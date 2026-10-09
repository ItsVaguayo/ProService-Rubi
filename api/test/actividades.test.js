// Actividades del CRM (T11): llamadas, visitas, tareas… de cada cliente, con fecha, responsable y resultado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche } from './ayuda.js';

// 'AAAA-MM-DD' de hoy + n días
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function cliente(pide, nombre = 'Marta Soler') {
  return (await pide('/clientes', { method: 'POST', body: { nombre } })).json.id;
}

const idDe = (db, email) => db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email).id;

test('el comercial apunta una llamada para mañana y le sale en sus pendientes', () =>
  conServidor(async ({ db, pide }) => {
    const c = await cliente(pide);
    const alta = await pide('/actividades', { method: 'POST', como: 'comercial',
      body: { tipo: 'llamada', cliente_id: c, descripcion: 'Llamar por el Golf', programada_para: `${dia(1)} 10:30` } });
    assert.equal(alta.status, 201);
    const comercial = idDe(db, 'comercial@ejemplo.com');
    assert.equal(alta.json.responsable_id, comercial, 'sin responsable, lo es quien la crea');
    assert.equal(alta.json.creado_por, comercial);
    assert.equal(alta.json.cliente_nombre, 'Marta Soler');
    assert.equal(alta.json.responsable_nombre, 'Comercial');
    assert.equal(alta.json.hecha_en, null);

    const suyas = (await pide('/actividades?responsable=yo&pendientes=1', { como: 'comercial' })).json;
    assert.deepEqual(suyas.map((a) => a.id), [alta.json.id]);
    assert.deepEqual((await pide('/actividades?responsable=yo&pendientes=1')).json, [], 'a Jaume no le sale');
    assert.equal((await pide(`/actividades?responsable=${comercial}`)).json.length, 1, 'gerencia ve las del comercial por su id');
  }));

test('creado_por sale de la sesión, nunca del cuerpo; el responsable puede ser otro', () =>
  conServidor(async ({ db, pide }) => {
    const c = await cliente(pide);
    const jaume = idDe(db, 'jaume@ejemplo.com');
    const trampa = await pide('/actividades', { method: 'POST', como: 'comercial', body: { tipo: 'nota', cliente_id: c, descripcion: 'x', creado_por: jaume } });
    assert.equal(trampa.status, 400);
    assert.match(trampa.json.error, /creado_por/);

    const para = await pide('/actividades', { method: 'POST', como: 'comercial', body: { tipo: 'tarea', cliente_id: c, descripcion: 'Preparar papeles', responsable_id: jaume } });
    assert.equal(para.json.responsable_id, jaume);
    assert.equal(para.json.creado_por, idDe(db, 'comercial@ejemplo.com'));
  }));

test('validación del alta', () =>
  conServidor(async ({ pide }) => {
    const c = await cliente(pide);
    const sinNadie = await pide('/actividades', { method: 'POST', body: { tipo: 'llamada', descripcion: 'x' } });
    assert.equal(sinNadie.status, 400);
    assert.match(sinNadie.json.error, /cliente o un contacto/);

    assert.equal((await pide('/actividades', { method: 'POST', body: { tipo: 'fax', cliente_id: c, descripcion: 'x' } })).status, 400, 'tipo que no existe');
    for (const fecha of ['2026-10-08', '08/10/2026 10:00', '2026-02-30 10:00', '2026-10-08 25:00', '2026-10-08T10:00']) {
      const r = await pide('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id: c, descripcion: 'x', programada_para: fecha } });
      assert.equal(r.status, 400, `fecha ${fecha}`);
    }
    const falta = await pide('/actividades', { method: 'POST', body: { cliente_id: c } });
    assert.ok(falta.json.errores.includes('Falta el tipo') && falta.json.errores.includes('Falta la descripción'));
    assert.equal((await pide('/actividades', { method: 'POST', body: { tipo: 'nota', cliente_id: '3', descripcion: 'x' } })).status, 400, 'ids como número');
  }));

test('un cliente, contacto, coche o responsable que no existe: 400', () =>
  conServidor(async ({ pide }) => {
    const c = await cliente(pide);
    for (const cambio of [{ cliente_id: 999 }, { contacto_id: 999 }, { cliente_id: c, vehiculo_id: 999 }, { cliente_id: c, responsable_id: 999 }]) {
      const r = await pide('/actividades', { method: 'POST', body: { tipo: 'nota', descripcion: 'x', ...cambio } });
      assert.equal(r.status, 400, JSON.stringify(cambio));
    }
  }));

test('vale con un contacto de la web en vez de un cliente, y con un coche', () =>
  conServidor(async ({ db, pide }) => {
    const { id: v } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const k = Number(db.prepare("INSERT INTO contactos (nombre, telefono, tipo) VALUES ('Iván Roca', '600 222 333', 'prueba')").run().lastInsertRowid);
    const r = await pide('/actividades', { method: 'POST', body: { tipo: 'prueba', contacto_id: k, vehiculo_id: v, descripcion: 'Prueba del Clio', programada_para: `${dia(2)} 17:00` } });
    assert.equal(r.status, 201);
    assert.equal(r.json.contacto_nombre, 'Iván Roca');
    assert.equal(r.json.vehiculo_marca, 'Renault');
    assert.deepEqual((await pide(`/actividades?vehiculo=${v}`)).json.map((a) => a.id), [r.json.id]);
  }));

test('marcar hecha la quita de pendientes; una hecha no se edita; se puede devolver a pendiente', () =>
  conServidor(async ({ pide }) => {
    const c = await cliente(pide);
    const { id } = (await pide('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id: c, descripcion: 'Llamar', programada_para: `${dia(0)} 09:00` } })).json;

    const hecha = await pide(`/actividades/${id}/hecha`, { method: 'PATCH', como: 'comercial', body: { resultado: 'Se lo piensa hasta el lunes' } });
    assert.equal(hecha.status, 200);
    assert.ok(hecha.json.hecha_en);
    assert.equal(hecha.json.resultado, 'Se lo piensa hasta el lunes');
    assert.deepEqual((await pide('/actividades?pendientes=1')).json, []);
    assert.equal((await pide('/actividades?pendientes=0')).json.length, 1, 'pendientes=0 no filtra');

    const editar = await pide(`/actividades/${id}`, { method: 'PUT', body: { descripcion: 'Otra cosa' } });
    assert.equal(editar.status, 409);
    assert.equal((await pide(`/actividades/${id}/hecha`, { method: 'PATCH', body: {} })).status, 409, 'ya está hecha');

    const vuelta = await pide(`/actividades/${id}/hecha`, { method: 'PATCH', body: { hecha: false } });
    assert.equal(vuelta.json.hecha_en, null);
    assert.equal(vuelta.json.resultado, null);
    assert.equal((await pide(`/actividades/${id}`, { method: 'PUT', body: { descripcion: 'Otra cosa' } })).status, 200, 'pendiente otra vez, se edita');
    assert.equal((await pide(`/actividades/${id}/hecha`, { method: 'PATCH', body: { hecha: false } })).status, 409, 'ya está pendiente');
    assert.equal((await pide(`/actividades/${id}/hecha`, { method: 'PATCH', body: { hecha: 'si' } })).status, 400);
  }));

test('editar: solo tipo, descripción, fecha y responsable', () =>
  conServidor(async ({ db, pide }) => {
    const c = await cliente(pide);
    const otro = await cliente(pide, 'Otro');
    const { id } = (await pide('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id: c, descripcion: 'Llamar' } })).json;
    const r = await pide(`/actividades/${id}`, { method: 'PUT', body: { tipo: 'visita', programada_para: `${dia(3)} 12:00`, responsable_id: idDe(db, 'comercial@ejemplo.com') } });
    assert.equal(r.status, 200);
    assert.equal(r.json.tipo, 'visita');
    assert.equal(r.json.responsable_nombre, 'Comercial');
    assert.equal((await pide(`/actividades/${id}`, { method: 'PUT', body: { cliente_id: otro } })).status, 400, 'el cliente no se cambia');
    assert.equal((await pide(`/actividades/${id}`, { method: 'PUT', body: { descripcion: '' } })).status, 400);
    assert.equal((await pide(`/actividades/${id}`, { method: 'PUT', body: {} })).status, 400);
    assert.equal((await pide('/actividades/999', { method: 'PUT', body: { descripcion: 'x' } })).status, 404);

    const audit = db.prepare("SELECT accion FROM auditoria WHERE entidad = 'actividad' ORDER BY id").all().map((a) => a.accion);
    assert.deepEqual(audit, ['alta', 'edicion'], 'alta y edición quedan apuntadas');
  }));

test('?dia= solo trae las de ese día, ordenadas por hora; ?cliente= las de ese cliente', () =>
  conServidor(async ({ pide }) => {
    const a = await cliente(pide, 'A');
    const b = await cliente(pide, 'B');
    const nueva = (cliente_id, programada_para, descripcion) =>
      pide('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id, descripcion, programada_para } });
    await nueva(a, `${dia(1)} 16:00`, 'tarde');
    await nueva(b, `${dia(1)} 09:15`, 'mañana');
    await nueva(a, `${dia(2)} 09:00`, 'pasado');
    await nueva(a, null, 'nota sin fecha');

    assert.deepEqual((await pide(`/actividades?dia=${dia(1)}`)).json.map((x) => x.descripcion), ['mañana', 'tarde']);
    assert.deepEqual((await pide(`/actividades?cliente=${a}`)).json.map((x) => x.descripcion), ['tarde', 'pasado', 'nota sin fecha'], 'sin fecha, al final');
    for (const malo of ['dia=mañana', 'dia=2026-13-01', 'cliente=abc', 'responsable=todos', 'pendientes=si']) {
      assert.equal((await pide(`/actividades?${malo}`)).status, 400, malo);
    }
  }));

test('sin sesión: 401', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/actividades', { como: null })).status, 401);
    assert.equal((await pide('/actividades', { method: 'POST', como: null, body: { tipo: 'nota', cliente_id: 1, descripcion: 'x' } })).status, 401);
  }));

test('una nota sin fecha nace hecha; con fecha, pendiente como las demás', () =>
  conServidor(async ({ db, pide }) => {
    const c = Number(db.prepare("INSERT INTO clientes (nombre) VALUES ('Nota')").run().lastInsertRowid);
    const sin = (await pide('/actividades', { method: 'POST', body: { tipo: 'nota', cliente_id: c, descripcion: 'Se quedó otro coche' } })).json;
    assert.ok(sin.hecha_en, 'hecha al crearla');
    const con = (await pide('/actividades', { method: 'POST', body: { tipo: 'nota', cliente_id: c, descripcion: 'Repasar', programada_para: '2099-01-01 10:00' } })).json;
    assert.equal(con.hecha_en, null);
    const pendientes = (await pide(`/actividades?cliente=${c}&pendientes=1`)).json;
    assert.deepEqual(pendientes.map((a) => a.id), [con.id]);
  }));
