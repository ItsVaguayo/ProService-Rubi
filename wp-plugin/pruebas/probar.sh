#!/usr/bin/env bash
# Pruebas del plugin sin tocar el WordPress de pruebas: hace una copia temporal de la imitación
# (wordpress-pruebas/), le pone el plugin del repo, pasa prueba.php y borra la copia.
#   wp-plugin/pruebas/probar.sh
set -euo pipefail
ORIGEN=${WP_PRUEBAS:-$HOME/wp-proservice/web}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
COPIA=$(mktemp -d)
trap 'rm -rf "$COPIA"' EXIT

# Sin las fotos subidas: no hacen falta y pesan
tar -C "$ORIGEN" --exclude=./wp-content/uploads -cf - . | tar -C "$COPIA" -xf -
# -n: la copia puede traer ya el enlace del WordPress de pruebas; sin él se crearía otro dentro del repo
ln -sfn "$REPO/wp-plugin/proservice-stock" "$COPIA/wp-content/plugins/proservice-stock"
WP="$HOME/.local/bin/wp --path=$COPIA"
$WP plugin activate proservice-stock --quiet 2>/dev/null
cd "$REPO"
PS_COPIA_DE_PRUEBAS=1 $WP eval-file wp-plugin/pruebas/prueba.php 2> >(grep -v Deprecated >&2)
