import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche } from './ayuda.js';
import { tipoNif } from '../src/modules/terceros/fiscal.js';

test('fiscal: DNI, NIE y CIF con su control', () => {
  assert.equal(tipoNif('12345678Z'), 'dni');
  assert.equal(tipoNif('12345678-z'), 'dni', 'acepta minúsculas y guiones');
  assert.equal(tipoNif('12345678A'), null, 'letra equivocada');
  assert.equal(tipoNif('X1234567L'), 'nie');
  assert.equal(tipoNif('Y1234567X'), 'nie');
  assert.equal(tipoNif('X1234567A'), null);
  assert.equal(tipoNif('B12345674'), 'cif');
  assert.equal(tipoNif('B12345675'), null);
  assert.equal(tipoNif('Q2826000H'), 'cif', 'organismos: siempre letra');
  assert.equal(tipoNif('Q28260008'), null);
  assert.equal(tipoNif('A58818501'), 'cif');
  assert.equal(tipoNif(''), null);
});

test('clientes: alta, búsqueda, ficha y edición con los dos roles', () =>
  conServidor(async ({ pide }) => {
    const alta = await pide('/clientes', { method: 'POST', como: 'comercial',
      body: { nombre: 'Marta Soler', nif: '12345678-z', telefono: '600 111 222', email: 'marta@ejemplo.com', poblacion: 'Rubí' } });
    assert.equal(alta.status, 201);
    assert.equal(alta.json.nif, '12345678Z', 'el NIF se guarda normalizado');
    assert.equal(alta.json.tipo, 'particular');
    assert.equal(alta.json.pais, 'ES');

    await pide('/clientes', { method: 'POST', body: { nombre: 'Talleres Vallès SL', tipo: 'empresa', nif: 'B12345674' } });
    assert.deepEqual((await pide('/clientes?q=600111')).json.map((c) => c.nombre), ['Marta Soler'], 'busca el teléfono sin espacios');
    assert.deepEqual((await pide('/clientes?q=b1234')).json.map((c) => c.nombre), ['Talleres Vallès SL']);
    assert.equal((await pide('/clientes')).json.length, 2);

    const repetido = await pide('/clientes', { method: 'POST', body: { nombre: 'Otra', nif: '12345678Z' } });
    assert.equal(repetido.status, 409, 'un NIF, un cliente');

    const editado = await pide(`/clientes/${alta.json.id}`, { method: 'PUT', body: { direccion: 'C/ Major 1', activo: false } });
    assert.equal(editado.status, 200);
    assert.equal(editado.json.direccion, 'C/ Major 1');
    assert.equal((await pide('/clientes')).json.length, 1, 'los desactivados no salen');
    assert.equal((await pide('/clientes?activos=0')).json.length, 2);

    const ficha = await pide(`/clientes/${alta.json.id}`);
    assert.deepEqual(ficha.json.coches, []);
    assert.deepEqual(ficha.json.contactos, []);
  }));

test('clientes: validación', () =>
  conServidor(async ({ pide }) => {
    const malo = await pide('/clientes', { method: 'POST', body: { nif: '12345678A', telefono: 'abc', email: 'no', tipo: 'otro', id: 3 } });
    assert.equal(malo.status, 400);
    for (const texto of ['Falta el nombre', 'DNI, NIE o CIF', 'teléfono', 'correo', 'tipo', 'Campo desconocido: id']) {
      assert.ok(malo.json.errores.some((e) => e.includes(texto)), texto);
    }
    const { id } = (await pide('/clientes', { method: 'POST', body: { nombre: 'Iván' } })).json;
    assert.equal((await pide(`/clientes/${id}`, { method: 'PUT', body: { nombre: '' } })).status, 400);
    assert.equal((await pide(`/clientes/${id}`, { method: 'PUT', body: {} })).status, 400);
    assert.equal((await pide('/clientes/999')).status, 404);
  }));

test('proveedores: solo gerencia, y el coche se une a su proveedor', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/proveedores', { como: 'comercial' })).status, 403);
    assert.equal((await pide('/proveedores', { method: 'POST', como: 'comercial', body: { nombre: 'X' } })).status, 403);

    const p = (await pide('/proveedores', { method: 'POST', body: { nombre: 'Subastas Vallès', tipo: 'subasta', nif: 'A58818501' } })).json;
    const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, proveedor_id: p.id } })).json;
    assert.equal(v.proveedor_id, p.id);
    assert.equal((await pide(`/vehiculos/${v.id}`, { como: 'comercial' })).json.proveedor_id, undefined, 'el comercial no ve el proveedor');
    assert.equal((await pide('/vehiculos', { method: 'POST', como: 'comercial', body: { matricula: '9999XYZ', marca: 'Kia', modelo: 'Ceed', proveedor_id: p.id } })).status, 400);
    assert.equal((await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '1111BBB', bastidor: null, proveedor_id: 999 } })).status, 400, 'proveedor que no existe');

    const ficha = (await pide(`/proveedores/${p.id}`)).json;
    assert.deepEqual(ficha.coches.map((c) => c.id), [v.id]);
    assert.equal(ficha.coches[0].precio_compra_cent, coche.precio_compra_cent);
  }));

test('contactos: pasar a cliente crea la ficha o reutiliza la que ya existe', () =>
  conServidor(async ({ pide }) => {
    const mandar = (body) => pide('/contactos', { method: 'POST', como: null, body: { tipo: 'informacion', privacidad: true, ...body } });
    await mandar({ nombre: 'Marta', telefono: '600 111 222', email: 'marta@ejemplo.com' });
    await mandar({ nombre: 'Marta S.', telefono: '600-111-222' });
    const [c1, c2] = (await pide('/contactos')).json;

    const primero = await pide(`/contactos/${c1.id}/cliente`, { method: 'POST', como: 'comercial' });
    assert.equal(primero.status, 201);
    assert.equal(primero.json.creado, true);
    const segundo = await pide(`/contactos/${c2.id}/cliente`, { method: 'POST' });
    assert.equal(segundo.status, 200);
    assert.deepEqual(segundo.json, { cliente_id: primero.json.cliente_id, creado: false }, 'mismo teléfono, mismo cliente');
    assert.equal((await pide(`/contactos/${c1.id}/cliente`, { method: 'POST' })).json.creado, false, 'repetir no duplica');

    const cliente = (await pide(`/clientes/${primero.json.cliente_id}`)).json;
    assert.equal(cliente.origen, 'web');
    assert.equal(cliente.email, 'marta@ejemplo.com');
    assert.equal(cliente.contactos.length, 2);
    assert.equal((await pide('/contactos/999/cliente', { method: 'POST' })).status, 404);
  }));

test('migración 0008: los proveedores escritos a mano pasan a la tabla', async () => {
  const { default: Database } = await import('better-sqlite3');
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../migraciones/', import.meta.url);
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  for (const f of readdirSync(dir).filter((f) => /^\d{4}_/.test(f)).sort()) {
    if (f.startsWith('0008')) {
      const ins = db.prepare("INSERT INTO vehiculos (matricula, marca, modelo, proveedor_nombre, proveedor_telefono) VALUES (?, 'Seat', 'Ibiza', ?, ?)");
      ins.run('1AAA', 'Autos Terrassa', '937778899');
      ins.run('2BBB', 'Autos Terrassa', '937778899');
      ins.run('3CCC', 'Particular', null);
      ins.run('4DDD', null, null);
    }
    db.exec(readFileSync(new URL(f, dir), 'utf8'));
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM proveedores').get().n, 2);
  const filas = db.prepare('SELECT v.matricula, p.nombre FROM vehiculos v LEFT JOIN proveedores p ON p.id = v.proveedor_id ORDER BY v.matricula').all();
  assert.deepEqual(filas.map((f) => f.nombre), ['Autos Terrassa', 'Autos Terrassa', 'Particular', null]);
  db.close();
});

test('clientes: estado comercial del embudo', () =>
  conServidor(async ({ pide }) => {
    const { id, estado_comercial } = (await pide('/clientes', { method: 'POST', como: 'comercial', body: { nombre: 'Marta' } })).json;
    assert.equal(estado_comercial, 'nuevo', 'por defecto');
    await pide('/clientes', { method: 'POST', body: { nombre: 'Iván', estado_comercial: 'negociando' } });

    assert.equal((await pide(`/clientes/${id}`, { method: 'PUT', body: { estado_comercial: 'me_lo_pienso' }, como: 'comercial' })).json.estado_comercial, 'me_lo_pienso');
    assert.equal((await pide(`/clientes/${id}`, { method: 'PUT', body: { estado_comercial: 'raro' } })).status, 400);
    assert.equal((await pide(`/clientes/${id}`, { method: 'PUT', body: { estado_comercial: null } })).status, 400);

    assert.deepEqual((await pide('/clientes?estado_comercial=negociando')).json.map((c) => c.nombre), ['Iván']);
    assert.equal((await pide('/clientes?estado_comercial=raro')).status, 400);
    assert.equal((await pide('/proveedores?estado_comercial=nuevo')).status, 400, 'los proveedores no tienen embudo');
  }));
