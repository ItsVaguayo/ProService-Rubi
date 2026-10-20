#!/usr/bin/env bash
# Prepara un servidor limpio para la plataforma. UNA VEZ, como root, en Ubuntu 22.04 o 24.04:
#
#   curl -fsSLO https://raw.githubusercontent.com/ItsVaguayo/ProService-Rubi/main/deploy/preparar-servidor.sh
#   less preparar-servidor.sh                     # leerlo antes de lanzarlo
#   sudo bash preparar-servidor.sh stock.proservicerubi.com correo@para-avisos-de-certbot
#
# Se puede repetir: lo que ya está hecho no se rehace. Lo que hace:
#   - Paquetes: nginx, certbot, git, sqlite3, ufw y actualizaciones de seguridad automáticas.
#   - Node 22 oficial (con su suma de comprobación) en /usr/local.
#   - Usuario «proservice» y /srv/proservice (repo, versiones, datos y copias).
#   - /etc/proservice/proservice.env a partir de deploy/produccion.env.example (las claves se ponen a mano).
#   - Servicio de la API y copia diaria (systemd), sudo solo para reiniciar la API, y proservice-desplegar.
#   - Firewall: solo SSH, 80 y 443. La API escucha en 127.0.0.1.
#   - nginx y el certificado de Let's Encrypt, si el dominio ya apunta a este servidor.
# No toca la configuración de SSH: ver docs/despliegue.md (claves y quitar contraseñas).
set -euo pipefail

DOMINIO="${1:-}"; CORREO="${2:-}"
NODE_VERSION="22.23.3"
REPO_URL="https://github.com/ItsVaguayo/ProService-Rubi.git"
BASE=/srv/proservice

dice() { printf '\033[1m==> %s\033[0m\n' "$*"; }
falla() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || falla "Hay que lanzarlo como root (sudo bash $0 ...)"
[ -n "$DOMINIO" ] || falla "Uso: sudo bash $0 DOMINIO [CORREO_PARA_CERTBOT]"
. /etc/os-release
[ "$ID" = ubuntu ] || echo "Aviso: probado para Ubuntu; esto es $PRETTY_NAME"

dice "Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot git sqlite3 ufw curl ca-certificates xz-utils unattended-upgrades rclone >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null

dice "Node $NODE_VERSION"
if [ "$(/usr/local/bin/node -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
  case "$(uname -m)" in x86_64) ARQ=x64 ;; aarch64) ARQ=arm64 ;; *) falla "Arquitectura $(uname -m) sin probar" ;; esac
  TMP="$(mktemp -d)"; F="node-v$NODE_VERSION-linux-$ARQ.tar.xz"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$F" -o "$TMP/$F"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  ( cd "$TMP" && grep " $F\$" SHASUMS256.txt | sha256sum -c --quiet ) || falla "La suma de comprobación de Node no cuadra"
  tar -xJf "$TMP/$F" -C /usr/local --strip-components=1 --exclude='*.md' --exclude=LICENSE
  rm -rf "$TMP"
fi
/usr/local/bin/node -v

dice "Usuario proservice y carpetas"
id proservice >/dev/null 2>&1 || useradd --system --create-home --home-dir "$BASE" --shell /bin/bash proservice
# nginx (www-data) sirve el panel desde current/frontend: tiene que poder pasar por $BASE (711: pasar sin listar)
# y leer releases/. Los datos y las copias, solo para proservice.
install -d -o proservice -g proservice -m 711 "$BASE"
install -d -o proservice -g proservice -m 755 "$BASE/releases"
install -d -o proservice -g proservice -m 750 "$BASE/datos" "$BASE/datos/uploads" "$BASE/copias"
install -d -o proservice -g proservice -m 700 "$BASE/.ssh"
touch "$BASE/.ssh/authorized_keys"; chown proservice:proservice "$BASE/.ssh/authorized_keys"; chmod 600 "$BASE/.ssh/authorized_keys"
[ -d "$BASE/repo/.git" ] || sudo -u proservice git clone --quiet "$REPO_URL" "$BASE/repo"
sudo -u proservice git -C "$BASE/repo" fetch --quiet origin
sudo -u proservice git -C "$BASE/repo" checkout --quiet --detach origin/main
SRC="$BASE/repo/deploy"

dice "Configuración (.env de producción)"
install -d -o root -g proservice -m 750 /etc/proservice
if [ ! -f /etc/proservice/proservice.env ]; then
  sed "s#stock.proservicerubi.com#$DOMINIO#g" "$SRC/produccion.env.example" > /etc/proservice/proservice.env
  NUEVO_ENV=si
fi
chown root:proservice /etc/proservice/proservice.env; chmod 640 /etc/proservice/proservice.env

dice "Servicios"
install -m 644 "$SRC/systemd/proservice-api.service" "$SRC/systemd/proservice-copia.service" "$SRC/systemd/proservice-copia.timer" /etc/systemd/system/
install -m 755 "$SRC/desplegar.sh" /usr/local/bin/proservice-desplegar
SYSTEMCTL="$(command -v systemctl)"
cat > /etc/sudoers.d/proservice <<EOF
# proservice-desplegar reinicia la API; no puede hacer nada más como root.
proservice ALL=(root) NOPASSWD: $SYSTEMCTL restart proservice-api, $SYSTEMCTL status proservice-api
EOF
chmod 440 /etc/sudoers.d/proservice; visudo -cq
systemctl daemon-reload
systemctl enable --quiet proservice-api proservice-copia.timer
systemctl start proservice-copia.timer

dice "Firewall"
ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null; ufw status | head -n 8

dice "nginx y certificado"
install -d /var/www/certbot
rm -f /etc/nginx/sites-enabled/default
# Mientras no haya certificado, solo el bloque de HTTP (sirve la comprobación de Let's Encrypt)
CONF=/etc/nginx/sites-available/proservice
sed "s/DOMINIO_DEL_PANEL/$DOMINIO/g" "$SRC/nginx/proservice.conf" > "$CONF.completo"
if [ ! -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  awk 'BEGIN{n=0} /^server \{/{n++} n<=1' "$CONF.completo" > "$CONF"
  ln -sfn "$CONF" /etc/nginx/sites-enabled/proservice
  nginx -t -q && systemctl reload nginx
  IP="$(curl -fsS -4 https://ifconfig.me 2>/dev/null || true)"
  # ahostsv4: con «hosts» un dominio con IPv6 devuelve esa dirección y nunca cuadra con la IPv4
  if getent ahostsv4 "$DOMINIO" | awk '{print $1}' | grep -qxF "${IP:-x}"; then
    certbot certonly --webroot -w /var/www/certbot -d "$DOMINIO" --non-interactive --agree-tos \
      ${CORREO:+-m "$CORREO"} ${CORREO:---register-unsafely-without-email} \
      --deploy-hook "systemctl reload nginx"
  else
    echo "El dominio $DOMINIO aún no apunta a este servidor (${IP:-IP desconocida}). Cuando apunte, repetir este script."
  fi
fi
if [ -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  nginx -v 2>&1 | grep -qE 'nginx/1\.(2[5-9]|[3-9][0-9])' || sed -i 's/listen 443 ssl;/listen 443 ssl http2;/; /http2 on;/d' "$CONF.completo"
  mv "$CONF.completo" "$CONF"
  ln -sfn "$CONF" /etc/nginx/sites-enabled/proservice
  nginx -t -q && systemctl reload nginx
  echo "nginx con HTTPS para $DOMINIO"
fi
rm -f "$CONF.completo"

dice "Listo"
cat <<EOF

Falta, a mano (docs/despliegue.md):
  1. ${NUEVO_ENV:+Rellenar las claves de }/etc/proservice/proservice.env${NUEVO_ENV:+ (SMTP, WordPress…)}: sudo nano /etc/proservice/proservice.env
  2. Las claves SSH públicas de quien despliega en $BASE/.ssh/authorized_keys
  3. Primer despliegue:        sudo -iu proservice proservice-desplegar
  4. Usuario de gerencia:      sudo -iu proservice bash -c 'cd current/api && npm run usuario -- --email ... --nombre Jaume --rol gerencia'
  5. Comprobar:                curl -s https://$DOMINIO/api/salud
EOF
