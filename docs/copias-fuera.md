# Copias fuera del servidor

Cada noche a las 03:15 la copia de la base y de las fotos se guarda en `/srv/proservice/copias/` ([despliegue.md](despliegue.md#copias)). Si el servidor se pierde entero, esa copia se pierde con él. Con esto, la misma tarea la sube además a otro sitio. Falta decidir **dónde y quién lo paga** (duda A3); lo demás está hecho y probado.

## Cómo funciona

`api/scripts/copia-seguridad.js`, después de hacer y comprobar la copia de dentro, si `COPIAS_REMOTO` tiene un destino, lanza `rclone copy` de la carpeta de copias a ese destino.

- **Solo sube una copia sana.** Si la de esa noche no pasa la comprobación, no se sube nada.
- **Nunca borra nada fuera** (`copy`, no `sync`). Si alguien entrara en el servidor y borrara las copias, las de fuera seguirían ahí. Las viejas se borran fuera con una regla del propio almacenamiento (por ejemplo, «borrar lo de más de 90 días»).
- **Si la subida falla**, la tarea de esa noche queda como fallida (`journalctl -u proservice-copia`) con el motivo.
- Sin `COPIAS_REMOTO`, todo sigue como antes: solo la copia de dentro.

## Montarlo, una vez

**1. El destino.** Cualquiera que entienda rclone: un almacenamiento S3 (Backblaze B2, Hetzner Storage Box, Wasabi…), Google Drive de una cuenta de la empresa o un FTP. Para unos pocos GB, un almacenamiento S3 cuesta céntimos al mes. Lo elige y lo paga quien decida A3.

**2. Cifrado.** Las copias llevan datos de clientes (nombre, DNI, teléfono): **se suben cifradas**, con un remoto `crypt` de rclone encima del destino. Quien tenga acceso al almacenamiento ve nombres y contenidos ilegibles.

```bash
# En el servidor, como root
rclone config --config /etc/proservice/rclone.conf
#   n) nuevo remoto «destino»: el almacenamiento elegido, con sus claves
#   n) nuevo remoto «copias»: tipo crypt, remote = destino:proservice-copias,
#      nombres de fichero cifrados, y dos contraseñas largas (password y salt)
chown root:proservice /etc/proservice/rclone.conf && chmod 640 /etc/proservice/rclone.conf
```

**Las dos contraseñas del cifrado se guardan también fuera del servidor** (en el gestor de contraseñas de Diego). Si el servidor se pierde y no las tenemos, las copias de fuera no se pueden abrir: no sirven de nada.

**3. Activarlo.** En `/etc/proservice/proservice.env`, `COPIAS_REMOTO=copias:` (o `copias:proservice` para una subcarpeta). El servicio de la copia ya lleva `RCLONE_CONFIG=/etc/proservice/rclone.conf`.

**4. Probarlo ya, sin esperar a la noche:**

```bash
sudo systemctl start proservice-copia
journalctl -u proservice-copia -n 5            # tiene que decir «Copia subida fuera del servidor»
sudo -u proservice RCLONE_CONFIG=/etc/proservice/rclone.conf rclone ls copias:
```

**5. La regla de borrado** en el almacenamiento: borrar lo de más de 90 días (o lo que diga Diego). Las fotos no se borran nunca.

## Recuperar una copia de fuera

Si el servidor se ha perdido: servidor nuevo con [despliegue.md](despliegue.md#montar-el-servidor-la-primera-vez), el mismo `rclone.conf` (con las dos contraseñas del gestor) y:

```bash
sudo -u proservice RCLONE_CONFIG=/etc/proservice/rclone.conf rclone ls copias:                 # qué hay
sudo -u proservice RCLONE_CONFIG=/etc/proservice/rclone.conf rclone copy copias: /srv/proservice/copias/
proservice-restaurar ultima --con-fotos
```

## Probado el 20-oct

Con rclone 1.60 de Ubuntu y un destino cifrado en una carpeta local, contra la base de la migración ficticia (300 coches): sin destino funciona como antes; con destino sube cifrado (con la clave se ve `proservice-2026-10-20.db`, sin ella solo nombres ilegibles); una copia borrada en el servidor sigue fuera; con un destino que no existe, la tarea sale como fallida con el motivo; una copia que no pasa la comprobación no se sube.
