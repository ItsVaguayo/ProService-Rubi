// Bloque 5: contratos generados con los datos del momento y guardados ya escritos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { eurosTexto } from '../src/modules/contratos/plantillas.js';

const EMPRESA = { direccion: 'Ctra. de Terrassa, 83', codigo_postal: '08191', poblacion: 'Rubí' };
const CLIENTE = { nombre: 'Laura Gil', nif: '12345678Z', direccion: 'C/ Major 12', codigo_postal: '08191', poblacion: 'Rubí' };
const textoDe = (c) => JSON.stringify(c.contenido);

async function vendidoConFactura(pide) {
  await pide('/facturas/empresa', { method: 'PUT', body: EMPRESA });
  const c = (await pide('/clientes', { method: 'POST', body: CLIENTE })).json;
  const v = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
  const f = (await pide('/facturas', { method: 'POST', body: { cliente_id: c.id, vehiculo_id: v.id, garantia_tipo: 'directa', garantia_meses: 12, km_entrega: 45100 } })).json;
  await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
  return { c, v, f };
}

test('eurosTexto: como en Pymecar', () => {
  assert.equal(eurosTexto(1597500), '15.975 €');
  assert.equal(eurosTexto(1597550), '15.975,50 €');
  assert.equal(eurosTexto(null), '__________ €');
});

test('compraventa: sale de la factura, con el texto de Pymecar, y no cambia aunque cambie la ficha', () =>
  conServidor(async ({ pide }) => {
    const { c, f } = await vendidoConFactura(pide);
    await pide(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 50000, forma_pago: 'contado' } });
    const r = await pide('/contratos', { method: 'POST', body: { tipo: 'compraventa', factura_id: f.id, hora: '17:30', probado: false } });
    assert.equal(r.status, 201);
    assert.match(r.json.codigo, /^C\d{2}-0001$/);
    const t = textoDe(r.json);
    assert.ok(t.includes('se pacta de común acuerdo en 12.900 € (IVA INCLUIDO)'));
    assert.ok(t.includes('CONTADO: 500 €') && t.includes('TRANSFERENCIA: 12.400 €'), 'lo cobrado y lo que falta, por forma');
    assert.ok(t.includes('y el comprador no lo ha probado'));
    assert.ok(t.includes('la duración de la garantía en 12 MESES'));
    assert.equal(r.json.contenido.vehiculo.kilometros, 45100, 'los km de la entrega');
    assert.equal(r.json.contenido.partes[1].nif, '12345678Z');
    assert.equal(r.json.contenido.pendiente_abogado, true);
    assert.match(r.json.contenido.lugar_fecha, /\(17:30 horas\)/);

    await pide(`/clientes/${c.id}`, { method: 'PUT', body: { direccion: 'Otra calle' } });
    assert.ok(!textoDe((await pide(`/contratos/${r.json.id}`)).json).includes('Otra calle'), 'congelado');
    assert.equal((await pide('/contratos', { method: 'POST', body: { tipo: 'compraventa', factura_id: f.id } })).json.codigo.slice(-4), '0002');
    assert.equal((await pide(`/contratos?factura=${f.id}`)).json.length, 2);
  }));

test('reserva: hace falta la reserva y el cliente; el comercial puede', () =>
  conServidor(async ({ db, pide }) => {
    const v = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const c = (await pide('/clientes', { method: 'POST', body: CLIENTE })).json;
    assert.equal((await pide('/contratos', { method: 'POST', como: 'comercial', body: { tipo: 'reserva', vehiculo_id: v.id, cliente_id: c.id } })).status, 409, 'sin reserva');
    meterFotos(db, v.id, 15);
    await pide(`/vehiculos/${v.id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    await pide(`/vehiculos/${v.id}/reserva`, { method: 'POST', body: { cliente: 'Laura', senal_cent: 50000, dias: 7 } });
    const sinCliente = await pide('/contratos', { method: 'POST', como: 'comercial', body: { tipo: 'reserva', vehiculo_id: v.id } });
    assert.equal(sinCliente.status, 400);
    assert.match(sinCliente.json.error, /Laura/);
    const r = await pide('/contratos', { method: 'POST', como: 'comercial', body: { tipo: 'reserva', vehiculo_id: v.id, cliente_id: c.id, forma_pago: 'tarjeta' } });
    assert.equal(r.status, 201);
    assert.ok(textoDe(r.json).includes('la cantidad de 500 € en concepto de señal, mediante TARJETA'));
  }));

test('compra y cesión: solo gerencia, cada una con su coche', () =>
  conServidor(async ({ pide }) => {
    const p = (await pide('/proveedores', { method: 'POST', body: { nombre: 'Marta Vendedora', tipo: 'particular', nif: '12345678Z' } })).json;
    const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, proveedor_id: p.id } })).json;
    assert.equal((await pide('/contratos', { method: 'POST', como: 'comercial', body: { tipo: 'compra', vehiculo_id: v.id } })).status, 403);
    const compra = await pide('/contratos', { method: 'POST', body: { tipo: 'compra', vehiculo_id: v.id, hora: '10:00' } });
    assert.equal(compra.status, 201);
    assert.equal(compra.json.contenido.partes[0].nombre, 'Marta Vendedora');
    assert.ok(textoDe(compra.json).includes('9.000 €'));
    assert.ok(textoDe(compra.json).includes('no está sujeta a IVA'), 'a un particular');
    assert.equal((await pide('/contratos', { method: 'POST', body: { tipo: 'cesion', vehiculo_id: v.id } })).status, 409, 'un coche propio no se cede');

    const dep = (await pide('/vehiculos', { method: 'POST', body: { matricula: '5555EEE', marca: 'Kia', modelo: 'Niro', propiedad: 'deposito', propietario_nombre: 'Jordi Dueño', pago_propietario_cent: 1500000 } })).json;
    const cesion = await pide('/contratos', { method: 'POST', body: { tipo: 'cesion', vehiculo_id: dep.id, duracion_meses: 2 } });
    assert.equal(cesion.status, 201);
    assert.equal(cesion.json.contenido.partes[0].nombre, 'Jordi Dueño');
    assert.equal(cesion.json.contenido.partes[0].nif, '____________', 'lo que falta, hueco para rellenar a mano');
    assert.ok(textoDe(cesion.json).includes('la cantidad neta de 15.000 €'));
    assert.equal((await pide('/contratos', { method: 'POST', body: { tipo: 'compra', vehiculo_id: dep.id } })).status, 409);

    assert.equal((await pide(`/contratos/${cesion.json.id}`, { como: 'comercial' })).status, 404, 'el comercial no ve lo que lleva precio de compra');
    assert.equal((await pide(`/contratos?vehiculo=${v.id}`, { como: 'comercial' })).json.length, 0);
  }));

test('validación', () =>
  conServidor(async ({ pide }) => {
    for (const body of [{ tipo: 'otro' }, { tipo: 'compraventa' }, { tipo: 'compra' }, { tipo: 'compra', vehiculo_id: 1, hora: '25:00' }, { tipo: 'reserva', vehiculo_id: 1, fecha: '2026-02-30' }]) {
      assert.ok([400, 404].includes((await pide('/contratos', { method: 'POST', body })).status), JSON.stringify(body));
    }
  }));

test('cabecera como en Pymecar: lugar y fecha, nota de consumidores, domicilio por partes y la ITV', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/facturas/empresa')).json.direccion, 'C/ Llull, 321, planta 4', 'el domicilio fiscal de sus contratos (0015)');
    const { f, v } = await vendidoConFactura(pide);
    await pide(`/vehiculos/${v.id}`, { method: 'PUT', body: { uso_anterior: 'particular', itv_ultima: '2026-01-01', itv_caducidad: '2028-01-01', fecha_matriculacion: '2022-01-15' } });
    const k = (await pide('/contratos', { method: 'POST', body: { tipo: 'compraventa', factura_id: f.id, fecha: '2026-10-01', hora: '17:51' } })).json.contenido;
    assert.equal(k.titulo, 'Contrato de compraventa de un vehículo usado');
    assert.equal(k.lugar_fecha, 'RUBÍ a 1 de octubre del 2026 (17:51 horas)');
    assert.match(k.nota_legal, /Real Decreto Legislativo 1\/2007/);
    assert.deepEqual([k.partes[0].domicilio, k.partes[0].municipio, k.partes[0].codigo_postal], ['Ctra. de Terrassa, 83', 'Rubí', '08191'], 'la que puso el test');
    assert.deepEqual([k.vehiculo.uso_anterior, k.vehiculo.itv_ultima, k.vehiculo.itv_proxima, k.vehiculo.primera_matriculacion, k.vehiculo.clase],
      ['particular', '01/01/2026', '01/01/2028', '03 / 2021', 'Turismo'], 'la primera matriculación sale de la copia de la factura');
    assert.equal((await pide(`/vehiculos/${v.id}`, { method: 'PUT', body: { uso_anterior: 'taxi' } })).status, 400);
  }));
