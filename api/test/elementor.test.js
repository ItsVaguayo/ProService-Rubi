// Webhook de los formularios de Elementor Pro de proservicerubi.com (contactos/elementor.js). Los envíos imitan
// lo que manda Elementor: application/x-www-form-urlencoded, con «Datos avanzados» (fields[id][…]) o sin ellos.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { conServidor, coche } from './ayuda.js';
import { descargasEnCurso } from '../src/modules/contactos/elementor.js';

const TOKEN = 'token-de-prueba-elementor';
const guardado = { token: process.env.FORMULARIOS_WEB_TOKEN, hosts: process.env.FORMULARIOS_WEB_HOSTS, subidas: process.env.UPLOADS_PATH };
const carpetas = [];
beforeEach(() => {
  process.env.FORMULARIOS_WEB_TOKEN = TOKEN;
  delete process.env.FORMULARIOS_WEB_HOSTS;
  const c = mkdtempSync(join(tmpdir(), 'elementor-'));
  carpetas.push(c);
  process.env.UPLOADS_PATH = c;
});
after(() => {
  for (const c of carpetas) rmSync(c, { recursive: true, force: true });
  for (const [k, v] of [['FORMULARIOS_WEB_TOKEN', guardado.token], ['FORMULARIOS_WEB_HOSTS', guardado.hosts], ['UPLOADS_PATH', guardado.subidas]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

/** Envía como Elementor: pares clave=valor, con las claves anidadas al estilo de PHP (fields[name][value]). */
async function enviar(base, pares, token = TOKEN) {
  const res = await fetch(`${base}/contactos/elementor${token === null ? '' : `?token=${encodeURIComponent(token)}`}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(pares),
  });
  return { status: res.status, json: await res.json() };
}

/** «Datos avanzados»: form[name], fields[id][title|type|value] y meta[page_url][value]. */
function avanzado(nombreFormulario, campos, pagina = 'https://proservicerubi.com/contacto-taller-mecanico-rubi/') {
  const pares = [['form[id]', '08d8c51'], ['form[name]', nombreFormulario], ['meta[page_url][title]', 'Page URL'], ['meta[page_url][value]', pagina]];
  for (const [id, titulo, tipo, valor] of campos) {
    pares.push([`fields[${id}][id]`, id], [`fields[${id}][type]`, tipo], [`fields[${id}][title]`, titulo], [`fields[${id}][value]`, valor]);
  }
  return pares;
}

const CONTACTO = [
  ['name', 'Nombre', 'text', 'Laura Pons'],
  ['email', 'Correo electrónico', 'email', 'laura@correo.com'],
  ['field_fe2491f', 'Número teléfono', 'number', '600222333'],
  ['message', 'Mensaje', 'textarea', '¿Tenéis algún SUV automático?'],
];

test('elementor: el formulario de contacto entra como «información», con la página de la que viene, y responde 200', () =>
  conServidor(async ({ db, base, pide }) => {
    const r = await enviar(base, avanzado('Formulario Contacto Web', CONTACTO));
    assert.equal(r.status, 200, 'Elementor da el envío por fallido con cualquier otro código, también con 201');
    assert.deepEqual(r.json, { ok: true });
    const [c] = (await pide('/contactos', { como: 'comercial' })).json;
    assert.deepEqual([c.nombre, c.telefono, c.email, c.tipo, c.origen], ['Laura Pons', '600222333', 'laura@correo.com', 'informacion', 'web']);
    assert.equal(c.mensaje, '¿Tenéis algún SUV automático?\nEnviado desde: https://proservicerubi.com/contacto-taller-mecanico-rubi/');
    assert.match(db.prepare("SELECT cuerpo FROM correos WHERE tipo = 'contacto'").get().cuerpo, /Laura Pons ha escrito por la web: pide información/);
  }));

test('elementor: sin token, con uno incorrecto o sin FORMULARIOS_WEB_TOKEN no se guarda nada', () =>
  conServidor(async ({ db, base }) => {
    assert.equal((await enviar(base, avanzado('Formulario Contacto Web', CONTACTO), null)).status, 401);
    assert.equal((await enviar(base, avanzado('Formulario Contacto Web', CONTACTO), 'otro')).status, 401);
    delete process.env.FORMULARIOS_WEB_TOKEN;
    assert.equal((await enviar(base, avanzado('Formulario Contacto Web', CONTACTO))).status, 404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 0);
  }));

test('elementor: sin límite por IP (todo llega desde el servidor de WordPress)', () =>
  conServidor(async ({ db, base }) => {
    for (let i = 0; i < 8; i++) assert.equal((await enviar(base, avanzado('Formulario Contacto Web', CONTACTO))).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 8);
  }));

test('elementor: lo mal escrito no se rechaza, va al mensaje; sin nombre se usa el correo', () =>
  conServidor(async ({ pide, base }) => {
    const r = await enviar(base, avanzado('Formulario Contacto Web', [
      ['email', 'Correo electrónico', 'email', 'pere@correo.com'],
      ['field_fe2491f', 'Número teléfono', 'number', '12'],
      ['message', 'Mensaje', 'textarea', ''],
    ]));
    assert.equal(r.status, 200);
    const [c] = (await pide('/contactos')).json;
    assert.deepEqual([c.nombre, c.telefono, c.email], ['pere', '', 'pere@correo.com']);
    assert.match(c.mensaje, /^Teléfono escrito: 12\n/);
  }));

test('elementor: sin teléfono ni correo se contesta 200 y no se guarda; el campo trampa de Elementor tampoco', () =>
  conServidor(async ({ db, base }) => {
    assert.equal((await enviar(base, avanzado('Formulario Contacto Web', [['name', 'Nombre', 'text', 'Anónimo']]))).status, 200);
    assert.equal((await enviar(base, avanzado('Formulario Contacto Web', [...CONTACTO, ['field_trampa', '', 'honeypot', 'spam']]))).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 0);
  }));

test('elementor: sin «Datos avanzados» (etiqueta = valor) también entra, sin los metadatos', () =>
  conServidor(async ({ pide, base }) => {
    const r = await enviar(base, [['Nombre', 'Jordi'], ['Correo electrónico', 'jordi@correo.com'], ['Número teléfono', '611 222 333'],
      ['Mensaje', 'Hola'], ['Date', '30 octubre, 2026'], ['User Agent', 'Mozilla'], ['Remote IP', '1.2.3.4'], ['form_name', 'Formulario Contacto Web']]);
    assert.equal(r.status, 200);
    const [c] = (await pide('/contactos')).json;
    assert.deepEqual([c.nombre, c.telefono, c.tipo, c.mensaje], ['Jordi', '611 222 333', 'informacion', 'Hola']);
  }));

test('elementor: la prueba de la ficha (su formulario propio) con el id del post: entra como prueba y con el coche', () =>
  conServidor(async ({ db, pide, base }) => {
    const v = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    db.prepare("UPDATE vehiculos SET estado = 'publicado' WHERE id = ?").run(v.id);
    db.prepare("INSERT INTO wp_posts (vehiculo_id, wp_post_id, estado) VALUES (?, 8835, 'publicado')").run(v.id);
    const r = await enviar(base, [['tipo', 'prueba'], ['nombre', 'Ana Gil'], ['email', 'ana@correo.com'], ['telefono', '622 333 444'],
      ['fecha', '2026-11-03'], ['hora', '17:30'], ['wp_post_id', '8835'], ['pagina', 'https://proservicerubi.com/coches/renault-clio/']]);
    assert.equal(r.status, 200);
    const [c] = (await pide('/contactos')).json;
    assert.deepEqual([c.tipo, c.vehiculo_id, c.nombre], ['prueba', v.id, 'Ana Gil']);
    assert.equal(c.mensaje, 'fecha: 2026-11-03\nhora: 17:30\nEnviado desde: https://proservicerubi.com/coches/renault-clio/');
    // Un post que no es de un coche a la venta: el contacto entra igual, sin coche
    await enviar(base, [['tipo', 'prueba'], ['nombre', 'Otro'], ['telefono', '633 444 555'], ['wp_post_id', '1']]);
    assert.equal(db.prepare("SELECT vehiculo_id FROM contactos WHERE nombre = 'Otro'").get().vehiculo_id, null);
  }));

// Su WordPress de mentira: sirve las fotos de /wp-content/uploads/elementor/forms/
async function conWeb(fn) {
  const jpg = await sharp({ create: { width: 60, height: 40, channels: 3, background: 'green' } }).jpeg().toBuffer();
  const web = createServer((req, res) => {
    if (req.url.endsWith('.jpg')) { res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end(jpg); } else { res.writeHead(404); res.end(); }
  }).listen(0);
  const host = `localhost:${web.address().port}`;
  process.env.FORMULARIOS_WEB_HOSTS = host;
  try { await fn(`http://${host}/wp-content/uploads/elementor/forms`); } finally { web.close(); }
}

const TASACION = (fotos) => avanzado('Formulario Tasación', [
  ['name', 'Nombre', 'text', 'Marc Vidal'],
  ['email', 'Correo electrónico (Te mandaremos la respuesta con la oferta)', 'email', 'marc@correo.com'],
  ['message', 'Marca vehículo', 'text', 'Seat'],
  ['field_9e29309', 'Modelo vehículo', 'text', 'León 1.5 TSI'],
  ['field_716f7fa', 'Año matriculación vehículo', 'number', '2018'],
  ['field_fee7602', 'Nº Puertas vehículo', 'text', '5'],
  ['field_e54b36d', 'Kilómetros vehículo', 'number', '95000'],
  ['field_cd5c8da', '¿Cuándo y por qué quieres vender tu coche? (Breve explicación)', 'textarea', 'Este mes, me voy fuera'],
  ['field_fotos', 'Sube hasta 6 fotos', 'upload', fotos],
], 'https://proservicerubi.com/compramos-tu-coche-en-rubi/');

test('elementor: la tasación, sin teléfono, con su coche y las fotos bajadas de su web después de contestar', () =>
  conWeb((fotos) => conServidor(async ({ db, pide, base }) => {
    const r = await enviar(base, TASACION(`${fotos}/a.jpg, ${fotos}/b.jpg, ${fotos}/no-existe.png, https://otra-web.com/wp-content/uploads/x.jpg`));
    assert.equal(r.status, 200);
    await Promise.all(descargasEnCurso);
    const [c] = (await pide('/contactos', { como: 'comercial' })).json;
    assert.deepEqual([c.tipo, c.telefono, c.tasacion_marca, c.tasacion_modelo, c.tasacion_anio, c.tasacion_km], ['tasacion', '', 'Seat', 'León 1.5 TSI', 2018, 95000]);
    assert.equal(c.fotos.length, 2, 'las dos que existen; la de otra web no se baja');
    assert.match(c.mensaje, /^Nº Puertas vehículo: 5\n¿Cuándo y por qué quieres vender tu coche\? \(Breve explicación\): Este mes, me voy fuera\n/);
    assert.match(c.mensaje, /Foto no descargada: https:\/\/otra-web\.com/);
    assert.match(c.mensaje, /No se pudo bajar una foto \(respondió 404\): .*no-existe\.png$/);
    const correo = db.prepare("SELECT cuerpo FROM correos WHERE tipo = 'contacto'").get().cuerpo;
    assert.match(correo, /Teléfono: no lo ha dejado, hay que contestar por correo/);
    assert.match(correo, /Su coche: Seat León 1\.5 TSI, 2018, 95\.000 km/);
  })));

test('elementor: un contacto sin teléfono pasa a cliente sin unirse a otro que tampoco tenga teléfono', () =>
  conServidor(async ({ db, pide, base }) => {
    db.prepare("INSERT INTO clientes (nombre, telefono) VALUES ('Cliente sin teléfono', '')").run();
    await enviar(base, avanzado('Formulario Tasación', [['name', 'Nombre', 'text', 'Marc'], ['email', 'Correo electrónico', 'email', 'marc@correo.com']]));
    const [c] = (await pide('/contactos')).json;
    const r = await pide(`/contactos/${c.id}/cliente`, { method: 'POST' });
    assert.equal(r.status, 201);
    assert.equal(r.json.creado, true);
  }));
