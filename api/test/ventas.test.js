import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { ventasDelMes } from '../src/modules/informes/ventas.js';

test('ventasDelMes: los vendidos del mes con quién los vendió', () =>
  conServidor(async ({ db, pide }) => {
    const alta = async (matricula, bastidor) => {
      const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula, bastidor } })).json;
      meterFotos(db, id, 15);
      await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
      return id;
    };
    const a = await alta('1111AAA', 'VF1RFB00000000011');
    const b = await alta('2222BBB', 'VF1RFB00000000022');
    await alta('3333CCC', 'VF1RFB00000000033'); // sigue a la venta

    await pide(`/vehiculos/${a}/estado`, { method: 'PATCH', body: { estado: 'vendido' }, como: 'comercial' });
    await pide(`/vehiculos/${b}/estado`, { method: 'PATCH', body: { estado: 'vendido' } });
    await pide(`/vehiculos/${b}/estado`, { method: 'PATCH', body: { estado: 'entregado' }, como: 'comercial' });

    const mes = new Date().toISOString().slice(0, 7);
    const ventas = ventasDelMes(db, mes);
    const comercial = db.prepare("SELECT id FROM usuarios WHERE rol = 'comercial'").get().id;
    const jaume = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia'").get().id;
    assert.deepEqual(ventas.map((v) => v.id).sort(), [a, b].sort());
    const de = (id) => ventas.find((v) => v.id === id);
    assert.equal(de(a).vendio_id, comercial);
    assert.equal(de(a).vendio, 'Comercial');
    assert.equal(de(b).vendio_id, jaume, 'entregar no es otra venta: vendió quien lo pasó a «Vendido»');
    assert.equal(de(a).precio_compra_cent, coche.precio_compra_cent, 'trae la fila completa');
    assert.deepEqual(ventasDelMes(db, '2001-01'), []);
  }));
