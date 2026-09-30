# ProService-Rubi

Plataforma de stock para Pro Service Rubí: el coche se da de alta una vez y sale en su web (WordPress) y en los portales, con costes y margen en la misma ficha.

Fecha objetivo: **31 de octubre de 2026** (no renuevan Pymecar).

## Estructura

```
api/         API Node + Express + SQLite       → Victor
panel/       Panel interno React + Vite        → Hafsa
wp-plugin/   Plugin para proservicerubi.com    → David
docs/        Reparto, flujo de git y resumen del briefing
```

## Arrancar

Node 18 o superior.

```bash
cp .env.example .env
npm install
npm run dev        # API en :3001 y panel en :5173
npm test           # tests de la API
```

El plugin se copia a `wp-content/plugins/` de un WordPress local y se usa con el shortcode `[proservice_stock]`.

## Documentación

- [Plan de trabajo](docs/plan.md) y [reparto resumido](docs/reparto.md)
- [Dudas abiertas con el cliente](docs/dudas.md)
- [Flujo de ramas](docs/flujo-git.md)
- [Resumen del briefing y dudas abiertas](docs/briefing.md)
- Briefing original: `Briefing-plataforma-vehiculos-ProService-Rubi.docx`
