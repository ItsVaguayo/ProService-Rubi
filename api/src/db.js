import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DIR_MIGRACIONES = new URL('../migraciones/', import.meta.url);

export function abrirDb(ruta = process.env.DB_PATH || './data/proservice.db') {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrar(db);
  return db;
}

// Aplica en orden las migraciones api/migraciones/NNNN_nombre.sql que falten.
// La versión aplicada se guarda en PRAGMA user_version. Cada migración va en su
// transacción: o entra entera o no entra.
export function migrar(db) {
  const actual = db.pragma('user_version', { simple: true });

  if (actual === 0 && db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vehiculos'").get()) {
    throw new Error(
      'Esta base de datos se creó con el antiguo schema.sql y no tiene versión. ' +
        'Solo tenía datos de prueba: borra api/data/proservice.db* y arranca de nuevo.',
    );
  }

  const ficheros = readdirSync(DIR_MIGRACIONES)
    .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
    .sort();

  for (const fichero of ficheros) {
    const version = Number(fichero.slice(0, 4));
    if (version <= actual) continue;
    const sql = readFileSync(new URL(fichero, DIR_MIGRACIONES), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
  }
}
