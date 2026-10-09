import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, CONTRASENA, coche } from './ayuda.js';
import { celda } from '../src/csv.js';
import { convertir, sinEtiquetas } from '../src/modules/publicacion/wordpress.js';

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

test('seguridad: una cookie de sesión mal codificada es «sin sesión», no un error del servidor', () =>
  conServidor(async ({ base }) => {
    const r = await fetch(`${base}/vehiculos`, { headers: { cookie: 'ps_sesion=%E0%A4%A' } });
    assert.equal(r.status, 401);
  }));

test('seguridad: las sesiones caducadas se borran al abrir una nueva', () =>
  conServidor(async ({ base, db }) => {
    db.prepare("UPDATE sesiones SET caduca_en = datetime('now', '-1 day')").run();
    await entrar(base, 'jaume@ejemplo.com', CONTRASENA);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sesiones WHERE caduca_en <= datetime('now')").get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sesiones').get().n, 1);
  }));

test('seguridad: parámetros con forma rara dan 400, no 500', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/vehiculos?estado[a]=1')).status, 400);
    assert.equal((await pide('/vehiculos?estado=inventado')).status, 400);
    assert.equal((await pide('/vehiculos?estado=publicado')).status, 200);
    for (const body of [{ tipo: 'compraventa', factura_id: { a: 1 } }, { tipo: 'reserva', vehiculo_id: 1, cliente_id: [1] }, { tipo: 'compra', vehiculo_id: 1, proveedor_id: '1' }]) {
      assert.equal((await pide('/contratos', { method: 'POST', body })).status, 400, JSON.stringify(body));
    }
  }));

test('seguridad: el vídeo del coche solo admite enlaces http o https', () =>
  conServidor(async ({ pide }) => {
    const alta = (video_url, matricula) => pide('/vehiculos', { method: 'POST', body: { ...coche, matricula, bastidor: null, video_url } });
    assert.equal((await alta('javascript:alert(1)', '1111AAA')).status, 400);
    assert.equal((await alta('data:text/html,hola', '2222AAA')).status, 400);
    assert.equal((await alta('no es un enlace', '3333AAA')).status, 400);
    const bien = await alta(' https://www.youtube.com/watch?v=abc ', '4444AAA');
    assert.equal(bien.status, 201);
    assert.equal(bien.json.video_url, 'https://www.youtube.com/watch?v=abc');
  }));

test('seguridad: a WordPress no llegan etiquetas HTML desde la ficha', () => {
  assert.equal(sinEtiquetas('Golf <script>alert(1)</script>'), 'Golf scriptalert(1)/script');
  assert.equal(convertir('<b>rojo</b>', { formato: 'capitalizar' }), 'Brojo/b');
  assert.equal(convertir('<img src=x onerror=alert(1)>', { formato: 'texto' }), 'img src=x onerror=alert(1)');
  assert.equal(convertir(1290000, { formato: 'euros' }), 12900);
});

test('seguridad: CSV sin fórmulas, tampoco con un tabulador o un retorno delante', () => {
  assert.equal(celda('=1+1'), "'=1+1");
  assert.equal(celda('\t=1+1'), "'\t=1+1");
  assert.equal(celda('\r=1+1'), "\"'\r=1+1\"");
  assert.equal(celda('-1632,23'), '-1632,23');
});
