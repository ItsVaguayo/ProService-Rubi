#!/usr/bin/env bash
# Despliega una versión del repo en el servidor de producción. Se lanza EN el servidor, como el usuario
# proservice (preparar-servidor.sh lo instala como /usr/local/bin/proservice-desplegar):
#
#   proservice-desplegar            despliega lo último de main
#   proservice-desplegar v1.2.0     una etiqueta o un commit concreto (de main, o avisa)
#   proservice-desplegar --volver   vuelve a la versión anterior
#   proservice-desplegar --estado   qué versión hay y las últimas desplegadas
#
# Qué hace, en orden, y dónde se para si algo va mal (sin tocar lo que está funcionando):
#   1. Baja el código de GitHub a una carpeta nueva en releases/ (la versión en marcha no se toca).
#   2. npm ci --omit=dev y npm test en esa carpeta. Si fallan, se para aquí.
#   3. Copia la base a datos/antes-de-<versión>.db (la API aplica las migraciones al arrancar).
#   4. Cambia el enlace «current» a la versión nueva y reinicia la API.
#   5. Espera a que /api/salud conteste. Si no contesta en 60 s, vuelve sola a la versión anterior.
#   6. Borra las versiones viejas (se quedan las 5 últimas) y lo apunta en despliegues.log.
#
# Las rutas y órdenes se pueden cambiar con variables PROSERVICE_* (para el ensayo sin root).
set -euo pipefail

BASE="${PROSERVICE_BASE:-/srv/proservice}"
ENV_FILE="${PROSERVICE_ENV:-/etc/proservice/proservice.env}"
REPO_URL="${PROSERVICE_REPO:-https://github.com/ItsVaguayo/ProService-Rubi.git}"
SYSTEMCTL="${PROSERVICE_SYSTEMCTL:-sudo systemctl}"
SERVICIO="${PROSERVICE_SERVICIO:-proservice-api}"
SALUD="${PROSERVICE_SALUD:-http://127.0.0.1:3001/api/salud}"
RAMA_BUENA="${PROSERVICE_RAMA:-main}"
GUARDAR=5

REPO="$BASE/repo"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
REGISTRO="$BASE/despliegues.log"

dice() { printf '\033[1m==> %s\033[0m\n' "$*"; }
falla() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
apuntar() { printf '%s\t%s\t%s\t%s\n' "$(date '+%F %T')" "${SUDO_USER:-$USER}" "$1" "$2" >> "$REGISTRO"; }
version_de() { basename "$(readlink -f "$1" 2>/dev/null || echo ninguna)"; }

salud() {
  for _ in $(seq 60); do
    if curl -fsS --max-time 2 "$SALUD" 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 1
  done
  return 1
}

cambiar_a() {
  # El enlace se cambia de golpe (rename), nunca hay un momento sin «current»
  ln -sfn "$1" "$CURRENT.nuevo"
  mv -T "$CURRENT.nuevo" "$CURRENT"
  $SYSTEMCTL restart "$SERVICIO"
}

[ -d "$BASE" ] || falla "No existe $BASE. ¿Se ha lanzado deploy/preparar-servidor.sh?"
[ -r "$ENV_FILE" ] || falla "No se puede leer $ENV_FILE"
mkdir -p "$RELEASES"

# Un solo despliegue a la vez
exec 9>"$BASE/.desplegando"
flock -n 9 || falla "Ya hay un despliegue en marcha"

case "${1:-}" in
  --estado)
    echo "En marcha: $(version_de "$CURRENT")"
    echo "Anterior:  $(version_de "$BASE/anterior")"
    echo "Últimos despliegues:"; tail -n 8 "$REGISTRO" 2>/dev/null || echo "  (ninguno)"
    exit 0 ;;
  --volver)
    [ -L "$BASE/anterior" ] || falla "No hay versión anterior a la que volver"
    destino="$(readlink -f "$BASE/anterior")"; actual="$(readlink -f "$CURRENT")"
    dice "Volviendo de $(basename "$actual") a $(basename "$destino")"
    cambiar_a "$destino"
    ln -sfn "$actual" "$BASE/anterior"
    salud || falla "La versión anterior tampoco contesta en $SALUD. Mirar: journalctl -u $SERVICIO -n 50"
    apuntar "--volver" "$(basename "$destino")"
    dice "Hecho. Si la versión nueva cambió la base (migraciones), la copia de antes está en $BASE/datos/antes-de-*.db"
    exit 0 ;;
esac

REF="${1:-$RAMA_BUENA}"

# 1. El código
dice "Bajando $REF de GitHub"
if [ ! -d "$REPO/.git" ]; then git clone --quiet "$REPO_URL" "$REPO"; fi
git -C "$REPO" fetch --quiet --tags --prune origin
if git -C "$REPO" rev-parse --verify --quiet "origin/$REF^{commit}" >/dev/null; then
  SHA="$(git -C "$REPO" rev-parse "origin/$REF")"
else
  SHA="$(git -C "$REPO" rev-parse --verify --quiet "$REF^{commit}")" || falla "No existe $REF en el repo"
fi
CORTO="${SHA:0:7}"
if ! git -C "$REPO" merge-base --is-ancestor "$SHA" "origin/$RAMA_BUENA"; then
  [ "${PROSERVICE_PERMITIR_OTRA_RAMA:-}" = "si" ] || falla "$CORTO no está en $RAMA_BUENA. A producción solo va lo que está en $RAMA_BUENA (PROSERVICE_PERMITIR_OTRA_RAMA=si para saltarlo)"
fi
if [ "$(version_de "$CURRENT")" != "ninguna" ] && [[ "$(version_de "$CURRENT")" == *"-$CORTO" ]]; then
  dice "$CORTO ya es la versión en marcha. Nada que hacer."; exit 0
fi

NUEVA="$RELEASES/$(date +%Y%m%d-%H%M%S)-$CORTO"
mkdir -p "$NUEVA"
git -C "$REPO" archive "$SHA" | tar -x -C "$NUEVA"
chmod 755 "$NUEVA"; chmod -R a+rX "$NUEVA/frontend"   # nginx lee el panel de aquí, con el umask que tenga quien despliega
ln -sfn "$ENV_FILE" "$NUEVA/.env"     # los npm run (copia, usuario, migrar, wordpress) leen ../.env

# 2. Dependencias y tests, sin tocar lo que está en marcha
dice "Instalando dependencias"
( cd "$NUEVA" && npm ci --omit=dev --no-audit --no-fund --loglevel=error ) || { rm -rf "$NUEVA"; falla "npm ci ha fallado"; }
if [ "${PROSERVICE_SIN_TESTS:-}" != "si" ]; then
  dice "Pasando los tests"
  # Los tests usan bases en memoria y carpetas temporales: no tocan los datos de verdad
  ( cd "$NUEVA" && env -u DB_PATH -u UPLOADS_PATH -u COPIAS_PATH npm test --silent >"$NUEVA/tests.log" 2>&1 ) \
    || { grep -E "^not ok|^# (pass|fail)" "$NUEVA/tests.log" | grep -v "^not ok [0-9]* - .*\.test\.js$" | head -n 20; rm -rf "$NUEVA"; falla "Los tests fallan: no se despliega"; }
  grep -E '^# (pass|fail)' "$NUEVA/tests.log" | tr '\n' ' '; echo
fi

# 3. Copia de la base antes de que la versión nueva aplique sus migraciones
DB_PATH_ENV="$(grep -E '^DB_PATH=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
if [ -n "$DB_PATH_ENV" ] && [ -f "$DB_PATH_ENV" ]; then
  COPIA="$(dirname "$DB_PATH_ENV")/antes-de-$CORTO.db"
  dice "Copiando la base a $COPIA"
  ( cd "$NUEVA/api" && node -e "require('better-sqlite3')(process.argv[1], { readonly: true }).backup(process.argv[2]).then(() => {}, (e) => { console.error(e.message); process.exit(1); })" "$DB_PATH_ENV" "$COPIA" ) \
    || { rm -rf "$NUEVA"; falla "No se ha podido copiar la base"; }
  # Solo las 5 últimas copias de antes de desplegar
  ls -1t "$(dirname "$DB_PATH_ENV")"/antes-de-*.db 2>/dev/null | tail -n +$((GUARDAR + 1)) | xargs -r rm -f
fi

# 4. Cambio de versión
ANTES=""; [ -L "$CURRENT" ] && ANTES="$(readlink -f "$CURRENT")"   # en el primer despliegue no hay anterior
dice "Arrancando $(basename "$NUEVA")"
cambiar_a "$NUEVA"

# 5. ¿Contesta?
if salud; then
  [ -n "$ANTES" ] && ln -sfn "$ANTES" "$BASE/anterior"
  apuntar "$REF" "$(basename "$NUEVA")"
  dice "En marcha: $(basename "$NUEVA")"
else
  apuntar "$REF" "$(basename "$NUEVA") FALLÓ"
  if [ -n "$ANTES" ]; then
    printf '\033[31mLa versión nueva no contesta en %s. Volviendo a %s\033[0m\n' "$SALUD" "$(basename "$ANTES")" >&2
    cambiar_a "$ANTES"
    salud && echo "La anterior vuelve a estar en marcha." || echo "TAMPOCO contesta la anterior: mirar journalctl -u $SERVICIO -n 50" >&2
    [ -n "${COPIA:-}" ] && echo "Si la nueva llegó a migrar la base, la copia de antes es $COPIA" >&2
  fi
  falla "Despliegue fallido. Registro: journalctl -u $SERVICIO -n 50"
fi

# 6. Limpieza: se quedan las 5 últimas versiones, nunca la que está en marcha ni la anterior
ls -1d "$RELEASES"/*/ 2>/dev/null | sort -r | tail -n +$((GUARDAR + 1)) | while read -r vieja; do
  vieja="${vieja%/}"
  [ "$vieja" = "$(readlink -f "$CURRENT")" ] || [ "$vieja" = "$(readlink -f "$BASE/anterior" 2>/dev/null)" ] || rm -rf "$vieja"
done
