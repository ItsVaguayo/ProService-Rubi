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
| B8 | Usuario de administrador de WordPress, acceso al hosting y al DNS del dominio. | 5.3 | Sin ellos no se instala el plugin ni se crea el subdominio de la API. | Sin defecto. | Francesc |
| B9 | ¿Cómo salen hoy los coches en la web? ¿Plugin, feed de Pymecar, a mano? | 5.1, 4.5 | Si los carga Pymecar, la web se queda vacía el 31. | Se lo preguntamos a Francesc directamente. | Francesc |
| B10 | ¿Francesc es de la empresa o externo? ¿Tiene que entrar al panel? ¿Con qué permisos? | 5.3, 11.3, 14.6 | Permisos y a quién se le pregunta cada cosa. | Sin acceso al panel, solo a WordPress. | Jaume |

---

## C. La ficha y los estados: antes del viernes 9-oct

| # | Pregunta al cliente | Ref. | Por qué importa | Si no contestan |
|---|---|---|---|---|
| C1 | Habéis marcado como obligatorio casi todo, incluidos los costes. Pero cuando un coche está «Pendiente de recoger» todavía no sabéis los kilómetros exactos ni lo que costará el taller. ¿Obligatorio para darlo de alta o para publicarlo? | 3.1 a 3.5 | Si es para el alta, no podréis apuntar un coche hasta tenerlo todo y seguiréis con el Excel. | Para darlo de alta: matrícula, marca, modelo y precio de compra. El resto es obligatorio para publicar. |
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

## Fuera de la primera versión

Lo que el cliente pidió o mencionó y va a noviembre en adelante. Se les dice en el mismo mensaje para que no lo esperen el 29:

- CRM de clientes con reparto por orden de venta y seguimiento del «me lo pienso» (8.4, 8.5).
- Calendario de pruebas de conducción (8.6).
- Firma digital de la entrega (9.9).
- Postventa, garantías e incidencias (9.7, 9.10).
- Facturación (9.2, 9.3).
- Seguros (9.6).
- Gestión de proveedores y ofertas por WhatsApp (7.3 a 7.8).
