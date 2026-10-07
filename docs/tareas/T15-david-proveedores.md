# T15 · Campos nuevos de proveedores

**Quién:** David (con el OK de Victor: `terceros` es su módulo).
**Para cuándo:** después de T14, o antes si quieres algo corto para empezar.
**Qué aprendes:** a validar un IBAN con su dígito de control, igual que el NIF.

## Objetivo

Que el alta de un proveedor tenga lo mismo que en Pymecar (`docs/pymecar.md`, apartado «Proveedores»). Hoy nos faltan cinco campos.

## Ficheros

- `api/migraciones/NNNN_proveedores_pago.sql`, con el siguiente número libre en `develop`.
- `api/src/modules/terceros/campos.js` y `fiscal.js` (añadir, sin cambiar lo que hay).
- `api/test/terceros.test.js` (añadir tests).
- `docs/api.md`, sección «Clientes y proveedores».

## 1. La migración

```sql
ALTER TABLE proveedores ADD COLUMN clase TEXT NOT NULL DEFAULT 'proveedor' CHECK (clase IN ('proveedor','acreedor'));
ALTER TABLE proveedores ADD COLUMN movil TEXT;
ALTER TABLE proveedores ADD COLUMN iban TEXT;
ALTER TABLE proveedores ADD COLUMN forma_pago TEXT;
ALTER TABLE proveedores ADD COLUMN persona_contacto TEXT;
```

**Proveedor** es a quien se le compran coches; **acreedor**, quien da un servicio (gestoría, luz, publicidad).

## 2. Los campos

En `terceros/campos.js`:

- `export const FORMAS_PAGO = ['a_la_vista', 'contado', 'pago_30', 'pago_30_60', 'tarjeta', 'transferencia']`. Son las de Pymecar. Tu T14 también la usa.
- En `CAMPOS_PROVEEDOR`: `clase` (opciones), `movil` (como `telefono`), `iban`, `forma_pago` (opciones `FORMAS_PAGO`) y `persona_contacto` (texto de hasta 100).
- `clase` no puede quedar vacío, como `tipo`.

## 3. El IBAN (`fiscal.js`)

`ibanValido(texto)`, con el mismo estilo que `tipoNif`:

1. Quitar espacios y pasar a mayúsculas.
2. Dos letras, dos números y de 11 a 30 letras o números. Si el país es `ES`, 24 caracteres en total.
3. Pasar los cuatro primeros caracteres al final, cambiar cada letra por su número (A = 10 … Z = 35) y comprobar que el resultado módulo 97 da 1. El número es demasiado largo para JavaScript normal: hazlo por trozos (resto de 9 cifras en 9 cifras) o con `BigInt`.

Se guarda sin espacios. Uno mal escrito: 400 «El IBAN no es válido».

## 4. Tests

- `ES91 2100 0418 4502 0005 1332` es válido y se guarda como `ES9121000418450200051332`.
- Cambiar una cifra → 400.
- Un IBAN alemán válido (`DE89370400440532013000`) también vale.
- `forma_pago: 'cheque'` → 400. `clase: null` → 400.
- Un proveedor dado de alta antes sale con `clase: 'proveedor'`.

## Cómo sé que está bien

- `npm test` en verde, también los tests que ya había de clientes y proveedores.
- PR hacia `develop` con «T15». Victor lo revisa.
