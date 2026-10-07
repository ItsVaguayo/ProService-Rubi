# T14 · API de gastos (el libro de gastos)

**Quién:** David.
**Para cuándo:** cuanto antes.
**Qué aprendes:** a llevar un libro registro: números correlativos sin huecos, importes que se calculan en el servidor y reglas que dependen del tipo.

## Objetivo

La API para apuntar los gastos de la empresa como hoy en Pymecar (lee antes `docs/pymecar.md`, apartado «Libros»). Con ella:
- la página `gastos.html` de Hafsa tiene de dónde leer;
- tu T12 apunta el gasto al liquidar un incentivo (tu `TODO(Victor)`, ahora es tuyo);
- Victor, más adelante, suma al coste de cada coche sus gastos y saca el margen neto. **Eso no es tuyo:** tú no tocas `margen.js` ni la ficha del coche.

## Antes de empezar

1. `docs/pymecar.md`: libro de gastos, tipos y conceptos.
2. Tu propio módulo `api/src/modules/crm/`: el patrón es el mismo.
3. `api/src/modules/terceros/campos.js`: `FORMAS_PAGO` la crea la T15; si haces antes la T14, define la lista en tu módulo y la mueves después.

## Ficheros

- `api/migraciones/NNNN_gastos.sql`, con el siguiente número libre en `develop`.
- `api/src/modules/gastos/campos.js`, `calculo.js`, `apuntar.js` y `routes.js` (el módulo es tuyo).
- `api/test/gastos.test.js`.
- Una línea en `app.js` (solo gerencia: `requiereRol('gerencia')`, como proveedores) y una sección en `docs/api.md`.

## 1. La tabla

```sql
CREATE TABLE gastos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  numero            INTEGER NOT NULL UNIQUE,      -- nº de registro del libro, correlativo, sin huecos
  fecha             TEXT NOT NULL,                -- 'AAAA-MM-DD', la de la factura
  tipo              TEXT NOT NULL CHECK (tipo IN ('general','irpf','comision','rebu','vehiculo')),
  concepto          TEXT NOT NULL CHECK (concepto IN ('alquileres','carburantes','comisiones','compras',
                      'electricidad','gestorias','papelerias','publicidad','vehiculos')),
  descripcion       TEXT,                         -- «Observaciones» en Pymecar
  factura_proveedor TEXT,                         -- el número de su factura: «F-26-000153»
  proveedor_id      INTEGER REFERENCES proveedores(id),
  cliente_id        INTEGER REFERENCES clientes(id),
  usuario_id        INTEGER REFERENCES usuarios(id),  -- el comercial, en los incentivos
  vehiculo_id       INTEGER REFERENCES vehiculos(id),
  base_cent         INTEGER NOT NULL CHECK (base_cent >= 0),
  iva_pct           INTEGER NOT NULL DEFAULT 21 CHECK (iva_pct IN (0, 4, 10, 21)),
  iva_cent          INTEGER NOT NULL,
  irpf_pct          INTEGER NOT NULL DEFAULT 0 CHECK (irpf_pct IN (0, 7, 15, 19)),
  irpf_cent         INTEGER NOT NULL,
  total_cent        INTEGER NOT NULL,             -- base + IVA − IRPF: lo que se paga
  forma_pago        TEXT,
  pagado_en         TEXT,                         -- vacío = sin pagar
  creado_por        INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX gastos_fecha ON gastos (fecha);
CREATE INDEX gastos_vehiculo ON gastos (vehiculo_id);
```

Los porcentajes de IRPF son los que tiene configurados Pymecar: 7, 15 y 19 %.

## 2. Cálculo (`calculo.js`)

- `iva_cent = Math.round(base_cent × iva_pct ÷ 100)`
- `irpf_cent = Math.round(base_cent × irpf_pct ÷ 100)`
- `total_cent = base_cent + iva_cent − irpf_cent`
- **Siempre en el servidor.** Si en el cuerpo llegan `iva_cent`, `irpf_cent` o `total_cent`: 400. Al editar la base o un porcentaje, se recalcula.

## 3. Reglas por tipo

| Tipo | Regla |
|---|---|
| `general` | `irpf_pct` = 0 |
| `irpf` | `irpf_pct` > 0 (por defecto 15; 19 si el concepto es `alquileres`) |
| `comision` | Hace falta `proveedor_id` (un comisionista) **o** `usuario_id` (un comercial, desde tu T12) |
| `rebu` | Compra de un coche a otro compraventa en REBU: `vehiculo_id` obligatorio, `iva_pct` e `irpf_pct` = 0 |
| `vehiculo` | `vehiculo_id` obligatorio (taller, transporte, ITV…) |

Si no llega `tipo`, sale del concepto: `alquileres` y `gestorias` → `irpf`; `comisiones` → `comision`; `vehiculos` → `vehiculo`; `compras` → `rebu`; el resto → `general`.

## 4. El número de registro (`apuntar.js`)

`apuntarGasto(db, datos, usuarioId)` hace el alta entera dentro de **una transacción**: calcula, valida las reglas, pone `numero = MAX(numero) + 1` (1 si no hay ninguno), inserta y llama a `registrar()`. Así dos altas a la vez nunca cogen el mismo número. La usan el `POST` y tu T12.

Al migrar desde Pymecar, Victor cargará los gastos antiguos con sus números (van por el 313); los nuevos siguen solos desde el último.

## 5. Rutas (`/api/gastos`, solo gerencia)

| Ruta | Qué hace |
|---|---|
| `GET /gastos?mes=AAAA-MM` | Los del mes (por defecto, el actual), del más reciente al más antiguo. Filtros: `tipo`, `concepto`, `vehiculo`, `pagado=1/0`. Devuelve `{ gastos, totales }`: `totales` por tipo y el total del mes (base, IVA, IRPF y total), y lo que falta por pagar |
| `GET /gastos/:id` | Uno, con el nombre del proveedor, cliente o comercial y el coche |
| `POST /gastos` | Alta con `apuntarGasto`. 201 |
| `PUT /gastos/:id` | Cambia lo que llegue, recalcula y vuelve a comprobar las reglas. El `numero` no se cambia nunca |
| `PATCH /gastos/:id/pagado` | `{ pagado: true, forma_pago? }` pone la fecha de hoy; `{ pagado: false }` la quita |

Sin `DELETE`: un libro registro no se borra. Si un gasto está mal, se corrige con `PUT`.

## 6. Tu T12

En `incentivos/routes.js`, al liquidar con importe mayor que 0: `apuntarGasto` con tipo `comision`, concepto `comisiones`, `usuario_id` del comercial, `iva_pct` 0 y la descripción «Incentivo de {nombre}, {mes}», todo en la misma transacción que la liquidación. Quita el `TODO(Victor)`.

## 7. Tests (mínimo)

- 100,00 € con 21 % de IVA y 15 % de IRPF: IVA 21,00, IRPF 15,00, total 106,00. Compruébalo a mano.
- 33,33 € con 21 %: IVA 7,00 (6,9993 redondeado).
- Numeración: tres altas seguidas → 1, 2, 3. Editar no cambia el número.
- Reglas: `vehiculo` sin coche, `irpf` con 0 %, `rebu` con IVA y `comision` sin nadie → 400.
- Sin `tipo`, con concepto `alquileres` → tipo `irpf` y 19 %.
- Mandar `total_cent` en el cuerpo → 400.
- El comercial: 403 en todas las rutas.
- Liquidar un incentivo de 150 € crea un gasto de 150 € de tipo `comision` con el `usuario_id` del comercial; liquidar uno de 0 € no crea nada.
- `?mes=` y `?pagado=0` filtran bien, y los totales cuadran con la suma de la lista.

## Cómo sé que está bien

- `npm test` en verde.
- Ningún importe calculado fuera del servidor, todo en enteros.
- PR hacia `develop` con «T14». Victor lo revisa.
