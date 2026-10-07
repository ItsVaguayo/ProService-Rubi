# T13 · La parte de Victor, desglosada

**Quién:** Victor (con Claude).
**Para cuándo:** en este orden, sin fechas. Cada paso cabe en una sesión.
**Reparto completo:** [reparto.md](../reparto.md) y la sección «Ampliación del 7-oct» de [plan.md](../plan.md).

Lo de arriba desbloquea a los demás; por eso va primero.

## 0. ✅ Migraciones sin números repartidos (7-oct)
Cada migración se apunta por su nombre en `migraciones_aplicadas`. David y tú podéis crear la vuestra a la vez sin pisaros. Test en `api/test/migraciones.test.js`.

## 1. Desbloquear a David y a Hafsa
- ✅ `estado_comercial` en clientes (migración `0009`, campo y filtro `?estado_comercial=`), hecho aparte para que David no espere (7-oct).
- ✅ `ventasDelMes(db, mes)` en `api/src/modules/informes/ventas.js`, con `vendio_id` para la T12 (7-oct). De paso, arreglado: si «Vendido» y «Entregado» caían en el mismo segundo, la venta se atribuía a quien entregó.
- ✅ PR #9 (T11) y #10 (T12) de David revisados y fusionados (7-oct). Queda el `TODO(Victor)` de T12: apuntar el gasto de comisión al liquidar, con el bloque 2.
- ✅ PR #11 (T07) de Hafsa revisado y fusionado (7-oct). Al comercial ya no le salen Proveedores, Gastos ni Facturas en el menú. Falta su T07b (gastos y facturas como en Pymecar).

## 2. T10 · Investigación (antes de los bloques 4 y 8)
- ~~Parte 1: Verifactu~~: aplazado a octubre de 2028 (duda H1).
- [ ] Parte 4: casos del margen → `docs/datos/margenes.csv` (los necesitan el bloque 2 y la T12).
- [ ] Parte 2: Meta → `docs/rrss.md`.
- [ ] Parte 3: partners de portales → `docs/portales.md`.
- [ ] Pasar a Diego las dudas H5 y H6 con lo encontrado. Para la H6, el candidato es Inventario.pro (lo trae Pymecar).

## 3. Bloque 2 · Gastos y margen con REBU
- [ ] Tabla `gastos` con el modelo de Pymecar: **T14 de David**.
- [ ] Tuyo, después de la T14: los cuatro `coste_*` de la ficha pasan a filas de `gastos`; la API los sigue aceptando y devolviendo.
- [ ] `margenNeto` en `api/src/modules/margen.js` (REBU, IVA general y depósito), probado con `margenes.csv`.
- [ ] Rutas `/api/gastos`, el libro y la comisión al liquidar: **ahora es la T14 de David**. Tú revisas su PR y luego sumas los gastos de cada coche a su coste.
- [ ] Informes con margen neto, gastos del mes y resultado.

## 4. Bloque 3 · Facturación, cobros e impagos
- [ ] Migración: series, facturas, líneas, cobros y datos de la empresa.
- [ ] Emitir con número correlativo sin huecos (en una transacción); una emitida no se edita; rectificativa.
- [ ] REBU sin IVA desglosado y con su mención; IVA general con base e IVA.
- [ ] Cobros, estado calculado (pendiente, parcial, cobrada, vencida) y lista de impagos.
- [ ] Anticipo al cobrar la señal de una reserva, descontado en la factura final.
- [ ] CSV para la gestoría.

## 5. T09 · Factura y contratos imprimibles
- [ ] `frontend/panel/documentos/factura.html` (REBU e IVA general, hueco del QR) y `frontend/css/documentos.css`.
- [ ] Los cinco contratos con la banda «pendiente de revisión por abogado».
- [ ] Textos base de los contratos en `docs/contratos/`, para el abogado (duda H3).

## 6. Bloque 4 · Verifactu (aplazado a 2028)
- Hacienda lo pasa a octubre de 2028 (duda H1). En el bloque 3 solo se deja sitio: un estado por factura y el hueco del QR.

## 7. Bloque 5 · Contratos
- [ ] Migración `contratos`, numeración y datos congelados al generarlo.
- [ ] Botones en la ficha del coche que abren las plantillas de T09 rellenas.

## 8. Bloque 7 · Fondo con IA y vídeo
- [ ] Cola de `trabajos` en SQLite (la reutilizan Verifactu y redes).
- [ ] Adaptador de fondo (lo que salga de la T08 de Hafsa) y composición con `sharp` en `ruta_photocall`.
- [ ] Vídeo con `ffmpeg`, vertical y horizontal.
- [ ] Conectar los estados de las fotos de la maqueta de Hafsa.

## 9. Bloque 8 · Web, portales y redes
- [ ] Vídeo en la ficha de WordPress (`api/src/modules/publicacion/wordpress.js`).
- [ ] Feed XML por portal.
- [ ] Adaptador de Meta en simulado: publicar al pasar a «Publicado» y retirar al vender (como `publicacion/retirada.js`).

## 10. Bloque 10 · Cita previa
- [ ] Migración `citas` y `horario_pruebas` (por defecto, el horario de la duda H12).
- [ ] Huecos y alta pública con el antispam de `contactos/routes.js`, sin solapes.
- [ ] Formulario en la ficha de la web y en `wordpress-pruebas/`.
- [ ] Conectar `agenda.html` de Hafsa.

## 11. Bloque 9 · Avisos
- [ ] `modules/avisos` encima de la tabla de David: tareas vencidas, contactos sin atender, coches parados, ITV, vendidos aún publicados, cobros vencidos y citas de mañana.
- [ ] Endpoint para el panel y correo diario (duda H13).

## 12. Conectar las maquetas de Hafsa
- ✅ `clientes.html` (7-oct): lista con buscador y filtros, ficha con sus coches y lo último del CRM, alta y edición. La lista de la API trae `n_coches` y `ultima_actividad`. Las facturas del cliente salen cuando esté el bloque 3.
- [ ] El resto, conforme sale su bloque. Siguiente con API ya hecha: `crm.html` (T11) e `incentivos.html` (T12).

Cada bloque es: migración, módulo, tests, `docs/api.md`, página del panel y datos de prueba. Marca con ✅ lo que acabes.
