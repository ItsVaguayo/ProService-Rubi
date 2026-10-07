# T07 · Maquetas del panel de gestión

**Quién:** Hafsa.
**Para cuándo:** en cuanto acabes T06. Una página por tarde, en el orden de la lista.
**Qué aprendes:** a diseñar pantallas de trabajo con muchos datos sin que se vuelvan ilegibles. Jaume las va a usar todos los días.

## Objetivo

Siete páginas nuevas del panel, en HTML y CSS, con datos de ejemplo escritos a mano. Victor las conecta a la API después: tú no escribes JavaScript.

| Página | Qué enseña |
|---|---|
| `clientes.html` (su API ya existe: los campos están en `docs/api.md`, «Clientes y proveedores») | Lista de clientes con buscador (nombre, teléfono, DNI). Al pulsar uno, su ficha: datos, coches que ha comprado, facturas y lo último que se habló con él. Botón «Nuevo cliente» con su formulario: particular o empresa, nombre o razón social, DNI/NIE/CIF, dirección, teléfono, correo. |
| `proveedores.html` | Igual que clientes, con el tipo (profesional, particular, subasta, comisionista) y los coches que nos ha vendido. |
| `gastos.html` | Formulario corto arriba (fecha, categoría, concepto, importe sin IVA, IVA, ¿pagado?) y debajo la lista del mes con filtros por mes y categoría. Categorías: coche, personal, proveedor, comisión, otros (en la API se llamarán `vehiculo`, `personal`, `proveedor`, `comision` y `otros`). Si es de un coche, se elige el coche. Total del mes por categoría arriba. |
| `facturas.html` | Lista con número, fecha, cliente, coche, total, cobrado y estado (pendiente, parcial, cobrada, vencida). Arriba, dos cifras: pendiente de cobro y vencido. Filtro por estado. |
| `incentivos.html` | Dos versiones en la misma página, separadas por un comentario: la de gerencia (todos los comerciales, coches vendidos en el mes, importe, botón «Liquidar») y la del comercial (solo lo suyo, **sin** el margen de cada coche). |
| `crm.html` | Arriba, las columnas del embudo: Nuevo, Interesado, Me lo pienso, Negociando, Ganado, Perdido, con tarjetas de clientes como el tablero de coches. Abajo, «Hoy»: llamadas, visitas y tareas del día con su hora y un botón «Hecho». |
| `agenda.html` | La semana de lunes a sábado en columnas, con las pruebas de conducción como bloques (hora, coche, cliente, estado: pedida, confirmada, hecha, no vino). Botones «Confirmar» y «Cambiar hora» en cada una. |

## Ficheros

- Crear las siete páginas en `frontend/panel/`.
- Estilos nuevos al final de `frontend/css/panel.css`, con un comentario `/* T07 · nombre de la página */` encima de cada bloque.
- Añadir los enlaces nuevos al menú de **todas** las páginas del panel. Los de dinero (gastos, facturas, incentivos) van debajo de `menu__separado`, con Informes y Usuarios.

## Pasos

1. Copia `contactos.html` y cámbiale el nombre. Así ya tienes el menú, la cabecera negra y los estilos.
2. Cambia `aria-current="page"` al enlace de la página nueva.
3. Escribe los datos de ejemplo: 6 a 10 filas que parezcan reales (coches de verdad del stock de prueba: mira `api/scripts/sembrar-pruebas.js`). Una fila de cada estado, para ver todos los colores.
4. Reutiliza lo que ya hay en `panel.css` antes de inventar: `.filtros`, `.segmentos`, `.opciones`, la tabla de `coches.html`, las columnas de `index.html`, las cifras de `informes.html`.
5. Comprueba cada página en el ordenador y en el móvil (en Chrome: F12 y el icono del móvil, 390 px de ancho). En el móvil una tabla ancha se convierte en tarjetas, como en `coches.html`.
6. Commit por página: `T07: maqueta de gastos`.

## Cómo sé que está bien

- Las siete páginas se abren desde el menú de cualquier otra.
- En 390 px de ancho no hay barra de desplazamiento horizontal.
- El dinero sale siempre con el mismo formato: `12.450 €` (punto de miles, sin decimales salvo en gastos e impuestos).
- PR hacia `develop` con «T07» en la descripción.

## Segunda vuelta (después del PR #11)

El 7-oct se miró Pymecar, el programa que usan hoy, y dos maquetas tienen que parecerse más a lo que ya conocen. Un PR aparte, con «T07b» en la descripción.

### `gastos.html`: el modelo de Pymecar

Cada gasto lleva **dos datos** en vez de una categoría:

1. **Tipo**, que dice cómo se calcula y a qué libro va. Cinco opciones:
   - **Gasto general**: factura normal con IVA (luz, publicidad, software).
   - **Gasto con IRPF**: de un autónomo o profesional con retención (gestoría, abogado, alquiler del local). Al elegirlo aparecen dos campos más: **% de retención** (por defecto 15 %; 19 % en alquileres) y su importe. El total a pagar es base + IVA − retención.
   - **Comisiones agentes**: lo que se paga a un comisionista. Se elige el proveedor (de tipo comisionista): no hay pantalla de agentes.
   - **Factura con REBU**: la compra de un coche a otro compraventa, sin IVA. Se elige el coche.
   - **Gasto vehículo**: taller, transporte, limpieza… de un coche. Se elige el coche.
2. **Concepto**, para agrupar. La lista de Pymecar: ALQUILERES, CARBURANTES, COMISIONES, COMPRAS, ELECTRICIDAD, GESTORÍAS, PAPELERÍAS, PUBLICIDAD, VEHÍCULOS.

Al elegir el concepto se propone el tipo: Alquileres y Gestorías → con IRPF; Comisiones → Comisiones agentes; Vehículos → Gasto vehículo; Compras → Factura con REBU; el resto → Gasto general. Jaume lo puede cambiar.

Además, en el formulario y en la lista:
- **Nº de registro** del gasto (correlativo, lo pone el programa: «313»).
- **Nº de la factura del proveedor** («F-26-000153»).
- **A quién**: proveedor o cliente (sin agentes: en Pymecar no hay ninguno).
- En la lista, una columna de **IRPF** junto a la de IVA.
- Las cifras de arriba, por **tipo** en vez de por categoría.
- Sin nóminas por ahora: Pymecar no las lleva y está preguntado (no metas «Personal»).

### `facturas.html`: la numeración real

Las facturas de venta van como en Pymecar: serie del año, guion y cinco cifras. **`V26-00038`**, `V26-00039`… Cambia los números de ejemplo a ese formato.

### Cómo sé que está bien

- En gastos no queda ninguna de las categorías viejas (Coche, Personal, Proveedor, Comisión, Otros).
- Al elegir «Gasto con IRPF» se ven los campos de la retención (en la maqueta pueden estar siempre visibles, con un comentario que diga que solo salen con ese tipo).
- PR hacia `develop` con «T07b».
