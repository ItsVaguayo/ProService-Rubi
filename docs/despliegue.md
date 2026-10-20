# Despliegue: de GitHub al servidor

Cómo llega un cambio desde el ordenador de cada uno hasta producción, cómo se monta el servidor la primera vez y quién entra a qué. La lista de lo que hay que tener el día del arranque (DNS, WordPress, migración) está en [produccion.md](produccion.md); esto es el cómo.

Vale para cualquier VPS con Ubuntu 22.04 o 24.04, lo ponga el cliente o Diego (duda A3).

## El camino de un cambio

```
tu ordenador ──push──► rama ──PR──► develop ──PR (OK de Diego)──► main ──proservice-desplegar──► servidor
                         │             │                            │
                    tests en GitHub  demo de los viernes        lo que está en producción
```

1. Cada uno trabaja en su rama y abre un PR a `develop` ([flujo-git.md](flujo-git.md)). GitHub pasa los tests.
2. Cuando hay que subir, Victor abre un PR de `develop` a `main`. Diego da el OK y Victor lo fusiona.
3. Victor despliega desde su ordenador con una línea:

   ```bash
   ssh proservice@SERVIDOR proservice-desplegar
   ```

El servidor **no recibe nada desde los ordenadores**: se baja el código de GitHub él solo. Así en producción solo hay lo que está en `main`, y se sabe exactamente qué versión es (el commit va en el nombre de la carpeta).

## Qué hace `proservice-desplegar`

Está en [`deploy/desplegar.sh`](../deploy/desplegar.sh). En orden, y parándose sin tocar nada si algo falla:

1. Baja `main` de GitHub a una carpeta nueva (`/srv/proservice/releases/FECHA-COMMIT`). La versión en marcha sigue funcionando mientras tanto.
2. `npm ci` y **los tests**. Si un test falla, se para y dice cuál.
3. Copia la base (`datos/antes-de-COMMIT.db`), porque la API aplica las migraciones nuevas al arrancar.
4. Cambia el enlace `current` a la versión nueva y reinicia la API (unos segundos sin servicio).
5. Espera a que `/api/salud` conteste **con la versión nueva** (cada versión lleva su commit en `VERSION` y la salud lo devuelve; también comprueba que la base responde). **Si en 60 s no contesta así, vuelve sola a la versión anterior.**
6. Guarda las 5 últimas versiones y apunta el despliegue en `despliegues.log`.

Otras órdenes:

| Orden | Qué hace |
|---|---|
| `proservice-desplegar --estado` | Qué versión está en marcha, cuál era la anterior y los últimos despliegues |
| `proservice-desplegar --volver` | Vuelve a la versión anterior (si la nueva da problemas aunque arranque) |
| `proservice-desplegar v2026.10.29` | Una etiqueta o un commit concreto, siempre que esté en `main` |
| `proservice-restaurar` | Enseña las copias de la base que hay; con `ultima`, `antes-de-migrar`, `antes-de-COMMIT` o una ruta, la restaura (ver «Copias») |
| `journalctl -u proservice-api -n 100` | El registro de la API (como root o con `sudo`) |

**Vuelta atrás y base de datos.** Las migraciones del proyecto solo añaden tablas y columnas, así que normalmente una versión vieja funciona con la base de una nueva. Si una migración estropeara datos, la copia de antes del despliegue está en `datos/antes-de-COMMIT.db` (se restaura parando la API y poniéndola en su sitio; ver «Copias»).

**El navegador no se queda con el panel viejo.** nginx manda el panel con `Cache-Control: no-cache`: el navegador pregunta en cada carga si ha cambiado y, si no, recibe un 304 sin volver a bajarlo. Sin esto, tras desplegar podía seguir horas con el JavaScript anterior contra la API nueva.

**Cuándo desplegar.** Al reiniciar, la API está unos segundos sin contestar: mejor fuera del horario de la tienda, o avisando a Jaume.

## Montar el servidor la primera vez

**El servidor.** Ubuntu 24.04, 2 núcleos, 2 GB de memoria (4 GB cuando entre el photocall con rembg) y 40 GB de disco (las fotos crecen con el tiempo). Acceso root por SSH con clave.

**El dominio.** Un registro A de `stock.proservicerubi.com` apuntando a la IP del servidor, en el DNS de Loading (lo hace Francesc, duda B8). Sin él se monta todo igual menos el certificado: se repite el paso 1 cuando el dominio apunte.

1. Como root en el servidor:

   ```bash
   curl -fsSLO https://raw.githubusercontent.com/ItsVaguayo/ProService-Rubi/main/deploy/preparar-servidor.sh
   less preparar-servidor.sh          # leerlo antes de lanzarlo
   sudo bash preparar-servidor.sh stock.proservicerubi.com correo-para-avisos-del-certificado
   ```

   Instala Node 22 (con su suma de comprobación), nginx, certbot y el firewall (solo SSH, 80 y 443); crea el usuario `proservice` y `/srv/proservice`; instala el servicio de la API, la copia diaria y `proservice-desplegar`; y pide el certificado si el dominio ya apunta. Se puede repetir sin miedo.

2. Las claves: `sudo nano /etc/proservice/proservice.env` (SMTP, destinatarios, WordPress). Ese fichero solo lo lee root y la API, y **nunca** va a Git ni al chat. La contraseña de aplicación de WordPress lleva espacios: no hace falta comillas, el fichero lo lee Node.
3. Las claves SSH de quien despliega (ver «Quién entra»).
4. Primer despliegue: `sudo -iu proservice proservice-desplegar`.
5. El usuario de gerencia, con Jaume delante para que escriba él la contraseña (no se ve al escribir y se pide dos veces):

   ```bash
   sudo -iu proservice bash -c 'cd current/api && npm run usuario -- --email CORREO --nombre Jaume --rol gerencia'
   ```

6. Comprobar: `curl -s https://stock.proservicerubi.com/api/salud` (tiene que decir `ok` y la versión) y entrar en `https://stock.proservicerubi.com/panel/`.

Después, la migración de Pymecar y la conexión con la web, según [produccion.md](produccion.md) y [web-real.md](web-real.md).

## Dónde está cada cosa en el servidor

| Ruta | Qué es |
|---|---|
| `/srv/proservice/current` | Enlace a la versión en marcha (de aquí salen la API y el panel) |
| `/srv/proservice/releases/` | Las 5 últimas versiones desplegadas |
| `/srv/proservice/repo` | Copia del repo de GitHub, de donde se sacan las versiones |
| `/srv/proservice/datos/` | La base (`proservice.db`), las fotos (`uploads/`) y las copias de antes de cada despliegue |
| `/srv/proservice/copias/` | La copia de cada noche |
| `/srv/proservice/despliegues.log` | Quién desplegó qué y cuándo |
| `/etc/proservice/proservice.env` | La configuración con las claves |
| `/etc/systemd/system/proservice-*` | El servicio de la API y la copia diaria |
| `/etc/nginx/sites-available/proservice` | nginx: HTTPS, panel, API y tamaños de subida |

## Quién entra y cómo

**Jaume y el comercial**, desde el navegador del ordenador o del móvil: `https://stock.proservicerubi.com/panel/`. En el móvil se puede «Añadir a la pantalla de inicio» y se abre como una aplicación. Sus usuarios los crea Victor (paso 5) o Jaume desde Usuarios; nadie más que ellos sabe sus contraseñas.

**La web de WordPress** habla con la API por HTTPS: el plugin con su ajuste «Dirección de la API» (`https://stock.proservicerubi.com`) y los formularios gracias a `CORS_ORIGENES`. La API entra en WordPress con el usuario Editor ([web-real.md](web-real.md)).

**Victor (y Hafsa si hace falta)**, por SSH con su propia clave, como el usuario `proservice`:

```bash
# En su ordenador, una vez: crear la clave si no la tiene y mandar la PÚBLICA (.pub) a quien administre el servidor
ssh-keygen -t ed25519 -C "victor@proservice"
cat ~/.ssh/id_ed25519.pub
```

Quien administra el servidor la añade a `/srv/proservice/.ssh/authorized_keys` (una línea por persona; para quitar a alguien, se borra su línea). Con eso pueden desplegar, ver el estado y lanzar `npm run` desde `current/api`. Para el registro de la API o tocar `/etc/proservice` hace falta root, que tiene solo quien administra el servidor.

Cuando todos entren con clave, quitar el acceso por contraseña: `PasswordAuthentication no` en `/etc/ssh/sshd_config` y `sudo systemctl reload ssh`. **Antes, comprobar en otra terminal que se entra con clave**: si no, uno se queda fuera.

**Los datos reales no salen del servidor.** La base lleva clientes con nombre, DNI y teléfono (RGPD): no se copia a los ordenadores del equipo. En los ordenadores se trabaja con la base de pruebas (`npm run seed`). Si hay que mirar un fallo con datos reales, se mira en el servidor.

**En el servidor nunca** se lanzan `npm run seed`, `npm run dev:pruebas` ni `npm run peor-caso` (borran o inventan datos).

## Copias

- Cada noche a las 03:15, `proservice-copia.timer` copia la base y las fotos nuevas a `/srv/proservice/copias/` y comprueba que la copia se abre. Se guardan 14 días. Resultado: `journalctl -u proservice-copia`.
- **Falta sacarlas del servidor** (A3): si se pierde el servidor, se pierden con él. Con `rclone` a un Drive o a un almacenamiento S3 es un comando más en el temporizador; falta decidir dónde y quién lo paga.
- **Restaurar**, como `proservice` ([`deploy/restaurar.sh`](../deploy/restaurar.sh)):

  ```bash
  proservice-restaurar                    # qué copias hay; no toca nada
  proservice-restaurar ultima             # la de anoche
  proservice-restaurar antes-de-migrar    # la que hizo la migración antes de cargar
  proservice-restaurar antes-de-2ae193e   # la de antes de desplegar esa versión
  proservice-restaurar ultima --con-fotos # y además las fotos de la copia que falten
  ```

  Comprueba que la copia está sana antes de tocar nada (si no, se para), pide escribir RESTAURAR, para la API, guarda la base de ahora en `datos/descartada-FECHA.db` (con la copia de SQLite: un solo fichero con todo) y arranca. Para deshacerlo, se restaura esa descartada. Ensayado el 20-oct: la de anoche, deshacerla (vuelve hasta lo que se hizo después de la copia), la de antes de migrar y una copia dañada (la rechaza y la API sigue en marcha). Repetirlo una vez en el servidor antes del arranque.

## Lo que queda fuera por ahora

- **Desplegar solo al fusionar en `main`** (GitHub Actions por SSH). Se puede añadir más adelante; de momento es mejor que una persona lo lance y mire que va bien.
- **Aviso si se cae**: un monitor gratuito contra `/api/salud` (UptimeRobot o similar), de una cuenta del equipo.
- **El photocall** (rembg como servicio aparte y la tipografía de la banda), cuando esté construido.

## Ensayado el 20-oct

Por la tarde, otra vez con la salud con versión: desplegar sobre una versión sin `VERSION`, volver a ella y regresar a la nueva; el despliegue paró una versión cuyo test nuevo fallaba dentro de la carpeta desplegada (era el propio test, corregido). nginx: el panel sale con `no-cache` y la segunda petición da 304. `npm run usuario` en una terminal: la contraseña no sale en pantalla y, si las dos no coinciden, no crea nada.


Sin root, con systemd de usuario y un repo de ensayo haciendo de GitHub: primer despliegue (36 s, 215 tests), volver a desplegar lo mismo (no hace nada), una versión con un test roto (se para antes de tocar nada y dice qué test), una versión que no arranca (vuelve sola a la anterior), `--volver`, una rama que no es `main` (la rechaza) y el registro de despliegues. La plantilla de nginx, con el nginx 1.28 de Ubuntu: HTTPS, redirección, la comprobación de Let's Encrypt, sin versión de nginx y sin servir lo que no es el panel. La copia diaria con los permisos del servicio (ficheros 600).

**Sin ensayar** (hace falta root): `preparar-servidor.sh` entero, el certificado de verdad, el firewall, sudo y el endurecimiento de systemd. La primera vez en el servidor, lanzarlo con calma y mirar la salida.
