// Libro de gastos (T14): número correlativo, importes calculados en el servidor y reglas por tipo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { importes } from '../src/modules/gastos/calculo.js';

const hoy = () => new Date().toISOString().slice(0, 10);
const mesActual = () => hoy().slice(0, 7);
const mesPasado = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); };
const idDe = (db, email) => db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email).id;

const gasto = (cambios = {}) => ({ fecha: hoy(), concepto: 'publicidad', base_cent: 10000, ...cambios });
const alta = (pide, cambios) => pide('/gastos', { method: 'POST', body: gasto(cambios) });

test('importes: 100,00 € al 21 % de IVA y 15 % de IRPF → IVA 21,00, IRPF 15,00, total 106,00; 33,33 € al 21 % → IVA 7,00', () => {
  assert.deepEqual(importes({ base_cent: 10000, iva_pct: 21, irpf_pct: 15 }), { iva_cent: 2100, irpf_cent: 1500, total_cent: 10600 });
  assert.deepEqual(importes({ base_cent: 3333, iva_pct: 21, irpf_pct: 0 }), { iva_cent: 700, irpf_cent: 0, total_cent: 4033 }); // 699,93 → 700
  for (const base of [1, 3333, 12345, 999999]) {
    for (const v of Object.values(importes({ base_cent: base, iva_pct: 21, irpf_pct: 19 }))) assert.ok(Number.isInteger(v));
  }
});

test('alta: el servidor calcula y numera 1, 2, 3; editar no cambia el número y recalcula', () =>
  conServidor(async ({ db, pide }) => {
    const a = await alta(pide, { concepto: 'gestorias', base_cent: 10000, irpf_pct: 15, factura_proveedor: 'F-26-000153' });
    assert.equal(a.status, 201);
    assert.equal(a.json.tipo, 'irpf', 'gestorías: tipo irpf sin decirlo');
    assert.deepEqual([a.json.iva_cent, a.json.irpf_cent, a.json.total_cent], [2100, 1500, 10600]);
    assert.equal(a.json.creado_por, idDe(db, 'jaume@ejemplo.com'));
    const b = await alta(pide);
    const c = await alta(pide, { concepto: 'carburantes' });
    assert.deepEqual([a.json.numero, b.json.numero, c.json.numero], [1, 2, 3]);
    assert.equal(b.json.tipo, 'general');
    assert.equal(b.json.irpf_pct, 0);

    const e = await pide(`/gastos/${a.json.id}`, { method: 'PUT', body: { base_cent: 20000, iva_pct: 10 } });
    assert.equal(e.status, 200);
    assert.equal(e.json.numero, 1, 'el número no cambia');
    assert.deepEqual([e.json.iva_cent, e.json.irpf_cent, e.json.total_cent], [2000, 3000, 19000]);
    assert.equal((await pide(`/gastos/${a.json.id}`, { method: 'PUT', body: { numero: 7 } })).status, 400, 'el número no se manda');
    assert.deepEqual(db.prepare("SELECT accion FROM auditoria WHERE entidad = 'gasto' ORDER BY id").all().map((x) => x.accion), ['alta', 'alta', 'alta', 'edicion']);
  }));

test('si ya hay gastos con su número (los que vendrán de Pymecar), sigue desde el último', () =>
  conServidor(async ({ db, pide }) => {
    db.prepare("INSERT INTO gastos (numero, fecha, tipo, concepto, base_cent, iva_cent, irpf_cent, total_cent, creado_por) VALUES (313, '2026-09-30', 'general', 'publicidad', 100, 21, 0, 121, 1)").run();
    assert.equal((await alta(pide)).json.numero, 314);
  }));

test('sin tipo, con concepto alquileres → tipo irpf al 19 %', () =>
  conServidor(async ({ pide }) => {
    const r = await alta(pide, { concepto: 'alquileres', base_cent: 100000 });
    assert.equal(r.json.tipo, 'irpf');
    assert.equal(r.json.irpf_pct, 19);
    assert.equal(r.json.total_cent, 100000 + 21000 - 19000);
  }));

test('reglas por tipo: 400 si no se cumplen', () =>
  conServidor(async ({ pide }) => {
    const { id: v } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const casos = [
      [{ tipo: 'vehiculo', concepto: 'vehiculos' }, /vehiculo_id/],
      [{ tipo: 'irpf', irpf_pct: 0 }, /IRPF/],
      [{ tipo: 'rebu', concepto: 'compras', vehiculo_id: v, iva_pct: 21 }, /REBU/],
      [{ tipo: 'rebu', concepto: 'compras' }, /vehiculo_id/],
      [{ tipo: 'comision', concepto: 'comisiones' }, /proveedor_id|usuario_id/],
      [{ tipo: 'general', irpf_pct: 15 }, /general/],
    ];
    for (const [cambios, error] of casos) {
      const r = await alta(pide, cambios);
      assert.equal(r.status, 400, JSON.stringify(cambios));
      assert.match(r.json.error, error);
    }
    const rebu = await alta(pide, { concepto: 'compras', vehiculo_id: v, base_cent: 900000 });
    assert.equal(rebu.status, 201, 'REBU bien puesto');
    assert.deepEqual([rebu.json.tipo, rebu.json.iva_pct, rebu.json.total_cent], ['rebu', 0, 900000]);
    assert.equal((await alta(pide, { concepto: 'vehiculos', vehiculo_id: v })).json.vehiculo_marca, 'Renault');

    // Al editar también: quitar el coche a un gasto de vehículo no se deja
    const g = (await alta(pide, { concepto: 'vehiculos', vehiculo_id: v })).json;
    assert.equal((await pide(`/gastos/${g.id}`, { method: 'PUT', body: { vehiculo_id: null } })).status, 400);
    assert.equal((await pide(`/gastos/${g.id}`, { method: 'PUT', body: { iva_pct: null } })).status, 400);
  }));

test('validación: importes calculados, valores fuera de lista, ids y fechas', () =>
  conServidor(async ({ pide }) => {
    for (const cambios of [{ total_cent: 12100 }, { iva_cent: 2100 }, { base_cent: 100.5 }, { base_cent: -1 }, { base_cent: '100' },
      { iva_pct: 7 }, { irpf_pct: 21 }, { concepto: 'luz' }, { tipo: 'otro' }, { fecha: '2026-02-30' }, { fecha: '30/09/2026' },
      { forma_pago: 'cheque' }, { proveedor_id: 999 }, { vehiculo_id: 'uno' }, { creado_por: 1 }]) {
      assert.equal((await alta(pide, cambios)).status, 400, JSON.stringify(cambios));
    }
    const falta = await pide('/gastos', { method: 'POST', body: {} });
    assert.equal(falta.status, 400);
    for (const t of ['fecha', 'tipo', 'concepto', 'base']) assert.ok(falta.json.errores.some((e) => e.includes(t)), t);
  }));

test('pagado: pone la fecha de hoy y la forma de pago; sin pagar la quita', () =>
  conServidor(async ({ pide }) => {
    const { id } = (await alta(pide)).json;
    const p = await pide(`/gastos/${id}/pagado`, { method: 'PATCH', body: { pagado: true, forma_pago: 'transferencia' } });
    assert.equal(p.status, 200);
    assert.equal(p.json.pagado_en, hoy());
    assert.equal(p.json.forma_pago, 'transferencia');
    const n = await pide(`/gastos/${id}/pagado`, { method: 'PATCH', body: { pagado: false } });
    assert.equal(n.json.pagado_en, null);
    assert.equal(n.json.forma_pago, 'transferencia', 'la forma de pago se queda');
    assert.equal((await pide(`/gastos/${id}/pagado`, { method: 'PATCH', body: { pagado: true, forma_pago: 'cheque' } })).status, 400);
    assert.equal((await pide(`/gastos/${id}/pagado`, { method: 'PATCH', body: { pagado: 'si' } })).status, 400);
    assert.equal((await pide('/gastos/999/pagado', { method: 'PATCH', body: { pagado: true } })).status, 404);
  }));

test('lista: ?mes= y ?pagado=0 filtran, y los totales cuadran con la suma de la lista', () =>
  conServidor(async ({ pide }) => {
    const a = (await alta(pide, { base_cent: 10000 })).json;
    await alta(pide, { concepto: 'gestorias', base_cent: 3333 });
    await alta(pide, { fecha: `${mesPasado()}-15`, base_cent: 50000 });
    await pide(`/gastos/${a.id}/pagado`, { method: 'PATCH', body: { pagado: true } });

    const mes = (await pide('/gastos')).json;
    assert.equal(mes.mes, mesActual());
    assert.equal(mes.gastos.length, 2);
    for (const campo of ['base_cent', 'iva_cent', 'irpf_cent', 'total_cent']) {
      assert.equal(mes.totales[campo], mes.gastos.reduce((s, g) => s + g[campo], 0), campo);
    }
    assert.deepEqual(Object.keys(mes.totales.por_tipo).sort(), ['general', 'irpf']);
    assert.equal(mes.totales.por_tipo.irpf.total_cent + mes.totales.por_tipo.general.total_cent, mes.totales.total_cent);
    assert.equal(mes.totales.pendientes, 1);

    const sinPagar = (await pide('/gastos?pagado=0')).json;
    assert.deepEqual(sinPagar.gastos.map((g) => g.concepto), ['gestorias']);
    assert.equal(sinPagar.totales.total_cent, mes.totales.pendiente_cent);
    assert.equal((await pide(`/gastos?mes=${mesPasado()}`)).json.gastos.length, 1);
    assert.equal((await pide('/gastos?tipo=irpf')).json.gastos.length, 1);
    for (const malo of ['mes=octubre', 'pagado=si', 'tipo=otro', 'vehiculo=x', 'concepto=luz']) assert.equal((await pide(`/gastos?${malo}`)).status, 400, malo);
  }));

test('el comercial: 403 en todas las rutas; sin sesión, 401', () =>
  conServidor(async ({ pide }) => {
    const { id } = (await alta(pide)).json;
    for (const [ruta, method, body] of [['/gastos', 'GET'], [`/gastos/${id}`, 'GET'], ['/gastos', 'POST', gasto()],
      [`/gastos/${id}`, 'PUT', { base_cent: 1 }], [`/gastos/${id}/pagado`, 'PATCH', { pagado: true }]]) {
      assert.equal((await pide(ruta, { method, body, como: 'comercial' })).status, 403, `${method} ${ruta}`);
    }
    assert.equal((await pide('/gastos', { como: null })).status, 401);
    assert.equal((await pide(`/gastos/${id}`, { method: 'DELETE' })).status, 404, 'no hay DELETE');
  }));

test('liquidar un incentivo de 150 € apunta un gasto de comisión de 150 €; uno de 0 € no apunta nada', () =>
  conServidor(async ({ db, pide }) => {
    const comercial = idDe(db, 'comercial@ejemplo.com');
    await pide(`/incentivos/reglas/${comercial}`, { method: 'PUT', body: { tipo: 'fijo_por_coche', valor: 15000 } });
    const { id: v } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    meterFotos(db, v, 15);
    await pide(`/vehiculos/${v}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    await pide(`/vehiculos/${v}/estado`, { method: 'PATCH', body: { estado: 'vendido' }, como: 'comercial' });
    db.prepare("UPDATE historial_estados SET fecha = ? || '-15 10:00:00' WHERE vehiculo_id = ?").run(mesPasado(), v);

    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: comercial } })).status, 201);
    const [g] = db.prepare("SELECT * FROM gastos WHERE tipo = 'comision'").all(); // los otros son los costes del coche
    assert.equal(g.tipo, 'comision');
    assert.equal(g.concepto, 'comisiones');
    assert.equal(g.usuario_id, comercial);
    assert.deepEqual([g.base_cent, g.iva_cent, g.irpf_cent, g.total_cent], [15000, 0, 0, 15000]);
    assert.equal(g.descripcion, `Incentivo de Comercial, ${mesPasado()}`);
    assert.equal((await pide(`/gastos/${g.id}`)).json.usuario_nombre, 'Comercial');

    const jaume = idDe(db, 'jaume@ejemplo.com');
    assert.equal((await pide('/incentivos/liquidar', { method: 'POST', body: { mes: mesPasado(), usuario_id: jaume } })).status, 201);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gastos WHERE tipo = 'comision'").get().n, 1, 'un incentivo de 0 € no apunta gasto');
  }));
