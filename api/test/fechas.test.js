import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyLocal, mesLocal, diaValido } from '../src/fechas.js';

test('hoyLocal: el día en Rubí, no en UTC', () => {
  assert.equal(hoyLocal(new Date('2026-12-31T23:30:00Z')), '2027-01-01', 'a las 00:30 de Rubí ya es año nuevo');
  assert.equal(mesLocal(new Date('2026-10-31T22:30:00Z')), '2026-10', 'en octubre Rubí va una hora por delante (UTC+1 desde el 25-oct)');
  assert.equal(mesLocal(new Date('2026-10-31T23:30:00Z')), '2026-11');
  assert.equal(hoyLocal(new Date('2026-07-15T22:30:00Z')), '2026-07-16', 'en verano, dos horas por delante');
});

test('diaValido', () => {
  assert.ok(diaValido('2026-02-28'));
  assert.ok(!diaValido('2026-02-30'));
  assert.ok(!diaValido('2026-2-3'));
});
