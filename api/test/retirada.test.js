// Retirada al vender: los anuncios de los portales quedan en «retirar» hasta que alguien confirme la baja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';

async function publicado(db, pide, cambios = {}) {
  const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, ...cambios } })).json;
  meterFotos(db, id, 15);
  assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } })).status, 200);
  return id;
}

function anuncios(db, id, estados) {
  const ins = db.prepare('INSERT INTO publicaciones (vehiculo_id, canal, estado) VALUES (?, ?, ?)');
  for (const [canal, estado] of Object.entries(estados)) ins.run(id, canal, estado);
}

const estados = (db, id) => Object.fromEntries(
  db.prepare('SELECT canal, estado FROM publicaciones WHERE vehiculo_id = ? ORDER BY canal').all(id).map((p) => [p.canal, p.estado]),
);

const cambiar = (pide, id, estado, como = 'gerencia') => pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado }, como });

test('al vender, los anuncios publicados en los portales quedan en «retirar»; la web y lo no subido no se tocan', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { coches_net: 'publicado', milanuncios: 'error', wallapop: 'pendiente', web: 'publicado' });
    assert.equal((await cambiar(pide, id, 'vendido', 'comercial')).status, 200);
    assert.deepEqual(estados(db, id), { coches_net: 'retirar', milanuncios: 'retirar', wallapop: 'pendiente', web: 'publicado' });

    const audit = db.prepare("SELECT usuario_id, antes, despues FROM auditoria WHERE entidad = 'publicacion' ORDER BY id").all();
    assert.equal(audit.length, 2, 'queda apuntado quién lo provocó');
    assert.deepEqual(JSON.parse(audit[0].antes), { canal: 'coches_net', estado: 'publicado' });
    assert.ok(audit.every((a) => a.usuario_id), 'con el usuario que vendió');
  }));

test('vendido → entregado no vuelve a marcar nada, y una baja ya confirmada se respeta', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { coches_net: 'publicado', wallapop: 'publicado' });
    await cambiar(pide, id, 'vendido');
    db.prepare("UPDATE publicaciones SET estado = 'retirado' WHERE vehiculo_id = ? AND canal = 'wallapop'").run(id);
    await cambiar(pide, id, 'entregado');
    assert.deepEqual(estados(db, id), { coches_net: 'retirar', wallapop: 'retirado' });
  }));

test('saltar directo a entregado también marca «retirar»', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { wallapop: 'publicado' });
    assert.equal((await cambiar(pide, id, 'entregado')).status, 200);
    assert.deepEqual(estados(db, id), { wallapop: 'retirar' });
  }));

test('vender un coche reservado también marca «retirar»', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { coches_net: 'publicado' });
    assert.equal((await pide(`/vehiculos/${id}/reserva`, { method: 'POST', body: { cliente: 'Marta', senal_cent: 50000 } })).status, 201);
    assert.deepEqual(estados(db, id), { coches_net: 'publicado' }, 'reservar no retira');
    await cambiar(pide, id, 'vendido');
    assert.deepEqual(estados(db, id), { coches_net: 'retirar' });
  }));

test('venta anulada: lo que aún estaba por retirar vuelve a publicado; lo ya retirado, no', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { coches_net: 'publicado', wallapop: 'publicado' });
    await cambiar(pide, id, 'vendido');
    db.prepare("UPDATE publicaciones SET estado = 'retirado' WHERE vehiculo_id = ? AND canal = 'wallapop'").run(id);
    assert.equal((await cambiar(pide, id, 'publicado')).status, 200);
    assert.deepEqual(estados(db, id), { coches_net: 'publicado', wallapop: 'retirado' });
  }));

test('dejar de estar a la venta sin venderlo también deja los anuncios en «retirar»; entre estados de fuera, nada', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    anuncios(db, id, { coches_net: 'publicado' });
    await cambiar(pide, id, 'en_taller');
    assert.deepEqual(estados(db, id), { coches_net: 'retirar' }, 'un coche en el taller no puede seguir anunciado');
    await cambiar(pide, id, 'en_preparacion');
    assert.deepEqual(estados(db, id), { coches_net: 'retirar' }, 'de taller a preparación no cambia nada');
  }));
