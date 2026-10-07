# Reparto del trabajo

El detalle semana a semana está en [plan.md](plan.md).

Las decisiones importantes (alcance, cliente, gastos, producción) las toma **Diego**. Victor coordina y se las prepara.

| Quién | Rama | Bloque |
|---|---|---|
| Victor (jefe de equipo, becario) | `feat/core-api` | API y datos: ficha, estados, reservas, margen e IVA, permisos, avisos e informes y, al final, la migración desde Pymecar. Coordina al equipo, revisa los PR y prepara las decisiones para Diego. |
| Hafsa | `feat/panel-fotos` | Panel interno: tablero por estados, alta y ficha, reservas, subida de fotos y photocall con IA. |
| David | `feat/web-portales` | Hasta el 7-oct: plugin de WordPress, buscador y ficha pública, formularios y contactos, portales y retirada al vender. Desde el 7-oct pasa a Victor, y David entra en la API (ver abajo). |

## Ampliación del 7-oct

Diego añade facturación con Verifactu, gastos, REBU, incentivos, contratos, clientes y proveedores, photocall con vídeo, redes sociales, CRM y cita previa. Lo más difícil, todo lo que toca la web, la investigación y los documentos imprimibles son de Victor. Hafsa hace las maquetas del panel y la prueba de fotos (T07 y T08). David entra en la API con dos partes acotadas: actividades del CRM e incentivos (T11 y T12). El reparto por bloque está en [plan.md](plan.md#ampliación-del-7-oct).

| Quién | Qué |
|---|---|
| Victor (con Claude) | API y lógica de los bloques 1 a 5, 7, 8 y 10: clientes y proveedores, gastos y margen con REBU, facturación, cobros e impagos, Verifactu, contratos, cola de trabajos, fondo con IA y vídeo, Meta y feed de portales, cita previa en la web. Avisos y correo diario del bloque 9. T09: factura y contratos imprimibles. T10: investigación de Verifactu, Meta y partners de portales, y los casos del margen a mano. Revisa los PR de David y le da el número de cada migración. |
| Hafsa | T07: maquetas de clientes, proveedores, gastos, facturas, incentivos, CRM y agenda. T08: prueba del fondo con IA y estados de las fotos. |
| David | T11: API de actividades del CRM (llamadas, visitas, tareas y estado comercial del cliente). T12: API de incentivos (reglas por comercial, cálculo del mes y liquidación). Sus módulos: `api/src/modules/crm` y `api/src/modules/incentivos`. |
