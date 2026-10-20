// Cuota orientativa de la web y los portales (5.7): 7,5 % y 10 años, como la calculadora de Pymecar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { condicionesCuota, cuotaDe, cuotaMensual, ejemploDe, taeSinComisiones, textoCondiciones, CUOTA_POR_DEFECTO } from '../src/modules/publicacion/cuota.js';

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

test('cuota: TAE sin comisiones, el TIN mensual capitalizado', () => {
  assert.equal(taeSinComisiones(7.5), 7.76);
  assert.equal(taeSinComisiones(0), 0);
});

test('cuota: el ejemplo representativo (Ley 16/2011, art. 9) lleva la cuota exacta, la TAE y el total adeudado', () => {
  assert.deepEqual(ejemploDe({ pvp_cent: 1000000 }, CUOTA_POR_DEFECTO),
    { capital_cent: 1000000, cuota_cent: 11870, meses: 120, tin: 7.5, tae: 7.76, total_cent: 1424400 });
  assert.equal(ejemploDe({ pvp_cent: 1290000, precio_financiado_cent: 1000000 }, CUOTA_POR_DEFECTO).capital_cent, 1000000, 'sobre el precio si financia');
  assert.equal(ejemploDe({ pvp_cent: null }, CUOTA_POR_DEFECTO), null);
  assert.equal(ejemploDe({ pvp_cent: 1000000 }, null), null);
});

test('cuota: la letra pequeña es el ejemplo del propio coche', () => {
  assert.equal(textoCondiciones({ pvp_cent: 1290000 }, CUOTA_POR_DEFECTO),
    'Ejemplo para 12.900 € sin entrada: 120 cuotas de 153,13 €, TIN 7,50 %, TAE 7,76 %, importe total adeudado 18.375,60 €. '
    + 'Sin comisiones. Orientativa y sujeta a la aprobación de la financiera.');
  assert.equal(textoCondiciones({ pvp_cent: 1290000 }, null), null);
  assert.equal(textoCondiciones({ pvp_cent: null }, CUOTA_POR_DEFECTO), null);
});
