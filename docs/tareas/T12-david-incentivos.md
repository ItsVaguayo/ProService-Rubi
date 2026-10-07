# T12 · API de incentivos de los comerciales

**Quién:** David.
**Para cuándo:** después de T11.
**Qué aprendes:** a calcular dinero sin errores de redondeo y a esconder datos según quién pregunta.

## Objetivo

Cada mes, saber cuánto se le paga a cada comercial por lo que ha vendido. Gerencia pone la regla de cada uno, ve el cálculo de todos y lo liquida. El comercial solo ve lo suyo, y nunca el margen de cada coche.

La regla del cliente aún no la sabemos (duda H9). Por eso se hace configurable: sin regla, el incentivo es 0.

## Antes de empezar

1. `api/src/modules/informes/routes.js`: la consulta `ventasDelMes` ya sabe qué coches se vendieron en un mes y quién los pasó a «Vendido». No la copies: pide a Victor que la saque a una función que puedas importar (`ventasDelMes(db, mes)`).
2. `api/src/modules/margen.js`: hoy da el margen bruto. Victor está haciendo el margen neto (con REBU o IVA). Usa la función que haya; cuando salga la nueva, se cambia en una línea.
3. `docs/datos/margenes.csv` (de T10): casos del margen calculados a mano. Úsalos en tus tests.

## Ficheros

- `api/migraciones/NNNN_incentivos.sql` (número, el que te dé Victor).
- `api/src/modules/incentivos/calculo.js` y `api/src/modules/incentivos/routes.js` (el módulo es tuyo).
- `api/test/incentivos.test.js`.
- Una línea en `api/src/app.js` y una sección en `docs/api.md`.

## Pasos

### 1. Las tablas

```sql
CREATE TABLE incentivos_reglas (
  usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('porcentaje_margen','fijo_por_coche')),
  valor       INTEGER NOT NULL CHECK (valor >= 0),  -- porcentaje en centésimas (500 = 5 %) o céntimos por coche
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE incentivos_liquidados (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mes           TEXT NOT NULL,                      -- 'AAAA-MM'
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  coches        INTEGER NOT NULL,
  importe_cent  INTEGER NOT NULL,
  liquidado_por INTEGER NOT NULL REFERENCES usuarios(id),
  liquidado_en  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mes, usuario_id)                          -- un mes no se paga dos veces
);
```

¿Por qué el porcentaje en centésimas y el dinero en céntimos? Porque con decimales el ordenador falla: `0.1 + 0.2` no da `0.3`. Todo en enteros, y se redondea una sola vez, al final de cada coche, con `Math.round`.

### 2. El cálculo (`calculo.js`)

Una función `calcularIncentivos(db, mes)` que devuelve, por comercial:

```js
{ usuario_id, nombre, regla, coches: [{ id, referencia, margen_cent, incentivo_cent }], total_cent, liquidado }
```

- `porcentaje_margen`: incentivo = margen × valor ÷ 10.000. Con margen negativo o sin margen (`null`), 0.
- `fijo_por_coche`: incentivo = valor, por cada coche vendido.
- Sin regla: 0, pero el comercial sale igual en la lista con sus coches.
- `liquidado`: si ya hay fila en `incentivos_liquidados` para ese mes, su importe y su fecha.

### 3. Las rutas (`/api/incentivos`)

| Ruta | Quién | Qué hace |
|---|---|---|
| `GET /incentivos/reglas` | gerencia | La regla de cada usuario |
| `PUT /incentivos/reglas/:usuarioId` | gerencia | `{ tipo, valor }`. Guarda o cambia la regla |
| `GET /incentivos?mes=AAAA-MM` | los dos | Gerencia: todos. Comercial: solo él, y a cada coche se le quita `margen_cent` (el incentivo sí lo ve) |
| `POST /incentivos/liquidar` | gerencia | `{ mes, usuario_id }`: guarda lo calculado. Si ya estaba liquidado: 409. Un mes que no ha terminado: 409 |

Cuando exista la tabla de gastos (bloque 2, Victor), al liquidar se apunta también un gasto de categoría `comision`. Victor te dirá qué función llamar.

### 4. Los tests

- 5 % sobre un margen de 2.345,67 € da 117,28 € (compruébalo a mano).
- Margen negativo: 0.
- Fijo de 150 € con 3 coches: 450 €.
- El comercial no recibe `margen_cent` en ningún coche, y no ve a los demás comerciales.
- El comercial no puede cambiar reglas ni liquidar: 403.
- Liquidar dos veces el mismo mes: 409.

## Cómo sé que está bien

- `npm test` en verde.
- Ningún cálculo con decimales: todo `Number.isInteger`.
- PR hacia `develop` con «T12». Victor lo revisa.
