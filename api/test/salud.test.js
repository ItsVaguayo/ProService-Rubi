// /api/salud: lo usa el despliegue para saber que la versión nueva arrancó, y un monitor de fuera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conServidor } from './ayuda.js';
import { versionDesplegada } from '../src/app.js';

test('salud: sin sesión, con la versión (la de VERSION en el servidor, «desarrollo» fuera)', () =>
  conServidor(async ({ pide }) => {
    const r = await pide('/salud', { como: null });
    assert.equal(r.status, 200);
    // Los tests también se pasan dentro de una versión desplegada, donde sí hay VERSION
    assert.deepEqual(r.json, { ok: true, version: versionDesplegada() });
  }));

test('salud: si la base no contesta, 503', () =>
  conServidor(async ({ db, pide }) => {
    db.close();
    const r = await pide('/salud', { como: null });
    assert.equal(r.status, 503);
    assert.equal(r.json.ok, false);
  }));

test('salud: la versión es la que deja el despliegue en VERSION', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ps-version-'));
  try {
    writeFileSync(join(dir, 'VERSION'), '2ae193e\n');
    assert.equal(versionDesplegada(join(dir, 'VERSION')), '2ae193e');
    assert.equal(versionDesplegada(join(dir, 'no-existe')), 'desarrollo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
