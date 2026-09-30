# Plugin de WordPress · Pro Service Stock

Mantiene al día las fichas de coches de proservicerubi.com con la plataforma y añade el buscador con filtros.

## Por qué funciona así

La web ya tiene un tipo de contenido `coches`, con campos ACF y la taxonomía `marca`. Hay 30 fichas con URL `/coches/<nombre>/`, maquetadas con la plantilla del tema hijo e indexadas en Google.

El plugin no rehace nada de eso (5.2 del briefing): **rellena esos mismos posts**. Así se conservan el diseño, las URLs y el SEO, y Francesc puede seguir tocando la plantilla como hasta ahora.

```
API  ──feed público──►  plugin (cada 5 min)  ──►  posts «coches» + campos ACF + galería
                                                    │
                        [proservice_buscador]  ◄────┘  (lee los posts, no la API)
```

## Reglas que cumple

- **Solo toca los posts vinculados** (meta `_proservice_id`). Las fichas hechas a mano siguen igual hasta que alguien las vincula.
- **La URL no cambia nunca** una vez creada, aunque cambien la versión o el título.
- **Un coche que desaparece del feed pasa a borrador**, no se borra, y su URL redirige con un 301 al listado de coches.
- **Si la API falla o el feed llega vacío, no se retira nada.** Una caída de la API no puede vaciar la web. Para retirar todo a propósito: `wp proservice sync --forzar`.
- **Cada foto se descarga una sola vez** a la biblioteca de medios, y solo si viene del mismo servidor que la API. Como mucho baja 40 por pasada; el resto, en la siguiente.
- **Un coche sin cambios no se reescribe.** Se compara una huella de sus datos.
- **El buscador lee los posts, no la API**: si la API se cae, la web sigue enseñando el stock.

## Instalación en la web

1. Subir la carpeta `proservice-stock/` a `wp-content/plugins/` y activarla.
2. En `wp-config.php`:
   ```php
   define('PROSERVICE_API_URL', 'https://stock.proservicerubi.com/api');
   ```
3. **Ajustes → Pro Service Stock.** Abajo salen los campos ACF reales de «coches». Hay que ajustar el **mapa de campos** a esos nombres. Los que trae por defecto (`precio`, `anio`, `kilometros`…) son una suposición hecha sin acceso de administrador.
4. **Vincular las fichas actuales.** En cada coche hecho a mano, en la caja «Plataforma de stock», se pone el ID que tiene en la plataforma. También se puede hacer con `wp proservice vincular <post_id> <id>`. En la siguiente pasada el post toma los datos de la plataforma y conserva su URL.
5. **Buscador.** El shortcode `[proservice_buscador]` va en la página del listado. Dónde exactamente (la página `/coches/` actual o una nueva) lo decide Francesc con Diego.
6. **Cron de verdad.** WP-Cron solo se dispara cuando alguien visita la web. En el hosting, conviene poner `DISABLE_WP_CRON` y una tarea del sistema:
   ```
   */5 * * * * cd /ruta/a/wordpress && wp proservice sync --quiet
   ```

## Lo que necesita del feed

`GET {API}/publicacion/feed/web` devuelve una lista de coches con `id`, `referencia`, `estado`, `marca`, `modelo`, `version` y los datos técnicos. El dinero va en **céntimos** (`pvp_cent`). También entiende `pvp` en euros, de la API antigua.

**Pendiente en la API** (módulo `publicacion`): añadir al feed `fotos: [{ orden, url }]` con las fotos públicas y los extras. Mientras no vengan, el plugin no toca la galería que ya tenga cada post. Las URL de las fotos tienen que ir por el puerto 80, 443 u 8080: WordPress rechaza descargas de otros puertos.

## Órdenes de WP-CLI

```bash
wp proservice sync [--forzar]      # sincronizar ahora
wp proservice estado               # última pasada y coches vinculados
wp proservice vincular 123 7       # el post 123 pasa a ser el coche 7 de la plataforma
```

## Pendiente

- Nombres reales de los campos ACF y dónde guarda la plantilla la galería. Hace falta el acceso de administrador de Francesc.
- Que la plantilla del tema enseñe la cinta de «Reservado» y «Vendido». El dato ya se guarda en el campo `estado_venta`.
- Filtro por cuota mensual y calculadora: esperan el tipo de interés del cliente (duda E2).
- Formularios de la ficha hacia `POST /api/contactos`, cuando exista ese endpoint.

## Pruebas

Ver [pruebas/README.md](pruebas/README.md): un WordPress local con SQLite, una API falsa y 42 comprobaciones.
