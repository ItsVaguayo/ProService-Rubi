# Dudas abiertas

Lo que el briefing deja sin contestar, contesta a medias o contradice. Cada duda lleva la referencia del briefing, por qué importa, qué hacemos si no contestan y quién la tiene que resolver.

Victor lo redactó en **un solo mensaje** para que Diego lo revisara y lo enviara antes del **viernes 2-oct**. Lo que no esté contestado el **lunes 5** se hace con la opción por defecto y así se les avisa en el mismo mensaje. El bloque A es interno: lo resolvemos con Diego antes de escribir al cliente.

Cuando una duda se cierre, se marca con ✅, se anota la respuesta y la fecha, y se actualiza `docs/plan.md` si cambia algo.

**Marcas:** ✅ resuelta (o construida con la opción por defecto, que de momento vale) · ➖ ya no importa para el desarrollo · sin marca, sigue abierta. Nada se borra: la respuesta y la fecha van en la misma fila.

## Lo que de verdad queda (revisado el 20-oct)

**Bloquean el arranque del 29-oct:**

| # | Qué | Quién |
|---|---|---|
| A3 | Servidor de producción | Diego **20-oct:** las copias fuera del servidor ya están hechas (cifradas, con rclone, [copias-fuera.md](copias-fuera.md)): solo falta elegir dónde (un almacenamiento S3 cuesta céntimos al mes para unos pocos GB) y quién lo paga. |
| B7 | Export de Pymecar (la migración es el 28) | Jaume |
| B2 | Plan B: un mes más de Pymecar | Jaume |
| B11 | Exponer ACF en la API REST de su web | Francesc |
| B17 | Cuáles de las 35 fichas de la web siguen en venta | Jaume |
| D10 | Mínimo de 15 fotos: 28 de las 35 fichas tienen menos | Jaume |
| E1, H13 | A quién llegan los contactos y desde qué correo salen | Jaume, Francesc |
| G6, G7 | Corte del martes 27 y media hora con Jaume el lunes 26 | Jaume |

**Importan, pero no paran el arranque:** B8 (administrador y DNS), B20 (el tipo de la cuota: publican al 8,75 %), B12, B16, B18, B19 y B14 (la web), C5 (N2), D4, D7, D8 y D9 (photocall), E5 (privacidad), E9 (TAE de la cuota), H3 (abogado), H7 (gestoría), H8 (número de la serie), H9 (incentivos) y las internas A1, A2, A4, H2 y H15.

Todo lo demás está resuelto, construido con la opción por defecto o ya no importa.

---

## A. Internas: con Diego, antes de hablar con el cliente

| # | Duda | Por qué importa |
|---|---|---|
| A1 | ¿Hay propuesta firmada con alcance, plazo y precio? El briefing promete «alcance cerrado, plazo y precio» antes de arrancar. | Sin alcance firmado, cada cosa que pidan a mitad de obra entra gratis. |
| A2 | En SaaSFlow hay un trabajo de Pro Service de 2.500 € + IVA con entrega el 31-dic. ¿Es este proyecto? | Si lo es, el plan de cuatro semanas para tres personas no cuadra con el precio, y la fecha tampoco coincide con el 31-oct. **20-oct:** el precio está cerrado en 2.500 € + IVA; la fecha que manda es el 29-oct (Pymecar vence el 31). Falta confirmar si el trabajo de SaaSFlow es este. |
| A3 | ¿Quién paga el servidor, el servicio de photocall y la carga en los portales si tiene coste? | Son gastos mensuales. Tienen que estar en la propuesta o el cliente los asume aparte. **20-oct:** queda solo el **servidor**. El photocall con rembg corre en nuestro servidor sin coste por foto (D3) y los portales van con el anuncio para pegar, sin servicio de pago (E6). Sin servidor no hay arranque. **20-oct:** las copias fuera del servidor ya están hechas (cifradas, con rclone, [copias-fuera.md](copias-fuera.md)): solo falta elegir dónde (un almacenamiento S3 cuesta céntimos al mes para unos pocos GB) y quién lo paga. |
| A4 | Con el cliente habla Diego. ¿Por el canal `proservice-plataforma-coches` del Chat? ¿Jaume y Francesc pueden preguntar dudas técnicas directamente a Victor? | Evitar que el cliente reciba mensajes cruzados y que Diego haga de intermediario en cada detalle. |
| A5 | ¿La reparación de la web de la 5.2 («ya hemos quedado que se repara») la hacemos nosotros? ¿Quién y cuándo? | Si otra persona toca la web a la vez que David instala el plugin, se pisan. |
| A6 ➖ | ¿Dedicación de Hafsa y David? ¿Jornada completa hasta el 30-oct? | El plan está hecho suponiendo que sí. **Ya no importa (20-oct):** el reparto cambió el 7-oct ([reparto.md](reparto.md)) y casi todo lo de la primera versión está construido. |
| A7 ✅ | Su web ya tiene 30 coches en WordPress, cada uno con su página en `proservicerubi.com/coches/...` (tipo de contenido `coches` con campos ACF, visto el 30-sep en `/wp-json/wp/v2/coches`). ¿La plataforma **rellena y actualiza esos mismos coches** de WordPress, o montamos **un listado nuevo** con nuestro plugin? | Con un listado nuevo, las 30 páginas actuales quedan duplicadas o huérfanas y se pierde lo que ya tengan en Google. Rellenar las suyas conserva su diseño y sus URLs, pero hace falta el acceso de administrador de Francesc para ver los campos. Hasta que se decida, David no avanza el plugin. **Respuesta (Diego, 1-oct):** se rellenan sus mismos coches. La API los publica por la API REST de WordPress con un usuario Editor y contraseña de aplicación, sin administrador. El plugin queda solo como buscador, ficha opcional y 301 de los coches retirados. Ver B8 y B11. |

---

## B. Bloquean el arranque: respuesta antes del lunes 5-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan | Quién |
|---|---|---|---|---|---|
| B1 ✅ | Si dejáis Pymecar el 31-oct, ¿con qué vais a facturar desde el 1-nov? | 9.2, 9.3, 14.1 | Hoy facturáis con Pymecar y decís tener facturación verificable. La plataforma nueva no factura. | Recomendamos mantener Pymecar solo para facturar o contratar un programa aparte. Nosotros exportamos las ventas. **Resuelta por la ampliación del 7-oct:** la plataforma sí factura (series, rectificativas, cobros, libros) y las facturas de Pymecar se importan con su número. Verifactu, aplazado a 2028 (H1). Pymecar no se renueva (confirmado el 9-oct). | Jaume |
| B2 | ¿Pymecar os deja ampliar un mes, aunque sea sin usarlo? | 14.1 | Es el plan B si la migración falla el 28-oct. | Os pedimos que lo preguntéis igualmente. | Jaume |
| B3 ✅ | En los coches en depósito (40 de 50), ¿cómo ganáis? Comisión fija, porcentaje o diferencia con lo que pide el dueño. | 1.2, 3.5 | Sin esto, el margen del 80 % del stock sale mal. | **Visto en Pymecar (7-oct):** la cesión se vende como un REBU. Al venderlo, se le compra al dueño lo pactado y se vende en REBU: el margen es la diferencia, con el IVA del REBU. Así lo calcula ya la plataforma. | Jaume |
| B4 ✅ | En un coche en depósito, ¿qué guardáis del dueño? Nombre, teléfono, precio pactado, fecha del acuerdo… | 1.2 | Hay que añadirlo a la ficha. | Nombre, teléfono y precio pactado. **Construido por defecto:** nombre, teléfono y lo pactado con el dueño en la ficha. En Pymecar, la cesión entra como compra al dueño (B3). | Jaume |
| B5 ✅ | ¿Cuándo es REBU y cuándo IVA deducible? ¿Quién lo decide en cada compra? | 9.1 | Cambia el cálculo del margen. | **Visto en Pymecar (7-oct):** lo decide la factura de compra (si trae IVA o no), no el tipo de proveedor. Fórmula del REBU comprobada al céntimo con una venta real. Por defecto REBU, editable por coche. Falta que la gestoría confirme las fórmulas (H7). | Jaume o gestoría |
| B6 ✅ | Una ficha real de un coche con todos los datos que metéis hoy. | 3.9 (en blanco) | Es lo que cierra los campos de la ficha. | Sin defecto: la necesitamos. **Visto en Pymecar (7-oct):** sus campos están en [pymecar.md](pymecar.md) y la ficha se ajustó en el PR #22 (precio sin oferta, seguro de flota, revisado). | Jaume |
| B7 | Un export de prueba de Pymecar (coches y clientes). Solo para comprobar que los datos salen. La migración va al final. | 13.2, 13.6 | Si Pymecar no deja sacar algo, hay que saberlo ahora y no el 28. | Sin defecto: sin export no hay migración. **20-oct: sigue sin llegar** y es de lo que más bloquea: la migración es el 28. El importador ya está hecho con plantillas propias ([migracion.md](migracion.md)). | Jaume |
| B8 | Acceso a WordPress, al hosting y al DNS del dominio. Para publicar los coches basta un **usuario Editor** con su contraseña de aplicación (A7). El administrador solo hace falta una vez, para instalar el buscador. | 5.3 | Sin el Editor no se publica nada; sin administrador no hay buscador ni 301; sin DNS no hay subdominio para la API. | **20-oct: Editor conseguido**, con contraseña de aplicación ([web-real.md](web-real.md)). Faltan el administrador (una vez, para el buscador y el 301) y el DNS. | Francesc |
| B9 ✅ | Hemos visto que los coches de la web están en WordPress (30 publicados el 1-oct, **35 el 20-oct**, todos a mano por los títulos, con campos ACF). ¿Quién los da de alta hoy y cómo: a mano, con un plugin o los manda Pymecar? | 5.1, 4.5 | Si los manda Pymecar, la web se queda vacía el 31. | Se lo preguntamos a Francesc directamente. **Visto en Pymecar (7-oct):** Pymecar no alimenta la web («Publicar en web» en NO e Inventario.pro sin clave). Se dan de alta a mano, como dicen los títulos. La web no se vacía el 31. | Francesc |
| B10 | ¿Francesc es de la empresa o externo? ¿Tiene que entrar al panel? ¿Con qué permisos? | 5.3, 11.3, 14.6 | Permisos y a quién se le pregunta cada cosa. | Sin acceso al panel, solo a WordPress. | Jaume |
| B11 | En WordPress, el grupo de campos de ACF de «coches» no está expuesto en la API REST (comprobado el 1-oct en `/wp-json`). ¿Puede Francesc marcar «Mostrar en la API REST» en ese grupo? Es una casilla. | 5.2, 4.4 | Sin ella, la plataforma solo puede mandar título, estado y marca: ni precio, ni km, ni fotos. El buscador solo filtraría por marca. | Se publica título, estado y marca y se avisa de lo que falta. **20-oct: comprobado con el Editor, sigue sin exponer.** Es lo que bloquea conectar la web. | Francesc |
| B12 | En las fichas de la web, el título grande y el «Conoce el …» salen vacíos, y el año también (revisado el 1-oct). ¿Qué campo debería llevar el nombre del coche? ¿Se rellena el año? | 3.1, 5.5 | La plataforma tiene que escribir en esos campos para que la ficha salga completa. | Mandamos modelo y año en los campos que más se parecen y lo comprobamos con el diagnóstico. **20-oct:** espera a B11; sin ACF en la API REST no se puede comprobar. | Francesc |
| B13 ✅ | La cuota «Desde X €/mes» de cada coche, ¿quién la calcula hoy y con qué tipo de interés y plazo? | 5.7, E2 | Es un dato que meten a mano. La plataforma no lo calcula sin el tipo de interés, así que en los coches nuevos esa línea no saldría. | **Visto en Pymecar (7-oct):** 7,5 % y 10 años. Desde el 19-oct la plataforma la calcula con eso (sobre el precio si financia o el PVP, sin entrada) y la manda a la web y al anuncio de los portales. Se cambia con `CUOTA_TIN` y `CUOTA_MESES`. | Jaume |
| B14 | El formulario de «Solicita tu prueba gratuita» de la web, ¿adónde manda las solicitudes hoy (correo, CRM, nada)? | 5.6, 8.1, 8.6 | Es el mismo contacto que queremos que entre en la plataforma. Si ya llega a algún sitio, hay que conectarlo y no duplicarlo. | Se deja como está y los contactos de la plataforma entran por los formularios nuevos. | Francesc |
| B15 ➖ | Aviso, no pregunta: el filtro de «Potencia mínima» de su página /coches/ no devuelve nada (con 130 CV debería salir el Kia Niro de 138 CV). El de precio funciona. | 5.4 | Un cliente que filtra por potencia ve que no hay coches. | Se lo decimos a Francesc para que lo revise. **No afecta al desarrollo (20-oct):** es un fallo de su tema, no de la plataforma. Queda decírselo a Francesc. | Francesc |
| B16 | ¿Puede Francesc crear un campo de texto `referencia` en el grupo de ACF de «coches»? La plataforma escribe ahí la referencia de cada coche (PS-00031). | 5.6, 8.1 | Con ella, un contacto que llega por el formulario de la ficha queda unido a su coche en el panel. Sin ella llega igual, con el título y la dirección del coche escritos en el mensaje. | El formulario pone el coche en el mensaje. | Francesc |
| B17 | En la web hay **35 fichas publicadas** y ninguna en borrador (20-oct), pero en Pymecar había unos 8 coches en stock. ¿Cuáles siguen en venta? Tabla para rellenar en [web-real.md](web-real.md#las-35-fichas-para-jaume). | 6.6, 2.2 | La plataforma solo retira las fichas que conoce: una ficha que no se vincule a un coche se queda publicada para siempre. Los vendidos que sigan en la web hay que vincularlos o pasarlos a borrador antes de la primera sincronización. | Sin defecto: sin la lista no se vincula nada. | Jaume |
| B18 | La marca de la web es jerárquica (Seat → Arona) pero solo la llevan 2 de 35 fichas, y faltan marcas del stock (Mini, Mitsubishi, Jeep, Land Rover, Volkswagen). ¿Se usa para algo (filtro, menú)? ¿Hay que poner también el modelo? | 5.4 | La plataforma pone la marca y crea la que falte; el modelo no. | Solo la marca. | Francesc |
| B19 | «TOYOTA PROACE 150CV DIESEL 8 PLAZAS» está publicada dos veces (fichas 8503 y 8362). ¿Son dos furgonetas o un duplicado? | 2.2 | Si es un duplicado, una de las dos se queda publicada sin coche detrás. | Se pregunta antes de vincular. | Jaume |
| B20 | Las cuotas «Desde X €/mes» que publicáis desde julio salen a un **8,75 %** aproximadamente (25 de 34 a 120 meses; algunas a un plazo más corto), no al 7,5 % de la calculadora de Pymecar (comprobado el 20-oct en las 35 fichas). ¿Qué tipo y qué plazo usáis ahora? ¿Cambia el plazo según el coche? | 5.7, B13 | La plataforma calcula la cuota de todas las fichas con un solo tipo y un solo plazo (`CUOTA_TIN`, `CUOTA_MESES`). Con el 7,5 %, al conectar la web bajarían 32 de 34 cuotas (14 € de media, hasta 87 €): anunciaríamos menos de lo que da la financiera. | **En producción, `CUOTA_TIN=8.75` hasta que lo confirméis.** Un plazo distinto por coche no está construido. | Jaume |

---

## C. La ficha y los estados: antes del viernes 9-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| C1 ✅ | Habéis marcado como obligatorio casi todo, incluidos los costes. Pero cuando un coche está «Pendiente de recoger» todavía no sabéis los kilómetros exactos ni lo que costará el taller. ¿Obligatorio para darlo de alta o para publicarlo? | 3.1 a 3.5 | Si es para el alta, no podréis apuntar un coche hasta tenerlo todo y seguiréis con el Excel. | Para darlo de alta: matrícula, marca y modelo. El resto es obligatorio para publicar. (El precio de compra no se exige al dar de alta porque el comercial no puede escribir datos de dinero.) **Construido así** (matrícula, marca y modelo para el alta). |
| C2 ✅ | En el bloque 3.4 hay dos columnas marcadas y no se sabe cuáles. ¿Algún campo de estado y documentación sale en la web? | 3.4 | Es lo que se ve o no en la ficha pública. | Ninguno sale en la web salvo la garantía. **Construido así.** |
| C3 ✅ | En la 5.5 respondéis «ya lo hemos respondido», pero no está. ¿Precio siempre visible o «consultar»? ¿Teléfono? ¿Ubicación exacta? ¿Bastidor? ¿Número de propietarios? | 5.5 | La ficha pública. | Precio siempre visible y teléfono sí. Ubicación solo «Rubí». Bastidor y propietarios no. **Construido así.** |
| C4 ✅ | ¿Un coche puede saltarse estados? Por ejemplo, uno que llega limpio y va directo a fotos. ¿Y volver atrás? | 2.2 | Si el sistema obliga a pasar por todos, lo saltaréis a mano. | Se puede mover a cualquier estado, y queda apuntado quién y cuándo. **Construido así**, con historial de estados. |
| C5 | ¿Cuántos días se enseña «Vendido» en la web antes de desaparecer? | 2.2 | Habéis marcado que se vea. | 7 días. **20-oct:** hoy «Vendido» sale en la web hasta que alguien lo pasa a «Entregado». Es la decisión N2 de Diego (recomendado: retirarlo solo a los 7 días). |
| C6 ✅ | Reservas: ¿cuántos días dura una reserva? Si el cliente no compra, ¿se devuelve la señal? ¿Queréis apuntarlo? | 2.4 | La caducidad automática y el registro de la señal. | 7 días. Se apunta si la señal se devolvió o no. **Construido:** 7 días por defecto (de 1 a 60), caduca sola y al cancelar se apunta si se devolvió la señal. |
| C7 ✅ | ¿Qué os interesa de la «referencia interna»? ¿Tenéis ya un formato? | 3.1 | Si ya usáis una, hay que respetarla en la migración. | `PS-00001` automática. **Construido:** `PS-00001`, también para los coches migrados. |
| C8 ✅ | Lista cerrada de extras: ¿nos pasáis la que usáis o partimos de la de Coches.net? | 3.7 | Hay que cargarla antes de dar de alta coches. | Partimos de una lista estándar de unos 40 extras y la revisáis. **Hecho en la T06** (PR #19): lista cerrada de extras. |
| C9 ✅ | Los dos sitios, patio del taller y parking: ¿el cliente de la web tiene que saber en cuál está el coche? | 1.5, 5.4 | Filtro de ubicación en la web. | Solo se usa dentro. En la web, «Rubí». **Construido así.** |
| C10 ✅ | Proveedores: la 7.2 está vacía. ¿Queréis una lista de proveedores para elegir en cada coche o basta con escribir el nombre? | 7.2 | Si hay lista, se puede sacar el margen por proveedor que pedís en la 12.2. | Lista sencilla: nombre y teléfono. **Construido** (ampliación del 7-oct): tabla de proveedores con sus datos fiscales y de pago. |

---

## D. Fotos: antes del viernes 16-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| D1 ✅ | El orden fijo de las fotos, por escrito. | 4.3 | Decís que existe, pero no lo habéis escrito. | Frontal, 3/4 delantero, lateral, 3/4 trasero, trasera, interior delantero, interior trasero, cuadro con km, maletero, motor. **Construido así:** huecos fijos en la pantalla de fotos. |
| D2 ✅ | El fondo del photocall: una foto o un archivo del fondo que queréis. | 4.4 | Sin él no se puede probar. | Sin defecto: sin fondo no hay photocall. **Resuelta de otra forma (19-oct):** su plató no es un fichero fijo, su herramienta lo genera en cada foto. Hemos generado dos fondos propios (de frente y de tres cuartos), probados con 11 coches. Ver [photocall-web-actual.md](photocall-web-actual.md). |
| D3 ✅ | El photocall cuesta dinero por foto (unas 240 fotos al mes). ¿Lo aprobáis cuando os enseñemos la prueba y el precio? | 4.4 | Es un gasto mensual. | Se publica con las fotos originales. **Sin coste por foto (19-oct):** rembg corre en nuestro servidor; solo pide unos 2 GB de memoria más. Photoroom no hace falta. |
| D4 | La IA solo cambia el fondo; el coche no se toca. ¿De acuerdo? | 4.4 | Si la IA «arregla» un golpe, el anuncio engaña al comprador y el problema es vuestro. | Solo fondo. **19-oct, más importante que antes:** la herramienta que usan hoy redibuja el coche (cambió la matrícula del i20 y las llantas del Colt). El photocall propuesto no toca los píxeles del coche. Hay que contárselo y que lo confirmen. |
| D5 ✅ | Fotos de daños: ¿quién decide en cada coche si se enseñan? | 4.8 | «Depende de si lo vamos a reparar». | Casilla por foto: por defecto no se enseñan. **Construido:** casillas «daño» y «en la web» por foto. |
| D6 | ¿Hay que migrar fotos antiguas? ¿Cuántos gigas y dónde están? | 13.5 (en blanco) | Espacio en el servidor y tiempo de migración. | Solo las de los coches en stock. El histórico va sin fotos. **20-oct:** las del stock se bajan de su web (PR #20), pero solo cuando ACF esté expuesto (B11). |
| D7 | La banda de abajo (garantía, taller, dirección y teléfono), ¿en todas las fotos? ¿Y en las de los portales? | 4.4, 6.1 | Hoy no la llevan todas. Creemos que Wallapop y Milanuncios no admiten teléfonos en las fotos (sin comprobar sus normas). | Con banda para la web y sin banda (solo el logo) para los portales. |
| D8 | La matrícula, ¿se publica o se tapa? | 4.4, 5.5 | Hoy la publican; su herramienta incluso la cambió en una foto del i20. Si se tapa, lo hace nuestro código sobre la foto, no una IA. | Se publica tal cual. |
| D9 | Fotos de prueba de Jaume hechas con el móvil, como las hace hoy (frontal, tres cuartos e interior). | 4.2, 4.4 | El photocall solo se ha probado con fotos de internet y con las suyas ya retocadas. | Sin defecto: sin ellas no se puede dar por bueno. **20-oct: las hay públicas.** 13 fichas de su web llevan las originales del móvil (JPG de 1600 × 1200, [web-real.md](web-real.md#lo-que-dicen-sus-fichas-públicas-20-oct)). Sirven para probar el photocall sin esperar a Jaume. |
| D10 | En vuestra web, 28 de las 35 fichas tienen menos de 15 fotos (de 1 a 21). En el briefing pedisteis un mínimo de 15, y la plataforma no deja publicar un coche con menos. ¿Lo mantenemos? | 4.1 | Si se mantiene, la mayoría del stock que hoy está en la web no se podrá publicar desde la plataforma hasta tener más fotos. | El mínimo se cambia con `FOTOS_MINIMAS` en el `.env` (por defecto 15). Proponemos empezar con el que digáis y subirlo después. | Jaume |

---

## E. Web y portales: antes del viernes 16-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| E1 | Número de WhatsApp y correo donde tienen que llegar los contactos de la web. | 5.6 | Formularios y botón de WhatsApp. | Sin defecto. **20-oct:** sigue sin llegar. Sin destinatario, los contactos de la web solo se ven en el panel. |
| E2 ✅ | Tipo de interés orientativo y plazos para la calculadora de cuota. | 5.7 | No podemos publicar un tipo inventado. | **7,5 % y 10 años, de su calculadora de Pymecar (7-oct).** Ver B13. |
| E3 ✅ | Pedir financiación: ¿el formulario solo os avisa o hay que mandar algo a Lendrock o BBVA? | 5.6, 9.5 | Una cosa es un correo y otra conectar con una financiera. | Solo os avisa. **Construido por defecto:** la petición entra como contacto de tipo `financiacion` en el panel, con su aviso; a la financiera no se manda nada. |
| E4 ✅ | Tasación: ¿qué datos pedís del coche del cliente? ¿Fotos? | 5.6, 8.7 | El formulario de tasación. | Marca, modelo, año, km, teléfono y hasta 5 fotos. **Construido** (PR #23): esos datos y hasta 5 fotos. |
| E5 | ¿Tenéis política de privacidad y de cookies en la web? | — | Los formularios la necesitan para recoger datos. | Revisamos la que haya. Si no hay, se avisa como pendiente legal. |
| E6 ✅ | Portales: cuando os digamos qué vía tiene cada uno (martes 6), ¿estáis dispuestos a dar de alta un servicio de carga si tiene coste? | 6.5, 6.7 | Pagáis 3.000 € al mes en portales. La carga automática puede tener un coste aparte. | Nos quedamos con «anuncio listo para pegar». **Construido por defecto:** anuncio listo para pegar y baja obligatoria al vender ([portales.md](portales.md)). |
| E7 ➖ | Usuarios y contraseñas de Coches.net, Milanuncios y Wallapop, o que nos pongáis en contacto con su soporte. | 6.5 | Para preguntar por la carga profesional. | Lo investigamos sin acceso. **Ya no hace falta:** la investigación de la T04 se hizo sin acceso y se quedó en el anuncio para pegar. |
| E8 ➖ | Google (anuncios de vehículos) y mobile.de quedaron en blanco. ¿Os interesan? | 6.1 | Si sí, es fase 2. | Fuera. **Fuera** de la primera versión. |
| E9 | La cuota «Desde X €/mes»: ¿la financiera cobra comisión de apertura u otros gastos? ¿Y se puede añadir en su web un campo de texto `cuota_condiciones` junto a la cuota? | 5.7 | Un anuncio con la cuota tiene que llevar un ejemplo con la TAE y el importe total adeudado (Ley 16/2011, art. 9). Desde el 20-oct la plataforma lo calcula sin comisiones y lo manda en el anuncio de los portales y en `cuota_condiciones`. Si cobran apertura, la TAE de verdad es más alta. Su web no tiene ese campo, así que allí la cuota saldría sola; el listado («o X €/mes») tampoco lo lleva. Conviene que lo mire el abogado (H3). | La cuota no se activa en la web real hasta tenerlo: `CUOTA_MESES=0` o la sincronización apagada. El diagnóstico de WordPress avisa si falta el campo. Jaume (comisiones) y Francesc (campo). |

---

## F. Números, avisos y usuarios: antes del viernes 23-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| F1 ✅ | ¿Qué avisos queréis y a quién le llegan? | 12.4 («sí») | No se puede programar un «sí». | Coche con 60 y 90 días, ITV en 30 días, vendido aún publicado y contacto sin atender en 24 h. A Jaume por correo, una vez al día. **Construido:** contactos sin atender, coches parados, vendidos aún publicados, anuncios por retirar, ITV, citas, cobros vencidos y tareas. El correo diario sale cuando haya SMTP (H13). |
| F2 ✅ | En la 12.2 respondéis «todo». ¿Cuáles tres miraríais cada lunes? | 12.1, 12.2 | Con «todo» se hacen informes que nadie abre. | Stock por antigüedad, margen por coche y ventas del mes. **Construido:** informes del lunes en el panel. |
| F3 ✅ | ¿Qué le pasáis al gestor, cada cuánto y en qué formato? | 12.3 | La exportación. | CSV mensual de ventas. **Construido:** CSV de ventas, y además los libros de la facturación. |
| F4 ✅ | La tabla de roles (11.1) está vacía. ¿Jaume es gerencia y el comercial es comercial? ¿Alguien más? | 1.6, 11.1 | Permisos. | Jaume gerencia, comercial sin ver dinero. **Construido así.** |
| F5 ✅ | En la 11.3 el comercial aparece como «de fuera». ¿Es externo? ¿Ve los clientes de todos? | 11.3 | Si es externo, el acceso se limita más. | Ve coches y contactos, nunca compra ni margen. **Construido así.** |
| F6 ✅ | Cuando alguien se va, «no pasa nada». ¿Queréis al menos un botón para desactivar su usuario? | 11.4 | Seguridad básica. | Sí, lo ponemos. **Construido:** usuarios activos e inactivos. |

---

## G. Antes del arranque

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| G1 ➖ | Si solo pudiéramos construir una cosa, ¿cuál sería? | 14.2 (en blanco) | Dice qué se protege si vamos tarde. | La que dice el plan: ficha, fotos, web y retirada al vender. **Ya no importa (20-oct):** lo que el plan protegía ya está construido. |
| G2 | ¿Quién firma la propuesta? Nombre y cargo. | 14.5 (en blanco) | Contrato. | Sin defecto. |
| G3 | ¿A alguien de dentro le va a molestar el cambio? | 14.7 (en blanco) | Si el comercial no lo usa, la plataforma no sirve. | Lo preguntamos en la demo. |
| G4 | ¿Qué funciona bien y no hay que tocar? ¿Quién arregla las cosas cuando fallan? | 10.2, 10.3 (en blanco) | Evitar romper algo que va bien. | Nada, y el soporte es nuestro. |
| G5 ➖ | ¿Nos pasáis los Excels que usáis, tal cual? | 10.4 (en blanco) | Suelen explicar el negocio mejor que el briefing. | Seguimos sin ellos. **Ya no importa:** lo que explicarían se vio directamente en Pymecar el 7-oct. |
| G6 | Del 27 por la tarde al 29 no se da de alta nada en Pymecar. ¿Os va bien esa fecha o hay algo que lo impida? | 14.1 | Es el corte de la migración. | Se mantiene. **20-oct:** sigue en pie y depende de B7 y del servidor (A3). |
| G7 | ¿Media hora el lunes 26 para probar el panel con coches de verdad? | — | Última corrección antes del arranque. | Se busca otro hueco esa semana. |

---

## H. Ampliación del 7-oct

Sale de la lista nueva de Diego. Las H1 a H6 son internas (Diego); las H7 en adelante, para el cliente.

| # | Duda | Por qué importa | Mientras tanto | Quién |
|---|---|---|---|---|
| H1 ✅ | ¿Con qué proveedor de API Verifactu facturamos y quién lo paga? | Montar un programa de facturación propio que cumpla Verifactu obliga a firmar como fabricante la declaración responsable. | **Aplazado (7-oct).** Hacienda anunció el 5-oct-2026 que Verifactu pasa a **octubre de 2028** para empresas de menos de 8 M€ de facturación (antes, enero de 2027 para sociedades). Falta verlo publicado en el BOE. La facturación se hace sin Verifactu, dejando sitio para añadirlo: estado por factura y hueco del QR. Se retoma en 2028 o si cambia la fecha. | Diego |
| H2 | ¿Esta ampliación se cobra aparte de lo pactado? | Son diez bloques nuevos, varios con coste mensual (Verifactu, fondo con IA, redes). | Se construye igual; el precio no lo tocamos. | Diego |
| H3 | Contratos: el de compraventa es el que usan hoy en Pymecar; reserva, compra y cesión los ha redactado Claude. ¿Qué abogado los revisa? **Ojo:** en el de compraventa, las cláusulas 10 (los «seis meses» para probar la falta de conformidad), 11 (dos meses para avisar) y 12 (la garantía se pierde si se vende a otro) parecen de la ley anterior a la reforma de garantías de 2021. En la reserva, que se pierda la señal si el comprador no compra es una decisión suya. | Un contrato mal hecho es responsabilidad nuestra ante el cliente. | Salen con la banda «Borrador pendiente de revisión por abogado». | Diego |
| H4 ✅ | Herramienta del fondo con IA: rembg (gratis, en nuestro servidor) o Photoroom (de pago por foto). Prueba en T08. | Unas 240 fotos al mes. | rembg. **Probado (19-oct):** rembg con `isnet-general-use` (u2net se come piezas del coche). Unos 4 s por foto. | Diego |
| H5 | App de Meta para publicar en sus redes: ¿a nombre de quién? (T10) | La app y el permiso los da Meta tras revisarla. | Publicación en redes en modo simulado. | Diego |
| H6 | Partner para cargar los portales con nuestro feed (T10). | Sin partner, el feed no llega a ningún portal. | Seguimos con el anuncio listo para pegar. | Diego |
| H7 | ¿Qué gestoría lleva sus cuentas? Necesitamos que nos confirme cómo calculan el IVA en REBU, en IVA general y en los coches en depósito. | Cambia el margen de cada coche y lo que se factura. | Las fórmulas de T10 (parte 4). | Jaume |
| H8 | Datos fiscales de la empresa para las facturas. **Ya los tenemos de Pymecar (7-oct):** PROSERVICE OCASIÓN SL, B56845381, C/ Llull 321, planta 4, 08191 Rubí (Barcelona) (la migración `0015` los pone si están vacíos), y la serie `V26` iba por la 38 el 1-oct. **Falta:** el número por el que vaya la serie el día del arranque y, si lo llevan en sus facturas, el Registro Mercantil. | Las facturas nuevas tienen que seguir la numeración de Pymecar sin saltos. | Se fija en Facturas → Datos de la empresa y numeración. | Jaume |
| H9 | ¿Cómo cobran los comerciales sus incentivos? ¿Porcentaje del margen, fijo por coche, tramos? | Sin la regla no hay cálculo. | Sin incentivo hasta que gerencia ponga la regla de cada uno. | Jaume |
| H10 | «Comisionado» en los gastos: ¿es alguien de fuera que os trae coches o clientes? ¿Cómo se le paga? | Es una categoría de gasto y puede ser un proveedor. | Gasto de categoría comisión, unido a un proveedor de tipo comisionista. | Jaume |
| H11 | Contratos: ¿cuáles usáis hoy? ¿Nos pasáis los que tengáis, en blanco? | Mejor partir de los suyos que de cero. | Los cinco de T09 con texto nuestro. | Jaume |
| H12 ✅ | Pruebas de conducción: horario, cuánto dura una prueba y qué pedís al cliente (carnet, DNI). | La web solo ofrece huecos libres dentro del horario. | Lunes a viernes de 10:00 a 13:30 y de 16:30 a 19:30, sábado de 10:00 a 13:30; 30 minutos; carnet. **Construido así** (tabla `horario_pruebas`); cambiarlo pide una migración. | Jaume |
| H13 | Correo desde el que salen los avisos (servidor SMTP o una cuenta de Google). | Sin él, los avisos solo se ven en el panel. | Solo en el panel. | Francesc |
| H15 | Con una regla de porcentaje, el comercial ve el incentivo de cada coche y puede sacar su margen (117,28 € al 5 % = 2.345,67 €). ¿Se acepta, o solo ve el total del mes (y aun así saca el margen total de sus ventas)? | El margen solo lo ve gerencia (11.2). | Ve el incentivo de cada coche. | Diego |
| H16 ✅ | Si gerencia cambia la regla de un comercial a mitad de mes, ¿se aplica al mes entero o solo desde ese día? | Hoy se aplica la regla vigente al liquidar, al mes entero. | Mes entero. **Construido así** (mes entero). | Jaume |
| H14 ✅ | El fondo del photocall y el logo en buena calidad (es la D2). Ahora también se usan para el vídeo. | Sin fondo no hay fotos ni vídeo con la marca. | Fondo gris liso. **19-oct:** el logo bueno es el de la marca roja (ya en `frontend/img`), el fondo lo generamos nosotros y la banda es una plantilla SVG editable. Ver [photocall-web-actual.md](photocall-web-actual.md). | Jaume |

---

## Fuera de la primera versión

Lo que el cliente pidió o mencionó y va a noviembre en adelante. Se les dice en el mismo mensaje para que no lo esperen el 29:

- Reparto de clientes por orden de venta (8.4). El seguimiento del «me lo pienso» entra en el CRM de la ampliación.
- Firma digital de la entrega (9.9).
- Postventa, garantías e incidencias (9.7, 9.10).
- Seguros (9.6).
- Gestión de proveedores y ofertas por WhatsApp (7.3 a 7.8).
