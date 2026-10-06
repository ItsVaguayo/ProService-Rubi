import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, CONTRASENA } from './ayuda.js';

const entrar = (base, email, contrasena = CONTRASENA) =>
  fetch(`${base}/auth/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena }) });

test('usuarios: solo gerencia los ve y los gestiona', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/usuarios', { como: 'comercial' })).status, 403);
    assert.equal((await pide('/usuarios', { method: 'POST', body: {}, como: 'comercial' })).status, 403);
    assert.equal((await pide('/usuarios', { como: null })).status, 401);

    const lista = (await pide('/usuarios')).json;
    assert.deepEqual(lista.map((u) => u.email), ['comercial@ejemplo.com', 'jaume@ejemplo.com']);
    assert.ok(lista.every((u) => !('hash' in u)), 'nunca sale el hash de la contraseña');
    assert.ok(lista.find((u) => u.email === 'jaume@ejemplo.com').ultimo_acceso, 'se apunta el último acceso al entrar');
  }));

test('usuarios: alta con validación y correo único', () =>
  conServidor(async ({ base, pide }) => {
    const malo = await pide('/usuarios', { method: 'POST', body: { nombre: '', email: 'no-es-correo', rol: 'jefe', contrasena: '' } });
    assert.equal(malo.status, 400);
    assert.equal(malo.json.errores.length, 4);

    const alta = await pide('/usuarios', { method: 'POST', body: { nombre: 'Marc', email: 'Marc@Ejemplo.com', rol: 'comercial', contrasena: 'provisional-123' } });
    assert.equal(alta.status, 201);
    assert.equal(alta.json.email, 'marc@ejemplo.com');
    assert.equal((await entrar(base, 'marc@ejemplo.com', 'provisional-123')).status, 200);

    const repetido = await pide('/usuarios', { method: 'POST', body: { nombre: 'Otro', email: 'marc@ejemplo.com', rol: 'comercial', contrasena: 'provisional-123' } });
    assert.equal(repetido.status, 409);
  }));

test('usuarios: desactivar echa de la sesión y reactivar deja volver', () =>
  conServidor(async ({ base, pide }) => {
    const comercial = (await pide('/usuarios')).json.find((u) => u.rol === 'comercial');
    assert.equal((await pide('/vehiculos', { como: 'comercial' })).status, 200);

    assert.equal((await pide(`/usuarios/${comercial.id}`, { method: 'PATCH', body: { activo: false } })).status, 200);
    assert.equal((await pide('/vehiculos', { como: 'comercial' })).status, 401, 'su sesión abierta ya no vale');
    assert.equal((await entrar(base, 'comercial@ejemplo.com')).status, 401, 'y no puede volver a entrar');

    assert.equal((await pide(`/usuarios/${comercial.id}`, { method: 'PATCH', body: { activo: true } })).status, 200);
    assert.equal((await entrar(base, 'comercial@ejemplo.com')).status, 200);
  }));

test('usuarios: cambiar la contraseña cierra las otras sesiones, no la propia', () =>
  conServidor(async ({ base, pide }) => {
    const jaume = 'jaume@ejemplo.com';
    const comercial = 'comercial@ejemplo.com';
    const lista = (await pide('/usuarios')).json;
    const idComercial = lista.find((u) => u.email === comercial).id;
    const idJaume = lista.find((u) => u.email === jaume).id;

    assert.equal((await pide(`/usuarios/${idComercial}`, { method: 'PATCH', body: { contrasena: 'otra-clave-larga' } })).status, 200);
    assert.equal((await pide('/vehiculos', { como: 'comercial' })).status, 401);
    assert.equal((await entrar(base, comercial)).status, 401, 'la vieja ya no vale');
    assert.equal((await entrar(base, comercial, 'otra-clave-larga')).status, 200);

    assert.equal((await pide(`/usuarios/${idJaume}`, { method: 'PATCH', body: { contrasena: 'mi-clave-nueva' } })).status, 200);
    assert.equal((await pide('/vehiculos')).status, 200, 'quien la cambia sigue dentro');
  }));

test('usuarios: nadie se deja fuera ni deja el stock sin gerencia', () =>
  conServidor(async ({ pide }) => {
    const lista = (await pide('/usuarios')).json;
    const yo = lista.find((u) => u.rol === 'gerencia');
    const comercial = lista.find((u) => u.rol === 'comercial');

    assert.equal((await pide(`/usuarios/${yo.id}`, { method: 'PATCH', body: { activo: false } })).status, 409);
    assert.equal((await pide(`/usuarios/${yo.id}`, { method: 'PATCH', body: { rol: 'comercial' } })).status, 409);
    assert.equal((await pide(`/usuarios/${yo.id}`, { method: 'PATCH', body: { nombre: 'Jaume P.' } })).json.nombre, 'Jaume P.');

    // Con otra persona de gerencia, a la segunda sí se la puede pasar a comercial; a la última, no
    const ana = (await pide('/usuarios', { method: 'POST', body: { nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'gerencia', contrasena: 'provisional-123' } })).json;
    assert.equal((await pide(`/usuarios/${ana.id}`, { method: 'PATCH', body: { rol: 'comercial' } })).status, 200);
    assert.equal((await pide(`/usuarios/${comercial.id}`, { method: 'PATCH', body: {} })).status, 400);
    assert.equal((await pide('/usuarios/999', { method: 'PATCH', body: { nombre: 'X' } })).status, 404);
  }));
