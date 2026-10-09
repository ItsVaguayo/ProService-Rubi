// Bloque 10: cita previa de pruebas de conducción. Horario (duda H12), huecos, sin solapes, la web pide,
// el panel apunta y mueve, y los avisos de hoy y mañana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche } from './ayuda.js';
import { hoyLocal } from '../src/fechas.js';

const DIA_MS = 86400000;
const sumar = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const semana = (dia) => (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
/** El próximo lunes, como mínimo dentro de 3 días (lejos de «hoy» y de las dos horas de margen de la web) */
const proximoLunes = () => { let d = sumar(hoyLocal(), 3); while (semana(d) !== 0) d = sumar(d, 1); return d; };

async function cochePublicado(pide, db) {
  const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
  db.prepare("UPDATE vehiculos SET estado = 'publicado' WHERE id = ?").run(id);
  return id;
}

test('huecos: el horario de H12, en punto y y media, y sin domingo', () =>
  conServidor(async ({ pide }) => {
    const lunes = proximoLunes();
    const r = await pide(`/citas/huecos?desde=${lunes}&dias=7`, { como: null });
    assert.equal(r.status, 200, 'público: lo usa la web sin sesión');
    assert.equal(r.json.duracion_min, 30);
    const dias = Object.fromEntries(r.json.dias.map((d) => [d.dia, d.horas]));
    assert.deepEqual(dias[lunes], ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00']);
    assert.deepEqual(dias[sumar(lunes, 5)], ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00'], 'sábado, solo por la mañana');
    assert.equal(dias[sumar(lunes, 6)], undefined, 'el domingo no hay pruebas');
    assert.equal((await pide('/citas/huecos?desde=mañana', { como: null })).status, 400);
  }));

test('la web pide una prueba: entra pedida, con su contacto, y la hora deja de estar libre', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cochePublicado(pide, db);
    const lunes = proximoLunes();
    const cuerpo = { coche: id, inicio: `${lunes} 10:30`, nombre: 'Jordi Camps', telefono: '617 554 102', privacidad: true, mensaje: 'Iré con mi pareja' };
    assert.equal((await pide('/citas/pedir', { method: 'POST', body: cuerpo, como: null })).status, 201);
    const cita = db.prepare('SELECT * FROM citas').get();
    assert.equal(cita.estado, 'pedida');
    assert.equal(cita.origen, 'web');
    const contacto = db.prepare('SELECT * FROM contactos WHERE id = ?').get(cita.contacto_id);
    assert.equal(contacto.tipo, 'prueba');
    assert.match(contacto.mensaje, /Pide prueba el .* a las 10:30\.\nIré con mi pareja/);
    assert.ok(db.prepare("SELECT 1 FROM correos WHERE tipo = 'contacto'").get(), 'y su correo al comercial');

    const libres = (await pide(`/citas/huecos?desde=${lunes}&dias=1`, { como: null })).json.dias[0].horas;
    assert.ok(!libres.includes('10:30'), 'la hora cogida ya no se ofrece');
    const otra = await pide('/citas/pedir', { method: 'POST', body: { ...cuerpo, nombre: 'Otra persona' }, como: null });
    assert.equal(otra.status, 409, 'sin solapes, aunque sea otro coche u otra persona');
  }));

test('la web: fuera de horario, sin privacidad, coche que no está a la venta y campo trampa', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cochePublicado(pide, db);
    const lunes = proximoLunes();
    const base = { coche: id, nombre: 'Ana', telefono: '600 111 222', privacidad: true };
    const fuera = await pide('/citas/pedir', { method: 'POST', body: { ...base, inicio: `${lunes} 14:00` }, como: null });
    assert.equal(fuera.status, 400);
    assert.match(fuera.json.error, /fuera del horario/);
    assert.equal((await pide('/citas/pedir', { method: 'POST', body: { ...base, inicio: `${lunes} 10:15` }, como: null })).status, 400, 'solo en punto o y media');
    assert.equal((await pide('/citas/pedir', { method: 'POST', body: { ...base, inicio: `${lunes} 10:00`, privacidad: false }, como: null })).status, 400);
    db.prepare("UPDATE vehiculos SET estado = 'vendido' WHERE id = ?").run(id);
    const vendido = await pide('/citas/pedir', { method: 'POST', body: { ...base, inicio: `${lunes} 10:00` }, como: null });
    assert.match(vendido.json.error, /ya no está a la venta/);
    db.prepare("UPDATE vehiculos SET estado = 'publicado' WHERE id = ?").run(id);
    const robot = await pide('/citas/pedir', { method: 'POST', body: { ...base, inicio: `${lunes} 10:00`, web: 'http://spam.example' }, como: null });
    assert.equal(robot.status, 201, 'al robot se le contesta bien…');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM citas').get().n, 0, '…pero no se guarda nada');
  }));

test('el panel: apunta confirmada, desde un contacto lo deja atendido, cambia la hora y la marca hecha', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cochePublicado(pide, db);
    const lunes = proximoLunes();
    const contacto = Number(db.prepare("INSERT INTO contactos (nombre, telefono, tipo, vehiculo_id) VALUES ('Sílvia Moreno', '651 230 984', 'prueba', ?)").run(id).lastInsertRowid);
    const r = await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${lunes} 12:00`, contacto_id: contacto }, como: 'comercial' });
    assert.equal(r.status, 201, 'el comercial también apunta pruebas');
    assert.equal(r.json.estado, 'confirmada');
    assert.equal(r.json.nombre, 'Sílvia Moreno', 'el nombre y el teléfono salen del contacto');
    assert.ok(db.prepare('SELECT atendido_en FROM contactos WHERE id = ?').get(contacto).atendido_en, 'el contacto queda atendido');

    const mover = await pide(`/citas/${r.json.id}`, { method: 'PATCH', body: { inicio: `${lunes} 17:00` } });
    assert.equal(mover.json.inicio, `${lunes} 17:00`);
    const otra = await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${lunes} 18:00`, nombre: 'Pere', telefono: '664 019 283' } });
    assert.equal((await pide(`/citas/${otra.json.id}`, { method: 'PATCH', body: { inicio: `${lunes} 17:00` } })).status, 409, 'no se mueve encima de otra');
    assert.equal((await pide(`/citas/${r.json.id}`, { method: 'PATCH', body: { estado: 'hecha' } })).json.estado, 'hecha');
    assert.equal((await pide(`/citas/${r.json.id}`, { method: 'PATCH', body: { inicio: `${lunes} 19:00` } })).status, 409, 'una hecha ya no cambia de hora');
    assert.equal((await pide(`/citas/${r.json.id}`, { method: 'PATCH', body: { estado: 'pedida' } })).status, 409);

    const semanaEntera = (await pide(`/citas?desde=${lunes}&hasta=${sumar(lunes, 5)}`)).json;
    assert.deepEqual(semanaEntera.map((c) => [c.inicio.slice(11), c.estado]), [['17:00', 'hecha'], ['18:00', 'confirmada']]);
    assert.equal(semanaEntera[0].marca, coche.marca, 'con su coche');
    assert.ok(db.prepare("SELECT 1 FROM auditoria WHERE entidad = 'cita'").get(), 'y en la auditoría');
    assert.equal((await pide('/citas', { como: null })).status, 401);
  }));

test('una cancelada libera la hora', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cochePublicado(pide, db);
    const lunes = proximoLunes();
    const a = (await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${lunes} 11:00`, nombre: 'Ana', telefono: '600 111 222' } })).json;
    await pide(`/citas/${a.id}`, { method: 'PATCH', body: { estado: 'cancelada' } });
    const b = await pide('/citas', { method: 'POST', body: { vehiculo_id: id, inicio: `${lunes} 11:00`, nombre: 'Berta', telefono: '600 333 444' } });
    assert.equal(b.status, 201);
    assert.deepEqual((await pide(`/citas?desde=${lunes}&hasta=${lunes}`)).json.map((c) => c.nombre), ['Berta'], 'sin las canceladas');
  }));

test('avisos: las pruebas de mañana; en rojo las que siguen sin confirmar', () =>
  conServidor(async ({ db, pide }) => {
    const id = await cochePublicado(pide, db);
    const manana = sumar(hoyLocal(), 1);
    // Directo a la base: mañana puede caer en domingo, y aquí se prueba el aviso, no el horario
    const ins = db.prepare("INSERT INTO citas (vehiculo_id, inicio, estado, nombre, telefono) VALUES (?, ?, ?, ?, '600 000 000')");
    ins.run(id, `${manana} 10:00`, 'pedida', 'Jordi');
    ins.run(id, `${manana} 12:00`, 'confirmada', 'Sílvia');
    ins.run(id, `${sumar(hoyLocal(), 3)} 10:00`, 'confirmada', 'Lejos');
    for (const como of ['gerencia', 'comercial']) {
      const avisos = (await pide('/avisos', { como })).json.filter((a) => a.tipo === 'citas');
      assert.deepEqual(avisos.map((a) => [a.gravedad, a.texto]), [
        ['alta', `Mañana a las 10:00, prueba del ${coche.marca} ${coche.modelo} 1234 ABC con Jordi: sin confirmar`],
        ['media', `Mañana a las 12:00, prueba del ${coche.marca} ${coche.modelo} 1234 ABC con Sílvia`],
      ], como);
      assert.equal(avisos[0].enlace, `agenda.html?semana=${manana}`);
    }
  }));
