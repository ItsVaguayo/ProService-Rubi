# ProService-Rubi

Plataforma de stock para Pro Service Rubí: el coche se da de alta una vez y sale en su web (WordPress) y en los portales, con costes y margen en la misma ficha.

Arranque: **jueves 29 de octubre de 2026**. Pymecar vence el 31 y no lo renuevan.

## Estructura

```
api/         API Node + Express + SQLite       → Victor
frontend/    Maquetas HTML + CSS: panel y web  → los tres
wp-plugin/   Plugin para proservicerubi.com    → David
wordpress-pruebas/  Imitación de la web para probar la publicación por API REST
docs/        Reparto, flujo de git y resumen del briefing
```

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

El plugin rellena las fichas «coches» que ya tiene la web y añade el buscador `[proservice_buscador]`. Instalación, ajustes y pruebas en [wp-plugin/README.md](wp-plugin/README.md).

## Reglas de la API

- **Sesión obligatoria** en todo salvo `/api/salud` y `/api/auth/*`. La web recibe los coches por su API REST (`/api/wordpress`, ver `wordpress-pruebas/README.md`). Roles `gerencia` y `comercial`.
- **El dinero va en céntimos enteros**, con sufijo `_cent` (`pvp_cent: 1290000` son 12.900 €). Se pasa a euros solo al enseñarlo.
- **El comercial nunca recibe dinero interno**: la API quita compra, costes, precio mínimo, régimen de IVA, datos del dueño en depósito y margen. No basta con esconderlo en el panel.
- **Solo se escriben los campos de `api/src/modules/vehiculos/campos.js`**. Un campo que no esté ahí da 400. Para añadir uno: migración + `campos.js`.
- **Alta con matrícula, marca y modelo.** El resto se exige al pasar a «Publicado», junto con 15 fotos (`OBLIGATORIOS_PUBLICAR` y `FOTOS_MINIMAS`).
- **La base de datos se cambia con migraciones** numeradas en `api/migraciones/`. Se aplican solas al arrancar. Si tenías una base del antiguo `schema.sql`, bórrala (`api/data/proservice.db*`): solo tenía datos de prueba.
- **Cada alta, edición y cambio de estado queda en `auditoria`**, con usuario y valores de antes y después.

## Documentación

- **[Fichas de tareas: empezad por aquí](docs/tareas/README.md)**

- [Plan de trabajo](docs/plan.md) y [reparto resumido](docs/reparto.md)
- [Dudas abiertas con el cliente](docs/dudas.md)
- [Flujo de ramas](docs/flujo-git.md)
- [Resumen del briefing y dudas abiertas](docs/briefing.md)
- Briefing original: `Briefing-plataforma-vehiculos-ProService-Rubi.docx`
