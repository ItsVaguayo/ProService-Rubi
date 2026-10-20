// Copia de seguridad de la base y de las fotos, pensada para lanzarla una vez al día con cron:
//   15 3 * * *  cd /ruta/api && npm run copia >> /var/log/proservice-copia.log 2>&1
// Deja en COPIAS_PATH (por defecto ./data/copias):
//   proservice-AAAA-MM-DD.db  la base entera, hecha con la API de copia de SQLite (segura con el servidor en marcha)
//   uploads/                  las fotos; solo se copian las nuevas, las que ya están no se tocan
// Cada copia se abre al acabar y se comprueba (integrity_check y que tenga coches y usuarios): una copia
// que no se puede abrir no sirve de nada. Se guardan las últimas COPIAS_DIAS (14 por defecto).
// Fuera del servidor: con COPIAS_REMOTO (un destino de rclone, como «copias:proservice»), al acabar sube
// COPIAS_PATH allí con `rclone copy`. Si el servidor se pierde entero, la copia de dentro se pierde con él.
// copy y no sync: nunca borra nada del destino, así un servidor comprometido no puede vaciar también las de
// fuera (lo viejo se borra allí con una regla del propio almacenamiento). La configuración de rclone, con sus
// claves, en RCLONE_CONFIG (en el servidor, /etc/proservice/rclone.conf). Ver docs/despliegue.md.
import Database from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUTA_DB = resolve(process.env.DB_PATH || './data/proservice.db');
const FOTOS = resolve(process.env.UPLOADS_PATH || './data/uploads');
const DESTINO = resolve(process.env.COPIAS_PATH || './data/copias');
const DIAS = Number(process.env.COPIAS_DIAS || 14);
const REMOTO = process.env.COPIAS_REMOTO || '';

if (!existsSync(RUTA_DB)) {
  console.error(`No existe la base ${RUTA_DB}`);
  process.exit(1);
}
mkdirSync(DESTINO, { recursive: true });

// 1. La base
const hoy = new Date().toISOString().slice(0, 10);
const copia = join(DESTINO, `proservice-${hoy}.db`);
const db = new Database(RUTA_DB, { readonly: true, fileMustExist: true });
try {
  await db.backup(copia);
} finally {
  db.close();
}

// 2. Comprobar que la copia se abre y tiene datos. Antes se pasa a un solo fichero (sin -wal ni -shm)
const prueba = new Database(copia);
prueba.pragma('journal_mode = DELETE');
try {
  const integridad = prueba.pragma('integrity_check', { simple: true });
  if (integridad !== 'ok') throw new Error(`integrity_check: ${integridad}`);
  const { coches } = prueba.prepare('SELECT COUNT(*) AS coches FROM vehiculos').get();
  const { usuarios } = prueba.prepare('SELECT COUNT(*) AS usuarios FROM usuarios').get();
  if (!usuarios) throw new Error('La copia no tiene usuarios');
  console.log(`${new Date().toISOString()} Base copiada y comprobada: ${copia} (${coches} coches, ${usuarios} usuarios, ${(statSync(copia).size / 1048576).toFixed(1)} MB)`);
} catch (e) {
  console.error(`${new Date().toISOString()} LA COPIA NO SIRVE: ${e.message}`);
  process.exitCode = 1;
} finally {
  prueba.close();
}

// 3. Las fotos: solo lo nuevo (force: false no sobrescribe lo que ya está)
if (existsSync(FOTOS)) {
  cpSync(FOTOS, join(DESTINO, 'uploads'), { recursive: true, force: false });
  console.log(`${new Date().toISOString()} Fotos al día en ${join(DESTINO, 'uploads')}`);
}

// 4. Quitar las copias de la base más viejas que DIAS (las fotos no se borran nunca)
const viejas = readdirSync(DESTINO).filter((f) => /^proservice-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -DIAS);
for (const f of viejas) rmSync(join(DESTINO, f));
if (viejas.length) console.log(`${new Date().toISOString()} Borradas ${viejas.length} copias de más de ${DIAS} días`);

// 5. Fuera del servidor, si hay destino y la copia de hoy está bien (una copia rota no se sube encima de nada)
if (REMOTO && process.exitCode !== 1) {
  const r = spawnSync(process.env.RCLONE || 'rclone', ['copy', DESTINO, REMOTO, '--checksum', '--stats-one-line', '--stats', '0'], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.error || r.status !== 0) {
    console.error(`${new Date().toISOString()} NO SE HA PODIDO SUBIR LA COPIA FUERA DEL SERVIDOR (${REMOTO}): ${r.error?.message ?? `rclone salió con ${r.status}`}`);
    process.exitCode = 1;
  } else {
    console.log(`${new Date().toISOString()} Copia subida fuera del servidor: ${REMOTO}`);
  }
}
