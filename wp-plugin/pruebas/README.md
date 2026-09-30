# Pruebas del plugin

Un WordPress local con SQLite (sin MySQL), una API falsa y un guion con 42 comprobaciones: alta, sin cambios, cambio de precio con URL fija, buscador y filtros, retirada con 301, API caída o vacía, fotos de otro servidor, límite de fotos por pasada, vincular fichas existentes y compatibilidad con la API antigua.

**El guion borra los coches vinculados y sus fotos.** Solo arranca si la web es `localhost` o `127.0.0.1`.

## Montarlo una vez (Linux o WSL)

Necesitas PHP 8 con `sqlite3`, `curl`, `mbstring` y `xml`, y [WP-CLI](https://wp-cli.org/).

```bash
W=~/wp-proservice/web
wp core download --path=$W
# Base de datos SQLite
cd $W/wp-content
curl -LO https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
unzip sqlite-database-integration.latest-stable.zip -d plugins
sed "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$W/wp-content/plugins/sqlite-database-integration#;s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
    plugins/sqlite-database-integration/db.copy > db.php
cd -
wp --path=$W config create --dbname=wp --dbuser=x --dbpass=x --skip-check
wp --path=$W core install --url=http://localhost:8080 --title=Local --admin_user=admin --admin_password=admin --admin_email=a@example.com --skip-email
wp --path=$W plugin install advanced-custom-fields --activate
wp --path=$W rewrite structure '/%postname%/'

# Lo que imita a proservicerubi.com (tipo «coches», taxonomía «marca», campos ACF de prueba)
mkdir -p $W/wp-content/mu-plugins
cp wp-plugin/pruebas/mu-plugin-local.php $W/wp-content/mu-plugins/
# El plugin, enlazado desde el repo
ln -s "$PWD/wp-plugin/proservice-stock" $W/wp-content/plugins/proservice-stock
wp --path=$W plugin activate proservice-stock
```

## Lanzarlas

Desde la raíz del repo:

```bash
python3 wp-plugin/pruebas/api_falsa.py &                      # API falsa en 127.0.0.1:3998
wp --path=~/wp-proservice/web eval-file wp-plugin/pruebas/prueba.php
```

Al final sale `42 comprobaciones, 42 bien, 0 fallos`.

Para verlo en el navegador: `php -S localhost:8080 -t ~/wp-proservice/web`, crea una página con `[proservice_buscador]` y ábrela.
