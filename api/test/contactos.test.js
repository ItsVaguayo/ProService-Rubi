import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche } from './ayuda.js';

const contacto = { nombre: 'Marta Soler', telefono: '600 111 222', tipo: 'prueba', mensaje: '¿Se puede probar el sábado?', privacidad: true };

test('contactos: la web los manda sin sesión y el panel los ve', () =>
  conServidor(async ({ pide }) => {
    const { id, referencia } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;

    const r = await pide('/contactos', { method: 'POST', body: { ...contacto, coche: referencia }, como: null });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { ok: true }, 'a la web no se le devuelve nada interno');
    assert.equal((await pide('/contactos', { method: 'POST', body: { ...contacto, nombre: 'Iván', tipo: 'tasacion', mensaje: '' }, como: null })).status, 201);

    assert.equal((await pide('/contactos', { como: null })).status, 401, 'leerlos sí pide sesión');
    const lista = (await pide('/contactos', { como: 'comercial' })).json;
    assert.deepEqual(lista.map((c) => c.nombre), ['Marta Soler', 'Iván'], 'el que más espera, primero');
    assert.equal(lista[0].vehiculo_id, id);
    assert.equal(lista[0].matricula, '1234ABC');
    assert.equal(lista[1].vehiculo_id, null);
    assert.equal(lista[1].mensaje, null);
    assert.deepEqual((await pide('/contactos/sin-atender')).json, { total: 2 });
    assert.deepEqual((await pide('/contactos?tipo=tasacion')).json.map((c) => c.nombre), ['Iván']);
  }));

test('contactos: marcar atendido y volver a pendiente', () =>
  conServidor(async ({ pide }) => {
    await pide('/contactos', { method: 'POST', body: contacto, como: null });
    const [c] = (await pide('/contactos')).json;

    const hecho = await pide(`/contactos/${c.id}`, { method: 'PATCH', body: { atendido: true }, como: 'comercial' });
    assert.equal(hecho.status, 200);
    assert.ok(hecho.json.atendido_en);
    assert.equal(hecho.json.atendido_por_nombre, 'Comercial');
    assert.equal((await pide('/contactos')).json.length, 0);
    assert.equal((await pide('/contactos?estado=atendidos')).json.length, 1);
    assert.deepEqual((await pide('/contactos/sin-atender')).json, { total: 0 });

    const deshacer = await pide(`/contactos/${c.id}`, { method: 'PATCH', body: { atendido: false } });
    assert.equal(deshacer.json.atendido_en, null);
    assert.equal((await pide(`/contactos/${c.id}`, { method: 'PATCH', body: { atendido: 'si' } })).status, 400);
    assert.equal((await pide('/contactos?estado=raro')).status, 400);
  }));

test('contactos: validación, campo trampa y casilla de privacidad', () =>
  conServidor(async ({ db, pide }) => {
    const malo = await pide('/contactos', { method: 'POST', body: { nombre: '', telefono: 'abc', email: 'no', tipo: 'otro', coche: 'PS-99999' }, como: null });
    assert.equal(malo.status, 400);
    assert.equal(malo.json.errores.length, 6, 'nombre, teléfono, correo, tipo, privacidad y coche');

    // Un robot rellena el campo trampa: se le contesta bien, pero no se guarda
    const robot = await pide('/contactos', { method: 'POST', body: { ...contacto, web: 'http://spam.example' }, como: null });
    assert.equal(robot.status, 201);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 0);
  }));

test('contactos: como mucho 5 envíos por IP cada 10 minutos', () =>
  conServidor(async ({ pide }) => {
    for (let i = 0; i < 5; i++) assert.equal((await pide('/contactos', { method: 'POST', body: contacto, como: null })).status, 201);
    const sexto = await pide('/contactos', { method: 'POST', body: contacto, como: null });
    assert.equal(sexto.status, 429);
    assert.match(sexto.json.error, /llámanos/);
  }));
