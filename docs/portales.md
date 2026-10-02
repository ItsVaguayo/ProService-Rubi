# Portales: cómo publicar de forma automática

Tarea T04. Revisado el 2-oct-2026 en las webs de cada portal. Lo que no aclaran pone **no lo sé**, con la pregunta para su soporte.

- **[oficial]**: lo dice una página del propio portal.
- **[tercero]**: lo dice un programa de gestión o un multipublicador sobre sí mismo. No está comprobado con el portal.

No hay precios. El coste, y si se contrata algo, lo decide Diego.

Punto de partida (briefing): publican a mano en los tres (6.1), no tienen XML, FTP ni API de ningún portal (6.5) y bajan los vendidos a mano, «y se nos ha pasado alguna vez» (6.6). Todos los coches van a todos los portales y con el mismo precio (6.3, 6.4).

## Tabla

| | Coches.net | Milanuncios | Wallapop |
|---|---|---|---|
| ¿Carga automática para profesionales? | Sí, por API, pero a través de un programa de gestión (DMS) o un «partner». No he visto una vía para conectarse por cuenta propia. [oficial] | No tiene carga propia para coches. Un profesional publica en Milanuncios **desde coches.net PRO**, el mismo sistema que Coches.net. [oficial] | Sí, pero solo en el plan «Coches Advanced» (grandes empresas, plan a medida): «con API o multipublicador». El plan «Coches» llega a 20 anuncios y no menciona la API. [oficial] |
| Cómo (XML, API, a través de un programa…) | «Importación API» desde el DMS o partner, que tiene canal directo con su soporte API. No publican formato, frecuencia ni lista de programas. [oficial] | Lo mismo que Coches.net. **No lo sé:** si lo que entra por API sale solo también en Milanuncios o hay que activarlo aparte. | API o multipublicador integrado. No publican documentación ni formato. Sus casos de éxito (Car10, Autosí, Mundicars) usan un multipublicador por API sin decir cuál. [oficial] |
| Programas que dicen conectar | Inventario.pro, Motorflash (que cita Pymecar entre los DMS que conecta), maxterauto y Dealcar. EasyConce solo genera el fichero y avisa de que lo tiene que aceptar el portal. [tercero] | Inventario.pro, maxterauto y Dealcar lo nombran. [tercero] | Inventario.pro, Motorflash, maxterauto y Dealcar. EasyConce solo genera el fichero en su formato. [tercero] |
| Qué hay que pedir y a quién | Cuenta profesional: formulario de alta o el 900 533 079. Correo de clientes: cliente@coches.net. El «soporte API» no tiene contacto público: según el portal, habla con el DMS. [oficial] | Lo mismo que Coches.net. No he encontrado un contacto de profesionales propio de Milanuncios. | Botón «Solicitar propuesta» del plan Advanced (formulario Typeform). No he encontrado teléfono ni correo públicos de Wallapop PRO. [oficial] |
| Retirada del coche vendido | A mano en coches.net PRO: Vehículos → publicados → Publicación → «No publicar». [oficial] Con API: **no lo sé**. Su ayuda cita el «borrado de vehículos» entre las incidencias del volcado, pero no dice cómo se hace. Los programas dicen que al marcarlo vendido desaparece de todos los portales. [tercero] | El mismo «No publicar» de coches.net PRO vale para los dos portales. [oficial] Con API: **no lo sé**. | A mano desde el catálogo: reservar, marcar como vendido, borrar o desactivar, de uno en uno o en grupo. **Los anuncios PRO no caducan**: un vendido sigue publicado hasta que alguien lo quita. [oficial] Con API: **no lo sé**. |
| Fuente | [1], [2], [3], [4], [5], [6]; terceros [12]–[16] | [7], [2]; terceros [12], [14], [15] | [8], [9], [10], [11]; terceros [12], [13], [14], [15], [16] |

## Dudas sin resolver

**Coches.net y Milanuncios** (900 533 079 · cliente@coches.net)
1. ¿Qué programas o partners tienen homologados para el volcado por API? ¿Alguno pensado para un compraventa de unos 50 coches?
2. ¿Se puede volcar sin DMS, con un desarrollo propio contra su API? ¿Dan documentación y formato de campos?
3. ¿Aceptan un fichero XML propio, como el que genera EasyConce?
4. Si un coche deja de venir en el volcado, ¿se despublica solo o hay que mandar la baja? ¿Cada cuánto se procesa?
5. Lo que entra por API, ¿sale también en Milanuncios o hay que activarlo coche a coche?
6. Su contrato actual, ¿incluye publicar en Milanuncios o va aparte?

**Wallapop** (por el formulario «Solicitar propuesta»)
1. ¿Hay un mínimo de coches para el plan Advanced? ¿Entra un compraventa de 50?
2. ¿Qué multipublicadores tienen homologados? ¿Abren la API a un desarrollo propio, y con qué documentación?
3. ¿Aceptan un feed XML propio o solo multipublicadores certificados?
4. Por API, ¿el coche se da de baja al salir del feed o hay que mandar «vendido»?
5. ¿Hay teléfono o correo directo del equipo PRO Coches?

**Al cliente** (por Diego)
1. Motorflash dice que conecta con Pymecar [tercero]. ¿Pymecar les ofreció alguna vez publicar en los portales? En el briefing dicen que no tienen ninguna vía automática (6.5).
2. ¿Qué plan tienen hoy en Wallapop? Para 50 coches el plan «Coches» se queda corto (hasta 20 anuncios), así que puede que ya estén en otro.

## Qué se puede hacer ya, sin depender del portal

Lo que no espera a nadie, porque en los tres portales la baja manual existe y está documentada:
- El panel apunta en qué portal está cada coche y, al venderlo, lo deja en «retirar» hasta que alguien confirme la baja en cada uno (tarea en curso). Es justo lo que se les pasa hoy (6.6).
- El anuncio listo para copiar en cada portal, con el texto y las fotos en orden.

## Recomendación

1. Ningún portal publica su formato ni deja conectarse sin un intermediario, así que hoy no se puede prometer al cliente la carga automática hecha por nosotros. Antes hay que llamar a Coches.net y pedir la propuesta de Wallapop con las preguntas de arriba.
2. Coches.net y Milanuncios son una sola integración (coches.net PRO). Con resolver esa, ya están dos de los tres portales.
3. Mientras tanto, el aviso de «retirar» y el anuncio listo para copiar quitan el problema de los vendidos que siguen publicados. Si se contrata un programa intermediario y quién lo paga, lo decide Diego.

## Fuentes

Consultadas el 2-oct-2026.

Oficiales
- [1] Coches.net, volcado API: https://ayudaprofesionales.coches.net/que-puedo-hacer-si-mi-volcado-api-no-ha-funcionado-correctamente/
- [2] Coches.net y Milanuncios, publicar y despublicar: https://ayudaprofesionales.coches.net/como-gestionar-la-publicacion-de-anuncios-en-coches-net-y-milanuncios/
- [3] Coches.net, alta de profesional: https://profesional.coches.net/anunciate-como-profesional/
- [4] Coches.net, acceso a coches.net PRO: https://ayudaprofesionales.coches.net/como-acceder-a-coches-net-pro/
- [5] Coches.net PRO, exportar stock (solo exporta, no importa): https://pro.coches.net/ocasion.aspx
- [6] Coches.net, profesionales: https://ayuda.coches.net/hc/es/articles/7427695229714--Eres-profesional-y-quieres-vender-tus-coches
- [7] Milanuncios, motor: https://ayuda.milanuncios.com/hc/es/articles/360007480719-Motor
- [8] Wallapop PRO Coches, planes: https://es.wallapop.com/wallapop-pro-cars y https://es.wallapop.com/c/motor/wallapop-pro-coches
- [9] Wallapop, catálogo de coches: https://ayuda.wallapop.com/hc/es-es/articles/44923103419281-Cat%C3%A1logo-de-coches
- [10] Wallapop, casos de éxito: https://es.wallapop.com/c/profesionales/impulsar-visibilidad-caso-car10 · https://es.wallapop.com/c/profesionales/crm-coches-usados-caso-autosi · https://es.wallapop.com/c/profesionales/gestionar-leads-caso-mundicars
- [11] Wallapop, «Solicitar propuesta»: https://form.typeform.com/to/rK4ov6vU

Terceros
- [12] Inventario.pro: https://www.inventario.pro/hub/ y https://www.inventario.pro/integracion-con-wallapop/
- [13] Motorflash: https://www.motorflashsolutions.com/en/servicios/dealer
- [14] maxterauto: https://www.maxterauto.com/landings/multipublicacion-stock/
- [15] Dealcar: https://dealcar.io/blog/software-concesionario-coches-espana
- [16] EasyConce: https://easyconce.com/publicar-coches-portales/
