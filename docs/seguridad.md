# Seguridad

Medidas para una herramienta interna de 3 personas: que alguien de fuera no pueda entrar ni tocar datos, sin complicarle la vida al equipo.

## Ya en el código

- **Contraseñas**: 8 caracteres como mínimo, sin más reglas. Se guardan con scrypt y sal; nunca en claro.
- **Login**: 10 intentos fallidos por cuenta y 30 por IP cada 15 minutos. Un correo que no existe responde igual y tarda lo mismo que una contraseña mala, así no se averigua quién tiene cuenta.
- **Sesión**: cookie `HttpOnly` y `SameSite=Lax`, con `Secure` en cuanto llega por HTTPS. Caduca a los `SESION_DIAS`. Cambiar la contraseña o desactivar a alguien cierra sus sesiones.
- **Roles**: los comprueba la API, no solo el panel. El comercial no recibe costes ni márgenes.
- **Origen**: lo que cambia datos (POST, PATCH, DELETE) solo se acepta desde el propio dominio o `CORS_ORIGENES` (`api/src/seguridad.js`).
- **Cabeceras**: `Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS con HTTPS (`api/src/seguridad.js`).
- **Base de datos**: todas las consultas con parámetros. Tamaño máximo en JSON y en fotos.
- **Auditoría**: quién cambia estados, precios y usuarios queda apuntado.
- **Copias**: `npm run copia --workspace api` copia la base y las fotos, y comprueba que la copia se abre (`api/scripts/copia-seguridad.js`).

Tests en `api/test/seguridad.test.js`.

## Al montar el servidor

1. **HTTPS** con nginx y Let's Encrypt. El HTTP solo redirige a HTTPS. La API escucha en `127.0.0.1:3001`, nunca abierta a internet. En el `location` que pasa a la API, nginx tiene que mandar estas cabeceras:
   ```
   proxy_set_header Host              $host;
   proxy_set_header X-Forwarded-For   $remote_addr;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```
   Sin `X-Forwarded-Proto`, la API cree que la petición llegó por HTTP. Entonces rechaza con 403 todo lo que manda el panel (el origen `https://` no coincide con `http://`) y no pone HSTS. Sin `X-Forwarded-For`, todos los intentos de login y los envíos del formulario de contacto parecen venir de la misma IP (`127.0.0.1`) y comparten el mismo límite.
2. **Firewall**: solo 80 y 443 abiertos, y SSH con clave (sin contraseña).
3. **`NODE_ENV=production`** en el `.env` del servidor. Sin `ACCESO_PRUEBAS`.
4. **Copias**, cada noche con cron:
   ```
   15 3 * * *  cd /ruta/ProService-Rubi/api && npm run copia >> /var/log/proservice-copia.log 2>&1
   ```
   Y sacarlas del servidor (por ejemplo `rclone sync` de `COPIAS_PATH` a Google Drive). **Restaurar una vez** antes del arranque: parar la API, copiar `proservice-AAAA-MM-DD.db` encima de `DB_PATH` y la carpeta `uploads`, arrancar y comprobar que el panel enseña los coches.
5. **Aviso si se cae**: un monitor gratuito (UptimeRobot o similar) contra `https://<dominio>/api/salud`, que avise por correo.
6. **Actualizaciones**: `npm audit` una vez al mes y las del sistema con `unattended-upgrades`.
