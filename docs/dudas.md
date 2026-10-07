# Dudas abiertas

Lo que el briefing deja sin contestar, contesta a medias o contradice. Cada duda lleva la referencia del briefing, por qué importa, qué hacemos si no contestan y quién la tiene que resolver.

Victor lo redacta en **un solo mensaje** y Diego lo revisa y lo envía antes del **viernes 2-oct**. Lo que no esté contestado el **lunes 5** se hace con la opción por defecto y así se les avisa en el mismo mensaje. El bloque A es interno: lo resolvemos con Diego antes de escribir al cliente.

Cuando una duda se cierre, se marca con ✅, se anota la respuesta y la fecha, y se actualiza `docs/plan.md` si cambia algo.

---

## A. Internas: con Diego, antes de hablar con el cliente

| # | Duda | Por qué importa |
|---|---|---|
| A1 | ¿Hay propuesta firmada con alcance, plazo y precio? El briefing promete «alcance cerrado, plazo y precio» antes de arrancar. | Sin alcance firmado, cada cosa que pidan a mitad de obra entra gratis. |
| A2 | En SaaSFlow hay un trabajo de Pro Service de 2.500 € + IVA con entrega el 31-dic. ¿Es este proyecto? | Si lo es, el plan de cuatro semanas para tres personas no cuadra con el precio, y la fecha tampoco coincide con el 31-oct. |
| A3 | ¿Quién paga el servidor, el servicio de photocall y la carga en los portales si tiene coste? | Son gastos mensuales. Tienen que estar en la propuesta o el cliente los asume aparte. |
| A4 | Con el cliente habla Diego. ¿Por el canal `proservice-plataforma-coches` del Chat? ¿Jaume y Francesc pueden preguntar dudas técnicas directamente a Victor? | Evitar que el cliente reciba mensajes cruzados y que Diego haga de intermediario en cada detalle. |
| A5 | ¿La reparación de la web de la 5.2 («ya hemos quedado que se repara») la hacemos nosotros? ¿Quién y cuándo? | Si otra persona toca la web a la vez que David instala el plugin, se pisan. |
| A6 | ¿Dedicación de Hafsa y David? ¿Jornada completa hasta el 30-oct? | El plan está hecho suponiendo que sí. |
| A7 ✅ | Su web ya tiene 30 coches en WordPress, cada uno con su página en `proservicerubi.com/coches/...` (tipo de contenido `coches` con campos ACF, visto el 30-sep en `/wp-json/wp/v2/coches`). ¿La plataforma **rellena y actualiza esos mismos coches** de WordPress, o montamos **un listado nuevo** con nuestro plugin? | Con un listado nuevo, las 30 páginas actuales quedan duplicadas o huérfanas y se pierde lo que ya tengan en Google. Rellenar las suyas conserva su diseño y sus URLs, pero hace falta el acceso de administrador de Francesc para ver los campos. Hasta que se decida, David no avanza el plugin. **Respuesta (Diego, 1-oct):** se rellenan sus mismos coches. La API los publica por la API REST de WordPress con un usuario Editor y contraseña de aplicación, sin administrador. El plugin queda solo como buscador, ficha opcional y 301 de los coches retirados. Ver B8 y B11. |

---

## B. Bloquean el arranque: respuesta antes del lunes 5-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan | Quién |
|---|---|---|---|---|---|
| B1 | Si dejáis Pymecar el 31-oct, ¿con qué vais a facturar desde el 1-nov? | 9.2, 9.3, 14.1 | Hoy facturáis con Pymecar y decís tener facturación verificable. La plataforma nueva no factura. | Recomendamos mantener Pymecar solo para facturar o contratar un programa aparte. Nosotros exportamos las ventas. | Jaume |
| B2 | ¿Pymecar os deja ampliar un mes, aunque sea sin usarlo? | 14.1 | Es el plan B si la migración falla el 28-oct. | Os pedimos que lo preguntéis igualmente. | Jaume |
| B3 | En los coches en depósito (40 de 50), ¿cómo ganáis? Comisión fija, porcentaje o diferencia con lo que pide el dueño. | 1.2, 3.5 | Sin esto, el margen del 80 % del stock sale mal. | Margen = PVP menos lo que se le paga al dueño. | Jaume |
| B4 | En un coche en depósito, ¿qué guardáis del dueño? Nombre, teléfono, precio pactado, fecha del acuerdo… | 1.2 | Hay que añadirlo a la ficha. | Nombre, teléfono y precio pactado. | Jaume |
| B5 | ¿Cuándo es REBU y cuándo IVA deducible? ¿Quién lo decide en cada compra? | 9.1 | Cambia el cálculo del margen. | REBU por defecto, editable en cada coche. | Jaume o gestoría |
| B6 | Una ficha real de un coche con todos los datos que metéis hoy. | 3.9 (en blanco) | Es lo que cierra los campos de la ficha. | Sin defecto: la necesitamos. | Jaume |
| B7 | Un export de prueba de Pymecar (coches y clientes). Solo para comprobar que los datos salen. La migración va al final. | 13.2, 13.6 | Si Pymecar no deja sacar algo, hay que saberlo ahora y no el 28. | Sin defecto: sin export no hay migración. | Jaume |
| B8 | Acceso a WordPress, al hosting y al DNS del dominio. Para publicar los coches basta un **usuario Editor** con su contraseña de aplicación (A7). El administrador solo hace falta una vez, para instalar el buscador. | 5.3 | Sin el Editor no se publica nada; sin administrador no hay buscador ni 301; sin DNS no hay subdominio para la API. | Sin defecto. | Francesc |
| B9 | Hemos visto que los coches de la web están en WordPress (30 publicados, con campos ACF). ¿Quién los da de alta hoy y cómo: a mano, con un plugin o los manda Pymecar? | 5.1, 4.5 | Si los manda Pymecar, la web se queda vacía el 31. | Se lo preguntamos a Francesc directamente. | Francesc |
| B10 | ¿Francesc es de la empresa o externo? ¿Tiene que entrar al panel? ¿Con qué permisos? | 5.3, 11.3, 14.6 | Permisos y a quién se le pregunta cada cosa. | Sin acceso al panel, solo a WordPress. | Jaume |
| B11 | En WordPress, el grupo de campos de ACF de «coches» no está expuesto en la API REST (comprobado el 1-oct en `/wp-json`). ¿Puede Francesc marcar «Mostrar en la API REST» en ese grupo? Es una casilla. | 5.2, 4.4 | Sin ella, la plataforma solo puede mandar título, estado y marca: ni precio, ni km, ni fotos. El buscador solo filtraría por marca. | Se publica título, estado y marca y se avisa de lo que falta. | Francesc |
| B12 | En las fichas de la web, el título grande y el «Conoce el …» salen vacíos, y el año también (revisado el 1-oct). ¿Qué campo debería llevar el nombre del coche? ¿Se rellena el año? | 3.1, 5.5 | La plataforma tiene que escribir en esos campos para que la ficha salga completa. | Mandamos modelo y año en los campos que más se parecen y lo comprobamos con el diagnóstico. | Francesc |
| B13 | La cuota «Desde X €/mes» de cada coche, ¿quién la calcula hoy y con qué tipo de interés y plazo? | 5.7, E2 | Es un dato que meten a mano. La plataforma no lo calcula sin el tipo de interés, así que en los coches nuevos esa línea no saldría. | La cuota se sigue metiendo a mano en WordPress y la plataforma no la toca. | Jaume |
| B14 | El formulario de «Solicita tu prueba gratuita» de la web, ¿adónde manda las solicitudes hoy (correo, CRM, nada)? | 5.6, 8.1, 8.6 | Es el mismo contacto que queremos que entre en la plataforma. Si ya llega a algún sitio, hay que conectarlo y no duplicarlo. | Se deja como está y los contactos de la plataforma entran por los formularios nuevos. | Francesc |
| B15 | Aviso, no pregunta: el filtro de «Potencia mínima» de su página /coches/ no devuelve nada (con 130 CV debería salir el Kia Niro de 138 CV). El de precio funciona. | 5.4 | Un cliente que filtra por potencia ve que no hay coches. | Se lo decimos a Francesc para que lo revise. | Francesc |
| B16 | ¿Puede Francesc crear un campo de texto `referencia` en el grupo de ACF de «coches»? La plataforma escribe ahí la referencia de cada coche (PS-00031). | 5.6, 8.1 | Con ella, un contacto que llega por el formulario de la ficha queda unido a su coche en el panel. Sin ella llega igual, con el título y la dirección del coche escritos en el mensaje. | El formulario pone el coche en el mensaje. | Francesc |

---

## C. La ficha y los estados: antes del viernes 9-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| C1 | Habéis marcado como obligatorio casi todo, incluidos los costes. Pero cuando un coche está «Pendiente de recoger» todavía no sabéis los kilómetros exactos ni lo que costará el taller. ¿Obligatorio para darlo de alta o para publicarlo? | 3.1 a 3.5 | Si es para el alta, no podréis apuntar un coche hasta tenerlo todo y seguiréis con el Excel. | Para darlo de alta: matrícula, marca y modelo. El resto es obligatorio para publicar. (El precio de compra no se exige al dar de alta porque el comercial no puede escribir datos de dinero.) |
| C2 | En el bloque 3.4 hay dos columnas marcadas y no se sabe cuáles. ¿Algún campo de estado y documentación sale en la web? | 3.4 | Es lo que se ve o no en la ficha pública. | Ninguno sale en la web salvo la garantía. |
| C3 | En la 5.5 respondéis «ya lo hemos respondido», pero no está. ¿Precio siempre visible o «consultar»? ¿Teléfono? ¿Ubicación exacta? ¿Bastidor? ¿Número de propietarios? | 5.5 | La ficha pública. | Precio siempre visible y teléfono sí. Ubicación solo «Rubí». Bastidor y propietarios no. |
| C4 | ¿Un coche puede saltarse estados? Por ejemplo, uno que llega limpio y va directo a fotos. ¿Y volver atrás? | 2.2 | Si el sistema obliga a pasar por todos, lo saltaréis a mano. | Se puede mover a cualquier estado, y queda apuntado quién y cuándo. |
| C5 | ¿Cuántos días se enseña «Vendido» en la web antes de desaparecer? | 2.2 | Habéis marcado que se vea. | 7 días. |
| C6 | Reservas: ¿cuántos días dura una reserva? Si el cliente no compra, ¿se devuelve la señal? ¿Queréis apuntarlo? | 2.4 | La caducidad automática y el registro de la señal. | 7 días. Se apunta si la señal se devolvió o no. |
| C7 | ¿Qué os interesa de la «referencia interna»? ¿Tenéis ya un formato? | 3.1 | Si ya usáis una, hay que respetarla en la migración. | `PS-00001` automática. |
| C8 | Lista cerrada de extras: ¿nos pasáis la que usáis o partimos de la de Coches.net? | 3.7 | Hay que cargarla antes de dar de alta coches. | Partimos de una lista estándar de unos 40 extras y la revisáis. |
| C9 | Los dos sitios, patio del taller y parking: ¿el cliente de la web tiene que saber en cuál está el coche? | 1.5, 5.4 | Filtro de ubicación en la web. | Solo se usa dentro. En la web, «Rubí». |
| C10 | Proveedores: la 7.2 está vacía. ¿Queréis una lista de proveedores para elegir en cada coche o basta con escribir el nombre? | 7.2 | Si hay lista, se puede sacar el margen por proveedor que pedís en la 12.2. | Lista sencilla: nombre y teléfono. |

---

## D. Fotos: antes del viernes 16-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| D1 | El orden fijo de las fotos, por escrito. | 4.3 | Decís que existe, pero no lo habéis escrito. | Frontal, 3/4 delantero, lateral, 3/4 trasero, trasera, interior delantero, interior trasero, cuadro con km, maletero, motor. |
| D2 | El fondo del photocall: una foto o un archivo del fondo que queréis. | 4.4 | Sin él no se puede probar. | Sin defecto: sin fondo no hay photocall. |
| D3 | El photocall cuesta dinero por foto (unas 240 fotos al mes). ¿Lo aprobáis cuando os enseñemos la prueba y el precio? | 4.4 | Es un gasto mensual. | Se publica con las fotos originales. |
| D4 | La IA solo cambia el fondo; el coche no se toca. ¿De acuerdo? | 4.4 | Si la IA «arregla» un golpe, el anuncio engaña al comprador y el problema es vuestro. | Solo fondo. |
| D5 | Fotos de daños: ¿quién decide en cada coche si se enseñan? | 4.8 | «Depende de si lo vamos a reparar». | Casilla por foto: por defecto no se enseñan. |
| D6 | ¿Hay que migrar fotos antiguas? ¿Cuántos gigas y dónde están? | 13.5 (en blanco) | Espacio en el servidor y tiempo de migración. | Solo las de los coches en stock. El histórico va sin fotos. |

---

## E. Web y portales: antes del viernes 16-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| E1 | Número de WhatsApp y correo donde tienen que llegar los contactos de la web. | 5.6 | Formularios y botón de WhatsApp. | Sin defecto. |
| E2 | Tipo de interés orientativo y plazos para la calculadora de cuota. | 5.7 | No podemos publicar un tipo inventado. | La calculadora no sale hasta tenerlo. |
| E3 | Pedir financiación: ¿el formulario solo os avisa o hay que mandar algo a Lendrock o BBVA? | 5.6, 9.5 | Una cosa es un correo y otra conectar con una financiera. | Solo os avisa. |
| E4 | Tasación: ¿qué datos pedís del coche del cliente? ¿Fotos? | 5.6, 8.7 | El formulario de tasación. | Marca, modelo, año, km, teléfono y hasta 5 fotos. |
| E5 | ¿Tenéis política de privacidad y de cookies en la web? | — | Los formularios la necesitan para recoger datos. | Revisamos la que haya. Si no hay, se avisa como pendiente legal. |
| E6 | Portales: cuando os digamos qué vía tiene cada uno (martes 6), ¿estáis dispuestos a dar de alta un servicio de carga si tiene coste? | 6.5, 6.7 | Pagáis 3.000 € al mes en portales. La carga automática puede tener un coste aparte. | Nos quedamos con «anuncio listo para pegar». |
| E7 | Usuarios y contraseñas de Coches.net, Milanuncios y Wallapop, o que nos pongáis en contacto con su soporte. | 6.5 | Para preguntar por la carga profesional. | Lo investigamos sin acceso. |
| E8 | Google (anuncios de vehículos) y mobile.de quedaron en blanco. ¿Os interesan? | 6.1 | Si sí, es fase 2. | Fuera. |

---

## F. Números, avisos y usuarios: antes del viernes 23-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| F1 | ¿Qué avisos queréis y a quién le llegan? | 12.4 («sí») | No se puede programar un «sí». | Coche con 60 y 90 días, ITV en 30 días, vendido aún publicado y contacto sin atender en 24 h. A Jaume por correo, una vez al día. |
| F2 | En la 12.2 respondéis «todo». ¿Cuáles tres miraríais cada lunes? | 12.1, 12.2 | Con «todo» se hacen informes que nadie abre. | Stock por antigüedad, margen por coche y ventas del mes. |
| F3 | ¿Qué le pasáis al gestor, cada cuánto y en qué formato? | 12.3 | La exportación. | CSV mensual de ventas. |
| F4 | La tabla de roles (11.1) está vacía. ¿Jaume es gerencia y el comercial es comercial? ¿Alguien más? | 1.6, 11.1 | Permisos. | Jaume gerencia, comercial sin ver dinero. |
| F5 | En la 11.3 el comercial aparece como «de fuera». ¿Es externo? ¿Ve los clientes de todos? | 11.3 | Si es externo, el acceso se limita más. | Ve coches y contactos, nunca compra ni margen. |
| F6 | Cuando alguien se va, «no pasa nada». ¿Queréis al menos un botón para desactivar su usuario? | 11.4 | Seguridad básica. | Sí, lo ponemos. |

---

## G. Antes del arranque

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| G1 | Si solo pudiéramos construir una cosa, ¿cuál sería? | 14.2 (en blanco) | Dice qué se protege si vamos tarde. | La que dice el plan: ficha, fotos, web y retirada al vender. |
| G2 | ¿Quién firma la propuesta? Nombre y cargo. | 14.5 (en blanco) | Contrato. | Sin defecto. |
| G3 | ¿A alguien de dentro le va a molestar el cambio? | 14.7 (en blanco) | Si el comercial no lo usa, la plataforma no sirve. | Lo preguntamos en la demo. |
| G4 | ¿Qué funciona bien y no hay que tocar? ¿Quién arregla las cosas cuando fallan? | 10.2, 10.3 (en blanco) | Evitar romper algo que va bien. | Nada, y el soporte es nuestro. |
| G5 | ¿Nos pasáis los Excels que usáis, tal cual? | 10.4 (en blanco) | Suelen explicar el negocio mejor que el briefing. | Seguimos sin ellos. |
| G6 | Del 27 por la tarde al 29 no se da de alta nada en Pymecar. ¿Os va bien esa fecha o hay algo que lo impida? | 14.1 | Es el corte de la migración. | Se mantiene. |
| G7 | ¿Media hora el lunes 26 para probar el panel con coches de verdad? | — | Última corrección antes del arranque. | Se busca otro hueco esa semana. |

---

## H. Ampliación del 7-oct

Sale de la lista nueva de Diego. Las H1 a H6 son internas (Diego); las H7 en adelante, para el cliente.

| # | Duda | Por qué importa | Mientras tanto | Quién |
|---|---|---|---|---|
| H1 ✅ | ¿Con qué proveedor de API Verifactu facturamos y quién lo paga? | Montar un programa de facturación propio que cumpla Verifactu obliga a firmar como fabricante la declaración responsable. | **Aplazado (7-oct).** Hacienda anunció el 5-oct-2026 que Verifactu pasa a **octubre de 2028** para empresas de menos de 8 M€ de facturación (antes, enero de 2027 para sociedades). Falta verlo publicado en el BOE. La facturación se hace sin Verifactu, dejando sitio para añadirlo: estado por factura y hueco del QR. Se retoma en 2028 o si cambia la fecha. | Diego |
| H2 | ¿Esta ampliación se cobra aparte de lo pactado? | Son diez bloques nuevos, varios con coste mensual (Verifactu, fondo con IA, redes). | Se construye igual; el precio no lo tocamos. | Diego |
| H3 | Los textos de los contratos los redacta Claude como base. ¿Qué abogado los revisa? | Un contrato de compraventa mal hecho es responsabilidad nuestra ante el cliente. | Salen con la banda «Borrador pendiente de revisión por abogado». | Diego |
| H4 | Herramienta del fondo con IA: rembg (gratis, en nuestro servidor) o Photoroom (de pago por foto). Prueba en T08. | Unas 240 fotos al mes. | rembg. | Diego |
| H5 | App de Meta para publicar en sus redes: ¿a nombre de quién? (T10) | La app y el permiso los da Meta tras revisarla. | Publicación en redes en modo simulado. | Diego |
| H6 | Partner para cargar los portales con nuestro feed (T10). | Sin partner, el feed no llega a ningún portal. | Seguimos con el anuncio listo para pegar. | Diego |
| H7 | ¿Qué gestoría lleva sus cuentas? Necesitamos que nos confirme cómo calculan el IVA en REBU, en IVA general y en los coches en depósito. | Cambia el margen de cada coche y lo que se factura. | Las fórmulas de T10 (parte 4). | Jaume |
| H8 | Datos fiscales de la empresa para las facturas: razón social, CIF, dirección, y si ya tienen series de facturas y por qué número van. | Las facturas nuevas tienen que seguir la numeración de Pymecar sin saltos. | Serie nueva con el año: `V2026-0001`. | Jaume |
| H9 | ¿Cómo cobran los comerciales sus incentivos? ¿Porcentaje del margen, fijo por coche, tramos? | Sin la regla no hay cálculo. | Sin incentivo hasta que gerencia ponga la regla de cada uno. | Jaume |
| H10 | «Comisionado» en los gastos: ¿es alguien de fuera que os trae coches o clientes? ¿Cómo se le paga? | Es una categoría de gasto y puede ser un proveedor. | Gasto de categoría comisión, unido a un proveedor de tipo comisionista. | Jaume |
| H11 | Contratos: ¿cuáles usáis hoy? ¿Nos pasáis los que tengáis, en blanco? | Mejor partir de los suyos que de cero. | Los cinco de T09 con texto nuestro. | Jaume |
| H12 | Pruebas de conducción: horario, cuánto dura una prueba y qué pedís al cliente (carnet, DNI). | La web solo ofrece huecos libres dentro del horario. | Lunes a viernes de 10:00 a 13:30 y de 16:30 a 19:30, sábado de 10:00 a 13:30; 30 minutos; carnet. | Jaume |
| H13 | Correo desde el que salen los avisos (servidor SMTP o una cuenta de Google). | Sin él, los avisos solo se ven en el panel. | Solo en el panel. | Francesc |
| H15 | Con una regla de porcentaje, el comercial ve el incentivo de cada coche y puede sacar su margen (117,28 € al 5 % = 2.345,67 €). ¿Se acepta, o solo ve el total del mes (y aun así saca el margen total de sus ventas)? | El margen solo lo ve gerencia (11.2). | Ve el incentivo de cada coche. | Diego |
| H16 | Si gerencia cambia la regla de un comercial a mitad de mes, ¿se aplica al mes entero o solo desde ese día? | Hoy se aplica la regla vigente al liquidar, al mes entero. | Mes entero. | Jaume |
| H14 | El fondo del photocall y el logo en buena calidad (es la D2). Ahora también se usan para el vídeo. | Sin fondo no hay fotos ni vídeo con la marca. | Fondo gris liso. | Jaume |

---

## Fuera de la primera versión

Lo que el cliente pidió o mencionó y va a noviembre en adelante. Se les dice en el mismo mensaje para que no lo esperen el 29:

- Reparto de clientes por orden de venta (8.4). El seguimiento del «me lo pienso» entra en el CRM de la ampliación.
- Firma digital de la entrega (9.9).
- Postventa, garantías e incidencias (9.7, 9.10).
- Seguros (9.6).
- Gestión de proveedores y ofertas por WhatsApp (7.3 a 7.8).
