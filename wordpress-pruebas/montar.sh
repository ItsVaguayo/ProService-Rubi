#!/usr/bin/env bash
# Monta (o deja al día) el WordPress de pruebas que imita a proservicerubi.com.
# Es independiente de la aplicación: no lleva código nuestro. La API le habla solo por su API REST,
# con un usuario Editor y una contraseña de aplicación, igual que haría con la web real.
#
#   wordpress-pruebas/montar.sh              monta o actualiza
#   wordpress-pruebas/montar.sh --limpiar    además borra los coches y deja 3 fichas «hechas a mano»
#   wordpress-pruebas/montar.sh --nueva-clave  genera otra contraseña de aplicación
#   wordpress-pruebas/montar.sh --acf-rest si|no  simula que el grupo de ACF está (o no) expuesto en REST.
#                                               La web real hoy está en «no».
#
# Necesita PHP 8 (sqlite3, curl, mbstring, xml) y WP-CLI. Para servirlo:
#   PHP_CLI_SERVER_WORKERS=4 php -S localhost:8080 -t ~/wp-proservice/web
set -euo pipefail

W=${WP_PRUEBAS:-$HOME/wp-proservice/web}
URL=${WP_PRUEBAS_URL:-http://localhost:8080}
CREDENCIALES=${WP_PRUEBAS_CREDENCIALES:-$HOME/wp-proservice/web-credenciales.env}
DIR=$(cd "$(dirname "$0")" && pwd)
WP="$HOME/.local/bin/wp --path=$W"
LIMPIAR=0; NUEVA_CLAVE=0; ACF_REST=""
while [ $# -gt 0 ]; do
  case $1 in
    --limpiar) LIMPIAR=1 ;;
    --nueva-clave) NUEVA_CLAVE=1 ;;
    --acf-rest) shift; case ${1:-} in si) ACF_REST=true ;; no) ACF_REST=false ;; *) echo "--acf-rest si|no"; exit 1 ;; esac ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
  shift
done
wp_() { $WP "$@" 2> >(grep -v Deprecated >&2); }

echo "1/6 WordPress en $W"
if [ ! -f "$W/wp-load.php" ]; then
  wp_ core download --path="$W"
  curl -fsSL -o /tmp/sqlite-integracion.zip https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
  python3 -c "import zipfile; zipfile.ZipFile('/tmp/sqlite-integracion.zip').extractall('$W/wp-content/plugins')"
  sed "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$W/wp-content/plugins/sqlite-database-integration#;s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
      "$W/wp-content/plugins/sqlite-database-integration/db.copy" > "$W/wp-content/db.php"
  wp_ config create --dbname=wp --dbuser=x --dbpass=x --skip-check
  wp_ core install --url="$URL" --title="proservicerubi.com (imitación)" --admin_user=admin \
      --admin_password="$(openssl rand -base64 18)" --admin_email=admin@example.com --skip-email
fi

echo "2/6 Configuración"
# Las contraseñas de aplicación por http solo funcionan en un entorno «local».
wp_ config set WP_ENVIRONMENT_TYPE local --quiet
wp_ config has PS_ACF_EN_REST || wp_ config set PS_ACF_EN_REST false --raw --quiet
[ -n "$ACF_REST" ] && wp_ config set PS_ACF_EN_REST "$ACF_REST" --raw --quiet
wp_ rewrite structure '/%postname%/' --quiet

echo "3/6 Plugins y tema de la web real"
wp_ plugin is-installed advanced-custom-fields || wp_ plugin install advanced-custom-fields --quiet
wp_ plugin activate advanced-custom-fields --quiet
wp_ theme is-installed hello-biz || wp_ theme install hello-biz --quiet
wp_ theme activate hello-biz --quiet

echo "4/6 Separación: fuera el código de la aplicación"
if wp_ plugin is-installed proservice-stock; then
  wp_ plugin deactivate proservice-stock --quiet || true
  [ -L "$W/wp-content/plugins/proservice-stock" ] && rm "$W/wp-content/plugins/proservice-stock"
fi
mkdir -p "$W/wp-content/mu-plugins"
rm -f "$W/wp-content/mu-plugins/simula-proservicerubi.php"
# La página del buscador era del plugin: sin él solo enseñaría el shortcode
for p in $(wp_ post list --post_type=page --name=coches-de-ocasion --field=ID); do wp_ post delete "$p" --force --quiet; done
cp "$DIR/imita-proservicerubi.php" "$W/wp-content/mu-plugins/"
wp_ rewrite flush --quiet

echo "5/6 Usuario Editor y contraseña de aplicación"
wp_ user get editor-pruebas --field=ID > /dev/null 2>&1 || \
  wp_ user create editor-pruebas editor@pruebas.local --role=editor --user_pass="$(openssl rand -base64 18)" --quiet
if [ ! -f "$CREDENCIALES" ] || [ $NUEVA_CLAVE = 1 ]; then
  for uuid in $(wp_ user application-password list editor-pruebas --field=uuid 2>/dev/null); do
    wp_ user application-password delete editor-pruebas "$uuid" --quiet
  done
  clave=$(wp_ user application-password create editor-pruebas "API de pruebas" --porcelain)
  umask 077
  printf 'WP_URL=%s\nWP_USUARIO=editor-pruebas\nWP_CLAVE_APLICACION=%s\n' "$URL" "$clave" > "$CREDENCIALES"
  echo "   Credenciales en $CREDENCIALES"
fi

echo "6/6 Datos"
if [ $LIMPIAR = 1 ]; then
  for p in $(wp_ post list --post_type=coches --post_status=any --field=ID); do wp_ post delete "$p" --force --quiet; done
  for a in $(wp_ post list --post_type=attachment --field=ID); do wp_ post delete "$a" --force --quiet; done
  for t in $(wp_ term list marca --field=term_id); do wp_ term delete marca "$t" --quiet; done
  # Tres fichas «hechas a mano», como las 30 que tiene hoy la web real, para probar a vincularlas
  for t in "VOLKSWAGEN GOLF TDI 105CV FAMILIAR" "KIA NIRO HIBRIDO MODELO NUEVO AUTOMATICO" "CITROEN C3 GASOLINA 83CV ACABADO FEEL"; do
    wp_ post create --post_type=coches --post_status=publish --post_title="$t" --quiet
  done
fi
echo "Listo: $(wp_ post list --post_type=coches --post_status=publish --format=count) coches publicados · ACF en REST: $([ "$(wp_ config get PS_ACF_EN_REST)" = 1 ] && echo sí || echo no)"
