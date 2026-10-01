# Plugin de WordPress · Pro Service Buscador

Buscador con filtros y ficha opcional para los coches de proservicerubi.com.

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
- **Diseño**: `assets/web.css` se genera desde `frontend/css` con `python3 wp-plugin/construir-css.py`, todo dentro de `.ps-web` para no chocar con el tema. No se edita a mano.
- **Ajustes → Pro Service Buscador**:
  - El **mapa de campos** (qué campo de la web tiene cada dato). Tiene que coincidir con el `WP_MAPA` de la API.
  - La lista de campos ACF del tipo `coches`, indicando si están expuestos en la API REST.
  - WhatsApp, página del listado (destino del 301 y de la miga de pan) y ficha propia.

## Instalación en la web

Instalar un plugin requiere **administrador** (una sola vez). La publicación de coches no: va por REST con un Editor.

1. Subir `proservice-stock/` a `wp-content/plugins/` y activarlo.
2. En **Ajustes → Pro Service Buscador**, ajustar el mapa a los nombres reales de los campos ACF.
3. Poner `[proservice_buscador]` en la página del listado.

## Pruebas

```bash
wp-plugin/pruebas/probar.sh
```

Hace una copia temporal del WordPress de pruebas (la imitación de `wordpress-pruebas/`), le pone el plugin, crea coches como los deja la API por REST y pasa 45 comprobaciones: buscador, caché, ficha, 301 y ajustes. El WordPress de pruebas no se toca.

## Versiones

- **0.4.1**: vuelve el 301 de los coches retirados, ahora sin depender de la plataforma: basta con que el post no esté publicado.
- **0.4.0**: la 0.3 leía un feed de la API cada 5 minutos y escribía ella los posts. Eso pasó a la API (vía REST), así que se quitaron la sincronización, las órdenes de WP-CLI y la caja de vincular. Si se actualiza encima de la 0.3, el plugin borra la tarea programada y entiende el mapa guardado.
