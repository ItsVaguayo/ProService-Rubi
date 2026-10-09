// Bloque 3: facturas de venta, numeración, rectificativas, cobros y libros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, CONTRASENA } from './ayuda.js';
import { importesFactura } from '../src/modules/facturacion/importes.js';
import { estadoCobro } from '../src/modules/facturacion/routes.js';

const EMPRESA = { direccion: 'Ctra. de Terrassa, 83', codigo_postal: '08191', poblacion: 'Rubí' };
const CLIENTE = { nombre: 'Laura Gil', nif: '12345678Z', direccion: 'C/ Major 12', codigo_postal: '08191', poblacion: 'Rubí' };

// Empresa con dirección, un cliente completo y un coche: lo mínimo para emitir
async function preparar(pide, { cocheExtra = {}, cliente = CLIENTE } = {}) {
  await pide('/facturas/empresa', { method: 'PUT', body: EMPRESA });
  const c = (await pide('/clientes', { method: 'POST', body: cliente })).json;
  const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, ...cocheExtra } })).json;
  return { c, v };
}
const borrador = (pide, body) => pide('/facturas', { method: 'POST', body });

test('importes: REBU sobre el margen (el caso real de Pymecar) y general con el 21 % dentro', () => {
  assert.deepEqual(importesFactura({ regimen: 'REBU', precio_cent: 1597500, compra_cent: 1400000 }),
    { base_cent: 163223, iva_pct: 21, iva_cent: 34277, total_cent: 1597500 }, 'base 1.632,23 + IVA 342,77, como su libro');
  assert.deepEqual(importesFactura({ regimen: 'REBU', precio_cent: 1300000, compra_cent: 1400000 }),
    { base_cent: 0, iva_pct: 21, iva_cent: 0, total_cent: 1300000 }, 'con pérdida, sin IVA');
  assert.deepEqual(importesFactura({ regimen: 'general', precio_cent: 1452000, suplidos_cent: 15000 }),
    { base_cent: 1200000, iva_pct: 21, iva_cent: 252000, total_cent: 1467000 }, 'los suplidos van fuera de la base');
});

test('estado de cobro', () => {
  const f = { estado: 'emitida', tipo: 'venta', total_cent: 1000, vencimiento: '2026-10-10' };
  assert.equal(estadoCobro({ ...f, cobrado_cent: 0 }, '2026-10-01'), 'pendiente');
  assert.equal(estadoCobro({ ...f, cobrado_cent: 300 }, '2026-10-01'), 'parcial');
  assert.equal(estadoCobro({ ...f, cobrado_cent: 300 }, '2026-10-11'), 'vencida');
  assert.equal(estadoCobro({ ...f, cobrado_cent: 1000 }, '2026-10-11'), 'cobrada');
  assert.equal(estadoCobro({ ...f, anulada: true, cobrado_cent: 0 }), 'anulada');
  assert.equal(estadoCobro({ ...f, estado: 'borrador' }), 'borrador');
});

test('borrador: sale del coche, se cambia y se borra; emitida, ya no', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const b = await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id });
    assert.equal(b.status, 201);
    assert.equal(b.json.estado, 'borrador');
    assert.equal(b.json.codigo, null, 'sin número hasta emitir');
    assert.equal(b.json.precio_cent, coche.pvp_cent, 'el PVP del coche');
    assert.equal(b.json.regimen, 'REBU');
    assert.equal(b.json.iva_cent, Math.round(((1290000 - 900000) * 21) / 121));

    const cambio = await pide(`/facturas/${b.json.id}`, { method: 'PUT', body: { precio_cent: 1250000, suplidos_cent: 12000, garantia_tipo: 'directa', garantia_meses: 12 } });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.json.total_cent, 1262000);
    assert.equal((await pide(`/facturas/${b.json.id}`, { method: 'PUT', body: { codigo: 'V26-00001' } })).status, 400, 'el número no se escribe');

    const otra = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id })).json;
    assert.equal((await pide(`/facturas/${otra.id}`, { method: 'DELETE' })).status, 200);

    assert.equal((await pide(`/facturas/${b.json.id}/emitir`, { method: 'POST' })).status, 200);
    assert.equal((await pide(`/facturas/${b.json.id}`, { method: 'PUT', body: { precio_cent: 1 } })).status, 409);
    assert.equal((await pide(`/facturas/${b.json.id}`, { method: 'DELETE' })).status, 409);
  }));

test('emitir: número correlativo de la serie del año, copia de los datos y el comprador en el coche', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const v2 = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '2222BBB', bastidor: null } })).json;
    // Seguir la numeración de Pymecar: V26 iba por la 38
    assert.equal((await pide('/facturas/series/V26', { method: 'PUT', body: { ultimo: 38 } })).json.codigo_siguiente, 'V26-00039');

    const a = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, fecha: '2026-10-07' })).json;
    const b = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v2.id, fecha: '2026-10-08' })).json;
    const ea = await pide(`/facturas/${a.id}/emitir`, { method: 'POST' });
    assert.equal(ea.status, 200);
    assert.equal(ea.json.codigo, 'V26-00039');
    assert.equal(ea.json.datos_cliente.nif, '12345678Z');
    assert.equal(ea.json.datos_empresa.nif, 'B56845381');
    assert.equal(ea.json.datos_vehiculo.matricula, '1234ABC');
    assert.equal((await pide(`/facturas/${b.id}/emitir`, { method: 'POST' })).json.codigo, 'V26-00040');
    assert.equal((await pide(`/vehiculos/${v.id}`)).json.comprador_id, c.id);

    // La copia no cambia aunque cambie la ficha
    await pide(`/clientes/${c.id}`, { method: 'PUT', body: { direccion: 'Otra calle 1' } });
    assert.equal((await pide(`/facturas/${a.id}`)).json.datos_cliente.direccion, 'C/ Major 12');

    assert.equal((await pide('/facturas/series/V26', { method: 'PUT', body: { ultimo: 100 } })).status, 409, 'con facturas, la numeración no se toca');

    // Fechas hacia atrás en la misma serie: no
    const v3 = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '3333CCC', bastidor: null } })).json;
    const atras = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v3.id, fecha: '2026-10-01' })).json;
    const r = await pide(`/facturas/${atras.id}/emitir`, { method: 'POST' });
    assert.equal(r.status, 409);
    assert.match(r.json.error, /2026-10-08/);
    assert.equal((await pide('/facturas/series')).json.find((s) => s.serie === 'V26').ultimo, 40, 'el intento fallido no gasta número');
  }));

test('emitir: falta algo → 409 con la lista de lo que falta', () =>
  conServidor(async ({ db, pide }) => {
    db.prepare('UPDATE empresa SET direccion = NULL WHERE id = 1').run(); // la 0015 la rellena: aquí se quita
    const c = (await pide('/clientes', { method: 'POST', body: { nombre: 'Sin datos' } })).json;
    const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, precio_compra_cent: null } })).json;
    const b = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id })).json;
    const r = await pide(`/facturas/${b.id}/emitir`, { method: 'POST' });
    assert.equal(r.status, 409);
    for (const texto of ['dirección fiscal de la empresa', 'DNI, NIE o CIF', 'dirección de Sin datos', 'precio de compra']) {
      assert.ok(r.json.faltan.some((f) => f.includes(texto)), texto);
    }
  }));

test('emitir: con una fecha que aún no ha llegado, no (y la serie no se bloquea)', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const manana = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const f = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, fecha: manana })).json;
    const r = await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
    assert.equal(r.status, 409);
    assert.match(r.json.error, /aún no ha llegado/);
    assert.equal((await pide(`/facturas/${f.id}`)).json.estado, 'borrador');
  }));

test('un coche no se factura dos veces, salvo rectificando la primera', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const a = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id })).json;
    await pide(`/facturas/${a.id}/emitir`, { method: 'POST' });
    const b = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id })).json;
    assert.equal((await pide(`/facturas/${b.id}/emitir`, { method: 'POST' })).status, 409);

    assert.equal((await pide(`/facturas/${a.id}/rectificar`, { method: 'POST', body: {} })).status, 400, 'sin motivo, no');
    const rect = await pide(`/facturas/${a.id}/rectificar`, { method: 'POST', body: { motivo: 'El cliente desiste' } });
    assert.equal(rect.status, 201);
    assert.match(rect.json.codigo, /^R\d{2}-00001$/);
    assert.equal(rect.json.total_cent, -1290000);
    assert.equal(rect.json.estado_cobro, 'rectificativa');
    assert.equal((await pide(`/facturas/${a.id}`)).json.estado_cobro, 'anulada');
    assert.equal((await pide(`/facturas/${a.id}/rectificar`, { method: 'POST', body: { motivo: 'Otra vez' } })).status, 409);
    assert.equal((await pide(`/vehiculos/${v.id}`)).json.comprador_id, null);
    assert.equal((await pide(`/facturas/${b.id}/emitir`, { method: 'POST' })).status, 200, 'rectificada la primera, ya se puede');
  }));

test('cobros: parcial, señal de la reserva, no más del total y estado', () =>
  conServidor(async ({ db, pide }) => {
    const { c, v } = await preparar(pide);
    db.prepare("INSERT INTO reservas (vehiculo_id, cliente, senal_cent, activa, cierre) VALUES (?, 'Laura', 50000, 0, 'vendida')").run(v.id);
    const f = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, vencimiento: '2099-01-01' })).json;
    assert.equal((await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 100, forma_pago: 'contado' } })).status, 409, 'un borrador no se cobra');
    await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });

    const senal = await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { senal: true } });
    assert.equal(senal.status, 201);
    assert.equal(senal.json.cobrado_cent, 50000);
    assert.equal(senal.json.estado_cobro, 'parcial');
    assert.equal((await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { senal: true } })).status, 409, 'la señal se aplica una vez');

    assert.equal((await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 1290000, forma_pago: 'transferencia' } })).status, 409, 'más de lo que queda');
    assert.equal((await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 100, forma_pago: 'cheque' } })).status, 400);
    const resto = await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 1240000, forma_pago: 'transferencia' } });
    assert.equal(resto.json.estado_cobro, 'cobrada');
    assert.equal(resto.json.saldo_cent, 0);

    const ficha = (await pide(`/facturas/${f.id}`)).json;
    assert.equal(ficha.cobros.length, 2);
    const quitado = await pide(`/facturas/${f.id}/cobros/${ficha.cobros[1].id}`, { method: 'DELETE' });
    assert.equal(quitado.json.estado_cobro, 'parcial');
  }));

test('lista: filtros, vencidas y resumen de lo pendiente', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const v2 = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '2222BBB', bastidor: null } })).json;
    const a = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, vencimiento: '2020-01-01' })).json;
    const b = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v2.id })).json;
    await pide(`/facturas/${a.id}/emitir`, { method: 'POST' });
    const { json } = await pide('/facturas');
    assert.equal(json.facturas.length, 2);
    assert.deepEqual(json.resumen, { pendiente_cent: 1290000, pendientes: 1, vencido_cent: 1290000, vencidas: 1, vencida_mas_antigua: '2020-01-01', borradores: 1 });
    assert.deepEqual((await pide('/facturas?estado=borrador')).json.facturas.map((f) => f.id), [b.id]);
    assert.deepEqual((await pide('/facturas?q=1234ABC')).json.facturas.map((f) => f.id), [a.id]);
    assert.equal((await pide('/facturas', { como: 'comercial' })).status, 403, 'solo gerencia');
  }));

test('libros de ingresos y de REBU, también en CSV', () =>
  conServidor(async ({ base, pide }) => {
    const { c, v } = await preparar(pide);
    const f = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, fecha: '2026-10-01', forma_pago: 'transferencia' })).json;
    await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
    const ingresos = (await pide('/facturas/libros/ingresos?desde=2026-10-01&hasta=2026-10-31')).json;
    assert.equal(ingresos.filas.length, 1);
    assert.deepEqual(
      [ingresos.filas[0].cliente, ingresos.filas[0].nif, ingresos.filas[0].base_cent + ingresos.filas[0].iva_cent],
      ['Laura Gil', '12345678Z', 1290000 - 900000], 'en REBU, base + IVA = el margen');
    const rebu = (await pide('/facturas/libros/rebu?desde=2026-10-01&hasta=2026-10-31')).json;
    assert.equal(rebu.filas[0].compra_cent, 900000);
    assert.equal(rebu.filas[0].vehiculo, 'Renault Clio (1234ABC)');

    // pide() espera JSON: el CSV se pide a mano con la cookie de gerencia
    const login = await fetch(`${base}/auth/entrar`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'jaume@ejemplo.com', contrasena: CONTRASENA }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const csv = await (await fetch(`${base}/facturas/libros/ingresos.csv?desde=2026-10-01&hasta=2026-10-31`, { headers: { cookie } })).text();
    const [cabecera, fila] = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    assert.match(cabecera, /^Serie;Número;Fecha;Cliente;NIF;/);
    assert.match(fila, /^V26;V26-00001;2026-10-01;Laura Gil;12345678Z;Transferencia;REBU;/);
    assert.equal((await pide('/facturas/libros/ingresos?desde=2026-13-01')).status, 400);
  }));

test('empresa: se completa la dirección; razón social y NIF fijos una vez hay facturas', () =>
  conServidor(async ({ pide }) => {
    const e = await pide('/facturas/empresa', { method: 'PUT', body: { ...EMPRESA, iban: 'ES91 2100 0418 4502 0005 1332' } });
    assert.equal(e.status, 200);
    assert.equal(e.json.iban, 'ES9121000418450200051332');
    assert.equal((await pide('/facturas/empresa', { method: 'PUT', body: { nif: '12345678A' } })).status, 400);
    const { c, v } = await preparar(pide);
    const f = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id })).json;
    await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
    assert.equal((await pide('/facturas/empresa', { method: 'PUT', body: { nif: 'A58818501' } })).status, 409);
    assert.equal((await pide('/facturas/empresa', { method: 'PUT', body: { telefono: '934 000 000' } })).status, 200, 'lo demás sí');
  }));

test('libros: trimestre y año, el libro de gastos y los totales', () =>
  conServidor(async ({ pide }) => {
    const { c, v } = await preparar(pide);
    const f = (await borrador(pide, { cliente_id: c.id, vehiculo_id: v.id, fecha: '2026-08-14' })).json;
    await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
    await pide('/gastos', { method: 'POST', body: { fecha: '2026-09-30', concepto: 'gestorias', base_cent: 10000, factura_proveedor: 'G-1' } });
    await pide('/gastos', { method: 'POST', body: { fecha: '2026-10-01', concepto: 'electricidad', base_cent: 5000 } });

    const t3 = (await pide('/facturas/libros/ingresos?anio=2026&trimestre=3')).json;
    assert.deepEqual([t3.desde, t3.hasta], ['2026-07-01', '2026-09-30']);
    assert.equal(t3.filas.length, 1);
    assert.equal((await pide('/facturas/libros/ingresos?anio=2026&trimestre=4')).json.filas.length, 0);
    assert.equal((await pide('/facturas/libros/rebu?anio=2026')).json.totales.compra_cent, 900000);

    const g = (await pide('/facturas/libros/gastos?anio=2026&trimestre=3')).json;
    // Los costes del coche de ayuda.js (transporte y taller) son de hoy: entran o no según la fecha de hoy
    const gestoria = g.filas.find((x) => x.factura_proveedor === 'G-1');
    assert.deepEqual([gestoria.tipo, gestoria.irpf_pct, gestoria.irpf_cent], ['irpf', 15, 1500]);
    assert.ok(!g.filas.some((x) => x.fecha === '2026-10-01'), 'el 1 de octubre es del cuarto trimestre');
    assert.equal(g.totales.total_cent, g.filas.reduce((s, x) => s + x.total_cent, 0));
    for (const malo of ['anio=26', 'anio=2026&trimestre=5', 'trimestre=1']) {
      assert.equal((await pide(`/facturas/libros/gastos?${malo}`)).status, 400, malo);
    }
  }));
