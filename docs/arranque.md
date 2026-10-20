# Guion del arranque (del 21 al 30 de octubre)

Qué se hace cada día hasta que Pro Service trabaja con la plataforma y deja Pymecar, quién lo hace y qué hacer si algo falla. Junta en un orden lo que está repartido en [produccion.md](produccion.md) (las listas), [despliegue.md](despliegue.md) (el servidor), [migracion.md](migracion.md) (Pymecar), [web-real.md](web-real.md) (su WordPress) y [dudas.md](dudas.md) (lo que falta que digan). Los comandos van en esos documentos; aquí, solo cuál toca.

Fechas que mandan ([plan.md](plan.md#fechas-que-mandan)): **Pymecar vence el sábado 31**. Arranque el **jueves 29**, con el viernes 30 de margen. No se arranca en fin de semana.

Quién es quién: **Diego** decide y habla con el cliente; **Victor** despliega y migra; **Jaume** es gerencia de Pro Service; **Francesc** lleva su WordPress y su DNS.

## Lo que hace falta, y antes de cuándo

Cada fila es una duda de [dudas.md](dudas.md). Si la fecha pasa sin respuesta, se aplica la columna de la derecha y se avisa al cliente.

| Antes del | Qué | Quién | Si no llega |
|---|---|---|---|
| **Jueves 22** | Servidor (VPS con Ubuntu) y quién lo paga (A3) | Diego | No hay ensayo el viernes: ver «Plan B» |
| **Jueves 22** | Registro DNS de `stock.proservicerubi.com` hacia el servidor (B8) | Francesc | Se monta todo igual; el certificado se pide cuando apunte |
| **Jueves 22** | Export de prueba de Pymecar (B7) | Jaume | La migración se hace a ciegas el 28: ver «Plan B» |
| **Viernes 23** | Si Pymecar deja un mes más (B2) | Jaume | Sin red si la migración falla |
| **Viernes 23** | «Mostrar en la API REST» en ACF y campo `referencia` (B11, B16) | Francesc | La plataforma arranca sin publicar en la web: ver «Plan B» |
| **Viernes 23** | Correo de envío y a quién llegan contactos y avisos (H13, E1) | Francesc, Jaume | Modo simulado: se ven en el panel, no salen por correo |
| **Viernes 23** | Corte del martes 27 por la tarde y media hora el lunes 26 (G6, G7) | Jaume | Se busca otro hueco esa semana |
| **Lunes 26** | Cuáles de las 35 fichas de la web siguen en venta (B17) | Jaume | No se vincula nada y la web no se conecta |
| **Lunes 26** | El tipo de la cuota (B20) y el mínimo de fotos (D10) | Jaume | 8,75 % a 120 meses y 15 fotos |
| **Lunes 26** | Dónde van las copias de fuera (A3) | Diego | Solo la copia de dentro del servidor |

## Esta semana (del 21 al 23)

**En cuanto haya servidor** (Victor, con quien lo administre):

1. `preparar-servidor.sh` ([despliegue.md](despliegue.md#montar-el-servidor-la-primera-vez)). Mirar la salida entera: es la primera vez que se lanza con root.
2. `/etc/proservice/proservice.env` con lo que se tenga (WordPress con `WP_SINCRONIZAR_MINUTOS=0`, `CUOTA_TIN=8.75`).
3. Claves SSH de Victor y, cuando todos entren con clave, quitar las contraseñas.
4. Primer despliegue (`proservice-desplegar`) y comprobar `/api/salud`.
5. **Ensayo general en el servidor**, con los datos ficticios ([migracion.md](migracion.md#ensayo-general-con-datos-ficticios)): un usuario de gerencia de prueba, migrar, mirar el panel, `proservice-restaurar antes-de-migrar` para volver a dejarlo vacío. Así se prueban de verdad, con root, el despliegue, la migración y la restauración.
6. Copias fuera, si ya hay destino ([copias-fuera.md](copias-fuera.md)), y lanzar una a mano.

**Con el export de prueba** (Victor): pasar sus columnas a nuestras plantillas, ensayo hasta cero errores y apuntar lo que no cuadra para preguntarlo a Jaume el lunes.

**Viernes 23, demo con Diego**: el recorrido completo de [plan.md](plan.md#verificación) en el servidor, con los datos ficticios: alta de un coche, 15 fotos, publicar, reservar, vender, un contacto desde el formulario, una factura. Diego decide aquí si se sigue con el 29 o se activa el plan B.

## Lunes 26

- **Mañana** (Victor): desplegar la última versión de `main` (PR de `develop` a `main` con el OK de Diego). Borrar los datos ficticios del ensayo: `proservice-restaurar antes-de-migrar` deja la base como antes de migrarlos, y después desactivar el usuario de gerencia de prueba (Usuarios, en el panel).
- **Usuario de Jaume** (Victor, con Jaume delante, que escribe él la contraseña): `npm run usuario` ([despliegue.md](despliegue.md#montar-el-servidor-la-primera-vez), paso 5). Tiene que existir antes de migrar: las facturas cargadas quedan a su nombre.
- **Media hora con Jaume** (G7), en el panel: dar de alta un coche, subir fotos, pasarlo por los estados, una reserva, una factura de prueba que luego se anula. Lo que le moleste se apunta y se arregla lunes y martes.
- **Ensayo con el export real** (Victor): hasta cero errores. Revisar con Jaume los avisos y 5 coches al azar ([migracion.md](migracion.md#cómo-se-usa)).
- **La lista de las 35 fichas** (B17), rellenada por Jaume: prepara la vinculación del miércoles.

## Martes 27

- **Arreglos** de lo que salió el lunes. Cada uno, su PR y su despliegue; si alguno da problemas, `proservice-desplegar --volver`.
- **Ensayo otra vez** con el export real, hasta cero errores.
- **Por la tarde, el corte** (G6), con el OK de Diego después de ver el ensayo: desde ese momento **no se da de alta nada en Pymecar**. Lo que entre o se venda hasta el jueves se apunta en papel o en un Excel, y se mete en la plataforma el jueves.

## Miércoles 28: la migración

1. **Export final** de Pymecar (Jaume) y paso a las plantillas (Victor).
2. **Ensayo** sobre el servidor, hasta cero errores.
3. **Carga** con `--aplicar`, con el OK de Diego. La migración copia antes la base (`proservice-restaurar antes-de-migrar` la recupera).
4. **Copia a mano** justo después: `sudo systemctl start proservice-copia`.
5. **Comprobaciones** con Jaume: la serie `V26` sigue en el número de Pymecar (H8), los coches del stock están y en su estado, cinco facturas al azar contra sus PDF de Pymecar, las que quedaron sin cobrar salen en Avisos.
6. **Usuario del comercial** (rol `comercial`): entra y no ve compra, costes ni margen.
7. **La web, solo si B11 está hecho**: vincular cada coche en venta con su ficha (lista de B17), bajar las fotos de la web y pasar a borrador las fichas de vendidos ([web-real.md](web-real.md#pasos-para-conectarla-en-orden)). Sin B11, nada de esto: ver «Plan B».

## Jueves 29: arranque

La lista de [produccion.md](produccion.md#jueves-29), en orden: salud con la versión, Jaume entra y guarda un cambio, el comercial no ve dinero, primera sincronización con la web (si B11) y comprobarla en el navegador, un contacto desde una ficha real, una cita con día y hora, una tasación con fotos desde el móvil, 25 fotos de golpe desde el panel. Si todo va: `WP_SINCRONIZAR_MINUTOS=5` y reiniciar la API. Meter lo apuntado en papel desde el martes.

Victor, disponible todo el día; Diego, para decidir si algo obliga a volver atrás.

## Viernes 30: margen

Arreglar lo que salga el jueves. **Última decisión del plan B**: si algo grave no se ha resuelto, Diego decide hoy si Pro Service sigue con Pymecar un mes más (B2), porque el sábado vence.

## Plan B

| Si pasa esto | Qué se hace |
|---|---|
| No hay servidor el jueves 22 | Sin ensayo en el servidor no se arranca el 29 con garantías. Diego decide el viernes 23: arrancar igual con lo ensayado aquí, o retrasar una semana con el mes extra de Pymecar (B2) |
| No llega el export de prueba | El 28 se migra a ciegas. Si Pymecar deja el mes extra, mejor retrasar la migración; si no, se migra con el export final y se revisa más despacio |
| La migración del 28 sale mal | `proservice-restaurar antes-de-migrar`, se corrige y se repite el jueves. Mientras, Pymecar sigue siendo el bueno (por eso el corte es el martes y Pymecar vence el sábado) |
| B11 no está hecho | La plataforma arranca igual, sin publicar en la web (`WP_SINCRONIZAR_MINUTOS=0`): Jaume sigue dando de alta en WordPress a mano como hoy, y se conecta cuando Francesc lo active. Las fotos del stock se bajan de las páginas públicas |
| No hay SMTP | Modo simulado: los contactos y los avisos se ven en el panel. Jaume los mira allí hasta que haya correo |
| Una versión nueva rompe algo | `proservice-desplegar --volver` (y, si cambió datos, `proservice-restaurar antes-de-COMMIT`) |
| Se cae el servidor | Servidor nuevo con [despliegue.md](despliegue.md#montar-el-servidor-la-primera-vez) y la copia de fuera ([copias-fuera.md](copias-fuera.md#recuperar-una-copia-de-fuera)) |

## La primera semana

La de [produccion.md](produccion.md#primera-semana): el resumen de avisos de cada mañana, la copia de cada noche (también la de fuera), los correos en error, las reservas que caducan solas, los anuncios por retirar de los portales y el disco. Y una llamada corta con Jaume el lunes 2 para recoger lo que le moleste.
