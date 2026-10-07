// Bloque 2: coste, IVA de la venta y margen neto, con los costes del coche en el libro de gastos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { conServidor, coche } from './ayuda.js';
import { ivaDeLaVenta, margenBruto, margenNeto, costeTotal } from '../src/modules/margen.js';

test('REBU: el caso real de Pymecar (compra 14.000, venta 15.975 → IVA 342,77)', () => {
  const arona = { propiedad: 'propio', regimen_iva: 'REBU', precio_compra_cent: 1400000, pvp_cent: 1597500 };
  assert.equal(margenBruto(arona), 197500);
  assert.equal(ivaDeLaVenta(arona), 34277, '1.975 × 21/121 = 342,768 → 342,77, como en su libro');
  assert.equal(margenNeto(arona), 163223, 'la base imponible de su factura: 1.632,23');
});

test('REBU: los gastos bajan el margen pero no el IVA; con pérdida, sin IVA', () => {
  const conTaller = { regimen_iva: 'REBU', precio_compra_cent: 1400000, coste_taller_cent: 50000, coste_otros_cent: 10000, pvp_cent: 1597500 };
  assert.equal(costeTotal(conTaller), 1460000);
  assert.equal(ivaDeLaVenta(conTaller), 34277, 'el IVA va sobre venta − compra: el taller no entra');
  assert.equal(margenNeto(conTaller), 1597500 - 1460000 - 34277);
  const perdida = { regimen_iva: 'REBU', precio_compra_cent: 1400000, pvp_cent: 1300000 };
  assert.equal(ivaDeLaVenta(perdida), 0);
  assert.equal(margenNeto(perdida), -100000);
});

test('IVA general: el 21 % va dentro del precio de venta', () => {
  const v = { regimen_iva: 'deducible', precio_compra_cent: 1000000, pvp_cent: 1452000 };
  assert.equal(ivaDeLaVenta(v), 252000, '14.520 = 12.000 + 2.520');
  assert.equal(margenNeto(v), 200000, 'base 12.000 − compra 10.000');
});

test('depósito: se trata como un REBU sobre lo pactado con el dueño; sin régimen, REBU', () => {
  const cesion = { propiedad: 'deposito', regimen_iva: 'deducible', pago_propietario_cent: 1500000, pvp_cent: 1690000 };
  assert.equal(ivaDeLaVenta(cesion), 32975, 'REBU aunque ponga otra cosa: (16.900 − 15.000) × 21/121');
  assert.equal(ivaDeLaVenta({ precio_compra_cent: 1400000, pvp_cent: 1597500 }), 34277, 'sin régimen');
  assert.equal(margenNeto({ precio_compra_cent: 1400000 }), null, 'sin precio no se inventa');
  assert.equal(margenNeto({ pvp_cent: 1597500 }), null, 'sin compra tampoco');
});

test('los costes de la ficha se guardan como gastos del coche, y se corrigen sin borrarse', () =>
  conServidor(async ({ db, pide }) => {
    const v = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    assert.equal(v.coste_transporte_cent, 20000);
    assert.equal(v.coste_taller_cent, 30000);
    const gastos = () => db.prepare('SELECT coste_ficha, base_cent, iva_pct, tipo FROM gastos WHERE vehiculo_id = ? ORDER BY coste_ficha').all(v.id);
    assert.deepEqual(gastos(), [
      { coste_ficha: 'taller', base_cent: 30000, iva_pct: 21, tipo: 'vehiculo' },
      { coste_ficha: 'transporte', base_cent: 20000, iva_pct: 21, tipo: 'vehiculo' },
    ]);

    const cambio = await pide(`/vehiculos/${v.id}`, { method: 'PUT', body: { coste_taller_cent: 45000, coste_impuestos_cent: 12000, coste_transporte_cent: null } });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.json.coste_taller_cent, 45000);
    assert.equal(cambio.json.coste_transporte_cent, 0, 'vaciar la casilla deja el gasto a 0');
    assert.deepEqual(gastos().map((g) => [g.coste_ficha, g.base_cent, g.iva_pct]), [['impuestos', 12000, 0], ['taller', 45000, 21], ['transporte', 0, 21]],
      'los impuestos sin IVA; ningún gasto se borra');
    assert.equal(cambio.json.coste_total_cent, 900000 + 45000 + 12000);

    assert.equal((await pide(`/vehiculos/${v.id}`, { method: 'PUT', body: { coste_taller_cent: 1 }, como: 'comercial' })).status, 400, 'el comercial no toca dinero');
    const delComercial = (await pide(`/vehiculos/${v.id}`, { como: 'comercial' })).json;
    for (const campo of ['coste_taller_cent', 'coste_otros_cent', 'iva_venta_cent', 'margen_bruto_cent', 'margen_cent', 'coste_total_cent']) {
      assert.ok(!(campo in delComercial), `el comercial no recibe ${campo}`);
    }
  }));

test('los otros gastos del coche suman a su coste; la factura de compra en REBU no', () =>
  conServidor(async ({ pide }) => {
    const v = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const gasto = (cuerpo) => pide('/gastos', { method: 'POST', body: { fecha: '2026-10-01', vehiculo_id: v.id, base_cent: 5000, ...cuerpo } });
    assert.equal((await gasto({ concepto: 'vehiculos' })).status, 201); // una ITV, por ejemplo
    assert.equal((await gasto({ concepto: 'compras', base_cent: 900000 })).status, 201); // la compra: ya es precio_compra
    const ficha = (await pide(`/vehiculos/${v.id}`)).json;
    assert.equal(ficha.coste_otros_cent, 5000);
    assert.equal(ficha.coste_total_cent, 900000 + 20000 + 30000 + 5000);
  }));

test('informes: margen neto, gastos de estructura y resultado del mes', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    db.prepare("UPDATE vehiculos SET estado = 'vendido' WHERE id = ?").run(id);
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a) VALUES (?, 'publicado', 'vendido')").run(id);
    const mes = new Date().toISOString().slice(0, 7);
    await pide('/gastos', { method: 'POST', body: { fecha: `${mes}-02`, concepto: 'electricidad', base_cent: 10000 } });
    await pide('/gastos', { method: 'POST', body: { fecha: `${mes}-02`, concepto: 'alquileres', base_cent: 100000 } });
    const { resumen } = (await pide(`/informes?mes=${mes}`)).json;
    assert.equal(resumen.margen_cent, 272314);
    assert.equal(resumen.gastos_estructura_cent, 110000, 'sin IVA; los del coche ya están en su margen');
    assert.equal(resumen.resultado_cent, 272314 - 110000);
  }));

test('migración 0012: los costes de la ficha pasan al libro y las columnas se van', () => {
  const dir = new URL('../migraciones/', import.meta.url);
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const f of readdirSync(dir).filter((f) => /^\d{4}_/.test(f)).sort()) {
    if (f.startsWith('0012')) {
      db.prepare("INSERT INTO usuarios (email, nombre, rol, hash) VALUES ('j@x', 'J', 'gerencia', 'x')").run();
      db.prepare(`INSERT INTO vehiculos (matricula, marca, modelo, coste_transporte_cent, coste_taller_cent, coste_impuestos_cent)
                  VALUES ('1AAA', 'Seat', 'Ibiza', 20000, 0, 5000), ('2BBB', 'Kia', 'Ceed', 0, 30000, 0)`).run();
      db.prepare("INSERT INTO gastos (numero, fecha, tipo, concepto, base_cent, iva_cent, irpf_cent, total_cent, creado_por) VALUES (313, '2026-10-01', 'general', 'publicidad', 100, 21, 0, 121, 1)").run();
    }
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  }
  const filas = db.prepare('SELECT numero, vehiculo_id, coste_ficha, base_cent, iva_cent, total_cent FROM gastos WHERE coste_ficha IS NOT NULL ORDER BY numero').all();
  assert.deepEqual(filas, [
    { numero: 314, vehiculo_id: 1, coste_ficha: 'impuestos', base_cent: 5000, iva_cent: 0, total_cent: 5000 },
    { numero: 315, vehiculo_id: 1, coste_ficha: 'transporte', base_cent: 20000, iva_cent: 4200, total_cent: 24200 },
    { numero: 316, vehiculo_id: 2, coste_ficha: 'taller', base_cent: 30000, iva_cent: 6300, total_cent: 36300 },
  ], 'siguen la numeración del libro y las casillas a 0 no apuntan nada');
  const columnas = db.prepare('PRAGMA table_info(vehiculos)').all().map((c) => c.name);
  assert.ok(!columnas.some((c) => c.startsWith('coste_')), 'ya no hay columnas de coste en vehiculos');
  db.close();
});

test('revisión: la factura de compra no cuenta como coste aunque vaya en IVA general', () =>
  conServidor(async ({ pide }) => {
    const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, regimen_iva: 'deducible' } })).json;
    assert.equal((await pide('/gastos', { method: 'POST', body: { fecha: '2026-10-01', tipo: 'general', concepto: 'compras', vehiculo_id: v.id, base_cent: 900000 } })).status, 201);
    const ficha = (await pide(`/vehiculos/${v.id}`)).json;
    assert.equal(ficha.coste_otros_cent, 0);
    assert.equal(ficha.coste_total_cent, 950000, 'compra 9.000 + transporte + taller, sin la factura de compra otra vez');
  }));

test('revisión: un gasto que sale de la ficha no se pasa a otro coche', () =>
  conServidor(async ({ db, pide }) => {
    const a = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const b = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '2222BBB', bastidor: null } })).json;
    const { id } = db.prepare("SELECT id FROM gastos WHERE vehiculo_id = ? AND coste_ficha = 'taller'").get(a.id);
    const r = await pide(`/gastos/${id}`, { method: 'PUT', body: { vehiculo_id: b.id } });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /taller de la ficha/);
    assert.equal((await pide(`/gastos/${id}`, { method: 'PUT', body: { base_cent: 31000 } })).status, 200, 'el importe sí se corrige');
    assert.equal((await pide(`/vehiculos/${a.id}`)).json.coste_taller_cent, 31000);
  }));
