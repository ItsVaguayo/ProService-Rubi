import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function abrirDb(ruta = process.env.DB_PATH || './data/proservice.db') {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return db;
}
