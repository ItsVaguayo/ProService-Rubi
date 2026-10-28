// ?q= en contactos, actividades del CRM, gastos y citas (buscadores del panel, 28-oct).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { hoyLocal } from '../src/fechas.js';

const DIA_MS = 86400000;
const sumar = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const semana = (dia) => (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
const proximoLunes = () => { let d = sumar(hoyLocal(), 3); while (semana(d) !== 0) d = sumar(d, 1); return d; };
const nombres = (lista) => lista.map((x) => x.nombre).sort();

async function golfPublicado(pide, db) {
  const { id, referencia } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, marca: 'Volkswagen', modelo: 'Golf' } })).json;
  meterFotos(db, id, 15);
  await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
  return { id, referencia };
}

test('contactos: ?q= busca en nombre, teléfono sin espacios, mensaje y coche', () =>
  conServidor(async ({ db, pide }) => {
    const { referencia } = await golfPublicado(pide, db);
    const manda = (c) => pide('/contactos', { method: 'POST', como: null, body: { tipo: 'informacion', privacidad: true, ...c } });
    await manda({ nombre: 'Marta Soler', telefono: '600 111 222', coche: referencia });
    await manda({ nombre: 'Pere Vidal', telefono: '611-222-333', mensaje: 'Busco un diésel familiar' });

    const busca = async (q, extra = '') => (await pide(`/contactos?estado=todos&q=${encodeURIComponent(q)}${extra}`, { como: 'comercial' })).json;
    assert.deepEqual(nombres(await busca('marta')), ['Marta Soler'], 'sin distinguir mayúsculas');
    assert.deepEqual(nombres(await busca('600111')), ['Marta Soler'], 'el teléfono, sin los espacios');
    assert.deepEqual(nombres(await busca('611 222')), ['Pere Vidal'], 'y escrito con espacios aunque se guardó con guiones');
    assert.deepEqual(nombres(await busca('golf')), ['Marta Soler'], 'por el coche');
    assert.deepEqual(nombres(await busca('diésel familiar')), ['Pere Vidal'], 'cada palabra, en cualquier campo');
    assert.deepEqual(await busca('marta diésel'), [], 'todas las palabras tienen que salir');
    assert.deepEqual(await busca('%'), [], 'el % se busca tal cual, no es comodín');
    assert.deepEqual(nombres(await busca('marta', '&tipo=informacion')), ['Marta Soler'], 'se suma a los otros filtros');
    assert.equal((await pide(`/contactos?q=${'x'.repeat(101)}`)).status, 400);
    assert.equal((await busca('   ')).length, 2, 'en blanco no filtra');
  }));

test('actividades: ?q= busca en la descripción, el cliente y el coche', () =>
  conServidor(async ({ db, pide }) => {
    const { id: golf } = await golfPublicado(pide, db);
    const marta = (await pide('/clientes', { method: 'POST', body: { nombre: 'Marta Soler', telefono: '600 111 222' } })).json.id;
    const pere = (await pide('/clientes', { method: 'POST', body: { nombre: 'Pere Vidal' } })).json.id;
    await pide('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id: marta, vehiculo_id: golf, descripcion: 'Ofrecerle financiación', programada_para: `${sumar(hoyLocal(), 1)} 10:00` } });
    await pide('/actividades', { method: 'POST', body: { tipo: 'nota', cliente_id: pere, descripcion: 'Quiere un SUV' } });

    const busca = async (q) => (await pide(`/actividades?q=${encodeURIComponent(q)}`, { como: 'comercial' })).json.map((a) => a.cliente_nombre);
    assert.deepEqual(await busca('financiación'), ['Marta Soler']);
    assert.deepEqual(await busca('golf'), ['Marta Soler']);
    assert.deepEqual(await busca('600 111'), ['Marta Soler'], 'por el teléfono del cliente');
    assert.deepEqual(await busca('pere suv'), ['Pere Vidal']);
    assert.equal((await pide(`/actividades?q=${'x'.repeat(101)}`)).status, 400);
  }));

test('gastos: ?q= busca en todos los meses salvo que llegue ?mes', () =>
  conServidor(async ({ pide }) => {
    const prov = (await pide('/proveedores', { method: 'POST', body: { nombre: 'Talleres Rubí' } })).json.id;
    const hoy = hoyLocal();
    const antiguo = `${Number(hoy.slice(0, 4)) - 1}-03-15`;
    await pide('/gastos', { method: 'POST', body: { fecha: antiguo, concepto: 'papelerias', base_cent: 10000, proveedor_id: prov, factura_proveedor: 'FT-2291' } }).then((r) => assert.equal(r.status, 201, JSON.stringify(r.json)));
    await pide('/gastos', { method: 'POST', body: { fecha: hoy, concepto: 'publicidad', base_cent: 5000, descripcion: 'Anuncio en la radio' } });

    const sinQ = (await pide('/gastos')).json;
    assert.equal(sinQ.gastos.length, 1, 'sin buscar, solo el mes actual');
    const r = (await pide('/gastos?q=ft-2291')).json;
    assert.equal(r.mes, null, 'buscando, sin mes');
    assert.deepEqual(r.gastos.map((g) => g.factura_proveedor), ['FT-2291'], 'la factura del proveedor de hace un año');
    assert.equal(r.totales.base_cent, 10000, 'los totales son de lo encontrado');
    assert.equal((await pide('/gastos?q=talleres')).json.gastos.length, 1, 'por el proveedor');
    assert.equal((await pide(`/gastos?q=talleres&mes=${hoy.slice(0, 7)}`)).json.gastos.length, 0, 'con ?mes, solo en ese mes');
    assert.equal((await pide('/gastos?q=radio')).json.gastos.length, 1);
    assert.equal((await pide('/gastos?q=radio', { como: 'comercial' })).status, 403, 'sigue siendo solo de gerencia');
  }));

test('citas: ?q= busca en todas las fechas, primero las que vienen', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = await golfPublicado(pide, db);
    const lunes = proximoLunes();
    await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${sumar(lunes, 7)} 10:00`, nombre: 'Marta Soler', telefono: '600 111 222' } });
    await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${lunes} 10:00`, nombre: 'Marta López', telefono: '622 333 444' } });
    db.prepare("INSERT INTO citas (vehiculo_id, inicio, nombre, telefono, estado) VALUES (?, ?, 'Marta Antigua', '633 000 000', 'hecha')")
      .run(id, `${sumar(hoyLocal(), -20)} 10:00`);

    const r = (await pide('/citas?q=marta', { como: 'comercial' })).json;
    assert.deepEqual(r.map((c) => c.nombre), ['Marta López', 'Marta Soler', 'Marta Antigua'], 'las que vienen por orden y después las pasadas');
    assert.deepEqual((await pide('/citas?q=622333')).json.map((c) => c.nombre), ['Marta López']);
    assert.equal((await pide('/citas?q=golf')).json.length, 3, 'por el coche');
    await pide(`/citas/${r[0].id}`, { method: 'PATCH', body: { estado: 'cancelada' } });
    assert.equal((await pide('/citas?q=marta')).json.length, 2, 'sin las canceladas');
    assert.equal((await pide('/citas?q=marta&canceladas=1')).json.length, 3);
  }));
