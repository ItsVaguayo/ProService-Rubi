# ProService-Rubi

Plataforma de stock para Pro Service Rubí: el coche se da de alta una vez y sale en su web (WordPress) y en los portales, con costes y margen en la misma ficha.

Arranque: **jueves 29 de octubre de 2026**. Pymecar vence el 31 y no lo renuevan.

## Estructura

```
api/                API Node + Express + SQLite; publica en la web por su API REST  → Victor y David
frontend/           Panel y web en HTML + CSS (panel.js lo conecta a la API)         → los tres
wp-plugin/          Plugin buscador para proservicerubi.com                         → David
wordpress-pruebas/  Imitación de proservicerubi.com para probar la publicación      → David
docs/               Reparto, flujo de git, dudas y resumen del briefing
```

## Cómo llegan los coches a la web

```
Panel ──► API (única dueña de los datos) ──REST, usuario Editor──► WordPress de la web
                                                                    · posts «coches»: título, estado, marca
                                                                    · campos ACF: precio, datos, galería (*)
                                                                    · plugin buscador: filtros, ficha y 301
```

- **La API publica en WordPress por su API REST** con un usuario Editor y una contraseña de aplicación. No hace falta administrador para publicar. Código en `api/src/modules/publicacion/wordpress.js`; guía completa en [wordpress-pruebas/README.md](wordpress-pruebas/README.md).
- **(*) Los campos de ACF** solo viajan si el grupo de campos está expuesto en la API REST. En proservicerubi.com hoy no lo está: hace falta que un administrador marque «Mostrar en la API REST» una vez. Mientras, llegan título, estado y marca.
- **Un coche vendido o entregado pasa a borrador**, nunca se borra. Su URL redirige con un 301 al listado gracias al plugin.
- **Su web ya tiene listado, filtro y ficha propios** en su tema hijo, que pintan los campos que deja la API. El valor del estado va con su texto («En venta», «Reservado», «Vendido»): la API lo traduce.
- **El plugin buscador** (`wp-plugin/`) es opcional y no escribe coches: añade `[proservice_buscador]` con más filtros, la ficha con el diseño de la maqueta y el 301. Instalarlo requiere administrador una vez. Detalles en [wp-plugin/README.md](wp-plugin/README.md).
- **Para probarlo sin la web real**: `wordpress-pruebas/montar.sh` monta una réplica con el mismo esquema REST y las mismas plantillas de coches.

## Arrancar

Node 22 (mínimo 22.9).

```bash
cp .env.example .env
npm install
npm run usuario --workspace api -- --email tu@correo.com --nombre Tu --rol gerencia
npm run dev        # API en :3001 y maquetas en :5173
npm run dev:front  # solo las maquetas
npm test           # tests de la API
```

Para trabajar con datos de prueba sin tocar la base real:

```bash
npm run seed         # crea api/data/pruebas.db: 12 coches, fotos, una reserva, contactos y dos usuarios
npm run dev:pruebas  # API con esa base y el panel en http://localhost:3001/panel/login.html
                     # jaume@pruebas.local (gerencia) o comercial@pruebas.local, contraseña pruebas-local-123
```

Todas las rutas de la API, con quién puede usarlas y sus errores: [docs/api.md](docs/api.md).

Publicar en la web (con `WP_URL`, `WP_USUARIO` y `WP_CLAVE_APLICACION` en el `.env`):

```bash
npm run wordpress --workspace api -- diagnostico   # qué deja hacer la web, sin escribir nada
npm run wordpress --workspace api -- sincronizar   # publica, actualiza y retira
```

## Reglas de la API

- **Sesión obligatoria** en todo salvo `/api/salud`, `/api/auth/*` y `POST /api/contactos` (el formulario de la web). Roles `gerencia` y `comercial`. Usuarios (`/api/usuarios`) y publicación en la web (`/api/wordpress/*`) son solo de gerencia.
- **El dinero va en céntimos enteros**, con sufijo `_cent` (`pvp_cent: 1290000` son 12.900 €). Se pasa a euros solo al enseñarlo.
- **El comercial nunca recibe dinero interno**: la API quita compra, costes, precio mínimo, régimen de IVA, datos del dueño en depósito, proveedor y margen. No basta con esconderlo en el panel.
- **Solo se escriben los campos de `api/src/modules/vehiculos/campos.js`**. Un campo que no esté ahí da 400. Para añadir uno: migración + `campos.js`.
- **Alta con matrícula, marca y modelo.** El resto se exige al pasar a «Publicado», junto con 15 fotos (`OBLIGATORIOS_PUBLICAR` y `FOTOS_MINIMAS`).
- **La base de datos se cambia con migraciones** numeradas en `api/migraciones/`. Se aplican solas al arrancar. Si tenías una base del antiguo `schema.sql`, bórrala (`api/data/proservice.db*`): solo tenía datos de prueba.
- **Cada alta, edición y cambio de estado queda en `auditoria`**, con usuario y valores de antes y después.
- **Qué post de WordPress es cada coche** se guarda en `wp_posts`, y qué foto subida en `wp_medios`: cada foto se sube una vez y un coche sin cambios no se reenvía.

## Documentación

- **[Fichas de tareas: empezad por aquí](docs/tareas/README.md)**

- [Plan de trabajo](docs/plan.md) y [reparto resumido](docs/reparto.md)
- [Dudas abiertas con el cliente](docs/dudas.md)
- [Flujo de ramas](docs/flujo-git.md)
- [Resumen del briefing y dudas abiertas](docs/briefing.md)
- Briefing original: `Briefing-plataforma-vehiculos-ProService-Rubi.docx`
