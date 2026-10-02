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

Campos que se pueden escribir: los de `api/src/modules/vehiculos/campos.js` y ninguno más (un campo desconocido da 400). Los marcados `dinero: true` solo los escribe y los recibe gerencia: compra, costes, precio mínimo, régimen de IVA, datos del dueño en depósito y proveedor.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /vehiculos/estados` | con sesión | Los 10 estados en orden, con `web: true` en los que salen en la web |
| `GET /vehiculos?estado=publicado` | con sesión | Lista, del más nuevo al más viejo. Cada coche lleva además `en_estado_desde`, `foto_portada_id` y `n_fotos` |
| `GET /vehiculos/:id` | con sesión | La ficha. Gerencia recibe también `coste_total_cent` y `margen_cent` |
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
| `GET /fotos/:vehiculoId/:fotoId/archivo` | con sesión | El fichero (JPG) |
| `POST /fotos/:vehiculoId` | con sesión | Formulario `multipart` con el campo `fotos` (una o varias). Se reducen a JPG de 1.600 px y entran en el primer hueco libre (25 como mucho). 15 MB por foto (413). HEIC del iPhone desde el ordenador: 415 con el aviso. 201 |
| `PUT /fotos/:vehiculoId/orden` | con sesión | `{ fotos: [{ id, orden }, …] }` con todas las fotos del coche, cada una en un hueco distinto del 1 al 25 |
| `PATCH /fotos/:vehiculoId/:fotoId` | con sesión | `{ es_dano?, publica? }`, los dos `true` o `false`. Si el coche sale en la web y el cambio lo deja con menos de 15 fotos válidas, 409 |
| `DELETE /fotos/:vehiculoId/:fotoId` | con sesión | Borra la foto y su fichero. Su hueco queda libre. Si el coche sale en la web y se quedaría con menos de 15 fotos válidas, 409 |

## Contactos de la web

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /contactos` | **sin sesión** | Lo manda el formulario de la web. Ver abajo |
| `GET /contactos?estado=sin_atender&tipo=prueba` | con sesión | `estado`: `sin_atender` (por defecto, el que más espera primero), `atendidos` o `todos`. `tipo`: `informacion`, `prueba`, `financiacion` o `tasacion`. Cada contacto lleva la matrícula, marca y modelo del coche y quién lo atendió |
| `GET /contactos/sin-atender` | con sesión | `{ total }`, para el contador del menú |
| `PATCH /contactos/:id` | con sesión | `{ atendido: true }` lo marca con fecha y usuario; `false` lo devuelve a pendiente |

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

## Usuarios (solo gerencia)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /usuarios` | gerencia | Lista sin contraseñas, con `activo` y `ultimo_acceso` |
| `POST /usuarios` | gerencia | `{ nombre, email, rol, contrasena }`, contraseña de 10 caracteres como mínimo. Correo repetido: 409. 201 |
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

## Pendiente

- Margen neto con REBU o IVA deducible y el caso depósito: espera a las respuestas del cliente (dudas B3 y B5). Hoy `margen_cent` es el bruto.
- Avisos (coches parados, ITV, contactos sin atender) e informes: semana 3.
