# Migración desde Pymecar

Lo que hay que cargar el miércoles 28-oct (plan, semana 4): los proveedores, los clientes, el stock vivo y 5 años de ventas. El histórico entra sin fotos.

El export de Pymecar aún no lo tenemos (duda B7). Por eso el importador no lee ese export: lee **tres plantillas CSV nuestras**. Cuando llegue el export, el trabajo que falta es pasar sus columnas a estas plantillas. El importador y sus reglas no cambian.

## Cómo se usa

1. Rellenar las plantillas de `docs/migracion/` (`proveedores.csv`, `clientes.csv`, `vehiculos.csv`) y dejarlas en `api/data/pymecar/`. Esa carpeta no va a Git: lleva datos de clientes. Las filas de ejemplo de las plantillas se borran. Si falta un fichero, se carga lo demás.
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

## Reglas

- **O entra todo o nada.** Con un solo error no se guarda ninguna fila: se corrige y se vuelve a lanzar.
- **No duplica.** Si un coche ya tiene esa matrícula, o un cliente o proveedor ya tiene ese NIF, se salta. Un cliente o proveedor sin NIF se salta si ya hay uno con el mismo nombre y teléfono. Así la carga del miércoles se puede lanzar encima del ensayo del martes.
- **Mismas reglas que el panel.** Cada fila pasa por las validaciones de la API: NIF con su letra, IBAN, teléfono, valores de las listas (cambio, etiqueta, combustible…), `video_url` solo `http(s)`. Una columna que no existe es un error, para que no se pierda un dato sin darnos cuenta.
- **Stock sin fotos.** Un coche que estaba publicado o reservado entra en «Pendiente de fotos», con un aviso: sin fotos no puede salir en la web. Se publica desde el panel cuando tenga sus 15 fotos.
- **Histórico de ventas.** Un coche con `fecha_venta` entra «Entregado» (o «Vendido», si se pone a mano, pero entonces sale en la web). Lleva su historial fechado (alta el día de `fecha_alta`, venta el de `fecha_venta`), así que cuenta en los informes del mes en que se vendió. No tiene vendedor, porque Pymecar no lo guarda: en incentivos sale como venta «sin vendedor».
- **Sin costes.** Los costes del coche viven en el libro de gastos, con su fecha. Si se metieran desde la ficha, caerían todos en el trimestre de hoy. Una columna `coste_*` es un error. Van con la migración del libro de gastos (pendiente, abajo).
- Todo lo cargado queda en `auditoria` con la acción `migracion`, la fila del CSV y, en los coches, su `ref_pymecar`.

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

## Lo que falta, y de qué depende

| Qué | Depende de |
|---|---|
| Pasar el export de Pymecar a las plantillas: qué columna suya va a cada una nuestra | El export (B7) |
| Fotos de los coches en stock (las tienen en el hosting de la web, 4.5) | Decidir si se bajan de WordPress o las rehace Jaume (D6) |
| Libro de gastos (va por el 313) y costes de cada coche | El export del libro |
| Facturas emitidas de años anteriores | Decidir si entran como facturas (los libros saldrían también de aquí) o se quedan en Pymecar en PDF. Hoy el importador no las carga |
| Numeración de la serie `V26` el día del arranque | Se fija a mano en Facturas → Datos de la empresa (H8) |
