# Flujo de ramas

- `main`: lo que está en producción. Solo entra desde `develop` y lo mergea Victor.
- `develop`: integración. Aquí se juntan los tres bloques.
- `feat/core-api` (Victor), `feat/panel-fotos` (Hafsa), `feat/web-portales` (David).

Para tareas sueltas dentro de un bloque, sacad ramas cortas desde la vuestra o desde `develop` (`feat/panel-fotos-subida`, `fix/estado-reservado`).

## Día a día

```bash
git checkout feat/panel-fotos
git pull
git merge origin/develop     # traer lo de los demás a menudo, mejor que un merge enorme al final
# ...trabajo...
git push
```

Cuando algo funciona, PR a `develop`. Victor revisa. Con `npm test` en verde.

## Zonas compartidas

- `api/src/schema.sql` es de Victor. Si necesitáis una columna, pedidla o proponedla en un PR pequeño aparte.
- Cada uno toca su módulo de la API: `modules/vehiculos` (Victor), `modules/fotos` (Hafsa), `modules/publicacion` (David).
