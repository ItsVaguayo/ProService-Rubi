# WordPress de pruebas · imitación de proservicerubi.com

Un WordPress aparte de la aplicación, que se comporta como la web real vista desde su API REST. No lleva código nuestro: la API le habla igual que hablará con proservicerubi.com, con un usuario **Editor** y una **contraseña de aplicación**. No hace falta ser administrador.

## Qué imita (comprobado el 1-oct-2026 contra https://proservicerubi.com/wp-json)

- Tipo de contenido `coches` (rest_base `coches`). Por REST solo admite **título, slug, estado, plantilla y marca**. No tiene contenido, foto destacada ni campos personalizados.
- Taxonomía `marca`.
- Campos de ACF en un grupo **no expuesto en REST**: la clave `acf` sale vacía.
- Contraseñas de aplicación activas.
- Tema `hello-biz`, el mismo que usa la web.

Los nombres de los campos ACF (`precio`, `kilometros`, `galeria`…) son una suposición. Los reales se verán con el diagnóstico en cuanto haya credenciales.

## Lo que esto significa para la web real

| Con un usuario Editor | Qué llega a la web |
|---|---|
| Hoy (ACF oculto en REST) | Título, estado (publicado o borrador) y marca |
| Si un administrador marca «Mostrar en la API REST» en el grupo de campos de ACF de «coches» | Además: precio, km, datos técnicos, estado de venta y galería de fotos |

Esa casilla es la única acción de administrador que hace falta para que el precio y las fotos viajen solos.

El buscador con filtros es aparte: el plugin `wp-plugin/` (instalarlo sí requiere administrador una vez). No escribe coches, solo lee lo que deja la API. Hoy, con ACF oculto, solo podría filtrar por marca.

## Montarlo

Necesitas PHP 8 (con `sqlite3`, `curl`, `mbstring` y `xml`) y [WP-CLI](https://wp-cli.org/).

```bash
wordpress-pruebas/montar.sh --limpiar               # monta o deja al día; borra coches y crea 3 fichas «hechas a mano»
wordpress-pruebas/montar.sh --acf-rest si           # simula que alguien ha expuesto ACF en REST
wordpress-pruebas/montar.sh --acf-rest no           # como la web real hoy
wordpress-pruebas/montar.sh --con-buscador          # instala el plugin buscador y la página /coches-de-ocasion/
PHP_CLI_SERVER_WORKERS=4 php -S localhost:8080 -t ~/wp-proservice/web
```

El script crea el usuario `editor-pruebas` y guarda su contraseña de aplicación en `~/wp-proservice/web-credenciales.env` (solo legible por ti), con el formato que lee la API:

```
WP_URL=http://localhost:8080
WP_USUARIO=editor-pruebas
WP_CLAVE_APLICACION=xxxx xxxx xxxx xxxx xxxx xxxx
```

## Probar la API contra esta web

```bash
cd api
set -a; . ~/wp-proservice/web-credenciales.env; set +a
npm run wordpress -- diagnostico        # qué deja hacer la web, sin escribir nada
npm run wordpress -- vincular 3 1110    # el coche 3 es el post 1110 que ya existía (conserva su URL)
npm run wordpress -- sincronizar        # publica, actualiza y retira
npm run wordpress -- estado             # qué post es cada coche
```

Desde el panel (solo gerencia): `GET /api/wordpress/diagnostico`, `POST /api/wordpress/sincronizar`, `GET /api/wordpress/estado` y `POST /api/wordpress/vincular`. Con `WP_SINCRONIZAR_MINUTOS=5` la API publica sola cada 5 minutos.

## Para la web real

1. Francesc crea un usuario con rol **Editor** (o nos da uno) y, desde su perfil, una contraseña de aplicación.
2. Se ponen `WP_URL`, `WP_USUARIO` y `WP_CLAVE_APLICACION` en el `.env` de la API.
3. `npm run wordpress -- diagnostico`. Dice qué se puede escribir y qué campos del mapa existen. Si los nombres de ACF no coinciden, se ajusta `WP_MAPA`.
4. Se vinculan las 30 fichas que ya existen con sus coches (`vincular`) **antes** de la primera sincronización, para no duplicarlas.
5. `sincronizar`.
