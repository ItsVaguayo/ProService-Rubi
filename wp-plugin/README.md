# Plugin de WordPress · Pro Service Buscador

Buscador con filtros y ficha opcional para los coches de proservicerubi.com.

Ojo: su web ya tiene listado y filtro propios en `/coches/` (precio máximo, potencia mínima y estado), pintados por su tema hijo. Este plugin es opcional: añade un buscador con todos los filtros de la 5.4, la ficha con el diseño de la maqueta y el 301 de los coches retirados. Lo del 301 no lo tiene su tema.

**El plugin no publica coches.** Los publica la API de la plataforma por la API REST de WordPress, con un usuario Editor y una contraseña de aplicación (`api/src/modules/publicacion/wordpress.js`, guía en `wordpress-pruebas/README.md`). El plugin solo lee lo que la API deja en los posts `coches`: título, marca y campos de ACF.

```
API ──REST (usuario Editor)──► posts «coches» + marca + campos ACF + fotos
                                        │
              [proservice_buscador] ◄───┘  la ficha, si se activa, y el 301 de los retirados
```

## Qué trae

- **`[proservice_buscador]`**: los filtros de la 5.4 (marca, modelo, precio, km, año, combustible, cambio, carrocería, etiqueta DGT, color, plazas), orden, cintas de «Reservado» y «Vendido», y paginación. Funciona sin JavaScript: cada búsqueda tiene su URL.
  - Un filtro del que la web no tenga datos no se enseña.
  - Con `cabecera="si"` pinta también el título de la maqueta.
- **301 de los coches retirados.** Cuando la API vende o entrega un coche, pasa su post a borrador. Su URL (`/coches/<nombre>/`) está indexada y daría 404, así que el plugin la manda con un 301 a la página del listado. Una URL que nunca existió, o un coche borrado a mano en WordPress, siguen dando 404.
- **Ficha del coche** con el diseño de `frontend/web/coche.html`. Va apagada por defecto, porque en la web real manda la plantilla del tema hijo. Se activa en Ajustes.
- **Formulario «Pregúntanos por este coche»** en esa ficha. Manda el contacto a `POST /api/contactos` de la plataforma (nombre, teléfono, tipo, coche, mensaje y privacidad) y sale en la página Contactos del panel.
  - La dirección de la API se pone en Ajustes. Sin ella, la ficha no enseña el formulario ni los botones «Pedir prueba», «Financiarlo» y «Tasar mi coche», que dejan elegido el tipo.
  - El coche va por su referencia (`PS-00031`), que la API deja en el campo `referencia`. Su web no tiene ese campo (duda B16): mientras no exista, el formulario pone en el mensaje el título y la dirección de la ficha.
  - Campo trampa `web`, fuera de la pantalla con CSS (no `type="hidden"`), con `tabindex="-1"` y `autocomplete="off"`. La API descarta los envíos que lo traen relleno.
  - Avisos de enviado, de dato mal puesto (el texto que devuelve la API), de demasiados envíos (429) y de error de conexión.
  - La API tiene que tener el dominio de la web en `CORS_ORIGENES`.
- **Diseño**: `assets/web.css` se genera desde `frontend/css` con `python3 wp-plugin/construir-css.py`, todo dentro de `.ps-web` para no chocar con el tema. No se edita a mano.
- **Ajustes → Pro Service Buscador**:
  - El **mapa de campos** (qué campo de la web tiene cada dato). Tiene que coincidir con el `WP_MAPA` de la API. Por defecto usa los nombres de la réplica de su web; el estado guarda su texto («En venta», «Reservado», «Vendido») y la cuota sale como «Desde X €/mes».
  - La lista de campos ACF del tipo `coches`, indicando si están expuestos en la API REST.
  - Dirección de la API (para el formulario), WhatsApp, página del listado (destino del 301 y de la miga de pan) y ficha propia.

## Instalación en la web

Instalar un plugin requiere **administrador** (una sola vez). La publicación de coches no: va por REST con un Editor.

1. Subir `proservice-stock/` a `wp-content/plugins/` y activarlo.
2. En **Ajustes → Pro Service Buscador**, ajustar el mapa a los nombres reales de los campos ACF y poner la dirección de la API.
3. Poner `[proservice_buscador]` en la página del listado.

## Pruebas

```bash
wp-plugin/pruebas/probar.sh
```

Hace una copia temporal del WordPress de pruebas (la imitación de `wordpress-pruebas/`), le pone el plugin, crea coches como los deja la API por REST y pasa 59 comprobaciones: buscador, caché, ficha y su formulario, 301 y ajustes. El WordPress de pruebas no se toca.

## Versiones

- **0.5.0**: el formulario de la ficha envía a la API (`POST /api/contactos`), con campo trampa. Vuelve el ajuste de la dirección de la API y la referencia entra en el mapa.
- **0.4.1**: vuelve el 301 de los coches retirados, ahora sin depender de la plataforma: basta con que el post no esté publicado.
- **0.4.0**: la 0.3 leía un feed de la API cada 5 minutos y escribía ella los posts. Eso pasó a la API (vía REST), así que se quitaron la sincronización, las órdenes de WP-CLI y la caja de vincular. Si se actualiza encima de la 0.3, el plugin borra la tarea programada y entiende el mapa guardado.
