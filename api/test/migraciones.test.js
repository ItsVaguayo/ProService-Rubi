import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('una migración con número más bajo que llega tarde también se aplica', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'migraciones-'));
  const dir = pathToFileURL(`${carpeta}/`);
  try {
    writeFileSync(join(carpeta, '0001_base.sql'), 'CREATE TABLE a (id INTEGER);');
    writeFileSync(join(carpeta, '0003_david.sql'), 'CREATE TABLE c (id INTEGER);');
    const db = new Database(':memory:');
    migrar(db, dir);
    assert.equal(db.pragma('user_version', { simple: true }), 3);

    // La rama de Victor entra después con la 0002 y otra 0003 con distinto nombre
    writeFileSync(join(carpeta, '0002_victor.sql'), 'CREATE TABLE b (id INTEGER);');
    writeFileSync(join(carpeta, '0003_victor.sql'), 'CREATE TABLE d (id INTEGER);');
    migrar(db, dir);
    const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('a','b','c','d') ORDER BY name").all();
    assert.deepEqual(tablas.map((t) => t.name), ['a', 'b', 'c', 'd']);
    assert.equal(db.pragma('user_version', { simple: true }), 3);
    assert.doesNotThrow(() => migrar(db, dir), 'no se reaplica nada');
    db.close();
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

test('una base de antes de la tabla de migraciones no reaplica lo que ya tenía', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'migraciones-'));
  const dir = pathToFileURL(`${carpeta}/`);
  try {
    writeFileSync(join(carpeta, '0001_base.sql'), 'CREATE TABLE a (id INTEGER);');
    writeFileSync(join(carpeta, '0002_mas.sql'), 'CREATE TABLE b (id INTEGER);');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE a (id INTEGER)'); // aplicada con el sistema viejo, que solo guardaba el número
    db.pragma('user_version = 1');
    migrar(db, dir);
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'b'").get());
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM migraciones_aplicadas').get().n, 2);
    db.close();
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});
