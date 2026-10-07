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

// Aplica en orden las migraciones api/migraciones/NNNN_nombre.sql que falten. Cada una se apunta por
// su nombre en migraciones_aplicadas, así una que llega tarde con un número más bajo (dos ramas que
// crean su migración a la vez) también se aplica. Cada migración va en su transacción: o entra
// entera o no entra. PRAGMA user_version sigue guardando el número más alto, como antes.
export function migrar(db, dir = DIR_MIGRACIONES) {
  const actual = db.pragma('user_version', { simple: true });

  if (actual === 0 && db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vehiculos'").get()) {
    throw new Error(
      'Esta base de datos se creó con el antiguo schema.sql y no tiene versión. ' +
        'Solo tenía datos de prueba: borra api/data/proservice.db* y arranca de nuevo.',
    );
  }

  const ficheros = readdirSync(dir)
    .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
    .sort();

  db.exec("CREATE TABLE IF NOT EXISTS migraciones_aplicadas (fichero TEXT PRIMARY KEY, aplicada_en TEXT NOT NULL DEFAULT (datetime('now')))");
  // Bases de antes de esta tabla: lo que tenía hasta su user_version ya estaba aplicado
  if (actual > 0 && !db.prepare('SELECT 1 FROM migraciones_aplicadas LIMIT 1').get()) {
    const marcar = db.prepare('INSERT INTO migraciones_aplicadas (fichero) VALUES (?)');
    db.transaction(() => { for (const f of ficheros) if (Number(f.slice(0, 4)) <= actual) marcar.run(f); })();
  }

  const aplicada = db.prepare('SELECT 1 FROM migraciones_aplicadas WHERE fichero = ?');
  for (const fichero of ficheros) {
    if (aplicada.get(fichero)) continue;
    const version = Number(fichero.slice(0, 4));
    const sql = readFileSync(new URL(fichero, dir), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migraciones_aplicadas (fichero) VALUES (?)').run(fichero);
      if (version > db.pragma('user_version', { simple: true })) db.pragma(`user_version = ${version}`);
    })();
  }
}
