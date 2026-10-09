# API · contrato

Todo va bajo `/api`, en JSON. La sesión es una cookie (`ps_sesion`, httpOnly) que pone `POST /api/auth/entrar`.

## Reglas comunes

- **Sin sesión, 401** en todo salvo `GET /api/salud`, `/api/auth/*` y `POST /api/contactos` (el formulario de la web).
- **Dos roles.** `gerencia` lo ve todo. `comercial` no recibe dinero interno ni entra en Usuarios ni en WordPress (403).
- **Dinero en céntimos enteros**, con sufijo `_cent`: `pvp_cent: 1290000` son 12.900 €. Se pasa a euros solo al enseñarlo.
- **Errores** siempre con la misma forma: `{ "error": "texto para la persona" }`. Cuando hay varios motivos, además `errores: [...]` (datos mal puestos, 400) o `motivos: [...]` (no se puede por una regla, 409).
- **Códigos**: 400 dato mal puesto · 401 sin sesión · 403 sin permiso · 404 no existe · 409 choca con una regla o con algo que ya existe · 413 fichero demasiado grande · 415 formato no admitido · 429 demasiados intentos.

## Entrar

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/entrar` | todos | `{ email, contrasena }`. Pone la cookie y devuelve `{ id, nombre, rol }`. 401 si no cuadra; 429 tras varios fallos seguidos desde la misma IP |
| `POST /auth/salir` | todos | Cierra la sesión |
| `GET /auth/yo` | con sesión | `{ id, email, nombre, rol }` |
| `GET /salud` | todos | `{ ok: true }` |

## Coches

Campos que se pueden escribir: los de `api/src/modules/vehiculos/campos.js` y ninguno más (un campo desconocido da 400). Los marcados `dinero: true` solo los escribe y los recibe gerencia: compra, costes, precio mínimo, régimen de IVA, datos del dueño en depósito y proveedor. `video_url` tiene que ser un enlace `http` o `https` (otro esquema, como `javascript:`, da 400).

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /vehiculos/estados` | con sesión | Los 10 estados en orden, con `web: true` en los que salen en la web |
| `GET /vehiculos?estado=publicado` | con sesión | Lista, del más nuevo al más viejo. Cada coche lleva además `en_estado_desde`, `foto_portada_id` y `n_fotos`. Un `estado` que no existe da 400 |
| `GET /vehiculos/:id` | con sesión | La ficha. Gerencia recibe también `coste_otros_cent`, `coste_total_cent`, `iva_venta_cent`, `margen_bruto_cent` y `margen_cent` (el neto). Ver «Coste y margen» |
| `POST /vehiculos` | con sesión | Alta. Basta con `matricula`, `marca` y `modelo`. Entra en «Pendiente de recoger». 201 con la ficha |
| `PUT /vehiculos/:id` | con sesión | Cambia solo lo que llega. **Si el coche sale en la web** (publicado, reservado o vendido), la edición no puede vaciar ninguno de los datos de publicar que tenía: 409 con la lista. Si ya le faltaba alguno de antes, se le deja editar lo demás |
| `PATCH /vehiculos/:id/estado` | con sesión | `{ estado }`. Para entrar en la web desde fuera (a «Publicado», o de taller directo a «Vendido») hacen falta todos los datos de publicar y 15 fotos públicas que no sean de daños; si no, 409 con `motivos`. Para «Reservado», una reserva activa. Un coche con reserva activa solo sale de «Reservado» a «Vendido» o «Entregado», que cierran la reserva como `vendida`; para lo demás, 409: hay que cancelarla antes |
| `GET /vehiculos/:id/historial` | con sesión | Cambios de estado, del más reciente al más antiguo, con quién los hizo. `usuario: null` = lo hizo el sistema (por ejemplo, una reserva que caduca) |
| `GET /vehiculos/:id/extras` | con sesión | Nombres de los extras marcados |
| `PUT /vehiculos/:id/extras` | con sesión | `{ extras: ["Navegador", …] }` sustituye la lista entera. Solo nombres del catálogo (migración `0003`): uno que no exista da 400 con `desconocidos` y no se guarda nada |

## Reservas

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /vehiculos/:id/reserva` | con sesión | La reserva activa o `null` |
| `POST /vehiculos/:id/reserva` | con sesión | `{ cliente, senal_cent, dias = 7 }`. Solo coches publicados; señal de 300 € como mínimo; de 1 a 60 días. Pasa el coche a «Reservado». 201 |
| `DELETE /vehiculos/:id/reserva` | con sesión | `{ senal_devuelta? }`, `true` o `false` (duda C6; sin él queda sin apuntar). Cancela la reserva y el coche vuelve a «Publicado» |

**Caducan solas.** La API revisa al arrancar, cada 10 minutos y antes de sincronizar con WordPress: una reserva vencida se desactiva, el coche vuelve a «Publicado» y queda en el historial sin usuario.

Cada reserva cerrada guarda cómo terminó: `cierre` (`cancelada`, `caducada` o `vendida`), `cerrada_en` y `senal_devuelta` (1, 0 o `null`).

## Fotos

Las fotos solo se sirven con sesión, también al `<img>` del panel: las de daños y las de coches sin publicar no son públicas. WordPress las recibe del conector, que las lee del disco.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /fotos/:vehiculoId` | con sesión | Fotos en orden, cada una con su `url` |
| `GET /fotos/:vehiculoId/:fotoId/archivo` | con sesión | El fichero (JPG). Usad la `url` que devuelve la API: lleva `?v=…` (fichero y fecha de subida; en los coches, `foto_portada_v`), que cambia cuando cambia la foto, para que el navegador no enseñe una vieja de su caché |
| `POST /fotos/:vehiculoId` | con sesión | Formulario `multipart` con el campo `fotos` (una o varias). Se reducen a JPG de 1.600 px y entran en el primer hueco libre (25 como mucho). 15 MB por foto (413). HEIC del iPhone desde el ordenador: 415 con el aviso. 201 |
| `PUT /fotos/:vehiculoId/orden` | con sesión | `{ fotos: [{ id, orden }, …] }` con todas las fotos del coche, cada una en un hueco distinto del 1 al 25 |
| `PATCH /fotos/:vehiculoId/:fotoId` | con sesión | `{ es_dano?, publica? }`, los dos `true` o `false`. Si el coche sale en la web y el cambio lo deja con menos de 15 fotos válidas, 409 |
| `DELETE /fotos/:vehiculoId/:fotoId` | con sesión | Borra la foto y su fichero. Su hueco queda libre. Si el coche sale en la web y se quedaría con menos de 15 fotos válidas, 409 |

## Contactos de la web

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /contactos` | **sin sesión** | Lo manda el formulario de la web. Ver abajo. Cada contacto apunta su correo para `CORREO_CONTACTOS` (ver «Correos») |
| `GET /contactos?estado=sin_atender&tipo=prueba` | con sesión | `estado`: `sin_atender` (por defecto, el que más espera primero), `atendidos` o `todos`. `tipo`: `informacion`, `prueba`, `financiacion` o `tasacion`. Cada contacto lleva la matrícula, marca y modelo del coche y quién lo atendió |
| `GET /contactos/sin-atender` | con sesión | `{ total }`, para el contador del menú |
| `PATCH /contactos/:id` | con sesión | `{ atendido: true }` lo marca con fecha y usuario; `false` lo devuelve a pendiente |
| `POST /contactos/:id/cliente` | con sesión | Pasa el contacto a cliente. Si ya hay un cliente con ese teléfono o ese correo, lo une a él: `{ cliente_id, creado: false }` (200). Si no, lo crea con origen `web`: `{ cliente_id, creado: true }` (201) |

**El formulario de la web** manda:

```json
{
  "nombre": "Marta Soler",
  "telefono": "600 111 222",
  "email": "opcional@correo.com",
  "tipo": "prueba",
  "coche": "PS-00031",
  "mensaje": "opcional, hasta 2.000 caracteres",
  "privacidad": true,
  "web": ""
}
```

- `coche` es opcional: la referencia como texto (`"PS-00031"`) o el id como número. Solo cuenta si el coche sale en la web; si no (o no existe), el contacto se guarda igual, sin coche, y la respuesta es la misma. Así el formulario no sirve para averiguar qué otros coches hay.
- `privacidad` tiene que ser `true`.
- `web` es el **campo trampa**: va oculto en el formulario y la persona lo deja vacío. Si llega con algo, se contesta 201 como si nada y no se guarda.
- Como mucho 5 envíos por IP cada 10 minutos (429). Se cambia con `CONTACTOS_POR_IP`.
- A la web solo se le devuelve `{ ok: true }`, nunca datos internos.
- Si el formulario está en otro dominio (proservicerubi.com), ese dominio tiene que estar en `CORS_ORIGENES`.

## Clientes y proveedores

Clientes: los dos roles (el comercial los usa en el CRM). Proveedores: solo gerencia, como el precio de compra.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /clientes?q=` | con sesión | Lista por nombre. `q` busca en nombre, NIF, teléfono (sin espacios) y correo. `activos=0` incluye los desactivados. Como mucho 5.000. Cada fila trae `n_coches` (los que ha comprado) y `ultima_actividad` (cuándo se hizo su última actividad del CRM; las apuntadas sin hacer no cuentan) |
| `GET /clientes/:id` | con sesión | La ficha, con `coches` (los que ha comprado: `vehiculos.comprador_id`) y `contactos` (los de la web unidos a él) |
| `POST /clientes` | con sesión | Alta. Solo `nombre` es obligatorio. 201 |
| `PUT /clientes/:id` | con sesión | Cambia los campos que lleguen. `{ activo: false }` lo desactiva: no se borra nunca |
| `GET /proveedores?q=` · `GET /proveedores/:id` · `POST /proveedores` · `PUT /proveedores/:id` | gerencia | Igual que clientes. Cada fila de la lista trae `n_coches` (los que nos ha vendido) y `comprado_cent` (la suma de su `precio_compra_cent`). La ficha trae `coches` con su `precio_compra_cent` |

Campos de los dos: `nombre` (o razón social), `nif`, `direccion`, `codigo_postal`, `poblacion`, `provincia`, `pais` (`ES` por defecto), `telefono`, `email`, `notas`, `activo`.

- Cliente: `tipo` `particular` (por defecto) o `empresa`, `origen` (texto libre: web, tienda, teléfono…) y `estado_comercial` para el embudo del CRM: `nuevo` (por defecto), `interesado`, `me_lo_pienso`, `negociando`, `ganado` o `perdido`. `GET /clientes?estado_comercial=negociando` filtra por él.
- Proveedor: `tipo` `profesional` (por defecto), `particular`, `subasta` o `comisionista`. Además, como en el alta de Pymecar:
  - `clase`: `proveedor` (por defecto: se le compran coches) o `acreedor` (da un servicio: gestoría, luz, publicidad). No puede quedar vacía.
  - `movil`, con la misma comprobación que `telefono`.
  - `iban`: se comprueba el dígito de control (módulo 97) y en España tiene que tener 24 caracteres. Se guarda sin espacios y en mayúsculas. Uno mal escrito: 400 «El IBAN no es válido».
  - `forma_pago`: `a_la_vista`, `contado`, `pago_30`, `pago_30_60`, `tarjeta` o `transferencia` (las de Pymecar).
  - `persona_contacto`: hasta 100 caracteres.
- El `nif` acepta DNI, NIE o CIF con su letra o dígito de control, y se guarda sin espacios ni guiones y en mayúsculas. Uno mal escrito: 400. Repetido: 409.
- En la ficha del coche: `proveedor_id` (solo gerencia) y `comprador_id`. Un id que no existe: 400. Los `proveedor_nombre` y `proveedor_telefono` de antes siguen; la migración `0008` los pasó a la tabla de proveedores.

## Actividades del CRM

Llamadas, visitas, WhatsApp, correos, pruebas, tareas y notas de cada cliente, con su fecha, su responsable y su resultado. Los dos roles ven y apuntan todo: aquí no hay dinero.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /actividades` | con sesión | Filtros: `?cliente=id`, `?vehiculo=id`, `?responsable=yo` o un id, `?pendientes=1` (sin hacer), `?dia=AAAA-MM-DD` (las programadas ese día). Por fecha programada; las que no tienen fecha (notas), al final. Cada una con `cliente_nombre`, `contacto_nombre`, `responsable_nombre`, `vehiculo_referencia`, `vehiculo_marca` y `vehiculo_modelo`. Un filtro mal escrito da 400 |
| `GET /actividades/:id` | con sesión | Una actividad, con los mismos nombres |
| `POST /actividades` | con sesión | `{ tipo, descripcion, cliente_id?, contacto_id?, vehiculo_id?, programada_para?, responsable_id? }`. Hace falta `cliente_id` o `contacto_id` (un contacto de la web que aún no es cliente). Sin `responsable_id`, el responsable es quien la crea. `creado_por` sale siempre de la sesión: si llega en el cuerpo, 400. Un id que no existe, 400. 201 |
| `PUT /actividades/:id` | con sesión | Solo `tipo`, `descripcion`, `programada_para` y `responsable_id`. El cliente, el contacto y el coche no se cambian: se crea otra actividad. Una ya hecha no se edita: 409 |
| `PATCH /actividades/:id/hecha` | con sesión | `{ resultado? }` la marca hecha ahora (409 si ya lo estaba). `{ hecha: false }` la devuelve a pendiente y borra el resultado (409 si ya lo estaba) |

- `tipo`: `llamada`, `visita`, `whatsapp`, `email`, `prueba`, `tarea` o `nota`.
- `programada_para`: `AAAA-MM-DD HH:MM`, hora de Rubí, y tiene que existir (`2026-02-30` da 400). Vacía en una nota.
- `hecha_en` va en UTC, como el resto de fechas de la base.
- Cada alta, edición, «hecha» y vuelta a pendiente queda en `auditoria` (entidad `actividad`).
- El estado comercial de cada cliente (las columnas del embudo) está en «Clientes y proveedores»: `estado_comercial`.

## Incentivos de los comerciales

Cuánto se le paga a cada comercial por lo vendido en un mes. La regla del cliente aún no se sabe (duda H9): es configurable y, sin regla, el incentivo es 0. Todo en enteros: el porcentaje en centésimas (`500` = 5 %) y el dinero en céntimos, redondeado una vez por coche.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /incentivos/reglas` | gerencia | Todos los usuarios con su regla (`tipo` y `valor` a `null` si no tienen) |
| `PUT /incentivos/reglas/:usuarioId` | gerencia | `{ tipo, valor }`. `porcentaje_margen`: centésimas sobre el margen de cada coche, de 0 a 10.000. `fijo_por_coche`: céntimos por coche vendido. `valor` entero: con decimales, 400 |
| `GET /incentivos?mes=AAAA-MM` | con sesión | Sin `mes`, el actual. Gerencia: `{ mes, comerciales, sin_vendedor }`. El comercial: solo él, sus coches **sin `margen_cent`** y, si su regla es un porcentaje, sin el `valor` (con él y el incentivo se despeja el margen) |
| `POST /incentivos/liquidar` | gerencia | `{ mes, usuario_id }`. Guarda lo calculado en ese momento. Un mes que no ha terminado, o ya liquidado para ese usuario: 409. 201 |

Cada comercial lleva `usuario_id`, `nombre`, `rol`, `regla`, `coches` (`id`, `referencia`, `marca`, `modelo`, `matricula`, `pvp_cent` (el precio público: lo ve también el comercial), `fecha_venta`, `margen_cent`, `incentivo_cent`), `total_cent` y `liquidado` (`coches`, `importe_cent`, `liquidado_en` y, para gerencia, `liquidado_por`; o `null`).

- Una venta cuenta para quien pasó el coche a «Vendido» (`ventasDelMes` de `informes/ventas.js`), también si es de gerencia. Salen los que vendieron algo y los comerciales activos aunque no vendieran nada.
- `porcentaje_margen`: con pérdida o sin margen (falta la compra o el PVP), 0. El margen es el neto de `margen.js`.
- Lo liquidado no cambia aunque luego cambie la regla o se deshaga una venta: `total_cent` es el cálculo de ahora y `liquidado.importe_cent`, lo que se pagó.
- Reglas y liquidaciones quedan en `auditoria` (`incentivo_regla` e `incentivo_liquidado`).
- Liquidar más de 0 € apunta el gasto de la comisión en el libro de gastos (ver «Libro de gastos»).

## Libro de gastos (solo gerencia)

Los gastos de la empresa, como el libro de gastos de Pymecar. Sin `DELETE`: un libro registro no se borra; un gasto mal apuntado se corrige con `PUT`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /gastos?mes=AAAA-MM` | gerencia | Los del mes (sin `mes`, el actual), del más reciente al más antiguo. Filtros: `tipo`, `concepto`, `vehiculo=id`, `pagado=1` o `0`. Devuelve `{ mes, gastos, totales }` |
| `GET /gastos/:id` | gerencia | Uno, con `proveedor_nombre`, `cliente_nombre`, `usuario_nombre` y los datos del coche |
| `POST /gastos` | gerencia | Alta. Ver abajo. 201 |
| `PUT /gastos/:id` | gerencia | Cambia lo que llegue, recalcula los importes y vuelve a comprobar las reglas con el gasto entero. `numero` no se cambia nunca |
| `PATCH /gastos/:id/pagado` | gerencia | `{ pagado: true, forma_pago? }` pone la fecha de hoy; `{ pagado: false }` la quita (la forma de pago se queda) |

**Alta.** `{ fecha, concepto, base_cent, tipo?, iva_pct?, irpf_pct?, descripcion?, factura_proveedor?, proveedor_id?, cliente_id?, usuario_id?, vehiculo_id?, forma_pago? }`

- `concepto`: `alquileres`, `carburantes`, `comisiones`, `compras`, `electricidad`, `gestorias`, `papelerias`, `publicidad` o `vehiculos`.
- Sin `tipo`, sale del concepto: `alquileres` y `gestorias` → `irpf`; `comisiones` → `comision`; `vehiculos` → `vehiculo`; `compras` → `rebu`; el resto → `general`.
- `iva_pct`: 0, 4, 10 o 21 (por defecto 21; 0 en REBU). `irpf_pct`: 0, 7, 15 o 19 (por defecto 0; en `irpf`, 15, y 19 si es un alquiler).
- `forma_pago`: `a_la_vista`, `contado`, `pago_30`, `pago_30_60`, `tarjeta` o `transferencia`.
- **Los importes los calcula el servidor**, en céntimos: `iva_cent = round(base × IVA ÷ 100)`, `irpf_cent = round(base × IRPF ÷ 100)` y `total_cent = base + IVA − IRPF`. Si llegan `iva_cent`, `irpf_cent` o `total_cent` en el cuerpo: 400.
- **Número de registro**: el siguiente al más alto, dentro de la misma transacción del alta (dos altas a la vez no cogen el mismo). Con los gastos de Pymecar cargados (van por el 313), sigue desde ahí.

**Reglas por tipo** (400 si no se cumplen, también al editar):

| Tipo | Regla |
|---|---|
| `general` | Sin IRPF |
| `irpf` | Con IRPF (7, 15 o 19) |
| `comision` | `proveedor_id` (un comisionista) o `usuario_id` (un comercial) |
| `rebu` | `vehiculo_id`, y sin IVA ni IRPF |
| `vehiculo` | `vehiculo_id` |

**Totales** (de la lista que se devuelve, con sus filtros): `gastos`, `base_cent`, `iva_cent`, `irpf_cent`, `total_cent`, `por_tipo` (lo mismo por cada tipo que tenga gastos), `pendientes` y `pendiente_cent` (lo que falta por pagar).

**Incentivos.** Al liquidar un incentivo de más de 0 € se apunta solo un gasto `comision`, concepto `comisiones`, con el `usuario_id` del comercial, sin IVA ni IRPF y la descripción «Incentivo de {nombre}, {mes}», en la misma transacción que la liquidación.

## Coste y margen (solo gerencia)

En `api/src/modules/margen.js`. Todo en céntimos y calculado al pedirlo: no se guarda.

- **Costes del coche**: los cuatro de la ficha (`coste_transporte_cent`, `coste_taller_cent`, `coste_preparacion_cent`, `coste_impuestos_cent`, sin IVA) viven en el libro de gastos desde la migración `0012`, un gasto de tipo `vehiculo` por casilla con `coste_ficha`. Se siguen escribiendo y leyendo en la ficha como siempre: al cambiar uno se corrige su gasto, y vaciarlo lo deja a 0 (no se borra). `coste_otros_cent` es la suma de los demás gastos del libro con ese `vehiculo_id`, menos los de tipo `rebu` (la factura de compra, que ya es el precio de compra).
- **Coste total** = precio de compra (en depósito, `pago_propietario_cent`) + todos los costes.
- **IVA de la venta** (`iva_venta_cent`):
  - REBU: (PVP − compra) × 21/121, redondeado; 0 si se vende por debajo de la compra. Comprobado con una venta real de Pymecar: 14.000 → 15.975 da 342,77.
  - IVA general (`regimen_iva: 'deducible'`): el 21 % incluido en el PVP, PVP − PVP/1,21.
  - Depósito: siempre REBU sobre lo pactado con el dueño, como en Pymecar (al venderlo se le compra y se vende en REBU).
  - Sin régimen: REBU.
- **Margen bruto** = PVP − coste total. **Margen neto** (`margen_cent`) = margen bruto − IVA de la venta.
- Sin compra (o lo pactado) o sin PVP, todos son `null`.

Las fórmulas las confirma la gestoría (duda H7).

## Facturación (solo gerencia)

En `api/src/modules/facturacion`. Verifactu queda para octubre de 2028 (duda H1): `verifactu_estado` es el hueco.

| Método y ruta | Qué hace |
|---|---|
| `GET /facturas?estado=&q=&desde=&hasta=&cliente=` | Lista (borradores primero, luego por fecha). `cliente` (id) deja solo las de ese cliente. `estado`: `borrador`, `pendiente`, `parcial`, `cobrada`, `vencida`, `anulada` o `rectificativa`. `q` busca en número, cliente y matrícula. Devuelve `{ facturas, resumen }`; el resumen es de todas: `pendiente_cent`, `pendientes`, `vencido_cent`, `vencidas`, `vencida_mas_antigua`, `borradores` |
| `GET /facturas/:id` | Una, con sus `cobros` |
| `POST /facturas` | Borrador. Obligatorio `cliente_id`; normalmente `vehiculo_id`. Del coche salen, si no llegan, `precio_cent` (su PVP) y `regimen` (`REBU`, o `general` si el coche es `deducible`; el depósito, siempre REBU). Opcionales: `fecha` (hoy), `vencimiento`, `suplidos_cent`, `forma_pago`, `uso_destino`, `garantia_tipo` (`directa`, `comprada`, `sin`), `garantia_meses` (0-36), `km_entrega`, `observaciones`. 201 |
| `PUT /facturas/:id` · `DELETE /facturas/:id` | Solo un borrador (emitida: 409). Los importes se recalculan |
| `POST /facturas/:id/emitir` | Le da número (serie del año: `V26-00039`), congela una copia de la empresa, el cliente y el coche (`datos_*`) y pone al cliente como comprador del coche. 409 con `faltan` si falta la dirección fiscal de la empresa, el NIF o la dirección del cliente, el coche o su precio de compra (REBU). 409 si el coche ya está en otra factura sin rectificar, si la fecha es anterior a la última de la serie o si es posterior a hoy |
| `POST /facturas/:id/rectificar` | `{ motivo }`. Rectificativa por el total, en la serie `R26`, con fecha de hoy e importes en negativo. La original queda `anulada` |
| `POST /facturas/:id/cobros` | `{ importe_cent, forma_pago, fecha?, nota? }` o `{ senal: true }`, que aplica la señal de la reserva del coche (una vez). Nunca más de lo que queda (409) |
| `DELETE /facturas/:id/cobros/:cobro` | Quita un cobro mal apuntado |
| `GET /facturas/series` · `PUT /facturas/series/:serie` | Las series y su `codigo_siguiente`. `{ ultimo }` fija el último número dado, para seguir a Pymecar, solo mientras la serie no tenga facturas |
| `GET /facturas/empresa` · `PUT /facturas/empresa` | Datos fiscales de la empresa (`direccion`, `codigo_postal`, `poblacion`, `provincia`, `telefono`, `email`, `registro_mercantil`, `iban`…). Razón social y NIF no se cambian una vez hay facturas emitidas (409) |
| `GET /facturas/libros/ingresos` · `.csv` | Libro de ingresos: las emitidas del periodo. Periodo: `?anio=2026` y, si se quiere, `&trimestre=1..4`; o `?desde=&hasta=`; sin nada, el año en curso. JSON con `filas` y `totales` |
| `GET /facturas/libros/rebu` · `.csv` | Libro de REBU: cada coche vendido en REBU, con la compra (fecha, proveedor, NIF, importe) y la venta |
| `GET /facturas/libros/gastos` · `.csv` | Libro de gastos: lo del libro de `/gastos`, por número de registro, con proveedor y NIF, base, IVA, IRPF, total y si está pagado |

Importes (`importes.js`): en REBU el cliente ve un solo total, sin IVA desglosado, y para los libros el margen (precio − compra) se separa en base e IVA (margen 1.975 → 1.632,23 + 342,77, como Pymecar); con pérdida, 0. En general, el 21 % va dentro del precio. Los suplidos se suman al total, fuera de la base. Estado de cobro: `cobrada` sin saldo, `vencida` con saldo y el vencimiento pasado, `parcial` con algo cobrado, si no `pendiente`.

## Contratos

En `api/src/modules/contratos`. Se generan con los datos del momento y se guardan ya escritos (`contenido`): un contrato firmado no cambia aunque cambie la ficha o la plantilla. Número correlativo del año: `C26-0001`. Se imprimen en `contrato.html?id=` y se firman en papel. Todos llevan `pendiente_abogado: true` (duda H3).

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /contratos` | según el tipo | `{ tipo, … }`. 201 con el contrato escrito |
| `GET /contratos?vehiculo=&factura=` | con sesión | Lista. El comercial no ve los de compra ni cesión |
| `GET /contratos/:id` | con sesión | Uno, con su `contenido` (partes, vehículo, intro, secciones con cláusulas, cláusulas adicionales y firmas) |

Tipos:
- `compraventa` (los dos roles): `factura_id` de una venta emitida sin rectificar. Cliente, precio, garantía y km salen de la factura; la forma de pago, de sus cobros (y lo que falte, con la forma de la factura). `probado` (por defecto `true`), `hora`. Texto: el contrato que usan hoy en Pymecar.
- `reserva` (los dos roles): `vehiculo_id` con reserva y `cliente_id` (la reserva solo guarda el nombre). `forma_pago` de la señal.
- `compra` (gerencia): `vehiculo_id` de un coche propio; el vendedor es `proveedor_id` o el proveedor de la ficha. `forma_pago`, `hora`. Si el proveedor es particular, dice que no lleva IVA.
- `cesion` (gerencia): `vehiculo_id` de un coche en depósito; el dueño es `proveedor_id` o el de la ficha. `duracion_meses` (3).

Todos aceptan `fecha` (hoy) y `clausulas_adicionales`. Lo que falta (un DNI, una dirección) sale como raya para rellenar a mano.

## Cita previa de pruebas de conducción

Las pide la web o se apuntan desde la agenda del panel. Una prueba dura 30 minutos y empieza en punto o y media, dentro del horario de `horario_pruebas` (por defecto el de la duda H12: de lunes a viernes de 10:00 a 13:30 y de 16:30 a 19:30; sábado de 10:00 a 13:30). Las horas van en hora de Rubí, `AAAA-MM-DD HH:MM`. **Sin solapes**: dos citas vivas (pedida o confirmada) no pueden empezar a la vez, porque las acompaña una persona; lo impide la base.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /citas/huecos?desde=AAAA-MM-DD&dias=14` | público | Las horas libres, `{ duracion_min, dias: [{ dia, horas: ['10:00', …] }] }`. Sin días vacíos. Con dos horas de margen: no ofrece lo que empieza antes |
| `POST /citas/pedir` | público | La web pide una prueba: `{ coche (id o referencia), inicio, nombre, telefono, email?, mensaje?, privacidad: true, web: '' }`. Solo coches publicados. Entra **pedida** y además apunta un contacto de tipo `prueba` (sale en Contactos, en los avisos y en el correo al comercial). La misma protección que los contactos: 5 por IP cada 10 minutos y el campo trampa `web`. Hora ya cogida: 409 |
| `GET /citas/horario` | con sesión | El horario de pruebas para dibujar la agenda: `{ duracion_min, franjas: [{ dia_semana (1 = lunes), desde, hasta }] }` |
| `GET /citas/libres?desde=&dias=` | con sesión | Lo mismo que `huecos`, sin el margen de dos horas (para el panel) |
| `GET /citas?desde=&hasta=` | con sesión | Las citas del periodo (los dos días incluidos; por defecto, de hoy a dentro de 7 días), con `marca`, `modelo`, `version`, `matricula`, `referencia`, `cliente_nombre`. Sin las canceladas, salvo `?canceladas=1` |
| `POST /citas` | con sesión | `{ vehiculo_id, inicio, nombre?, telefono?, email?, cliente_id?, contacto_id?, notas?, estado? }`. Entra **confirmada** (se ha hablado con el cliente), salvo `estado: 'pedida'`. Con `cliente_id` o `contacto_id`, el nombre y el teléfono salen de ahí si no llegan, y el contacto queda atendido. 201 |
| `PATCH /citas/:id` | con sesión | `{ estado?, inicio?, notas? }`. `estado`: `confirmada`, `hecha`, `no_vino` o `cancelada` (no vuelve a `pedida`; una cancelada no revive). La hora solo se cambia en una cita viva |

- Los dos roles: la agenda no lleva dinero.
- Cada alta y cambio queda en `auditoria` (entidad `cita`).
- **Avisos** (`GET /avisos`, tipo `citas`): las pruebas de hoy que aún no han empezado y las de mañana. `alta` si siguen sin confirmar (hay que llamar), `media` si están confirmadas. Enlace a `agenda.html?semana=AAAA-MM-DD`.

## Avisos del panel

Lo que hay que atender hoy, calculado al pedirlo con lo que ya hay en la base: no tiene tabla propia. El correo diario (duda H13) y las citas de mañana van aparte.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /avisos` | con sesión | Lista de avisos, los de gravedad `alta` primero y, dentro de cada gravedad, del más antiguo al más nuevo. Sin avisos, `[]` |

Cada aviso lleva `tipo`, `gravedad` (`alta` o `media`), `texto` (corto, para la pantalla), `enlace` (la página del panel a la que lleva) y `fecha` (la que lo origina).

| `tipo` | Cuándo sale | `gravedad` | `enlace` | `fecha` |
|---|---|---|---|---|
| `tareas_vencidas` | Actividad del CRM sin hacer (`hecha_en` vacía) con `programada_para` antes de ahora, de cualquier tipo salvo `nota`. El texto empieza por lo que es: «Llamada vencida», «Tarea vencida», «Correo sin mandar»… | `alta` si es de un día anterior; `media` si es de hoy | `clientes.html?id=` si es de un cliente, `contactos.html?id=` si es de un contacto y `crm.html` si no es de nadie | `programada_para` (hora de Rubí) |
| `contactos_sin_atender` | Contacto de la web sin `atendido_en` y recibido hace más de 24 h | `alta` | `contactos.html?id=` (la página baja hasta ese contacto y lo marca) | `recibido_en` (UTC) |
| `coches_parados` | Coche en «Publicado» desde hace más de 60 días, contados desde la **primera** vez que pasó a «Publicado» en el historial (una reserva cancelada no pone el contador a cero); sin historial, desde el alta | `alta` desde 90 días; `media` de 60 a 90 | `coche.html?id=` | esa fecha (UTC) |
| `vendidos_publicados` | Coche vendido o entregado con alguna publicación en `retirar`. Un aviso por coche, con los canales en el texto | `alta` | `coche.html?id=` | la `actualizado_en` más antigua de esas publicaciones (UTC) |
| `itv` | Coche que ya está en el patio: ni por recoger ni en transporte (todavía no es nuestro), ni vendido ni entregado, con `itv_caducidad` pasada o en los próximos 30 días. Sin fecha de ITV, no hay aviso | `alta` si ya caducó; `media` si caduca pronto | `coche.html?id=` | `itv_caducidad` (día de aquí) |
| `citas` | Prueba de conducción de hoy (aún no empezada) o de mañana, pedida o confirmada | `alta` si está pedida (sin confirmar); `media` si está confirmada | `agenda.html?semana=` | `inicio` (hora de Rubí) |
| `cobros_vencidos` | **Solo gerencia.** Factura de venta emitida, sin anular, con saldo pendiente y `vencimiento` pasado (el `estado_cobro` `vencida` de facturación) | `alta` | `factura.html?id=` | `vencimiento` |

- **El comercial** solo ve sus tareas (`responsable_id` suyo) y los avisos de coches y contactos. Nunca `cobros_vencidos` ni ningún importe: ninguno de sus textos lleva dinero.
- Gerencia ve las tareas de todos, con el nombre del responsable al final del texto.
- Los umbrales son constantes arriba de `api/src/modules/avisos/routes.js`: `DIAS_PARADO` (60), `DIAS_PARADO_ALTA` (90), `HORAS_SIN_ATENDER` (24) y `DIAS_ITV` (30).
- `fecha` viene en el formato de su columna: `AAAA-MM-DD HH:MM:SS` en UTC para las marcas de la base, `AAAA-MM-DD HH:MM` en hora de Rubí para las tareas y `AAAA-MM-DD` para la ITV y el vencimiento. El orden no compara estos textos: los pasa todos a la misma hora (UTC) antes de ordenar.

Ejemplo (gerencia):

```json
[
  { "tipo": "cobros_vencidos", "gravedad": "alta", "texto": "V26-00041 de Laura Gil: 7.500,00 € sin cobrar",
    "enlace": "factura.html?id=7", "fecha": "2026-10-05" },
  { "tipo": "contactos_sin_atender", "gravedad": "alta", "texto": "Marta Ruiz escribió por la web (prueba) y sigue sin atender",
    "enlace": "contactos.html?id=31", "fecha": "2026-10-06 17:42:10" },
  { "tipo": "itv", "gravedad": "alta", "texto": "Seat Ibiza 1234 BCD: la ITV caducó el 07/10/2026",
    "enlace": "coche.html?id=12", "fecha": "2026-10-07" },
  { "tipo": "vendidos_publicados", "gravedad": "alta", "texto": "Renault Clio 5678 FGH está vendido y sigue por retirar en Coches.net, Wallapop",
    "enlace": "coche.html?id=9", "fecha": "2026-10-07 09:15:00" },
  { "tipo": "coches_parados", "gravedad": "media", "texto": "Peugeot 208 4321 JKL lleva 71 días publicado",
    "enlace": "coche.html?id=3", "fecha": "2026-07-29 10:02:33" },
  { "tipo": "tareas_vencidas", "gravedad": "media", "texto": "Tarea vencida: Llamar por la financiación (Laura Gil) · Comercial",
    "enlace": "clientes.html?id=5", "fecha": "2026-10-08 09:30" }
]
```

## Usuarios (solo gerencia)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /usuarios` | gerencia | Lista sin contraseñas, con `activo` y `ultimo_acceso` |
| `POST /usuarios` | gerencia | `{ nombre, email, rol, contrasena }`, contraseña de 8 caracteres como mínimo. Correo repetido: 409. 201 |
| `PATCH /usuarios/:id` | gerencia | `{ nombre?, rol?, activo?, contrasena? }`. Desactivar o cambiar la contraseña cierra las sesiones abiertas de esa persona (la de quien la cambia se mantiene) |

Nadie se borra: se desactiva, y su nombre sigue en el historial. Nadie puede desactivarse ni cambiarse el rol a sí mismo, y siempre queda al menos una persona de gerencia activa (409).

## Publicación en WordPress (solo gerencia)

Necesita `WP_URL`, `WP_USUARIO` y `WP_CLAVE_APLICACION`; sin ellas, 503. Detalles en `wordpress-pruebas/README.md`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /wordpress/diagnostico` | gerencia | Qué deja escribir la web, sin escribir nada |
| `POST /wordpress/sincronizar` | gerencia | Publica, actualiza y retira. `{ forzar: true }` permite retirar aunque no quede ningún coche a la venta |
| `GET /wordpress/estado` | gerencia | Cada coche con su post de WordPress y el último error |
| `POST /wordpress/vincular` | gerencia | `{ vehiculo_id, wp_post_id }` une un coche con una ficha que ya existía en la web |

## Portales (Coches.net, Milanuncios y Wallapop)

Ningún portal deja cargar los coches sin un intermediario (`docs/portales.md`). Mientras tanto, el panel deja el anuncio listo para copiar, quien lo sube lo marca como publicado y, cuando el coche se vende, confirma la baja en cada portal. Al pasar a «Vendido» o «Entregado», lo publicado queda en `retirar` (`publicacion/retirada.js`) y sale en los avisos hasta que se confirma la baja. La web no va aquí: la lleva el conector de WordPress.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /portales?estado=retirar` | con sesión | Los anuncios de los portales en ese estado (`pendiente`, `publicado`, `retirar`, `retirado` o `error`; sin `estado`, todos), del más antiguo al más nuevo, con `nombre` del portal y `referencia`, `matricula`, `marca`, `modelo` y `vehiculo_estado` del coche |
| `GET /portales/:vehiculoId` | con sesión | `{ vehiculo, a_la_venta, portales, anuncio }`. `portales`: los tres, con `canal`, `nombre`, `estado` (`sin_publicar` si nunca se marcó), `enlace`, `publicado_en`, `retirado_en` y `actualizado_en`. `anuncio`: `titulo`, `precio_euros` (el PVP), `descripcion`, `video_url` y `fotos` (las públicas que no son de daños, en orden, con su `url` del panel) |
| `PUT /portales/:vehiculoId/:canal` | con sesión | `{ estado: "publicado", enlace? }` lo marca subido (solo con el coche publicado o reservado; si no, 409). `{ estado: "retirado" }` confirma la baja (409 si en ese portal no constaba publicado). `enlace`: la dirección del anuncio, `http` o `https`. `canal`: `coches_net`, `milanuncios` o `wallapop` (otro, 404) |

- El anuncio solo usa datos de la ficha: no lleva frases que la ficha no respalde (revisado en taller, financiación…). Es el mismo para los tres portales. Sin precio de compra, proveedor ni margen: lo usan los dos roles.
- Cada cambio queda en `auditoria` (entidad `publicacion`), con el estado y el enlace de antes. El enlace se conserva al retirar.
- Volver a marcar publicado uno que ya lo estaba solo cambia el enlace: `publicado_en` no se mueve.

## Correos (solo gerencia)

La plataforma manda dos correos: el aviso de cada contacto que llega por la web (a `CORREO_CONTACTOS`, en el momento) y el resumen diario de avisos (a `CORREO_AVISOS`, a partir de las `AVISOS_HORA` de Rubí, por defecto las 8, y solo si hay avisos). Se apuntan en la tabla `correos` y `server.js` los manda cada minuto: un SMTP caído no tumba el formulario y lo que falla se reintenta cada vez más espaciado (unas 9 horas en total) antes de quedar en `error`.

**Sin `SMTP_URL`, modo simulado** (duda H13): los correos quedan como `simulado`, con el motivo en `ultimo_error`, y no salen. Lo mismo si falta el destinatario. Variables en `.env.example`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /correos?estado=` | gerencia | Los 200 últimos, del más nuevo al más viejo: `tipo` (`contacto` o `avisos_diario`), `para`, `asunto`, `cuerpo`, `estado` (`pendiente`, `enviado`, `simulado` o `error`), `intentos`, `ultimo_error`, `creado_en`, `enviado_en` |

- El resumen diario usa los avisos de gerencia, **con los cobros vencidos y sus importes**: `CORREO_AVISOS` tiene que ser de gerencia.
- Texto plano. Con `PANEL_URL`, cada aviso y cada contacto llevan el enlace a su página del panel.
- El asunto se queda en una línea: un nombre con saltos de línea en el formulario no puede colar cabeceras.

## Informes (solo gerencia)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /informes?mes=2026-09` | gerencia | El informe del mes (sin `mes`, el actual). Ver abajo |
| `GET /informes/ventas.csv?mes=2026-09` | gerencia | Las ventas del mes para el gestor, en CSV para Excel: `;` entre columnas, coma decimal y BOM. Una celda que empieza por `=`, `+`, `-` o `@` va con un apóstrofo delante para que Excel no la ejecute |

`GET /informes` devuelve:

- `mes` y `meses` (los que tienen ventas, más el actual, para el selector).
- `resumen`: `vendidos`, `vendidos_mes_anterior`, `facturado_cent`, `margen_cent` (neto), `margen_medio_cent`, `ventas_sin_margen` (les falta el coste o el precio, y no se inventa), `gastos_estructura_cent` (gastos del libro de ese mes que no son de ningún coche, sin IVA), `resultado_cent` (margen neto − gastos de estructura) y `dias_medios_venta`.
- `ventas`: cada coche vendido con `fecha_venta`, `vendio`, `precio_venta_cent` (su PVP), `coste_total_cent`, `regimen` (`REBU` o `deducible`), `iva_venta_cent`, `margen_cent` (neto) y `dias_en_stock`. El CSV lleva las mismas columnas.
- `evolucion`: los 12 meses que acaban en el pedido, del más antiguo al más nuevo, para las gráficas. Cada uno con `mes`, `vendidos`, `facturado_cent`, `margen_cent` (neto, `null` sin ventas con margen), `gastos_estructura_cent` y `resultado_cent` (margen − gastos; sin ventas, los gastos en negativo). El último coincide con `resumen`.
- `stock`: `total`, `propios`, `deposito`, `tramos` (menos de 30, 30-60, 60-90 y más de 90 días) y `mas_antiguos` (los 5 que más llevan).

Una venta es el último paso a «Vendido» (o a «Entregado», si se saltó ese paso) de un coche que sigue vendido o entregado: si se deshace la venta, deja de contar. Los meses van en UTC, como las fechas de la base.

## Pendiente

- Citas de mañana en los avisos: cuando exista la tabla de citas.
- El correo sale de verdad cuando haya SMTP (duda H13) y destinatarios (E1). Hasta entonces, simulado.
