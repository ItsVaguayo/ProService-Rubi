# Plan de trabajo · Plataforma de stock Pro Service Rubí

> **Cómo se trabaja (actualizado el 30-sep).** El equipo empieza desde HTML, CSS y Git básico, a media jornada. Las piezas técnicas de este plan (API, login, seguridad, servidor y migración) las monta Claude. Victor, Hafsa y David trabajan con fichas paso a paso en [docs/tareas](tareas/README.md), empezando por maquetas, datos e investigación. Diego tiene que decidir si, con este equipo, se mantiene todo el alcance para el 29-oct.

## Contexto

Pro Service Rubí es una compraventa de coches de ocasión en Rubí, con taller propio. Tienen unos 50 coches en stock (10 suyos y 40 de terceros en depósito) y mueven unos 12 al mes. Trabajan dos personas: Jaume y el comercial. Francesc lleva la web.

Hoy cada coche se teclea varias veces: en Pymecar, en su web de WordPress y a mano en Coches.net, Milanuncios y Wallapop. Publicar un coche en todos lados puede tardar una semana, y alguna vez se les ha quedado anunciado uno ya vendido. Las fotos son lo que más les duele.

Lo que piden:

1. **Dar de alta el coche una sola vez** y que salga solo en la web y en los portales.
2. **Colgar de esa misma ficha** el proveedor, los costes (compra, transporte, taller, limpieza, impuestos) y el margen, que solo ven ellos.
3. **Seguir el coche por estados**, desde que se compra hasta que se entrega, con reservas con señal (mínimo 300 €) que se vean en la web.
4. **Fotos más rápidas**: Jaume hace de 15 a 25 con el móvil, en orden fijo, y quiere que una IA las ponga sobre el fondo de su photocall.
5. **Web conectada, no rehecha**: buscador con todos los filtros, ficha con formulario, WhatsApp, prueba de conducción, cuota orientativa, financiación, tasación y compartir.
6. **Números de los lunes**: márgenes y ventas, días parado de cada coche y avisos automáticos.

Lo que NO quieren: rellenar la ficha por matrícula, puntuar proveedores ni cobrar la señal online. La web es solo en España.

Fuera de la primera versión (Parte B del briefing): CRM con reparto de clientes por turno, calendario de pruebas, firma digital de la entrega, postventa y facturación. Solo recogemos los contactos que entran por la web.

## Fechas que mandan

- **Pymecar vence el sábado 31-oct.** El arranque real es el **jueves 29-oct**, con el viernes 30 de margen para fallos. No se arranca en fin de semana.
- **Lunes 12-oct es festivo** (Pilar). La semana 2 tiene cuatro días.
- Semanas de lunes a viernes. Todos los trabajos de la semana se entregan como PR a `develop` antes del **viernes a las 14:00**.
- **Demo al cliente cada viernes** por la tarde, 20 minutos, con lo que haya en `develop`. Así Jaume corrige pronto y no descubrimos en la semana 4 que algo no le sirve.

| Semana | Días | Objetivo |
|---|---|---|
| 0 | mié 30-sep a vie 2-oct | Arranque: dudas al cliente, contrato de la API, entorno listo |
| 1 | 5 a 9 oct | Alta y tablero funcionando con datos de prueba |
| 2 | 13 a 16 oct | Ficha completa, fotos, web leyendo el stock. Servidor de pruebas en marcha |
| 3 | 19 a 23 oct | Reservas, avisos, formularios, portales, photocall |
| 4 | 26 a 30 oct | Pruebas con Jaume, migración y arranque |

## Quién decide qué

**Las decisiones importantes las toma Diego.** Victor es el jefe de equipo (becario): coordina, reparte, revisa el código y prepara cada decisión para que Diego solo tenga que elegir.

| Decide Diego | Decide Victor | Decide cada uno |
|---|---|---|
| Alcance, precio y todo lo que se le promete al cliente | Cómo se reparte el trabajo y en qué orden dentro de la semana | Cómo resuelve su bloque, dentro del contrato de la API |
| Todo lo que se le envía al cliente (Victor lo redacta, Diego lo revisa y lo manda o da el OK) | Diseño técnico: esquema, contrato de la API, estructura del código | |
| Gastos: servidor, photocall, servicios de carga en portales | Aprobar los PR a `develop` | |
| Qué se aplaza si vamos tarde | Pedir ayuda a Diego cuando algo se atasca más de un día | |
| Vía para cada portal (con la tabla de David) | | |
| Subir a producción, el corte y la migración real | | |

Cómo se le pide una decisión a Diego: un mensaje corto con el problema, dos o tres opciones con lo que cuesta cada una y la que recomienda Victor. Si Diego no contesta en un día y bloquea a alguien, se le recuerda; no se decide por él.

## Semana 0: lo que hay que cerrar antes del viernes 2-oct

La lista completa de dudas, con las de fases posteriores, está en [dudas.md](dudas.md). Aquí van solo las que bloquean.

Victor redacta **un solo mensaje** para el cliente con todo esto y se lo pasa a Diego, que lo revisa y lo envía por el canal del Chat. Lo que no conteste el cliente antes del lunes 5 se hace con la opción por defecto, y así se lo decimos en el mensaje. Antes, Diego resuelve el bloque A de `dudas.md`.

| Pregunta | Por qué bloquea | Si no contestan |
|---|---|---|
| Facturación: si Pymecar se va, ¿con qué facturan desde el 1-nov? | Dicen tener facturación verificable. No la vamos a construir | Se les recomienda mantener Pymecar solo para facturar o contratar uno aparte. Nosotros exportamos los datos de venta |
| ¿Pymecar deja ampliar un mes? | Es el plan B si la migración falla | Se les pide que lo pregunten igualmente |
| En los coches en depósito (40 de 50), ¿cómo se gana? Comisión fija, porcentaje o diferencia con lo que pide el dueño | Sin esto, el margen del 80 % del stock sale mal | Margen = PVP menos lo que se le paga al dueño |
| Regla de REBU o IVA deducible y quién la decide en cada compra | Cambia el margen | REBU por defecto, editable por coche |
| ¿Rellenamos los 30 coches que ya tienen en WordPress o montamos un listado nuevo? (duda A7, decide Diego) | Cambia todo el bloque de David | Sin defecto: David espera |
| Una ficha real de un coche y un export de prueba de Pymecar | La ficha cierra el esquema. El export solo sirve para comprobar que los datos salen: la migración no se toca hasta el final | Sin defecto. Sin export no hay migración |
| Accesos de WordPress, hosting y DNS (Francesc) | Sin ellos no se instala el plugin ni el subdominio de la API | Sin defecto |
| ¿Cómo carga hoy la web los coches? ¿Plugin, feed de Pymecar, a mano? | Si Pymecar alimenta la web, el 31 se queda vacía | Se lo preguntamos a Francesc directamente |
| Fondo del photocall y orden fijo de las fotos por escrito | Photocall y subida de fotos | Orden estándar: frontal, 3/4 delantero, lateral, 3/4 trasero, trasera, interior, cuadro, maletero |
| Días que dura una reserva | Caducidad automática | 7 días |
| TIN orientativo y plazos para la calculadora de cuota | Calculadora de la web | Sin defecto: no publicamos un tipo de interés inventado. La calculadora no sale hasta tenerlo |
| Número de WhatsApp y correo donde llegan los contactos | Formularios | Sin defecto |
| Qué avisos quieren y a quién le llegan | Avisos | Todos los de la lista de Victor, a Jaume por correo |

Además, en la semana 0:

- **Victor** escribe `docs/api.md`: cada endpoint con lo que recibe y lo que devuelve. Es el contrato. Hafsa y David trabajan contra ese documento aunque el endpoint aún no exista, y un cambio en el contrato se avisa en el canal del equipo.
- **Victor** propone dónde vive la API (por ejemplo, un VPS con subdominio `stock.proservicerubi.com`) con su coste mensual, y **Diego** decide dónde y quién lo paga.
- **Victor** añade una GitHub Action que pase `npm test` en cada PR.
- **Cada uno** clona, arranca con `npm run dev` y confirma en el canal que le funciona.

## Reglas del equipo

- **Solo la API toca la base de datos.** Panel, web y portales pasan por la API.
- `api/migraciones/` es de Victor. Si alguien necesita una columna, la pide y Victor la añade en menos de un día con una migración nueva, o se propone en un PR pequeño aparte. Una migración ya mergeada no se edita.
- **Cada uno en su módulo**: `api/src/modules/vehiculos` (Victor), `modules/fotos` (Hafsa), `modules/publicacion` y `modules/contactos` (David). Si tu módulo necesita reaccionar a algo de otro módulo, el dueño de ese módulo expone una función y tú la usas. No se edita el módulo de otro.
- **Ramas**: `main` (producción), `develop` (integración), `feat/core-api`, `feat/panel-fotos` y `feat/web-portales`. Se trae `develop` a la rama propia cada mañana. PR a `develop` con tests en verde. Victor revisa en menos de un día. `main` solo se toca para desplegar.
- **Seguimiento**: 10 minutos al empezar el día en el canal del equipo: qué hice, qué hago y qué me bloquea. Un bloqueo de más de medio día se dice, no se espera.
- **Con el cliente habla Diego.** Victor le prepara los mensajes y las preguntas; Hafsa y David no escriben al cliente. Si necesitan algo de Jaume o de Francesc, se lo piden a Victor.

## Arquitectura (ya montada en la plantilla)

```
Panel (HTML y CSS) ────┐                                  ┌──► WordPress de la web (API REST, usuario Editor)
                       ├──►  API (Express + SQLite)  ─────┤      posts «coches» + campos ACF + fotos
Portales (exportación) ◄┘       única dueña de los datos  │      plugin buscador: filtros, ficha y 301
                                                          └◄── formularios de la web (contactos)
```

- **Web (duda A7, decidida el 1-oct)**: la API publica los coches en los posts «coches» que ya tiene la web, por la API REST de WordPress, con un usuario Editor y una contraseña de aplicación. Sin administrador. El plugin no escribe coches: es el buscador, la ficha opcional y el 301 de los retirados. Detalle en `wordpress-pruebas/README.md`.

- **Login**: sesión con cookie en el panel. Dos roles: `gerencia` (Jaume, ve todo) y `comercial` (no ve dinero). El dinero se quita en la respuesta de la API, no solo se esconde en el panel.
- **Público**: el envío de formularios no lleva login. El envío de formularios lleva un campo trampa contra spam y límite de peticiones por IP.
- **Fotos**: la API las guarda reducidas (lado largo 1.600 px, JPG). A la web las sube ella misma por REST, una sola vez cada una. Los portales usarán su URL pública.
- **Copias**: base de datos y fotos, una vez al día, fuera del servidor.

## Victor · jefe de equipo · `feat/core-api`

Te toca que los datos sean correctos, que los otros dos no se bloqueen y que Diego tenga cada decisión preparada a tiempo.

**Semana 0**
- Repasar con Diego el bloque A de `dudas.md`, redactarle el mensaje al cliente, `docs/api.md`, propuesta de servidor y GitHub Action (ver arriba).

**Semana 1**

Hecho en el **PR #1** («Cimientos de la API»), cuando se acepte:
- ~~Login y roles~~: sesión con cookie; el comercial no recibe dinero.
- ~~`PUT /api/vehiculos/:id`~~, con lista blanca de campos.
- ~~Reglas de estado~~: publicar exige la ficha completa y 15 fotos; reservar exige una reserva activa.
- ~~Gancho `alCambiarEstado`~~ para David (`registrarAlCambiarEstado` en `vehiculos/eventos.js`).
- ~~Migraciones~~ (`api/migraciones/`), dinero en céntimos, datos del dueño en depósito y registro de cambios.

Queda:
- Aceptar el PR #1 y comprobar que los tres arrancáis con Node 22.
- Arreglo pendiente del PR: al editar un coche publicado o reservado, volver a comprobar los obligatorios (hoy se le puede vaciar el precio y sigue publicado).
- Cerrar el esquema con la ficha real: lista cerrada de extras (tabla nueva, en `0002_...`) y **proveedor** para los coches propios. El PR solo guarda el dueño de los que están en depósito.
- `npm run seed` con 10 coches repartidos por estados y los dos usuarios de prueba. Son los datos con los que se trabaja hasta la migración. **Para el lunes 5 a mediodía.**
- `docs/api.md` con el contrato real. Ojo: los importes van en céntimos (`*_cent`) y `PATCH /estado` devuelve el coche.

**Semana 2**
- Levantar el **servidor de pruebas** con HTTPS y desplegar `develop` en él. David lo necesita para probar el plugin en un WordPress de verdad.
- Reservas: crear, cancelar y caducar solas a los N días. Reservar pasa el coche a «Reservado» y cancelar lo devuelve a «Publicado». Una reserva activa por coche como máximo.
- Margen neto con la regla de IVA del cliente y el caso depósito. Tests con los números de la ficha real.
- Tabla `contactos` para David.
- Rutas de usuarios para la página «Usuarios» del panel, solo para gerencia: listar, añadir, cambiar la contraseña y desactivar o reactivar (`GET/POST /api/usuarios`, `PATCH /api/usuarios/:id`). Nadie puede desactivarse a sí mismo. Hoy los usuarios solo se crean desde la terminal con `npm run usuario`.

**Semana 3**
- Avisos: coche con más de 60 y 90 días, ITV que caduca en 30 días, vendido que sigue publicado en algún canal, contacto sin atender en 24 horas. Correo diario a quien diga el cliente y la misma lista en un endpoint para el panel.
- Informes del lunes: stock por antigüedad, días parado de cada coche, margen por coche y ventas del mes.
- Exportación de ventas en CSV para el gestor y para lo que facture.

**Semana 4**
- **Lunes 26**: producción montada (con el OK de Diego), copias diarias comprobadas (restaurar una vez para ver que funciona).
- **Migración, lo último de todo**, con la plataforma ya cerrada:
  - Lunes 26 y martes 27: script desde el export de Pymecar y ensayo sobre una copia. Se revisan con Jaume 5 coches al azar.
  - **Martes 27 por la tarde: corte**, si Diego da el OK tras ver el ensayo. Desde ese momento no se da de alta nada en Pymecar.
  - **Miércoles 28**: export final y carga real: los coches vivos, los clientes y 5 años de ventas (el histórico entra sin fotos).
- **Jueves 29**: arranque. **Viernes 30**: fallos.
- Si la migración falla el miércoles, el plan B es el mes extra de Pymecar pedido en la semana 0.

## Hafsa · `feat/panel-fotos`

Te toca lo que Jaume va a usar cada día. Si el panel es lento o le pide datos de más, volverá a Pymecar. Jaume trabaja desde el PC y el comercial puede entrar desde el móvil, así que el panel tiene que verse bien en las dos cosas.

**Semana 1**
- Pantalla de login (usa lo de Victor desde el miércoles 7; hasta entonces, contra `docs/api.md`).
- Tablero por estados (la maqueta está en `frontend/panel/index.html`): cambiar un coche de estado con un clic. Si la API rechaza el cambio (por ejemplo, publicar con pocas fotos), se enseña el motivo.
- Formulario de alta por bloques: identificación, mecánica, carrocería, documentación, proveedor y dinero. Los obligatorios se marcan y se validan antes de enviar. El bloque de dinero solo aparece para gerencia.

**Semana 2**
- Ficha del coche: ver y editar, historial de estados, coste total y margen (solo gerencia).
- Subida de fotos desde el ordenador: arrastrar varias a la vez, ordenarlas arrastrando, marcar las de daños y decidir si se ven en la web. En la API, `POST /api/fotos/:vehiculoId` con `multer`: reducir, guardar en `api/data/uploads` y devolver la URL. Borrar una foto y reordenar también.
- **Prueba del photocall**, sin meterlo aún en el flujo: tres fotos reales de Jaume con dos servicios de recorte de fondo y el fondo del cliente. Anotar calidad, segundos por foto y precio por foto. El viernes 16 se enseña a Victor, que se lo pasa a Diego con el coste (unos 12 coches × 20 fotos al mes). Diego decide y pide el OK al cliente.

**Semana 3**
- Reservas desde la ficha: cliente, señal (mínimo 300 €) y días; botón para cancelar.
- Photocall en el flujo, si Diego y el cliente dieron el OK: al subir, la foto se procesa en segundo plano y se guarda en `ruta_photocall`. Si falla o tarda, se usa la original y se marca para reintentar. Un interruptor por foto para usar la original.
- Campo de vídeo de YouTube en la ficha.
- Lista de contactos que llegan de la web (de David), con un botón de «atendido».

**Semana 4**
- Pantalla de avisos e informes con los datos de Victor.
- Lunes 26: sesión de una hora con Jaume usando el panel con coches de verdad. Lo que le moleste se corrige el lunes y el martes.

## David · `feat/web-portales`

Te toca todo lo que ve el cliente final y los portales. Tu bloque es el que quita el trabajo que más les duele.

**Semana 0 y semana 1**
- Con los accesos que consiga Diego a través de Victor, averiguar cómo carga hoy la web los coches y qué URLs de fichas existen. Si hay fichas indexadas en Google, se redirigen al listado nuevo para no perder visitas.
- ~~Montar un WordPress local con una copia de la web.~~ Hecho: `wordpress-pruebas/` imita la web real tal como se ve desde su API REST (`montar.sh`).
- Investigar cada portal: Coches.net, Milanuncios y Wallapop. Qué vía de carga profesional tiene cada uno (XML, FTP, importador, programa homologado), qué pide, cuánto cuesta y cuánto se tarda en darla de alta. **Tabla a Victor el martes 6**. Victor añade su recomendación y Diego decide ese mismo día y se lo dice al cliente.

**Semana 2**
- **Duda A7 decidida (1-oct): se rellenan sus coches por la API REST.** Ya hecho y probado contra `wordpress-pruebas/`:
  - Publicación desde la API (`api/src/modules/publicacion/wordpress.js`): diagnóstico, sincronizar, vincular las fichas que ya existen y retirar. Nunca datos de compra, proveedor ni margen.
  - Plugin buscador (`wp-plugin/proservice-stock/`): listado con los filtros de la 5.4, ficha con galería y vídeo (opcional), cintas «Reservado» y «Vendido», y 301 de los coches retirados.
- Pendiente para cerrar con la web real: usuario Editor (B8), «Mostrar en la API REST» en el grupo de ACF (B11) y los nombres reales de los campos para ajustar `WP_MAPA`.

**Semana 3**
- En la ficha pública: formulario, WhatsApp con el coche ya escrito en el mensaje, pedir prueba, calculadora de cuota orientativa, pedir financiación, tasar su coche y compartir.
- Cada formulario envía el contacto a `POST /api/contactos` (módulo `contactos`, tuyo), con casilla de privacidad obligatoria y enlace a la política de la web. El correo al comercial sale en el momento.
- Portales, según lo que se decidió el martes 6: carga automática donde se pueda y, donde no, un botón en el panel que deje el texto y las fotos listos para pegar en el formato de cada portal. El estado de cada canal se guarda en la tabla `publicaciones`.
- Retirada al vender: con `alCambiarEstado`, cuando un coche pasa a «Vendido» o «Entregado», sus publicaciones quedan en «retirar». El panel lo enseña hasta que alguien confirme la baja en cada portal (hoy se les olvida). Si hay carga automática, se retira solo.

**Semana 4**
- Lunes 26 y martes 27: con Francesc, instalar el plugin buscador en la web real (sin enlazarlo aún en el menú), lanzar el diagnóstico y probarlo en móvil.
- Antes de la primera sincronización: vincular las 30 fichas que ya existen con sus coches, para conservar sus URLs.
- Jueves 29, con la migración hecha: primera sincronización y enlazar el listado en el menú. Los coches retirados redirigen solos con 301.
- Comprobar que un coche dado de alta en el panel sale en la web en menos de cinco minutos (`WP_SINCRONIZAR_MINUTOS`).

## Si vamos tarde, se cae en este orden

Es una propuesta: la decisión de aplazar algo la toma Diego, y Victor le avisa en cuanto vea que no llegamos. Lo primero de la lista es lo primero que se aplaza a noviembre:

1. Informes (los números se pueden sacar de la exportación CSV).
2. Calculadora de cuota y formulario de tasación.
3. Photocall con IA (se publica con las fotos originales).
4. Avisos por correo (se quedan solo en el panel).

Lo que **no se cae**: ficha, estados, login con el margen oculto, fotos, web con listado y ficha, retirada al vender, formulario de contacto y migración. Sin eso no pueden dejar Pymecar.

## Verificación

- Tests en verde en cada PR (GitHub Action). Cada módulo con sus tests en `api/test/`.
- Con un usuario `comercial`: la API no devuelve precio de compra, proveedor ni margen en ningún endpoint.
- Recorrido completo en el servidor de pruebas el **viernes 23**: alta de un coche, 15 fotos, publicar, sale en la web, un contacto desde la web llega al panel y al correo, reservar, sale «Reservado», vender, queda «retirar» en todos los portales.
- Ensayo de migración revisado con Jaume antes del corte del martes 27.
- Copia de seguridad restaurada una vez antes del arranque.
