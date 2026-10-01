// Estados, reglas para estar a la venta y reservas: lo que no puede pasar aunque el panel no lo intente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';

// Un coche completo, con fotos y publicado.
async function publicado(db, pide, fotos = 15, cambios = {}) {
  const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, ...cambios } })).json;
  meterFotos(db, id, fotos);
  const r = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
  assert.equal(r.status, 200, 'el coche de partida se publica');
  return id;
}

async function reservado(db, pide, cambios = {}) {
  const id = await publicado(db, pide, 15, cambios);
  const r = await pide(`/vehiculos/${id}/reserva`, { method: 'POST', body: { cliente: 'Marta', senal_cent: 50000, dias: 7 } });
  assert.equal(r.status, 201);
  return id;
}

const fotosDe = (db, id) => db.prepare('SELECT id FROM fotos WHERE vehiculo_id = ? ORDER BY orden').all(id).map((f) => f.id);

// --- Editar un coche que está en la web --------------------------------------------------------------

test('editar un coche publicado: no se le puede vaciar un dato obligatorio', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    const r = await pide(`/vehiculos/${id}`, { method: 'PUT', body: { pvp_cent: null } });
    assert.equal(r.status, 409);
    assert.match(r.json.error, /pvp_cent/);
    assert.equal((await pide(`/vehiculos/${id}`)).json.pvp_cent, 1290000, 'el precio no cambia');

    const km = await pide(`/vehiculos/${id}`, { method: 'PUT', body: { kilometros: 46000 } });
    assert.equal(km.status, 200, 'un cambio que no deja nada vacío sí se guarda');
  }));

test('también reservado y vendido, que también salen en la web; fuera de la web sí se puede vaciar', () =>
  conServidor(async ({ db, pide }) => {
    const r = await reservado(db, pide);
    assert.equal((await pide(`/vehiculos/${r}`, { method: 'PUT', body: { bastidor: '' } })).status, 409);

    const v = await publicado(db, pide, 15, { matricula: '2222BBB', bastidor: 'VIN2' });
    await pide(`/vehiculos/${v}/estado`, { method: 'PATCH', body: { estado: 'vendido' } });
    assert.equal((await pide(`/vehiculos/${v}`, { method: 'PUT', body: { version: null } })).status, 409);

    const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '3333CCC', bastidor: 'VIN3' } })).json;
    assert.equal((await pide(`/vehiculos/${id}`, { method: 'PUT', body: { pvp_cent: null } })).status, 200, 'en preparación se puede');
  }));

// --- Fotos de un coche que está en la web -------------------------------------------------------------

test('borrar una foto de un coche publicado no puede dejarlo por debajo del mínimo', () =>
  conServidor(async ({ db, pide }) => {
    const justo = await publicado(db, pide);
    const r = await pide(`/fotos/${justo}/${fotosDe(db, justo)[0]}`, { method: 'DELETE' });
    assert.equal(r.status, 409);
    assert.match(r.json.error, /15/);
    assert.equal(fotosDe(db, justo).length, 15, 'la foto sigue ahí');

    const sobrado = await publicado(db, pide, 16, { matricula: '4444DDD', bastidor: 'VIN4' });
    assert.equal((await pide(`/fotos/${sobrado}/${fotosDe(db, sobrado)[0]}`, { method: 'DELETE' })).status, 200, 'con 16 se puede quitar una');
  }));

test('marcar como daño o como interna una foto de un coche publicado tampoco puede dejarlo sin el mínimo', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    const [foto] = fotosDe(db, id);
    assert.equal((await pide(`/fotos/${id}/${foto}`, { method: 'PATCH', body: { es_dano: true } })).status, 409);
    assert.equal((await pide(`/fotos/${id}/${foto}`, { method: 'PATCH', body: { publica: false } })).status, 409);
    assert.equal(db.prepare('SELECT es_dano, publica FROM fotos WHERE id = ?').get(foto).publica, 1, 'la foto no cambia');

    await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'en_taller' } });
    assert.equal((await pide(`/fotos/${id}/${foto}`, { method: 'PATCH', body: { publica: false } })).status, 200, 'fuera de la web sí se puede');
  }));

// --- Entrar en un estado que sale en la web -----------------------------------------------------------

test('un coche que nunca estuvo a la venta no puede saltar a vendido sin cumplir lo de publicar', () =>
  conServidor(async ({ pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: { matricula: '5555EEE', marca: 'Seat', modelo: 'Ibiza' } })).json;
    const r = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'vendido' } });
    assert.equal(r.status, 409, 'saldría en la web como vendido sin datos ni fotos');
    assert.match(r.json.error, /Faltan datos/);
    assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'entregado' } })).status, 200, 'entregado no sale en la web');
  }));

// --- Salir de «Reservado» -------------------------------------------------------------------------------

test('vender un coche reservado cierra su reserva como vendida', () =>
  conServidor(async ({ db, pide }) => {
    const id = await reservado(db, pide);
    assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'vendido' } })).status, 200);
    assert.equal((await pide(`/vehiculos/${id}/reserva`)).json, null, 'ya no hay reserva activa');
    const r = db.prepare('SELECT activa, cierre, cerrada_en FROM reservas WHERE vehiculo_id = ?').get(id);
    assert.equal(r.activa, 0);
    assert.equal(r.cierre, 'vendida');
    assert.ok(r.cerrada_en);
  }));

test('un coche reservado no vuelve a publicado ni a taller por el cambio de estado: hay que cancelar la reserva', () =>
  conServidor(async ({ db, pide }) => {
    const id = await reservado(db, pide);
    for (const estado of ['publicado', 'en_taller']) {
      const r = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado } });
      assert.equal(r.status, 409, `a ${estado}`);
      assert.match(r.json.error, /reserva/i);
    }
    assert.equal((await pide(`/vehiculos/${id}`)).json.estado, 'reservado');
    assert.ok((await pide(`/vehiculos/${id}/reserva`)).json, 'la reserva sigue activa');
  }));

test('cancelar una reserva apunta si la señal se devolvió (duda C6)', () =>
  conServidor(async ({ db, pide }) => {
    const a = await reservado(db, pide);
    assert.equal((await pide(`/vehiculos/${a}/reserva`, { method: 'DELETE', body: { senal_devuelta: true } })).status, 200);
    const ra = db.prepare('SELECT cierre, senal_devuelta FROM reservas WHERE vehiculo_id = ?').get(a);
    assert.deepEqual({ ...ra }, { cierre: 'cancelada', senal_devuelta: 1 });
    assert.equal((await pide(`/vehiculos/${a}`)).json.estado, 'publicado');

    const b = await reservado(db, pide, { matricula: '6666FFF', bastidor: 'VIN6' });
    await pide(`/vehiculos/${b}/reserva`, { method: 'DELETE' });
    assert.equal(db.prepare('SELECT senal_devuelta FROM reservas WHERE vehiculo_id = ?').get(b).senal_devuelta, null, 'sin dato, queda sin apuntar');
    assert.equal((await pide(`/vehiculos/${b}/reserva`, { method: 'DELETE', body: { senal_devuelta: 'si' } })).status, 404, 'ya no hay reserva que cancelar');
  }));

test('senal_devuelta tiene que ser true o false', () =>
  conServidor(async ({ db, pide }) => {
    const id = await reservado(db, pide);
    assert.equal((await pide(`/vehiculos/${id}/reserva`, { method: 'DELETE', body: { senal_devuelta: 'si' } })).status, 400);
    assert.ok((await pide(`/vehiculos/${id}/reserva`)).json, 'y la reserva sigue');
  }));

// --- Caducidad -----------------------------------------------------------------------------------------

test('una reserva caducada se cierra sola y el coche vuelve a publicado', () =>
  conServidor(async ({ db, pide }) => {
    const id = await reservado(db, pide);
    db.prepare("UPDATE reservas SET caduca_en = datetime('now', '-1 minute') WHERE vehiculo_id = ?").run(id);

    const ficha = (await pide(`/vehiculos/${id}`)).json;
    assert.equal(ficha.estado, 'publicado');
    assert.equal((await pide(`/vehiculos/${id}/reserva`)).json, null);
    assert.equal(db.prepare('SELECT cierre FROM reservas WHERE vehiculo_id = ?').get(id).cierre, 'caducada');

    const historial = (await pide(`/vehiculos/${id}/historial`)).json;
    assert.deepEqual(historial.slice(0, 2).map((h) => h.a), ['publicado', 'reservado']);
    assert.equal(historial[0].usuario, null, 'lo hace el sistema, no una persona');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE entidad = 'reserva' AND accion = 'caducidad'").get().n, 1);

    assert.equal((await pide(`/vehiculos/${id}/reserva`, { method: 'POST', body: { cliente: 'Otro', senal_cent: 30000 } })).status, 201, 'y se puede volver a reservar');
  }));

test('una reserva que aún no ha caducado no se toca; un coche ya vendido no vuelve a publicado', () =>
  conServidor(async ({ db, pide }) => {
    const vigente = await reservado(db, pide);
    assert.equal((await pide(`/vehiculos/${vigente}`)).json.estado, 'reservado');

    const vendido = await reservado(db, pide, { matricula: '7777GGG', bastidor: 'VIN7' });
    await pide(`/vehiculos/${vendido}/estado`, { method: 'PATCH', body: { estado: 'vendido' } });
    db.prepare("UPDATE reservas SET caduca_en = datetime('now', '-1 day') WHERE vehiculo_id = ?").run(vendido);
    assert.equal((await pide(`/vehiculos/${vendido}`)).json.estado, 'vendido');
  }));
