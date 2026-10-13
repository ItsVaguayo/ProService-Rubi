// Tasación desde la web (duda E4): el coche del cliente con sus datos y hasta 5 fotos, por multipart.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { conServidor, CONTRASENA } from './ayuda.js';

// Cada test con su carpeta de subidas: la API la lee de UPLOADS_PATH en cada envío
let subidas;
const carpetas = [];
const antes = process.env.UPLOADS_PATH;
beforeEach(() => { subidas = mkdtempSync(join(tmpdir(), 'tasacion-')); carpetas.push(subidas); process.env.UPLOADS_PATH = subidas; });
after(() => {
  for (const c of carpetas) rmSync(c, { recursive: true, force: true });
  if (antes === undefined) delete process.env.UPLOADS_PATH; else process.env.UPLOADS_PATH = antes;
});

const jpg = (color = 'red') => sharp({ create: { width: 60, height: 40, channels: 3, background: color } }).jpeg().toBuffer();
const ficherosEn = (carpeta) => (existsSync(carpeta) ? readdirSync(carpeta, { recursive: true }).filter((f) => f.endsWith('.jpg')) : []);
const BASE = { nombre: 'Marta Ruiz', telefono: '600 111 222', tipo: 'tasacion', privacidad: 'on' };

/** Envía el formulario como lo haría la web: multipart, con las fotos en el campo «fotos». */
async function enviar(base, campos, fotos = []) {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, String(v));
  for (const [i, f] of fotos.entries()) form.append('fotos', new Blob([f.datos], { type: f.tipo ?? 'image/jpeg' }), f.nombre ?? `foto-${i + 1}.jpg`);
  const res = await fetch(`${base}/contactos`, { method: 'POST', body: form });
  return { status: res.status, json: await res.json() };
}

test('tasación: datos del coche y fotos por multipart; el panel las ve con sesión y el correo lo cuenta', () =>
  conServidor(async ({ db, base, pide }) => {
    const r = await enviar(base, { ...BASE, tasacion_marca: 'Seat', tasacion_modelo: 'Ibiza 1.0 TSI', tasacion_anio: '2019', tasacion_km: '80.000', mensaje: 'Lo cambiaría por uno más grande' },
      [{ datos: await jpg('red') }, { datos: await jpg('blue'), tipo: 'image/png', nombre: 'b.png' }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));

    const [c] = (await pide('/contactos', { como: 'comercial' })).json;
    assert.deepEqual([c.tipo, c.tasacion_marca, c.tasacion_modelo, c.tasacion_anio, c.tasacion_km], ['tasacion', 'Seat', 'Ibiza 1.0 TSI', 2019, 80000]);
    assert.equal(c.fotos.length, 2);
    assert.match(c.fotos[0].url, new RegExp(`^/api/contactos/${c.id}/fotos/\\d+$`));

    const url = `${base}${c.fotos[0].url.replace('/api', '')}`;
    assert.equal((await fetch(url)).status, 401, 'sin sesión, no');
    const entrar = await fetch(`${base}/auth/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'comercial@ejemplo.com', contrasena: CONTRASENA }) });
    const conSesion = await fetch(url, { headers: { cookie: entrar.headers.get('set-cookie').split(';')[0] } });
    assert.equal(conSesion.status, 200);
    assert.equal(conSesion.headers.get('content-type'), 'image/jpeg');
    assert.equal((await sharp(Buffer.from(await conSesion.arrayBuffer())).metadata()).format, 'jpeg', 'reducida a JPG, también la que llegó en PNG');
    assert.equal(ficherosEn(join(subidas, 'contactos')).length, 2);

    const correo = db.prepare("SELECT cuerpo FROM correos WHERE tipo = 'contacto'").get().cuerpo;
    assert.match(correo, /Su coche: Seat Ibiza 1\.0 TSI, 2019, 80\.000 km\nHa mandado 2 fotos de su coche: están en el panel\./);
  }));

test('tasación: también en JSON, sin fotos, y los datos del coche son opcionales', () =>
  conServidor(async ({ pide }) => {
    const r = await pide('/contactos', { method: 'POST', como: null, body: { ...BASE, privacidad: true, tasacion_marca: 'Kia', tasacion_km: 120000 } });
    assert.equal(r.status, 201);
    const sinDatos = await pide('/contactos', { method: 'POST', como: null, body: { ...BASE, privacidad: true } });
    assert.equal(sinDatos.status, 201, 'como hasta ahora: una tasación solo con el mensaje');
    const lista = (await pide('/contactos')).json;
    assert.deepEqual(lista.map((c) => [c.tasacion_marca, c.tasacion_km, c.fotos.length]), [['Kia', 120000, 0], [null, null, 0]]);
  }));

test('tasación: lo que no se acepta, sin dejar nada guardado', async () => {
  const foto = { datos: await jpg() };
  const casos = [
    [{ ...BASE, tipo: 'informacion' }, [foto], 400, /solo van al pedir una tasación/],
    [{ ...BASE, tipo: 'informacion', tasacion_marca: 'Seat' }, [], 400, /solo van al pedir una tasación/],
    [BASE, Array(6).fill(foto), 400, /Como mucho 5 fotos/],
    [BASE, [{ datos: Buffer.from('esto no es una imagen') }], 400, /no es una imagen/],
    [BASE, [{ datos: await jpg(), tipo: 'image/heic', nombre: 'IMG_0001.HEIC' }], 400, /HEIC/],
    [{ ...BASE, tasacion_anio: '1900' }, [], 400, /año/],
    [{ ...BASE, tasacion_km: 'muchos' }, [], 400, /kilómetros/],
    [{ ...BASE, privacidad: 'no' }, [foto], 400, /privacidad/],
    [BASE, [{ datos: Buffer.alloc(11 * 1024 * 1024) }], 413, /10 MB/],
  ];
  // Cada caso en su servidor: son más de los 5 envíos por IP que deja la API
  for (const [campos, fotos, status, error] of casos) {
    await conServidor(async ({ db, base }) => {
      const r = await enviar(base, campos, fotos);
      assert.equal(r.status, status, `${JSON.stringify(campos)} ${fotos.length}: ${JSON.stringify(r.json)}`);
      assert.match(r.json.error, error);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 0);
    });
  }
  assert.equal(ficherosEn(join(subidas, 'contactos')).length, 0, 'ni fotos sueltas en el disco');
});

test('tasación: el campo trampa y el límite de envíos cortan antes de procesar las fotos', () =>
  conServidor(async ({ db, base }) => {
    const foto = { datos: await jpg() };
    const trampa = await enviar(base, { ...BASE, web: 'http://spam' }, [foto]);
    assert.equal(trampa.status, 201, 'al robot se le dice que ha ido bien');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contactos').get().n, 0);
    for (let i = 0; i < 4; i++) await enviar(base, BASE);
    assert.equal((await enviar(base, BASE, [foto])).status, 429, 'el sexto envío de la misma IP');
    assert.equal(ficherosEn(join(subidas, 'contactos')).length, 0);
  }));
