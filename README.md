# ProService-Rubi

Plataforma de stock para Pro Service Rubí: el coche se da de alta una vez y sale en su web (WordPress) y en los portales, con costes y margen en la misma ficha.

Arranque: **jueves 29 de octubre de 2026**. Pymecar vence el 31 y no lo renuevan.

## Estructura

```
api/         API Node + Express + SQLite       → Victor
frontend/    Maquetas HTML + CSS: panel y web  → los tres
wp-plugin/   Plugin para proservicerubi.com    → David
docs/        Reparto, flujo de git y resumen del briefing
```

## Arrancar

Node 22 (mínimo 22.9).

```bash
cp .env.example .env
npm install
npm run dev        # API en :3001 y maquetas en :5173
npm run dev:front  # solo las maquetas
npm test           # tests de la API
```

El plugin rellena las fichas «coches» que ya tiene la web y añade el buscador `[proservice_buscador]`. Instalación, ajustes y pruebas en [wp-plugin/README.md](wp-plugin/README.md).

## Documentación

- **[Fichas de tareas: empezad por aquí](docs/tareas/README.md)**

- [Plan de trabajo](docs/plan.md) y [reparto resumido](docs/reparto.md)
- [Dudas abiertas con el cliente](docs/dudas.md)
- [Flujo de ramas](docs/flujo-git.md)
- [Resumen del briefing y dudas abiertas](docs/briefing.md)
- Briefing original: `Briefing-plataforma-vehiculos-ProService-Rubi.docx`
