import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, CONTRASENA } from './ayuda.js';

const entrar = (base, email, contrasena, headers = {}) =>
  fetch(`${base}/auth/entrar`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ email, contrasena }) });

test('seguridad: cabeceras en las respuestas de la API', () =>
  conServidor(async ({ pide }) => {
    const { headers } = await pide('/vehiculos');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    assert.match(headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(headers.get('x-powered-by'), null);
  }));

test('seguridad: otra web no puede cambiar datos con la sesión de alguien', () =>
  conServidor(async ({ base, pide }) => {
    const cookie = (await entrar(base, 'jaume@ejemplo.com', CONTRASENA)).headers.get('set-cookie').split(';')[0];
    const desde = (origin) => fetch(`${base}/usuarios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin },
      body: JSON.stringify({ nombre: 'Intruso', email: 'intruso@ejemplo.com', rol: 'gerencia', contrasena: 'contrasena-larga' }),
    });
    assert.equal((await desde('https://web-mala.example')).status, 403);
    assert.equal((await pide('/usuarios')).json.some((u) => u.email === 'intruso@ejemplo.com'), false);
    // Desde el propio dominio, sí
    assert.equal((await desde(new URL(base).origin)).status, 201);
  }));

test('seguridad: 10 fallos bloquean la cuenta, no a los demás de la misma IP', () =>
  conServidor(async ({ base }) => {
    for (let i = 0; i < 10; i++) assert.equal((await entrar(base, 'jaume@ejemplo.com', 'no-es-esta')).status, 401);
    assert.equal((await entrar(base, 'jaume@ejemplo.com', CONTRASENA)).status, 429, 'ni con la buena');
    assert.equal((await entrar(base, 'comercial@ejemplo.com', CONTRASENA)).status, 200);
  }));

test('seguridad: un correo que no existe responde igual que una contraseña mala', () =>
  conServidor(async ({ base }) => {
    const noExiste = await entrar(base, 'nadie@ejemplo.com', 'lo-que-sea');
    const mala = await entrar(base, 'jaume@ejemplo.com', 'lo-que-sea');
    assert.equal(noExiste.status, mala.status);
    assert.deepEqual(await noExiste.json(), await mala.json());
  }));

test('seguridad: la cookie va con Secure detrás de un proxy con HTTPS', () =>
  conServidor(async ({ base }) => {
    const sinHttps = (await entrar(base, 'jaume@ejemplo.com', CONTRASENA)).headers.get('set-cookie');
    assert.doesNotMatch(sinHttps, /Secure/);
    const conHttps = (await entrar(base, 'jaume@ejemplo.com', CONTRASENA, { 'x-forwarded-proto': 'https' })).headers.get('set-cookie');
    assert.match(conHttps, /Secure/);
    assert.match(conHttps, /HttpOnly/);
  }));

test('seguridad: contraseña de 8 caracteres como mínimo', () =>
  conServidor(async ({ pide }) => {
    const corta = await pide('/usuarios', { method: 'POST', body: { nombre: 'Marc', email: 'marc@ejemplo.com', rol: 'comercial', contrasena: '1234567' } });
    assert.equal(corta.status, 400);
    const justa = await pide('/usuarios', { method: 'POST', body: { nombre: 'Marc', email: 'marc@ejemplo.com', rol: 'comercial', contrasena: '12345678' } });
    assert.equal(justa.status, 201);
  }));
