# Pymecar: lo que usan hoy

Revisado el 7-oct-2026 entrando con el usuario de gerencia, **solo mirando**: no se guardó, borró ni exportó nada. Pymecar 2.0 (versión 2.3.92, de FNSOFTWARE). Aquí no van nombres, DNI ni teléfonos de clientes o proveedores: solo cifras, campos y cómo trabajan.

## Lo que más cambia el plan

1. **El stock es mucho menor de lo que dice el briefing.** Pymecar tiene 76 coches desde 2024 y hoy unos **8 en stock** (valorados en 29.561 €). Han vendido 38 en 2026 hasta el 1-oct, **unos 4 al mes**, no 12. Rotación media: 37,6 días. El briefing hablaba de 50 en stock (10 propios y 40 de terceros) y 12 ventas al mes. Hay que preguntarlo: o meten en Pymecar solo una parte, o el briefing exageró.
2. **El depósito funciona distinto de lo que habíamos supuesto.** Lo llaman **«Cesión de vehículos para venta»**: 17 cesiones desde 2024, casi todas de un mismo compraventa profesional, y alguna de particulares. Hoy no hay ninguna activa (stock cedido: 0 €). Al venderse, el coche cedido **entra como compra** («procedencia: cesión») y se vende en **REBU**, como uno propio. El margen es venta − lo pactado con el cedente, y el IVA va sobre esa diferencia. Cierra la duda B3.
3. **Facturan con una sola empresa:** PROSERVICE OCASIÓN SL, B56845381 (sigla PRO), con domicilio fiscal en C/ Llull 321, planta 4, 08191 Rubí (Barcelona), según la cabecera de sus contratos.
4. **Calculadora de cuota:** 7,5 % de interés anual y 10 años de plazo. Cierra B13 y E2.
5. **Pymecar puede publicar en portales a través de Inventario.pro** (hay un campo para su API key y en cada coche un «Publicar en web» y «Publicar en portales»). **No lo usan:** la clave está vacía y el coche revisado tenía las dos en NO.
6. **Muchas pantallas están vacías:** agentes (0), comisiones a agentes (0), gestores (0), tasaciones (0), pedidos (0), tareas (0). Contactos: 15, el último de 2025. Lo de CRM, tasaciones y comisiones no lo usan hoy.

## Menús

- **Ficheros:** configuración general, empresas, usuarios, tareas a usuarios, accesos, clientes (80), proveedores (58), agentes, gestores, contactos, financieras (1: Lendrock), aseguradoras, tipos de gastos, IVA, IRPF (15 %, 7 % y 19 %), formas de pago, poblaciones.
- **Vehículos:** vehículos, marcas, modelos, tasaciones.
- **Entradas:** compras de vehículos (77), facturas de compra de empresas (51), facturas REBU de particulares (25), cesión de vehículos para venta (17).
- **Ventas:** pedidos, reservas (2), facturas de venta (68), facturas proforma, solicitud de provisionales, comisiones a agentes.
- **Libros contables:** ingresos, REBU, gastos.

## Ficha del coche

Cinco pestañas:

- **Datos básicos:** marca y modelo (catálogo cerrado), versión, carrocería, combustible, cambio, puertas, matriculación (mes y año), bastidor, matrícula, cilindrada, potencia, km, color, última y próxima ITV, **uso anterior** (particular o profesional), precio de venta neto y con impuestos, vendido sí/no, en stock sí/no, fotos ordenables.
- **Web / Portales:** publicar en web, publicar en portales, mantener en web cuando se vende, descripción, vídeo de YouTube, precio sin oferta (tachado), cuota de financiación calculada, equipamiento de serie importado de JATO y textos SEO (título, descripción y palabras clave generados con la marca, el modelo y «Rubí»).
- **Extras:** casillas en 4 grupos (exterior, interior, seguridad, otros), unos 30.
- **Documentación:** ficha técnica, permiso de circulación y otros documentos escaneados, más observaciones.
- **Revisión:** checklist con controlado, información adicional, sustituido y cubierto. Recepción: ficha técnica, permiso, libro de mantenimiento, checklist de entrada, 2.ª llave. Entrega: 2.ª llave, gato o kit, rueda de recambio, triángulos, chalecos, alfombrillas…
- **Documentos imprimibles:** ficha del vehículo y certificado de kilometraje.

En la lista: filtros por entrada (COM compra / CES cesión), reservado, **seguro de flota** (con, sin, alta o baja solicitada), vendido, en stock y **revisado**.

## Compras

- Cada compra lleva procedencia (compra o cesión), tipo de proveedor (EMP empresa o PAR particular), documento (FRA factura o ALB albarán), si está facturada y el total.
- **Compra a un profesional:** se apunta su factura (con su número) en «Facturas de compra (empresas)».
- **Compra a un particular:** Pymecar emite su propio documento de compra en REBU, numerado, en «Facturas R.E.B.U. (particulares)». Hay que emitirlo igual.
- La configuración tiene «Compras en libro de gastos: SÍ»: las compras salen también en el libro de gastos.

## Ventas y facturas

- Serie **`V26`** (`V25` el año pasado), número de cinco cifras: `V26-00038` (en la lista del coche sale como `F-V26-00038`). La 38 fue el 1-oct.
- La factura de venta lleva: cliente, forma de pago, coche, **uso destino** (particular o profesional), precio neto, subvención, descuento, **régimen (REBU o general)**, base, IVA (0, 10 o 21 %), total, **gastos de gestoría como suplidos**, total de la operación, **entrega de un coche como parte del pago**, financiación sí/no, hasta dos formas de pago adicionales con importe, **garantía** (comprada, directa o sin garantía, de 1 a 36 meses, con fecha de fin), comisión sí/no y **datos del contrato** (fecha, hora, km, otros usos, cláusulas adicionales) y observaciones.
- **El contrato se imprime desde la factura** (botón «Contrato»), igual que la solicitud de provisional y la revisión de componentes. No hay contratos sueltos. Su cabecera: lugar, fecha y hora; la nota del RDL 1/2007 (consumidores); vendedor y comprador con domicilio, municipio, código postal y provincia; y el vehículo con clase, marca y modelo, uso anterior, estado, última ITV, matrícula, bastidor, próxima ITV, km, primera matriculación y combustible. Dice que lleva un anexo con el estado del vehículo (su «Revisión componentes»): nosotros aún no lo generamos.
- Hay botón de **Devolución** (rectificativa).
- **Reservas:** 2 en total, de 500 € de señal, ninguna facturada. Llevan forma de pago.
- Formas de pago: a la vista, contado (efectivo), pago a 30 días, a 30 y 60 días, tarjeta y transferencia.

## Libros

- **Libro de ingresos:** serie, número, fecha, cliente, forma de pago, base, IVA, subvención y total. En REBU, la base y el IVA son solo los del margen.
- **Libro REBU:** numerado por coche (va por el 60). Compra (fecha, proveedor, NIF, base, IVA y total) y venta (fecha, factura, cliente, NIF, base, IVA, subvención y total).
- **Libro de gastos:** número de registro correlativo (313), fecha, número de la factura del proveedor, proveedor, agente o cliente, gasto (concepto), observaciones y total. Tipos de gasto: gasto general, gasto con IRPF, comisiones agentes, factura con REBU y gasto vehículo. Conceptos: alquileres, carburantes, comisiones, compras, electricidad, gestorías, papelerías, publicidad y vehículos.

## Proveedores

Alta con: nombre, proveedor o acreedor, tipo (empresa…), NIF, país, dirección, código postal, población, provincia, teléfono, móvil, e-mail, **IBAN, forma de pago, persona de contacto** y observaciones.

## Contactos (su CRM)

15 contactos, de 2024 y 2025: fecha, nombre, coche de interés, financiación, llamada, canal (tienda, Wallapop, Coches.net, web), visita, fase (análisis, oferta presentada…), seguimiento con fecha y prioridad. Lo dejaron de usar.

## Dudas que cierra y dudas nuevas

Cierra:
- **B3** (depósito): se cede, al vender se compra al cedente y se vende en REBU.
- **B5** (REBU): el IVA va sobre la diferencia; caso real comprobado al céntimo.
- **B13 y E2** (cuota): 7,5 % y 10 años.
- **H8** a medias: razón social, CIF y serie `V26`. Falta el domicilio fiscal.

Nuevas, para Jaume:
- ¿Cuántos coches tenéis de verdad en stock y cuántos vendéis al mes? En Pymecar salen unos 8 y unos 4.
- ¿Los coches en depósito los dais de alta en Pymecar? Ahora no hay ninguno.
- ¿Usáis la garantía «comprada» (con una aseguradora) o solo la directa?
- ¿Las nóminas las lleva la gestoría?

## Lo que no pasamos (vacío en Pymecar)

Decidido el 7-oct: lo que no tiene datos en Pymecar no se lleva a la plataforma.

- **Fuera:** tasaciones (la tasación de la web sigue entrando como contacto), pedidos de clientes, gestores (la gestoría es un proveedor o acreedor más) y agentes como pantalla propia (un comisionista es un proveedor de tipo `comisionista`).
- **Se quedan aunque estén vacíos, porque los pidió Diego el 7-oct:** CRM con tareas, llamadas y visitas (T11), incentivos (T12) y comisiones como concepto de gasto. Si Diego decide quitarlos, se quitan.

## Lo que esto cambia en nuestra plataforma

- **Ficha:** añadir uso anterior, última ITV, precio sin oferta, seguro de flota y revisado (con el checklist de recepción y entrega). ✅ Todo (migraciones `0015` y `0019`). La lista de componentes de la revisión es provisional: falta ver la de Pymecar.
- **Compras:** documento de compra REBU para particulares, numerado; factura del proveedor para empresas; la cesión como forma de entrada.
- **Factura de venta:** uso destino, suplidos de gestoría, coche entregado como parte del pago, formas de pago adicionales, garantía (tipo y meses), datos del contrato y devolución. ✅ Todo menos subvención y descuento, que esperan a la gestoría (H7). Las formas de pago adicionales son los cobros de cada factura, cada uno con su forma, y así salen en el contrato. El contrato de compraventa ya lleva el anexo del estado del vehículo.
- **Contratos:** que salgan de la factura o de la reserva, como en Pymecar.
- **Tres libros:** ingresos, REBU y gastos.
- **Proveedores:** IBAN, móvil, forma de pago, persona de contacto, y proveedor o acreedor.
