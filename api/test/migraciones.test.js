import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readdirSync } from 'node:fs';
import { migrar } from '../src/db.js';

const ultima = Math.max(
  ...readdirSync(new URL('../migraciones/', import.meta.url))
    .filter((f) => /^\d{4}_/.test(f))
    .map((f) => Number(f.slice(0, 4))),
);

test('las migraciones se aplican una vez y dejan la versión', () => {
  const db = new Database(':memory:');
  migrar(db);
  assert.equal(db.pragma('user_version', { simple: true }), ultima);
  assert.doesNotThrow(() => migrar(db), 'volver a arrancar no reaplica nada');
  db.close();
});

test('una base del antiguo schema.sql se detecta en vez de romperse a medias', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE vehiculos (id INTEGER PRIMARY KEY)');
  assert.throws(() => migrar(db), /antiguo schema\.sql/);
  db.close();
});
