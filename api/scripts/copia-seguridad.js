// Copia de seguridad de la base y de las fotos, pensada para lanzarla una vez al día con cron:
//   15 3 * * *  cd /ruta/api && npm run copia >> /var/log/proservice-copia.log 2>&1
// Deja en COPIAS_PATH (por defecto ./data/copias):
//   proservice-AAAA-MM-DD.db  la base entera, hecha con la API de copia de SQLite (segura con el servidor en marcha)
//   uploads/                  las fotos; solo se copian las nuevas, las que ya están no se tocan
// Cada copia se abre al acabar y se comprueba (integrity_check y que tenga coches y usuarios): una copia
// que no se puede abrir no sirve de nada. Se guardan las últimas COPIAS_DIAS (14 por defecto).
// Fuera del servidor: sincroniza COPIAS_PATH con otro sitio (rclone a Google Drive, por ejemplo). Si el
// servidor se pierde entero, la copia que estaba dentro se pierde con él.
import Database from 'better-sqlite3';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUTA_DB = resolve(process.env.DB_PATH || './data/proservice.db');
const FOTOS = resolve(process.env.UPLOADS_PATH || './data/uploads');
const DESTINO = resolve(process.env.COPIAS_PATH || './data/copias');
const DIAS = Number(process.env.COPIAS_DIAS || 14);

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
