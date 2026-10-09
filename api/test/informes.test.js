// Informes de los lunes: qué cuenta como venta, el margen, el stock por antigüedad y el CSV para el gestor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, CONTRASENA } from './ayuda.js';

// Da de alta un coche hace `alta` días y, si se pide, lo vende hace `vendido` días (por quien diga).
async function cocheCon(db, pide, { alta, vendido, estado = vendido == null ? 'publicado' : 'vendido', vendio = 1, cambios = {} }) {
  const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, ...cambios } })).json;
  db.prepare("UPDATE historial_estados SET fecha = datetime('now', ?) WHERE vehiculo_id = ?").run(`-${alta} days`, id);
  if (vendido != null) {
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, 'publicado', 'vendido', ?, datetime('now', ?))")
      .run(id, vendio, `-${vendido} days`);
  }
  db.prepare('UPDATE vehiculos SET estado = ? WHERE id = ?').run(estado, id);
  return id;
}

const mesDe = (haceDias) => new Date(Date.now() - haceDias * 86400000).toISOString().slice(0, 7);

test('solo gerencia, y el mes tiene que ir como AAAA-MM', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/informes', { como: 'comercial' })).status, 403, 'el comercial no ve márgenes');
    assert.equal((await pide('/informes/ventas.csv', { como: 'comercial' })).status, 403);
    assert.equal((await pide('/informes', { como: null })).status, 401);
    assert.equal((await pide('/informes?mes=septiembre')).status, 400);
    assert.equal((await pide('/informes?mes=2026-13')).status, 400);
    assert.equal((await pide('/informes')).status, 200, 'sin mes, el actual');
  }));

test('ventas del mes: precio, margen, quién vendió y días hasta vender', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cocheCon(db, pide, { alta: 40, vendido: 0, vendio: 2 });
    const { json } = await pide(`/informes?mes=${mesDe(0)}`);
    assert.equal(json.ventas.length, 1);
    const [v] = json.ventas;
    assert.equal(v.id, id);
    assert.equal(v.precio_venta_cent, 1290000);
    assert.equal(v.coste_total_cent, 950000, 'compra 9.000 + transporte 200 + taller 300');
    // REBU: IVA = (12.900 − 9.000) × 21/121 = 676,86; neto = 3.400 − 676,86
    assert.equal(v.iva_venta_cent, 67686);
    assert.equal(v.margen_cent, 272314);
    assert.equal(v.vendio, 'Comercial');
    assert.equal(v.dias_en_stock, 40);
    assert.deepEqual(
      { vendidos: json.resumen.vendidos, facturado: json.resumen.facturado_cent, margen: json.resumen.margen_cent, dias: json.resumen.dias_medios_venta },
      { vendidos: 1, facturado: 1290000, margen: 272314, dias: 40 },
    );
  }));

test('no cuentan las ventas de otro mes ni las que se deshicieron', () =>
  conServidor(async ({ db, pide }) => {
    // Ventas el día 15 de este mes y del anterior: así no dependen del día en que se pasen las pruebas
    const hoy = new Date();
    const haceDias = (fecha) => Math.round((hoy - fecha) / 86400000);
    const esteMes = haceDias(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1, 12))); // día 1 de este mes
    const mesPasado = haceDias(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 15, 12)));
    await cocheCon(db, pide, { alta: 90, vendido: mesPasado, cambios: { matricula: '1111AAA', bastidor: 'VIN1' } });
    await cocheCon(db, pide, { alta: 20, vendido: esteMes, estado: 'publicado', cambios: { matricula: '2222BBB', bastidor: 'VIN2' } }); // deshecha
    await cocheCon(db, pide, { alta: 60, vendido: esteMes, estado: 'entregado', cambios: { matricula: '3333CCC', bastidor: 'VIN3' } }); // entregado: cuenta
    const { json } = await pide(`/informes?mes=${mesDe(esteMes)}`);
    assert.deepEqual(json.ventas.map((v) => v.matricula), ['3333CCC']);
    assert.equal(json.resumen.vendidos_mes_anterior, 1);
    assert.ok(json.meses.includes(mesDe(mesPasado)), 'el selector ofrece los meses con ventas');
  }));

test('una venta deshecha y luego entregada directamente cuenta en el mes de la entrega', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cocheCon(db, pide, { alta: 100, vendido: 60, estado: 'entregado' }); // vendido hace 60 días...
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, 'vendido', 'publicado', 1, datetime('now', '-50 days'))").run(id);
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, 'publicado', 'entregado', 2, datetime('now'))").run(id);
    const ahora = (await pide(`/informes?mes=${mesDe(0)}`)).json;
    assert.deepEqual(ahora.ventas.map((v) => [v.id, v.vendio]), [[id, 'Comercial']], '...se deshizo y hoy se entregó: es venta de hoy');
    if (mesDe(60) !== mesDe(0)) assert.equal((await pide(`/informes?mes=${mesDe(60)}`)).json.ventas.length, 0, 'y no del mes de la venta deshecha');
  }));

test('entregar un coche vendido no es otra venta', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cocheCon(db, pide, { alta: 50, vendido: 40, estado: 'entregado' });
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, 'vendido', 'entregado', 1, datetime('now'))").run(id);
    const venta = (await pide(`/informes?mes=${mesDe(40)}`)).json.ventas.find((v) => v.id === id);
    assert.ok(venta, 'cuenta en el mes en que se vendió');
    assert.equal(venta.dias_en_stock, 10);
  }));

test('una venta sin coste o sin precio no se inventa un margen', () =>
  conServidor(async ({ db, pide }) => {
    await cocheCon(db, pide, { alta: 10, vendido: 0, cambios: { precio_compra_cent: null } });
    const { json } = await pide(`/informes?mes=${mesDe(0)}`);
    assert.equal(json.ventas[0].margen_cent, null);
    assert.equal(json.resumen.margen_cent, null);
    assert.equal(json.resumen.ventas_sin_margen, 1);
  }));

test('stock por antigüedad y los que más llevan; lo vendido no es stock', () =>
  conServidor(async ({ db, pide }) => {
    const dias = [5, 35, 70, 120];
    for (const [i, d] of dias.entries()) await cocheCon(db, pide, { alta: d, cambios: { matricula: `${i}000AAA`, bastidor: `VIN${i}`, propiedad: i ? 'propio' : 'deposito' } });
    await cocheCon(db, pide, { alta: 200, vendido: 1, cambios: { matricula: '9999ZZZ', bastidor: 'VIN9' } });
    const { stock } = (await pide('/informes')).json;
    assert.equal(stock.total, 4);
    assert.deepEqual([stock.propios, stock.deposito], [3, 1]);
    assert.deepEqual(stock.tramos.map((t) => t.n), [1, 1, 1, 1]);
    assert.deepEqual(stock.mas_antiguos.map((v) => v.dias), [120, 70, 35, 5]);
  }));

test('CSV para el gestor: Excel en español y sin fórmulas coladas', () =>
  conServidor(async ({ db, base, pide }) => {
    await cocheCon(db, pide, { alta: 12, vendido: 0, cambios: { marca: '=HYPERLINK("x")', modelo: 'Clio; 5p' } });
    // pide() espera JSON: el CSV se pide a mano con la cookie de gerencia
    const login = await fetch(`${base}/auth/entrar`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'jaume@ejemplo.com', contrasena: CONTRASENA }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await fetch(`${base}/informes/ventas.csv?mes=${mesDe(0)}`, { headers: { cookie } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /ventas-\d{4}-\d{2}\.csv/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM para que Excel lea los acentos');
    const [cabecera, fila] = bytes.subarray(3).toString('utf8').trim().split('\r\n');
    assert.match(cabecera, /^Fecha de venta;Referencia;Matrícula;/);
    const celdas = fila.split(';');
    assert.equal(celdas[3], `"'=HYPERLINK(""x"")"`, 'una fórmula entra como texto, con apóstrofo y entre comillas');
    assert.ok(fila.includes('"Clio; 5p"'), 'el «;» de un dato no parte la columna');
    assert.ok(fila.includes(';12900,00;9500,00;REBU;676,86;2723,14;12'), 'coste, régimen, IVA de la venta y margen neto, con coma decimal; los días al final');
  }));

test('evolución: los 12 meses que acaban en el pedido, con las mismas cifras que el resumen', () =>
  conServidor(async ({ db, pide }) => {
    await cocheCon(db, pide, { alta: 40, vendido: 0 });
    const mes = mesDe(0);
    const { json } = await pide(`/informes?mes=${mes}`);
    assert.equal(json.evolucion.length, 12);
    assert.equal(json.evolucion.at(-1).mes, mes, 'el último es el pedido');
    assert.ok(json.evolucion.every((m, i, l) => !i || l[i - 1].mes < m.mes), 'del más antiguo al más nuevo');
    const ultimo = json.evolucion.at(-1);
    assert.deepEqual([ultimo.vendidos, ultimo.margen_cent, ultimo.facturado_cent], [json.resumen.vendidos, json.resumen.margen_cent, json.resumen.facturado_cent]);
    assert.equal(ultimo.resultado_cent, json.resumen.resultado_cent);
    assert.equal(json.evolucion[0].vendidos, 0, 'un mes sin ventas sale a 0, no falta');
  }));
