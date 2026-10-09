# Migración desde Pymecar

Lo que hay que cargar el miércoles 28-oct (plan, semana 4): los proveedores, los clientes, el stock vivo, 5 años de ventas y **sus facturas**. Pymecar no se renueva: las facturas tienen que quedarse aquí. Las fotos del stock se bajan de la web, que es donde viven hoy (briefing 4.5). El histórico entra sin fotos.

El export de Pymecar aún no lo tenemos (duda B7). Por eso el importador no lee ese export: lee **cuatro plantillas CSV nuestras**. Cuando llegue el export, el trabajo que falta es pasar sus columnas a estas plantillas. El importador y sus reglas no cambian.

## Cómo se usa

1. Rellenar las plantillas de `docs/migracion/` (`proveedores.csv`, `clientes.csv`, `vehiculos.csv`, `facturas.csv`) y dejarlas en `api/data/pymecar/`. Esa carpeta no va a Git: lleva datos de clientes. Las filas de ejemplo de las plantillas se borran. Si falta un fichero, se carga lo demás.
2. **Ensayo**, que no guarda nada:
   ```
   npm run migrar --workspace api -- --dir ./data/pymecar
   ```
   Saca por pantalla cuántos entran, cuántos ya estaban, los errores y los avisos, cada uno con su fila. El informe completo queda en `api/data/pymecar/informe-ensayo.json`.
3. Corregir las plantillas y repetir hasta que no quede ningún error. Revisar los avisos con Jaume, y también 5 coches al azar.
4. **Carga**, con el OK de Diego:
   ```
   npm run migrar --workspace api -- --dir ./data/pymecar --aplicar
   ```
   Antes de tocar nada copia la base (`proservice.db.antes-de-migrar-…`). Si sale mal, se para la API y se pone esa copia en su sitio.
   Las facturas quedan a nombre de la primera persona de gerencia activa: tiene que existir antes de cargar (`npm run usuario`).
5. **Fotos del stock**, desde la web: vincular cada coche con su ficha de proservicerubi.com (`POST /api/wordpress/vincular`, las 30 fichas que ya existen) y después `POST /api/wordpress/fotos`. Baja las fotos de todos los vinculados que aún no tienen ninguna. Con 15 o más, el coche ya se puede publicar desde el panel.

## Reglas

- **O entra todo o nada.** Con un solo error no se guarda ninguna fila: se corrige y se vuelve a lanzar.
- **No duplica.** Si un coche ya tiene esa matrícula, o un cliente o proveedor ya tiene ese NIF, se salta. Un cliente o proveedor sin NIF se salta si ya hay uno con el mismo nombre y teléfono. Así la carga del miércoles se puede lanzar encima del ensayo del martes.
- **Mismas reglas que el panel.** Cada fila pasa por las validaciones de la API: NIF con su letra, IBAN, teléfono, valores de las listas (cambio, etiqueta, combustible…), `video_url` solo `http(s)`. Una columna que no existe es un error, para que no se pierda un dato sin darnos cuenta.
- **Stock sin fotos.** Un coche que estaba publicado o reservado entra en «Pendiente de fotos», con un aviso: sin fotos no puede salir en la web. Se publica desde el panel cuando tenga sus 15 fotos.
- **Histórico de ventas.** Un coche con `fecha_venta` entra «Entregado» (o «Vendido», si se pone a mano, pero entonces sale en la web). Lleva su historial fechado (alta el día de `fecha_alta`, venta el de `fecha_venta`), así que cuenta en los informes del mes en que se vendió. No tiene vendedor, porque Pymecar no lo guarda: en incentivos sale como venta «sin vendedor».
- **Sin costes.** Los costes del coche viven en el libro de gastos, con su fecha. Si se metieran desde la ficha, caerían todos en el trimestre de hoy. Una columna `coste_*` es un error. Van con la migración del libro de gastos (pendiente, abajo).
- Todo lo cargado queda en `auditoria` con la acción `migracion`, la fila del CSV y, en los coches, su `ref_pymecar`.

- **Facturas.** Entran emitidas, con su número de Pymecar (`V25-00012`; también vale `F-V25-00012`, como sale en su lista) y los importes que calculó Pymecar. Si falta la base, el IVA o el total, se calculan como lo haría la plataforma. Si están y no cuadran con esa cuenta, se deja el de Pymecar con un aviso (puede ser una subvención o un descuento). Se congela una copia del cliente y del coche, como al emitir: salen en los libros de ingresos y de REBU. Por defecto, cada factura de venta entra **cobrada entera** (son ventas cerradas). Con `cobrado` se pone lo que se cobró de verdad, y con 0 queda pendiente.
- **La serie sigue donde la dejó Pymecar.** Al acabar, cada serie queda en su número más alto: si `V26` llega a la 38, la primera factura desde el panel es la `V26-00039`. Si faltan números en medio, se avisa: Hacienda pide la numeración sin huecos y lo más probable es que el export esté incompleto.

## Las plantillas

CSV como lo guarda Excel en español: `;` entre columnas (también vale `,`), UTF-8, primera fila con los nombres de columna. Las celdas vacías no cuentan. Fechas como `10/03/2021` o `2021-03-10`. Importes en euros, como `12.900,00` o `12900`.

**`proveedores.csv`**: `nombre` (obligatorio), `nif`, `tipo` (`profesional`, `particular`, `subasta` o `comisionista`), `clase` (`proveedor` o `acreedor`), `direccion`, `codigo_postal`, `poblacion`, `provincia`, `pais` (`ES`), `telefono`, `movil`, `email`, `iban`, `forma_pago`, `persona_contacto` y `notas`.

**`clientes.csv`**: `nombre` (obligatorio), `nif`, `tipo` (`particular` o `empresa`), `direccion`, `codigo_postal`, `poblacion`, `provincia`, `pais`, `telefono`, `email`, `origen`, `estado_comercial` y `notas`.

**`vehiculos.csv`**:
- Ficha: `matricula`, `marca` y `modelo` (obligatorios) y todo lo de `api/src/modules/vehiculos/campos.js`, con el mismo nombre.
- Dinero en euros: `precio_compra`, `pvp`, `precio_financiado`, `precio_minimo` y `pago_propietario`.
- Relaciones: `proveedor_nif` y `comprador_nif`. Tienen que estar en `proveedores.csv` o `clientes.csv`, o ya en la base.
- Recorrido: `estado` (uno de los 10; vacío = «Recibido» o, con venta, «Entregado»), `fecha_alta` y `fecha_venta`.
- `ref_pymecar`: la referencia del coche en Pymecar. Solo va a la auditoría, para poder buscarlo después.

**`facturas.csv`**:
- `codigo` (`V26-00038` o `R26-00002`), `fecha` y `cliente_nif` son obligatorios. El cliente tiene que estar en `clientes.csv` o en la base.
- `matricula`: el coche vendido, de `vehiculos.csv` o de la base.
- Importes en euros: `precio` (el del coche, impuestos incluidos), `compra` (en REBU; si falta, se coge el precio de compra del coche), `base`, `iva`, `suplidos` y `total`. `iva_pct`: 0, 10 o 21. En una rectificativa, en negativo.
- `regimen` (`REBU`, por defecto, o `general`), `vencimiento`, `forma_pago`, `uso_destino`, `garantia_tipo`, `garantia_meses`, `km_entrega` y `observaciones`: los mismos valores que en el panel.
- Rectificativas: `rectifica` (el código de la que anula, que tiene que venir también) y `motivo`.
- Cobro: `cobrado` (por defecto, el total), `fecha_cobro` (por defecto, la de la factura) y `forma_cobro` (por defecto, la `forma_pago`).

## Lo que falta, y de qué depende

| Qué | Depende de |
|---|---|
| Pasar el export de Pymecar a las plantillas: qué columna suya va a cada una nuestra | El export (B7) |
| Vincular cada coche del stock con su ficha de la web, para bajar sus fotos | Acceso de Editor a WordPress (B8). Si la web no expone la galería de ACF (B11), se bajan las adjuntas a la ficha y Jaume las ordena |
| Libro de gastos (va por el 313) y costes de cada coche | El export del libro |
| Numeración de la serie `V26` el día del arranque | Sale sola de las facturas cargadas. Solo si no se cargaran, se fija a mano en Facturas → Datos de la empresa (H8) |
