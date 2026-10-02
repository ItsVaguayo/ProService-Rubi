# WordPress de pruebas · imitación de proservicerubi.com

Un WordPress aparte de la aplicación que se comporta como proservicerubi.com: lo que expone su API REST y lo que pintan sus páginas de coches. No lleva código de la aplicación. La API le habla igual que hablará con la web real, con un usuario **Editor** y una **contraseña de aplicación**. No hace falta ser administrador.

## Qué imita (comprobado el 1-oct-2026 contra https://proservicerubi.com)

**Su API REST**
- Tipo de contenido `coches` (rest_base `coches`). Por REST solo admite **título, slug, estado, plantilla y marca**. No tiene contenido, foto destacada ni campos personalizados.
- Taxonomía `marca`.
- Campos de ACF en un grupo **no expuesto en REST**: la clave `acf` sale vacía.
- Contraseñas de aplicación activas.

**Sus páginas** (carpeta `replica/`, ver más abajo)
- Tema `hello-biz` con un tema hijo que pinta `/coches/` y cada ficha con plantillas propias, no con Elementor.
- `/coches/`: portada, **su propio filtro** (precio máximo, potencia mínima y estado) que va por `admin-ajax.php` con la acción `filtrar_coches`, y tarjetas de 10 en 10.
- Ficha: portada con la primera foto, precio, «Desde X €/mes», galería con miniaturas y lightbox, ficha técnica de 6 datos (año, combustible, km, potencia, cilindrada, uso anterior), la sección de Jaume, la comparativa, las reseñas y **su formulario de prueba de conducción**.
- Valores con su texto: estado «En venta», «Reservado» o «Vendido»; combustible «Gasolina», «Diésel», «Híbrido»…

Los **nombres** de los campos ACF (`precio`, `cuota`, `estado`, `potencia`, `galeria`…) son una suposición sacada de sus etiquetas y de los parámetros de su filtro. Los reales se verán con el diagnóstico en cuanto haya credenciales y el grupo esté expuesto.

**Un campo que su web no tiene:** `referencia` (texto, `PS-00031`). Lo añade la imitación para que el formulario de la ficha del plugin diga a la API de qué coche se pregunta. En la real hay que pedir a Francesc que lo cree en el grupo (duda B16); sin él, el conector se lo salta y el formulario pone el coche en el mensaje.

## Lo que se vio en su web y conviene saber

- **El título grande de la ficha y el «Conoce el …» salen vacíos** en los coches revisados, y el **año** también. Su plantilla lee campos que hoy nadie rellena. En la réplica se supone que el título es el campo `modelo`.
- **Su filtro por potencia no funciona**: «mínimo 130 CV» devuelve 0 coches y hay un Kia Niro de 138 CV. El de precio sí funciona.
- **Todos sus coches están «En venta»** (30 de 30), aunque el campo admite «Reservado» y «Vendido».
- **La cuota «Desde X €/mes» es un dato que meten a mano.** La plataforma no la envía (depende del tipo de interés, duda E2), así que en los coches nuevos esa línea no saldría.
- **Su formulario de prueba de conducción** no se sabe adónde envía las solicitudes. En la réplica se guardan en la opción `replica_solicitudes` del WordPress de pruebas.

## Lo que esto significa para la web real

| Con un usuario Editor | Qué llega a la web |
|---|---|
| Hoy (ACF oculto en REST) | Título, estado (publicado o borrador) y marca |
| Si un administrador marca «Mostrar en la API REST» en el grupo de campos de ACF de «coches» | Además: precio, km, combustible, potencia, cilindrada, color, año, estado («En venta», «Reservado», «Vendido») y galería |

Esa casilla es la única acción de administrador que hace falta para que el precio y las fotos viajen solos.

Su web ya tiene listado y filtro propios, que funcionan con lo que manda la API si los nombres de los campos coinciden. El plugin `wp-plugin/` es opcional: añade un buscador con más filtros y el 301 de los coches retirados. Instalarlo sí requiere administrador una vez. Hoy, con ACF oculto, cualquiera de los dos solo podría filtrar por marca.

**Coches retirados.** Al vender o entregar un coche, la API pasa su post a borrador (nunca lo borra). Con el plugin instalado, su URL redirige con un 301 al listado. Sin el plugin daría 404.

## La réplica de sus plantillas

`replica/extraer.py` descarga su `/coches/` y la ficha del primer coche, y guarda en `replica/` el CSS, sus scripts y las partes fijas (portada, comparativa, reseñas, formulario). Las partes con datos (tarjetas, portada, galería, ficha técnica) las pintan `archivo.php` y `ficha.php` con el mismo HTML que su web. Si cambian su web, se vuelve a lanzar:

```bash
python3 wordpress-pruebas/replica/extraer.py && wordpress-pruebas/montar.sh
```

Comprobado el 1-oct: el listado y la ficha de la réplica tienen la misma estructura de bloques que los suyos. La única diferencia es la línea de la cuota, porque la plataforma no la manda. Su filtro AJAX responde igual (estado, precio y potencia) y el formulario rechaza el campo trampa como el suyo.

Las imágenes fijas (la foto de Jaume, los fondos) se cargan de su web, y Swiper, GLightbox y Font Awesome de sus CDN: para ver la réplica entera hace falta internet.

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

## Probar el formulario de la ficha

La ficha del plugin va apagada en la imitación (manda la de su web). Para probar su formulario contra la API de `npm run dev:pruebas`:

```bash
CORS_ORIGENES=http://localhost:8080 npm run dev:pruebas      # la API deja pasar a la réplica
wp --path=~/wp-proservice/web eval 'ProService_Ajustes::guardar(["api_url" => "http://localhost:3001", "ficha_propia" => true]);'
cd api && set -a && . ~/wp-proservice/web-credenciales.env && set +a
DB_PATH=./data/pruebas.db UPLOADS_PATH=./data/uploads-pruebas npm run wordpress -- sincronizar   # hasta «pendientes 0»
```

Abre una ficha (por ejemplo http://localhost:8080/coches/volkswagen-golf-2-0-tdi-life/), envía el formulario y el contacto sale en la página Contactos del panel con su coche. La API admite 5 envíos por IP cada 10 minutos; al reiniciar `dev:pruebas` el contador vuelve a cero.

## Para la web real

1. Francesc crea un usuario con rol **Editor** (o nos da uno) y, desde su perfil, una contraseña de aplicación.
2. Se ponen `WP_URL`, `WP_USUARIO` y `WP_CLAVE_APLICACION` en el `.env` de la API.
3. `npm run wordpress -- diagnostico`. Dice qué se puede escribir y qué campos del mapa existen. Si los nombres de ACF no coinciden, se ajusta `WP_MAPA`.
4. Se vinculan las 30 fichas que ya existen con sus coches (`vincular`) **antes** de la primera sincronización, para no duplicarlas y conservar sus URLs.
5. `sincronizar`.
