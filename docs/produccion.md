# Producción: lo que hay que hacer para arrancar

Lista de lo que hay que montar en el servidor, en el DNS y en WordPress para que la plataforma funcione el jueves 29-oct. La migración desde Pymecar es el miércoles 28 y el viernes 30 queda de margen para fallos ([plan.md](plan.md#fechas-que-mandan)).

Cada paso dice quién lo hace y de qué depende. Se marca la casilla cuando está hecho y comprobado. Las contraseñas y los tokens no se escriben aquí ni en Git: van en el `.env` del servidor o en el panel de WordPress, y se dice quién los da.

Quién es quién: Victor coordina y monta el servidor, Diego decide (servidor, gastos, OK a producción y a la migración) y habla con el cliente, Jaume es gerencia de Pro Service y Francesc lleva su WordPress y su DNS en Loading.

Bloqueo a 13-oct: no hay servidor de producción para la API. Hasta que Diego lo decida, la sección 1 no se puede empezar.

## 1. Antes del día

### Servidor

- [ ] Elegir el servidor de la API y quién lo paga. Quién: Diego. Depende de: la propuesta de Victor ([plan.md](plan.md), semana 0) y la duda A3. Si se monta en el hosting de Loading (nginx, 185.186.171.117), hay que confirmar antes que deja tener Node 22, un proceso siempre en marcha y cron. Por decidir.
- [ ] Node 22.9 o más nuevo. Lo pide `api/package.json` (`engines`) y hace falta para `--env-file-if-exists`. Quién: Victor.
- [ ] Disco para las fotos y las copias. Cada coche lleva de 15 a 25 fotos reducidas a JPG de 1.600 px; las tasaciones de la web guardan hasta 5 más por contacto en `UPLOADS_PATH/contactos/`. La copia diaria duplica la carpeta de fotos y nunca borra fotos viejas. El tamaño de una foto reducida no está medido: por medir con el stock real. Las fotos antiguas siguen pendientes (D6). Quién: Victor.
- [ ] Firewall: solo 80 y 443 abiertos, SSH con clave y sin contraseña ([seguridad.md](seguridad.md#al-montar-el-servidor)). La API escucha solo en `127.0.0.1` (variable `HOST`), así que el 3001 no se ve desde fuera aunque falle el firewall. Quién: Victor.
- [ ] Desplegar desde `main` ([flujo-git.md](flujo-git.md)). Hoy `main` va muy por detrás de `develop`: hay que llevar `develop` a `main` con el OK de Diego antes del lunes 26. Quién: Victor, con el OK de Diego.
- [ ] Clonar el repo, `npm ci --omit=dev` en la raíz (Vite solo hace falta en desarrollo) y `npm test` para ver que `better-sqlite3` y `sharp` se han instalado bien en esa máquina. Si alguno no trae binario para el servidor, hacen falta las herramientas de compilación. Quién: Victor.
- [ ] Usuario del sistema propio para la API, dueño de la carpeta de datos. Nada de arrancarla como root. Quién: Victor.
- [ ] En el servidor de producción no se lanzan nunca `npm run seed`, `npm run dev:pruebas` ni `npm run peor-caso`. La siembra lleva `--reset` y se niega a borrar una base o una carpeta de fotos que no lleven «prueba» en la ruta, pero mejor no tentar a la suerte. Quién: todos.

### DNS del subdominio

- [ ] Crear `stock.proservicerubi.com` en el DNS de Loading (ns1-3.grupoloading.com), apuntando a la IP del servidor de la API. Solo ese registro: los MX (mx1-3.loading.es) y la web no se tocan. Quién: Francesc. Depende de: el servidor (Diego) y el acceso al DNS (B8).
- [ ] Comprobar que el nombre ya resuelve a la IP nueva antes de pedir el certificado. Quién: Victor.

### Certificado HTTPS

- [ ] Let's Encrypt para `stock.proservicerubi.com` y renovación automática ([seguridad.md](seguridad.md#al-montar-el-servidor)). El HTTP solo redirige a HTTPS. Quién: Victor. Depende de: el DNS.

### nginx

El panel son ficheros sueltos de `frontend/` y nginx los sirve directamente. La API los sirve sola solo con `SERVIR_FRONTEND`, que es para pruebas (ver la tabla). Esto tiene una consecuencia: las cabeceras del panel que pone `api/src/seguridad.js` (la `Content-Security-Policy` de `/panel/` y HSTS) solo salen en lo que sirve la API. En lo estático las tiene que poner nginx.

- [ ] Pasar `/api/` a `http://127.0.0.1:3001` con las tres cabeceras de [seguridad.md](seguridad.md#al-montar-el-servidor) (`Host`, `X-Forwarded-For`, `X-Forwarded-Proto`). Sin `X-Forwarded-Proto` el panel no puede guardar nada (403 «Origen no permitido»). Sin `X-Forwarded-For` todos los formularios de la web comparten el mismo límite de 5 envíos. Quién: Victor.
- [ ] En `/api/` nginx no añade cabeceras de seguridad: ya las pone la API y saldrían repetidas. Quién: Victor.
- [ ] Servir solo `panel/`, `css/`, `js/` e `img/` de `frontend/`. El resto de la carpeta (índice de maquetas, `web/`, `package.json`, `vite.config.js`, `README.md`) no se sirve: la web pública vive en WordPress ([frontend/README.md](../frontend/README.md)). La raíz redirige al login. Quién: Victor.
- [ ] En lo estático, las mismas cabeceras que la API: la CSP del panel copiada tal cual de `CSP_PANEL` en `api/src/seguridad.js`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` y HSTS. Quién: Victor.
- [ ] Tamaño de subida. El panel manda todas las fotos que se eligen en una sola petición: hasta 25 de 15 MB, unos 375 MB. La tasación de la web, 5 de 10 MB más los campos. El resto de la API es JSON de 100 KB como mucho. Quién: Victor.
- [ ] Tiempo de espera. `POST /api/wordpress/fotos` baja las fotos de todo el stock en una sola petición y puede tardar unos minutos ([migracion.md](migracion.md)). Con los 60 s que nginx espera por defecto se cortaría. Quién: Victor.

Una base para empezar (los valores de tamaño y tiempo son propuesta, se ajustan al probar):

```nginx
server {
    listen 80;
    server_name stock.proservicerubi.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stock.proservicerubi.com;
    # ssl_certificate y ssl_certificate_key: los pone certbot

    root /ruta/ProService-Rubi/frontend;
    client_max_body_size 1m;

    location = / { return 302 /panel/login.html; }
    location / { return 404; }

    location ~ ^/(panel|css|js|img)/ {
        add_header Content-Security-Policy "<CSP_PANEL de api/src/seguridad.js>" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "same-origin" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
        add_header Strict-Transport-Security "max-age=31536000" always;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/fotos/ {
        client_max_body_size 400m;   # 25 fotos de 15 MB en una petición
        proxy_read_timeout 300s;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/contactos {
        client_max_body_size 55m;    # tasación: 5 fotos de 10 MB y los campos
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/wordpress/ {
        proxy_read_timeout 600s;     # bajar las fotos del stock tarda minutos
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Proceso que arranca solo

El repo no trae ni systemd ni pm2: por decidir. Lo que pide el código:

- [ ] Una sola instancia. `server.js` lleva dentro las tareas de cada minuto (correo), cada 10 minutos (reservas que caducan) y cada `WP_SINCRONIZAR_MINUTOS` (web). Con dos procesos (pm2 en modo cluster, por ejemplo) un correo podría salir dos veces. Quién: Victor.
- [ ] Que arranque al encender el servidor y se reinicie si se cae. Quién: Victor.
- [ ] Que falle si no encuentra el `.env`. `npm start` usa `--env-file-if-exists=../.env`: si el fichero no está, arranca igual con los valores de desarrollo (solo avisa en el registro: «sin DB_PATH»). Mejor llamar a node con `--env-file`, que se para si falta. El `.env` va en la raíz del repo, al lado de `api/`. Quién: Victor.

Con systemd quedaría así (la ruta de node, la del repo y el usuario son las del servidor):

```ini
[Unit]
Description=API de Pro Service Rubí
After=network.target

[Service]
User=proservice
WorkingDirectory=/ruta/ProService-Rubi/api
ExecStart=/usr/bin/node --env-file=../.env src/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

- [ ] Al arrancar, la API aplica sola las migraciones de `api/migraciones/` que falten. Mirar en el registro que no hay ningún error de migración. Quién: Victor.

### Variables de entorno

- [ ] Crear el `.env` del servidor a partir de `.env.example` y de la tabla del final. Solo lo puede leer el usuario de la API. Quién: Victor. Depende de: las claves de WordPress (Francesc) y del SMTP (Francesc o Loading).
- [ ] `NODE_ENV=production` y sin `ACCESO_PRUEBAS` ni `SERVIR_FRONTEND` ([seguridad.md](seguridad.md#al-montar-el-servidor)). Quién: Victor.
- [ ] Rutas absolutas en `DB_PATH`, `UPLOADS_PATH` y `COPIAS_PATH`, para que la API, la copia del cron y los scripts lean siempre la misma base. Quién: Victor.

### Usuarios del panel

- [ ] Crear el usuario de gerencia de Jaume con `npm run usuario --workspace api -- --email <su correo> --nombre Jaume --rol gerencia`. La contraseña se pide por teclado (8 caracteres como mínimo): mejor que la escriba él. Tiene que existir antes de la migración, porque las facturas cargadas quedan a nombre de la primera persona de gerencia activa ([migracion.md](migracion.md)). Quién: Victor, con Jaume. Depende de: el correo de Jaume.
- [ ] Usuario del comercial, con rol `comercial` (F4, F5). Quién: Victor o Jaume desde Usuarios. Depende de: su correo.
- [ ] Francesc sin acceso al panel, salvo que Jaume diga otra cosa (B10).

### Correo

- [ ] Una cuenta de correo del dominio en Loading para mandar los avisos (H13). Quién: Francesc. Depende de: que Jaume la apruebe.
- [ ] `SMTP_URL` con su servidor, usuario y contraseña (`smtps://usuario:clave@servidor:465`). Los datos del servidor SMTP de Loading no están en los docs: los da Francesc o Loading. La clave va solo en el `.env`. Quién: Victor.
- [ ] `CORREO_DE` con esa misma cuenta, para que el SMTP la acepte como remitente. Quién: Victor.
- [ ] `CORREO_CONTACTOS` (a quién llega cada contacto de la web, E1) y `CORREO_AVISOS` (el resumen diario, solo gerencia porque lleva importes, F1). Quién: Jaume lo dice, Diego lo pasa.
- [ ] Mientras falte algo de esto la plataforma funciona en modo simulado: los correos se apuntan en `GET /api/correos` con el motivo y no salen ([api.md](api.md#correos-solo-gerencia)).

### Copias y vigilancia

- [ ] Cron de la copia cada noche, como en [seguridad.md](seguridad.md#al-montar-el-servidor) (`15 3 * * *`, `npm run copia` desde `api/`, con registro en `/var/log/proservice-copia.log`). El script copia la base, la abre para comprobarla y copia las fotos nuevas. Quién: Victor.
- [ ] Sacar las copias del servidor (por ejemplo `rclone sync` de `COPIAS_PATH`). El destino y quién lo paga, por decidir (Diego, A3). Quién: Victor.
- [ ] Restaurar una copia una vez antes del arranque: parar la API, poner la copia encima de `DB_PATH` y la carpeta `uploads`, arrancar y ver los coches en el panel. Plan: lunes 26. Quién: Victor.
- [ ] Monitor gratuito contra `https://stock.proservicerubi.com/api/salud` que avise por correo si se cae. Quién: Victor.
- [ ] `unattended-upgrades` para el sistema y `npm audit` una vez al mes. Quién: Victor.

## 2. WordPress

Todo esto toca la web de Jaume: lo hace Francesc o se hace con él. Guía de la conexión en [wordpress-pruebas/README.md](../wordpress-pruebas/README.md#para-la-web-real) y del plugin en [wp-plugin/README.md](../wp-plugin/README.md).

- [x] Usuario con rol Editor y una contraseña de aplicación creada desde su perfil (B8). **Conseguido el 20-oct** ([web-real.md](web-real.md)). Cargar el `.env` siempre con `node --env-file`, nunca con `source`: la clave lleva espacios. Con eso basta para publicar: no hace falta administrador. Francesc nos pasa el usuario y la contraseña de aplicación, que van a `WP_USUARIO` y `WP_CLAVE_APLICACION`. Quién: Francesc.
- [ ] Marcar «Mostrar en la API REST» en el grupo de campos de ACF de «coches» (B11). A 20-oct sigue sin hacer (comprobado con el Editor). Sin ella solo viajan título, estado y marca: ni precio, ni km, ni fotos. Quién: Francesc, con administrador.
- [ ] Campo de texto `referencia` en ese mismo grupo (B16), para que un contacto de la ficha quede unido a su coche. Sin él, el formulario escribe el coche en el mensaje. Quién: Francesc.
- [ ] Qué campos llevan el nombre del coche y el año (B12). Quién: Francesc.
- [ ] Lanzar el diagnóstico (`npm run wordpress --workspace api -- diagnostico`). Primera vez el 20-oct, sin ACF: ver [web-real.md](web-real.md#diagnóstico). Repetirlo cuando esté B11 con las claves en el `.env`. Dice qué deja escribir la web y qué campos del mapa existen. Si los nombres de ACF no coinciden, se ajusta `WP_MAPA`. Quién: Victor. Depende de: B8 y B11.
- [ ] Instalar el plugin 0.6.0: subir `wp-plugin/proservice-stock/` a `wp-content/plugins/` y activarlo. Necesita administrador una vez. Plan: lunes 26 o martes 27, sin enlazarlo aún en el menú. Quién: Francesc, con Victor.
- [ ] En Ajustes, Pro Service Buscador: el mapa de campos igual que `WP_MAPA`, la dirección de la API (`https://stock.proservicerubi.com`), el WhatsApp (E1) y la página del listado (destino del 301). La ficha propia del plugin se queda apagada: manda la del tema. Quién: Francesc, con Victor.
- [ ] `[proservice_buscador]` en la página del listado, si se usa el buscador del plugin. Quién: Francesc.
- [ ] `[proservice_contacto]` dentro de la plantilla de la ficha del coche del tema hijo (`<?php echo do_shortcode('[proservice_contacto]'); ?>`). Antes hay que decidir si sustituye a su formulario «Solicita tu prueba gratuita» o convive con él (B14). Quién: Francesc. Depende de: B14 (Jaume y Francesc).
- [ ] `CORS_ORIGENES` con el origen exacto de la web: `https://proservicerubi.com`, y también la variante con `www` si la web la usa. Sin él, el formulario de la ficha recibe 403. Quién: Victor.
- [ ] Política de privacidad. El formulario enlaza a la página que WordPress tenga puesta en Ajustes, Privacidad. Si no hay ninguna, el enlace sale vacío (`#`) y la casilla obligatoria no lleva a ningún sitio. Comprobar que existe y que cubre los datos del formulario: nombre, teléfono, correo y las fotos y datos del coche de la tasación (E5). Quién: Francesc lo comprueba, Diego decide si hace falta revisión legal.

## 3. Migración del miércoles 28

El procedimiento entero está en [migracion.md](migracion.md). Aquí solo los puntos de control en producción.

- [ ] El export de Pymecar (B7) pasado a las plantillas CSV, dejado en `api/data/pymecar/` del servidor. Lleva datos de clientes: no va a Git ni se manda por canales abiertos. Quién: Victor. Depende de: B7 (Jaume).
- [ ] Usuario de gerencia creado antes de cargar (sección 1).
- [ ] Ensayo hasta cero errores, avisos revisados con Jaume y 5 coches al azar. Plan: lunes 26 y martes 27. Quién: Victor, con Jaume.
- [ ] Corte el martes 27 por la tarde: desde ahí no se da de alta nada en Pymecar (G6). Quién: Diego da el OK tras ver el ensayo.
- [ ] Miércoles 28: export final, ensayo otra vez y carga con `--aplicar`, con el OK de Diego. El script copia la base antes de tocar nada (`proservice.db.antes-de-migrar-…`). Quién: Victor.
- [ ] Copia de seguridad a mano justo después (`npm run copia --workspace api`). Quién: Victor.
- [ ] Vincular cada coche del stock con su ficha de la web (`POST /api/wordpress/vincular`) antes de la primera sincronización, para no duplicarlas y conservar sus URLs. A 20-oct hay 35 fichas publicadas y ninguna en borrador: las de vendidos no las retira nadie si no se vinculan (B17, tabla en [web-real.md](web-real.md#las-35-fichas-para-jaume)). A 13-oct había 33 coches dados de alta a mano en WordPress (B9). Quién: Victor. Depende de: B8.
- [ ] Bajar las fotos del stock desde la web (`POST /api/wordpress/fotos`). Si la web no expone la galería de ACF (B11), baja las adjuntas a la ficha y Jaume las ordena. Quién: Victor, después Jaume.
- [ ] Comprobar en Facturas, Datos de la empresa, que la serie `V26` sigue en el número que dejó Pymecar (H8). Quién: Victor, con Jaume.
- [ ] Si sale mal: parar la API, poner la copia `antes-de-migrar` en su sitio y arrancar. El plan B es el mes extra de Pymecar (B2). Quién: Victor avisa, Diego decide.

## 4. El día del arranque y la primera semana

### Jueves 29

- [ ] `https://stock.proservicerubi.com/api/salud` contesta `{ ok: true }` y el monitor lo ve.
- [ ] Jaume entra con su usuario y guarda un cambio cualquiera. Si sale 403 «Origen no permitido», falta `X-Forwarded-Proto` en nginx.
- [ ] El comercial entra y no ve compra, costes ni margen en ningún sitio.
- [ ] Primera sincronización con la web (`POST /api/wordpress/sincronizar` o `npm run wordpress --workspace api -- sincronizar`). Después, enlazar el listado en el menú (plan, semana 4). Cada pasada sube como mucho `WP_FOTOS_POR_PASADA` fotos: con mucho stock pueden hacer falta varias, hasta «pendientes 0». Las fotos bajadas de la web no se vuelven a subir.
- [ ] `GET /api/wordpress/estado` sin errores en ningún coche.
- [ ] Un coche dado de alta en el panel sale en la web en menos de cinco minutos. Uno vendido pasa a borrador y su URL redirige con 301 al listado.
- [ ] Formulario de contacto desde una ficha real: el contacto sale en Contactos del panel y el correo llega a `CORREO_CONTACTOS` (en `GET /api/correos`, estado `enviado`). Comprobar que no cae en spam.
- [ ] Pedir una prueba con día y hora desde la web: entra en la agenda como «pedida» y además como contacto.
- [ ] Tasación con 5 fotos grandes desde el móvil: llega entera, sin 413 de nginx.
- [ ] Subir 25 fotos de golpe a un coche desde el panel: sin 413 ni corte por tiempo.
- [ ] Dos envíos del formulario desde redes distintas no comparten el límite de 5 por IP.

### Primera semana

- [ ] Cada mañana, después de `AVISOS_HORA`, llega el resumen de avisos a `CORREO_AVISOS`. Solo sale si hay avisos.
- [ ] Cada mañana, el registro de la copia de las 03:15 dice «Base copiada y comprobada», y la copia de fuera está al día.
- [ ] `GET /api/correos?estado=error` vacío. Un correo en `error` ya ha agotado sus reintentos (unas 9 horas).
- [ ] Las reservas caducadas vuelven solas a «Publicado».
- [ ] Los avisos de portales en «retirar» se van confirmando: la plataforma no da de baja nada en Coches.net, Milanuncios ni Wallapop, lo hace una persona ([portales.md](portales.md)).
- [ ] Disco: cuánto ocupan `UPLOADS_PATH` y `COPIAS_PATH` al acabar la semana, para calcular cuánto aguanta.
- [ ] El registro de la API (con systemd, `journalctl -u` y el nombre del servicio) sin errores de `[wordpress]`, `[correo]` ni `[reservas]`.

## 5. Pendiente de decisión

| # | Qué falta | Quién | Mientras tanto |
|---|---|---|---|
| Sin número | Servidor de producción: dónde y quién lo paga (A3) | Diego | Bloquea toda la sección 1 |
| Sin número | Cómo arranca la API (systemd o pm2) y adónde van las copias de fuera | Victor propone, Diego decide si cuesta dinero | Nada en el repo |
| B2 | ¿Pymecar deja ampliar un mes? | Jaume | Sin plan B si la migración falla |
| B7 | Export de Pymecar | Jaume | Sin export no hay migración |
| B8 | Administrador una vez y DNS (el Editor ya está, 20-oct) | Francesc | Sin administrador no hay buscador ni 301; sin DNS no hay subdominio |
| B9 | Quién da de alta hoy los coches en la web (35 a mano a 20-oct) | Francesc | Se vinculan los que haya el 28 |
| B11 | «Mostrar en la API REST» en ACF | Francesc | Solo título, estado y marca. **Es lo que bloquea conectar la web** |
| B17 | Cuáles de las 35 fichas siguen en venta | Jaume | Sin la lista no se vincula nada |
| B18 | Marca (y modelo) en la web | Francesc | Solo la marca |
| B19 | Toyota Proace publicada dos veces | Jaume | Se pregunta antes de vincular |
| B12 | Campos del nombre y del año en la ficha | Francesc | Modelo y año en los campos más parecidos |
| B13 | Quién calcula la cuota «Desde X €/mes» | Jaume | Se sigue metiendo a mano en WordPress |
| B14 | Su formulario actual frente a `[proservice_contacto]` | Francesc | Se deja el suyo |
| B16 | Campo `referencia` en ACF | Francesc | El coche va escrito en el mensaje |
| E1 | Correo y WhatsApp para los contactos | Jaume | Sin destinatario, el correo queda simulado |
| E5 | Política de privacidad de la web | Jaume, Francesc | Pendiente legal |
| F1 | Qué avisos y a quién | Jaume | Resumen diario a Jaume |
| G6 | Corte del martes 27 por la tarde | Jaume | Se mantiene |
| G7 | Media hora el lunes 26 para probar con coches de verdad | Jaume | Otro hueco esa semana |
| H3 | Abogado que revise los contratos | Diego | Salen con la banda de borrador |
| H7 | Gestoría que confirme el IVA en REBU, general y depósito | Jaume | Fórmulas actuales |
| H8 | Número de la serie `V26` el día del arranque | Jaume | Sale de las facturas cargadas |
| H12 | Horario de pruebas, duración y qué se pide | Jaume | L-V 10:00-13:30 y 16:30-19:30, sábado 10:00-13:30, 30 min. Está en la tabla `horario_pruebas` (migración `0018`): cambiarlo pide otra migración, no hay pantalla |
| H13 | Cuenta de correo para los avisos | Francesc | Modo simulado |
| H15 | Si el comercial ve el incentivo de cada coche | Diego | Lo ve |
| D6 | Fotos antiguas: cuántas y dónde | Jaume | Solo las del stock, bajadas de la web |

Lista completa en [dudas.md](dudas.md).

## 6. Variables de entorno

Las lee el código con `process.env`. Van en el `.env` de la raíz del repo; todas están en `.env.example` con su explicación.

| Variable | Para qué | Por defecto en el código | En producción |
|---|---|---|---|
| `PORT` | Puerto de la API | `3001` | `3001`; nginx entra por `127.0.0.1` |
| `HOST` | En qué dirección escucha la API | `127.0.0.1`: solo la propia máquina | `127.0.0.1`. `0.0.0.0` la abriría a la red |
| `NODE_ENV` | Con `production`, la cookie de sesión siempre `Secure` y nunca se sirve `/api/pruebas/acceso` | Sin valor (`.env.example`: `development`) | `production` |
| `DB_PATH` | Base SQLite | `./data/proservice.db`, relativo a `api/` | Ruta absoluta |
| `UPLOADS_PATH` | Fotos de los coches y de las tasaciones | `./data/uploads` | Ruta absoluta, con disco de sobra |
| `COPIAS_PATH` | Dónde deja la copia diaria | `./data/copias` | Ruta absoluta, mejor en otro disco, y además fuera del servidor |
| `COPIAS_DIAS` | Copias de la base que se guardan (las fotos no se borran) | `14` | `14`, salvo que falte disco |
| `SESION_DIAS` | Días que dura una sesión del panel | `30` | `30`, o menos si Diego lo pide |
| `CORS_ORIGENES` | Orígenes de fuera que pueden llamar a la API (separados por comas) | Vacío: ninguno | `https://proservicerubi.com` (y con `www` si la web la usa) |
| `PANEL_URL` | Dirección del panel en los enlaces de los correos | Vacío: sin enlace | `https://stock.proservicerubi.com/panel/` |
| `SERVIR_FRONTEND` | La API sirve `frontend/` en su mismo origen. Solo para el sistema de pruebas | Vacío | No se pone: lo sirve nginx, y con ella saldrían también las maquetas |
| `ACCESO_PRUEBAS` | Usuarios de prueba para el botón «Rellenar» del login. Lo pone `dev:pruebas` | Vacío | No se pone. Con `NODE_ENV=production` se ignora igualmente |
| `CONTACTOS_POR_IP` | Envíos de los formularios de la web por IP cada 10 minutos: contactos y citas (`POST /api/citas/pedir`), cada uno con su cuenta | `5` | `5` |
| `FOTOS_MINIMAS` | Fotos para poder publicar (briefing 4.1) | `15` | `15` |
| `SMTP_URL` | Servidor de correo. Vacío, modo simulado | Vacío | La cuenta del dominio en Loading (H13). La da Francesc |
| `CORREO_DE` | Remitente | `Pro Service Rubí <no-responder@proservicerubi.com>` | La misma cuenta del SMTP |
| `CORREO_CONTACTOS` | A quién llega cada contacto de la web | Vacío: queda simulado | Lo que diga Jaume (E1) |
| `CORREO_AVISOS` | A quién llega el resumen diario (lleva importes) | Vacío: queda simulado | Solo gerencia (F1) |
| `AVISOS_HORA` | Desde qué hora de Rubí sale el resumen (0 a 23) | `8` | `8`, o la que pida Jaume |
| `WP_URL` | Web de WordPress. Sin ella no hay publicación (503) | Vacío | `https://proservicerubi.com` |
| `WP_USUARIO` | Usuario Editor | Vacío | El que cree Francesc (B8) |
| `WP_CLAVE_APLICACION` | Su contraseña de aplicación | Vacío | La que genere Francesc. Solo en el `.env` |
| `WP_TIPO` | Tipo de contenido de los coches | `coches` | `coches`, salvo que el diagnóstico diga otra cosa |
| `WP_TAXONOMIA` | Taxonomía de la marca | `marca` | `marca`, salvo que el diagnóstico diga otra cosa |
| `WP_MAPA` | JSON: qué campo de ACF recibe cada dato. Tiene que coincidir con el mapa del plugin | `MAPA_POR_DEFECTO` de `wordpress.js` | Vacío si el diagnóstico confirma los nombres; si no, el JSON ajustado |
| `WP_FOTOS_POR_PASADA` | Fotos que sube a la web en cada sincronización como mucho | `40` | `40` |
| `WP_SINCRONIZAR_MINUTOS` | Cada cuánto publica sola en la web. `0`, solo a mano | `0` | `5`, para que un coche salga en menos de cinco minutos (plan, semana 4) |
