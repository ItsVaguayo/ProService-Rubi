// Incentivos de los comerciales (T12): todo en céntimos enteros, el comercial solo ve lo suyo y sin margen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { incentivoDeCoche } from '../src/modules/incentivos/calculo.js';
import { margenNeto } from '../src/modules/margen.js';

// El coche de ayuda.js cuesta 9.500 € (compra 9.000 + transporte 200 + taller 300): el margen bruto es PVP − 950.000.
// El incentivo va sobre el neto (después del IVA de la venta en REBU): netoDe(bruto) lo calcula como margen.js.
const COSTE = 950000;
const netoDe = (bruto) => margenNeto({ ...coche, coste_otros_cent: 0, pvp_cent: COSTE + bruto });
const mesActual = () => new Date().toISOString().slice(0, 7);
const mesPasado = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); };
const idDe = (db, email) => db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email).id;

let n = 0;
// Un coche publicado que vende `como`, con el margen que se pida (o sin compra: margen null)
async function vendido(db, pide, { margen = 340000, como = 'comercial', sinCompra = false } = {}) {
  n++;
  const datos = { ...coche, matricula: `${1000 + n} BCD`, bastidor: `VIN${n}`, pvp_cent: COSTE + margen };
  if (sinCompra) delete datos.precio_compra_cent;
  const { id } = (await pide('/vehiculos', { method: 'POST', body: datos })).json;
  meterFotos(db, id, 15);
  assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } })).status, 200);
  assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'vendido' }, como })).status, 200);
  return id;
}

const regla = (pide, usuarioId, tipo, valor) => pide(`/incentivos/reglas/${usuarioId}`, { method: 'PUT', body: { tipo, valor } });
const comercialDe = (json, id) => json.comerciales.find((c) => c.usuario_id === id);

test('cálculo en enteros: 5 % de 2.345,67 € son 117,28 €; con pérdida o sin margen, 0', () => {
  const cinco = { tipo: 'porcentaje_margen', valor: 500 };
  assert.equal(incentivoDeCoche(cinco, 234567), 11728); // 2.345,67 × 0,05 = 117,2835 → 117,28
  assert.equal(incentivoDeCoche(cinco, 234570), 11729, 'medio céntimo hacia arriba: 117,285 → 117,29');
  assert.equal(incentivoDeCoche(cinco, -50000), 0);
  assert.equal(incentivoDeCoche(cinco, 0), 0);
  assert.equal(incentivoDeCoche(cinco, null), 0);
  assert.equal(incentivoDeCoche(null, 234567), 0, 'sin regla');
  assert.equal(incentivoDeCoche({ tipo: 'fijo_por_coche', valor: 15000 }, null), 15000, 'el fijo no depende del margen');
  for (const m of [1, 333, 234567, 999999, 12345678]) assert.ok(Number.isInteger(incentivoDeCoche({ tipo: 'porcentaje_margen', valor: 333 }, m)));
});

test('porcentaje sobre el margen real de los coches vendidos', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    assert.equal((await regla(pide, comercial, 'porcentaje_margen', 500)).status, 200);
    await vendido(db, pide, { margen: 234567 });
    await vendido(db, pide, { margen: -50000 });
    await vendido(db, pide, { sinCompra: true });

    const c = comercialDe((await pide(`/incentivos?mes=${mesActual()}`)).json, comercial);
    const bueno = incentivoDeCoche({ tipo: 'porcentaje_margen', valor: 500 }, netoDe(234567));
    assert.equal(netoDe(234567), 234567 - Math.round((284567 * 21) / 121), 'neto = bruto − IVA del REBU sobre venta − compra');
    assert.equal(netoDe(-50000), -50000, 'vendido por debajo de la compra: sin IVA');
    assert.deepEqual(c.coches.map((x) => x.incentivo_cent).sort((a, b) => a - b), [0, 0, bueno]);
    assert.deepEqual(c.coches.map((x) => x.margen_cent).sort((a, b) => (a ?? 0) - (b ?? 0)), [-50000, null, netoDe(234567)]);
    assert.equal(c.total_cent, bueno);
    assert.deepEqual(c.regla, { tipo: 'porcentaje_margen', valor: 500 });
    assert.ok(Number.isInteger(c.total_cent));
  }));

test('fijo de 150 € por coche con 3 coches: 450 €', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    await regla(pide, comercial, 'fijo_por_coche', 15000);
    for (let i = 0; i < 3; i++) await vendido(db, pide);
    assert.equal(comercialDe((await pide('/incentivos')).json, comercial).total_cent, 45000);
  }));

test('sin regla el incentivo es 0, pero el comercial sale con sus coches; gerencia que vende también sale', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    const jaume = idDe(db, 'jaume@ejemplo.com');
    await vendido(db, pide);
    await vendido(db, pide, { como: 'gerencia' });
    const todos = (await pide('/incentivos')).json;
    assert.equal(comercialDe(todos, comercial).regla, null);
    assert.equal(comercialDe(todos, comercial).coches.length, 1);
    assert.equal(comercialDe(todos, comercial).total_cent, 0);
    assert.equal(comercialDe(todos, jaume).coches.length, 1, 'la venta cuenta para quien la hizo');
    assert.equal(todos.sin_vendedor, 0);
  }));

test('el comercial solo ve lo suyo, sin el margen de ningún coche', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    await regla(pide, comercial, 'porcentaje_margen', 500);
    await vendido(db, pide, { margen: 234567 });
    await vendido(db, pide, { como: 'gerencia' });

    const r = await pide('/incentivos', { como: 'comercial' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.comerciales.map((c) => c.usuario_id), [comercial], 'no ve a los demás');
    assert.equal(r.json.sin_vendedor, undefined);
    const [c] = r.json.comerciales;
    assert.equal(c.coches.length, 1);
    assert.ok(c.coches.every((x) => !('margen_cent' in x)), 'sin margen');
    assert.equal(c.coches[0].incentivo_cent, incentivoDeCoche({ tipo: 'porcentaje_margen', valor: 500 }, netoDe(234567)), 'el incentivo sí');
    assert.ok(!JSON.stringify(r.json).includes(String(netoDe(234567))), 'el margen no aparece por ningún sitio');
    assert.deepEqual(c.regla, { tipo: 'porcentaje_margen' }, 'ni el porcentaje: con él y el incentivo se despeja el margen');
  }));

test('el comercial no puede ver ni cambiar reglas ni liquidar: 403', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    assert.equal((await pide('/incentivos/reglas', { como: 'comercial' })).status, 403);
    assert.equal((await regla((r, o) => pide(r, { ...o, como: 'comercial' }), comercial, 'fijo_por_coche', 100000)).status, 403);
    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', como: 'comercial', body: { mes: mesPasado(), usuario_id: comercial } })).status, 403);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM incentivos_reglas').get().n, 0);
    assert.equal((await pide('/incentivos', { como: null })).status, 401);
  }));

test('reglas: validación, cambio y lista', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    for (const [tipo, valor] of [['porcentaje', 500], ['fijo_por_coche', 150.5], ['fijo_por_coche', -1], ['porcentaje_margen', 10001], ['fijo_por_coche', '15000']]) {
      assert.equal((await regla(pide, comercial, tipo, valor)).status, 400, `${tipo} ${valor}`);
    }
    assert.equal((await pide(`/incentivos/reglas/${comercial}`, { method: 'PUT', body: { tipo: 'fijo_por_coche', valor: 1, usuario_id: 9 } })).status, 400);
    assert.equal((await regla(pide, 999, 'fijo_por_coche', 1)).status, 404);

    await regla(pide, comercial, 'fijo_por_coche', 15000);
    const cambio = await regla(pide, comercial, 'porcentaje_margen', 300);
    assert.equal(cambio.json.tipo, 'porcentaje_margen');
    const lista = (await pide('/incentivos/reglas')).json;
    assert.equal(lista.length, 2, 'todos los usuarios, con regla o sin ella');
    assert.equal(lista.find((u) => u.usuario_id === comercial).valor, 300);
    assert.deepEqual(db.prepare("SELECT accion FROM auditoria WHERE entidad = 'incentivo_regla' ORDER BY id").all().map((a) => a.accion), ['alta', 'edicion']);
  }));

test('liquidar: solo un mes terminado y una sola vez; guarda lo calculado', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    await regla(pide, comercial, 'fijo_por_coche', 15000);
    const v = await vendido(db, pide);
    await vendido(db, pide);
    // Una venta del mes pasado: se mueve su paso a «Vendido» al día 15 del mes anterior
    db.prepare("UPDATE historial_estados SET fecha = ? || '-15 10:00:00' WHERE vehiculo_id = ?").run(mesPasado(), v);

    const ahora = await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesActual(), usuario_id: comercial } });
    assert.equal(ahora.status, 409, 'el mes en curso no se liquida');

    const r = await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: comercial } });
    assert.equal(r.status, 201);
    assert.equal(r.json.coches, 1);
    assert.equal(r.json.importe_cent, 15000);
    assert.equal(r.json.liquidado_por, idDe(db, 'jaume@ejemplo.com'));

    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: comercial } })).status, 409, 'dos veces no');

    // Cambiar la regla después no toca lo pagado
    await regla(pide, comercial, 'fijo_por_coche', 99900);
    const c = comercialDe((await pide(`/incentivos?mes=${mesPasado()}`)).json, comercial);
    assert.equal(c.liquidado.importe_cent, 15000);
    assert.equal(c.total_cent, 99900, 'el cálculo de ahora sí cambia, para ver la diferencia');
    const suyo = (await pide(`/incentivos?mes=${mesPasado()}`, { como: 'comercial' })).json.comerciales[0];
    assert.deepEqual(Object.keys(suyo.liquidado).sort(), ['coches', 'importe_cent', 'liquidado_en'], 'el comercial ve lo cobrado, no quién lo liquidó');
  }));

test('liquidar: validación', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: '2026-13', usuario_id: comercial } })).status, 400);
    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: '2' } })).status, 400);
    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: 999 } })).status, 404);
    assert.equal((await pide('/incentivos?mes=octubre')).status, 400);
    const cero = await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: comercial } });
    assert.equal(cero.status, 201, 'un mes sin ventas se liquida a 0');
    assert.equal(cero.json.importe_cent, 0);
  }));
