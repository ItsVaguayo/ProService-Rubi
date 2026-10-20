#!/usr/bin/env bash
# Vuelve a poner una copia de la base en su sitio. En el servidor, como el usuario proservice
# (preparar-servidor.sh lo instala como /usr/local/bin/proservice-restaurar):
#
#   proservice-restaurar                     enseña las copias que hay y no toca nada
#   proservice-restaurar ultima              la copia de anoche (copias/proservice-AAAA-MM-DD.db más nueva)
#   proservice-restaurar antes-de-migrar     la que hizo la migración antes de cargar (datos/*.antes-de-migrar-*)
#   proservice-restaurar antes-de-2ae193e    la de antes de desplegar esa versión
#   proservice-restaurar RUTA/a/copia.db     cualquier otra
#   … --con-fotos                            además, vuelve a traer las fotos de copias/uploads que falten
#
# Antes de tocar nada comprueba que la copia se abre y está sana. La base que había no se borra: queda en
# datos/descartada-FECHA.db, así que restaurar también se puede deshacer (restaurando esa).
set -euo pipefail

BASE="${PROSERVICE_BASE:-/srv/proservice}"
ENV_FILE="${PROSERVICE_ENV:-/etc/proservice/proservice.env}"
SYSTEMCTL="${PROSERVICE_SYSTEMCTL:-sudo systemctl}"
SERVICIO="${PROSERVICE_SERVICIO:-proservice-api}"
SALUD="${PROSERVICE_SALUD:-http://127.0.0.1:3001/api/salud}"

dice() { printf '\033[1m==> %s\033[0m\n' "$*"; }
falla() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }
valor() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }

[ -r "$ENV_FILE" ] || falla "No se puede leer $ENV_FILE"
DB="$(valor DB_PATH)"; FOTOS="$(valor UPLOADS_PATH)"; COPIAS="$(valor COPIAS_PATH)"
[ -n "$DB" ] || falla "DB_PATH vacío en $ENV_FILE"
DATOS="$(dirname "$DB")"

QUE=""; CON_FOTOS=""
for arg in "$@"; do
  if [ "$arg" = "--con-fotos" ]; then CON_FOTOS=si; else QUE="$arg"; fi
done

if [ -z "$QUE" ]; then
  echo "Copias que hay (de la más nueva a la más vieja):"
  ls -1t "$COPIAS"/proservice-*.db "$DATOS"/antes-de-*.db "$DATOS"/*.antes-de-migrar-* "$DATOS"/descartada-*.db 2>/dev/null \
    | while read -r f; do printf '  %s  %s  %s\n' "$(date -r "$f" '+%F %H:%M')" "$(du -h "$f" | cut -f1)" "$f"; done
  echo "Para restaurar una: proservice-restaurar ultima | antes-de-migrar | antes-de-COMMIT | RUTA [--con-fotos]"
  exit 0
fi

case "$QUE" in
  ultima) COPIA="$(ls -1t "$COPIAS"/proservice-*.db 2>/dev/null | head -n1 || true)" ;;
  antes-de-migrar) COPIA="$(ls -1t "$DATOS"/*.antes-de-migrar-* 2>/dev/null | head -n1 || true)" ;;
  antes-de-*) COPIA="$DATOS/$QUE.db" ;;
  *) COPIA="$QUE" ;;
esac
[ -n "${COPIA:-}" ] && [ -f "$COPIA" ] || falla "No encuentro la copia «$QUE»"

# Un solo despliegue o restauración a la vez
exec 9>"$BASE/.desplegando"
flock -n 9 || falla "Hay un despliegue o una restauración en marcha"

dice "Comprobando $COPIA"
RESUMEN="$(cd "$BASE/current/api" && node -e "
const db = require('better-sqlite3')(process.argv[1], { readonly: true, fileMustExist: true });
const ok = db.pragma('integrity_check', { simple: true });
if (ok !== 'ok') { console.error('integridad: ' + ok); process.exit(1); }
const n = (t) => db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n;
console.log(n('vehiculos') + ' coches, ' + n('clientes') + ' clientes, ' + n('facturas') + ' facturas, ' + n('usuarios') + ' usuarios');
" "$COPIA")" || falla "La copia no se puede abrir o está dañada: no se toca nada"
echo "   $RESUMEN"

if [ -t 0 ] && [ "${PROSERVICE_SIN_PREGUNTAR:-}" != "si" ]; then
  read -r -p "Se cambia la base de ahora por esta copia (la de ahora se guarda aparte). Escribe RESTAURAR para seguir: " RESP
  [ "$RESP" = "RESTAURAR" ] || falla "Cancelado: no se ha tocado nada"
fi

DESCARTADA="$DATOS/descartada-$(date +%Y%m%d-%H%M%S).db"
dice "Parando la API"
$SYSTEMCTL stop "$SERVICIO"
# Con la API parada, la de ahora se guarda con la copia de SQLite: un solo fichero con todo, también lo que
# estaba aún en el -wal (copiar el .db a pelo lo perdería, y restaurarla después no lo traería)
if [ -f "$DB" ]; then
  ( cd "$BASE/current/api" && node -e "require('better-sqlite3')(process.argv[1]).backup(process.argv[2]).then(() => {}, (e) => { console.error(e.message); process.exit(1); })" "$DB" "$DESCARTADA" ) \
    || { $SYSTEMCTL start "$SERVICIO"; falla "No se ha podido guardar la base de ahora: no se ha tocado nada (la API vuelve a arrancar)"; }
  echo "   La de ahora queda en $DESCARTADA"
fi
rm -f "$DB-wal" "$DB-shm"
cp "$COPIA" "$DB.restaurando" && mv -f "$DB.restaurando" "$DB"
if [ -n "$CON_FOTOS" ]; then
  dice "Trayendo las fotos que falten de $COPIAS/uploads"
  # Sin borrar: las fotos más nuevas que la copia se quedan (no estorban, la base ya no las nombra)
  cp -rn "$COPIAS/uploads/." "$FOTOS/"
fi

dice "Arrancando la API"
$SYSTEMCTL start "$SERVICIO"
for _ in $(seq 60); do
  if curl -fsS --max-time 2 "$SALUD" 2>/dev/null | grep -q '"ok":true'; then
    printf '%s\t%s\trestaurar\t%s\n' "$(date '+%F %T')" "${SUDO_USER:-$USER}" "$(basename "$COPIA")" >> "$BASE/despliegues.log"
    dice "Restaurada $(basename "$COPIA"). Para deshacerlo: proservice-restaurar $DESCARTADA"
    exit 0
  fi
  sleep 1
done
falla "La API no contesta con la copia restaurada. Mirar: journalctl -u $SERVICIO -n 50. La base de antes está en $DESCARTADA"
