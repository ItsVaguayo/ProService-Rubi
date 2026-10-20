// Cuota orientativa de la web y los portales (5.7): 7,5 % y 10 años, como la calculadora de Pymecar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { condicionesCuota, cuotaDe, cuotaMensual, textoCondiciones, CUOTA_POR_DEFECTO } from '../src/modules/publicacion/cuota.js';

test('cuota: préstamo francés al 7,5 % y 120 meses, redondeada hacia arriba al euro', () => {
  // 10.000 € al 7,5 % en 10 años salen 118,70 €/mes: se anuncia «desde 119»
  assert.equal(cuotaMensual(1000000, CUOTA_POR_DEFECTO), 119);
  assert.equal(cuotaMensual(1290000, CUOTA_POR_DEFECTO), 154);
  assert.equal(cuotaMensual(1200000, { tin: 0, meses: 120 }), 100, 'sin interés es el precio entre los meses');
  assert.equal(cuotaMensual(1200000, { tin: 0, meses: 60 }), 200);
});

test('cuota: sin precio o apagada no hay cuota', () => {
  assert.equal(cuotaMensual(null, CUOTA_POR_DEFECTO), null);
  assert.equal(cuotaMensual(0, CUOTA_POR_DEFECTO), null);
  assert.equal(cuotaMensual(1000000, null), null);
});

test('cuota: sobre el precio si financia y, si no lo tiene, sobre el PVP', () => {
  assert.equal(cuotaDe({ pvp_cent: 1290000, precio_financiado_cent: 1000000 }, CUOTA_POR_DEFECTO), 119);
  assert.equal(cuotaDe({ pvp_cent: 1000000, precio_financiado_cent: null }, CUOTA_POR_DEFECTO), 119);
});

test('cuota: condiciones del .env, con las de Pymecar por defecto y CUOTA_MESES=0 para apagarla', () => {
  assert.deepEqual(condicionesCuota({}), { tin: 7.5, meses: 120 });
  assert.deepEqual(condicionesCuota({ CUOTA_TIN: '', CUOTA_MESES: '' }), { tin: 7.5, meses: 120 });
  assert.deepEqual(condicionesCuota({ CUOTA_TIN: '8.99', CUOTA_MESES: '96' }), { tin: 8.99, meses: 96 });
  assert.equal(condicionesCuota({ CUOTA_MESES: '0' }), null);
  assert.throws(() => condicionesCuota({ CUOTA_TIN: '7,5' }), /CUOTA_TIN/, 'con coma no es un número: mejor parar que publicar una cuota mala');
  assert.throws(() => condicionesCuota({ CUOTA_TIN: '75' }), /CUOTA_TIN/);
  assert.throws(() => condicionesCuota({ CUOTA_MESES: '10.5' }), /CUOTA_MESES/);
});

test('cuota: la letra pequeña dice el tipo y el plazo', () => {
  assert.equal(textoCondiciones(CUOTA_POR_DEFECTO), 'Cuota orientativa: 7,5 % TIN, 120 meses, sin entrada. Sujeta a la aprobación de la financiera.');
  assert.equal(textoCondiciones(null), null);
});
