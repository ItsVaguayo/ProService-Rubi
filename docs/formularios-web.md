# Formularios de proservicerubi.com → CRM

Para Victor (dueño de contactos). Revisado el 30-oct-2026 leyendo el HTML público de las 19 páginas de la web, sin enviar nada. Hoy ningún formulario de la web llega al CRM: como mucho mandan un correo.

## Qué formularios hay

| Formulario | Dónde | Campos | Hecho con |
|---|---|---|---|
| «Formulario Contacto Web» | inicio, contacto, servicios, sobre nosotros y las páginas de cada servicio del taller. Es el mismo en 5 copias (form_id `761980d`, `08d8c51`, `b87e6aa`, `f93143d`, `b8ea29c`) | nombre, correo (obligatorio), teléfono (obligatorio, tipo número), mensaje | Elementor Pro |
| «Formulario Tasación» | /compramos-tu-coche-en-rubi/ (form_id `a6dd5aa`) | nombre, correo, marca, modelo, año, puertas, km, por qué lo vende y hasta 6 fotos de 3 MB. **No pide teléfono** | Elementor Pro |
| «Solicita tu prueba gratuita» | la ficha de cada coche | nombre, correo, teléfono, fecha y hora (libres), casilla de privacidad | A mano en la plantilla de la ficha: se envía a la misma página, con `form_token` y un campo trampa `empresa` |
| «Newsletter» | pie de todas las páginas | correo | Elementor Pro. No va al CRM |

Ninguno de los de Elementor lleva casilla de privacidad.

## Qué hemos hecho en la API (este PR)

`POST /api/contactos/elementor?token=…` recibe la acción «Webhook» de Elementor Pro (detalle en [api.md](api.md#contactos-de-la-web)):

- Lo llama el servidor de WordPress, no el navegador. Por eso no hay CORS ni límite por IP (todos los envíos llegarían desde la misma IP); en su lugar va un token.
- Lee los campos por su etiqueta («Correo electrónico», «Número teléfono», «Marca vehículo»…), no por su id, así que vale para las 5 copias y sigue funcionando si se rehace un formulario.
- Contesta siempre 200 si el token es bueno: un dato mal escrito no hace fallar el formulario de la web, va al mensaje del contacto.
- La tasación entra como `tasacion` con marca, modelo, año y km en sus campos, y lo demás (puertas, por qué vende) en el mensaje. Las fotos llegan como enlaces a su WordPress: se contesta enseguida y se bajan después, solo de su dominio.
- Un contacto sin teléfono (la tasación de hoy) se guarda igual: el correo al comercial dice que hay que contestar por correo, y al pasarlo a cliente no se une a otro cliente sin teléfono.
- El mismo endpoint sirve para la prueba de la ficha, con los campos `tipo`, `nombre`, `email`, `telefono`, `fecha`, `hora`, `wp_post_id` y `pagina` (ver abajo).

## Lo que tiene que hacer Victor (servidor)

1. Crear el token: `openssl rand -hex 24`, y ponerlo en `FORMULARIOS_WEB_TOKEN` del `produccion.env`. Sin esa variable la ruta no existe (404).
2. `FORMULARIOS_WEB_HOSTS=proservicerubi.com,www.proservicerubi.com` (los dominios de los que se bajan las fotos de tasación). Si no se pone, se usa el de `WP_URL`.
3. Pasarle a Francesc la URL con el token **por un canal privado**, no por el grupo: `https://stock.proservicerubi.com/api/contactos/elementor?token=EL_TOKEN`.
4. El token va en la URL (Elementor no deja poner cabeceras), así que sale en el log de acceso de nginx. Si molesta, quitar el log de esa ruta o rotar el token si alguien ve los logs.
5. Comprobar que el servidor de su hosting llega a `stock.proservicerubi.com` por HTTPS (el webhook sale de allí, no del navegador).

## Lo que tiene que hacer Francesc (web)

Todo con su usuario administrador. Ninguno de estos pasos cambia lo que ve un visitante salvo el 3 y el 4.

### 1. Webhook en los 6 formularios de Elementor

En cada una de las 5 copias del «Formulario Contacto Web» y en el «Formulario Tasación»:

1. Editar la página con Elementor → seleccionar el formulario → **Acciones después del envío** → añadir **Webhook**. Dejar **Correo electrónico** como está y poner Webhook **después**: así, si un día el CRM no contesta, el correo ya habrá salido.
2. En la pestaña **Webhook**: URL = la que le pase Victor, y activar **Datos avanzados**.
3. Actualizar la página.

### 2. Fotos de la tasación

En el campo de subida del formulario de tasación, que las fotos se **suban a la web** (no solo adjuntas al correo y borradas): el CRM las baja desde su enlace. Si no, el contacto entra pero sin fotos, con un aviso en el mensaje.

### 3. Teléfono en la tasación

Añadir un campo **Teléfono** (tipo tel, obligatorio) al formulario de tasación. Hoy no lo pide y el comercial solo puede contestar por correo. La etiqueta tiene que llevar la palabra «teléfono» para que el CRM lo reconozca.

### 4. Casilla de privacidad

Añadir un campo **Aceptación** («He leído y acepto la política de privacidad», con enlace) a los formularios de contacto y de tasación. Es obligatorio para recoger datos (duda E5). El CRM no la necesita para funcionar.

### 5. La prueba de la ficha («Solicita tu prueba gratuita»)

Es código de su plantilla, no de Elementor. Donde ese código procesa el envío (después de comprobar `form_token` y el campo `empresa`), añadir:

```php
// En wp-config.php: define( 'PROSERVICE_CRM_URL', 'https://stock.proservicerubi.com/api/contactos/elementor?token=EL_TOKEN' );
wp_remote_post( PROSERVICE_CRM_URL, array(
    'timeout' => 5,
    'body'    => array(
        'tipo'       => 'prueba',
        'nombre'     => $nombre,
        'email'      => $email,
        'telefono'   => $telefono,
        'fecha'      => $fecha,   // tal cual la escribe la persona
        'hora'       => $hora,
        'wp_post_id' => get_the_ID(),
        'pagina'     => get_permalink(),
    ),
) );
```

Las variables `$nombre`, `$email`… son las que ya use su código. Con `wp_post_id` el contacto queda unido a su coche en cuanto el coche esté vinculado en el CRM; si no, entra igual, sin coche y con la dirección de la ficha en el mensaje.

La otra opción, ya prevista en [produccion.md](produccion.md) (B14), es cambiar su formulario por el `[proservice_contacto]` de nuestro plugin. Eso obliga a instalar el plugin en producción; el fragmento de arriba no.

La fecha y la hora entran en el mensaje, no como cita: su formulario deja elegir cualquier hora y la agenda solo admite las medias horas libres del horario de pruebas. El comercial llama y la apunta en la agenda. Si más adelante quieren la cita directa, el formulario tendría que pedir las horas a `GET /api/citas/huecos` y enviar a `POST /api/citas/pedir`.

### 6. Probar

Enviar una vez cada formulario con datos de prueba (nombre «Prueba Francesc») y avisar. Comprobamos en el panel, en Contactos, que han entrado con todo, y los borramos. Si el formulario de la web enseña un error al enviar, el webhook no ha llegado (token mal copiado o API caída): el correo de siempre habrá salido igual.

## Pendiente aparte

- Los campos de ACF ya están en la API REST (comprobado el 30-oct, solo lectura): el mapa del conector (`WP_MAPA`) hay que ajustarlo a sus nombres reales (`estado_coche`, `potencia_cv`, `financiado`, `ano` como fecha, `colores` y `extras` como listas cerradas). Va en otro PR.
- El campo `referencia` de ACF ya existe pero está vacío en las 31 fichas: lo rellenará el conector.
