import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { conServidor, coche, CONTRASENA } from './ayuda.js';

// Cada ejecución guarda las fotos en una carpeta temporal que se borra al final
const carpeta = mkdtempSync(join(tmpdir(), 'proservice-fotos-'));
process.env.UPLOADS_PATH = carpeta;
after(() => rmSync(carpeta, { recursive: true, force: true }));

// Una «foto de móvil» de 4000 × 3000 para comprobar que se reduce
const imagen = (color = '#888888') =>
  sharp({ create: { width: 4000, height: 3000, channels: 3, background: color } }).jpeg().toBuffer();

// pide() de ayuda.js manda JSON; para subir hace falta multipart con la cookie de sesión
async function subir(base, cookie, vehiculoId, buffers, campo = 'fotos') {
  const form = new FormData();
  buffers.forEach((b, i) => form.append(campo, new Blob([b], { type: 'image/jpeg' }), `IMG_${i + 1}.jpg`));
  const res = await fetch(`${base}/fotos/${vehiculoId}`, { method: 'POST', headers: cookie ? { cookie } : {}, body: form });
  return { status: res.status, json: await res.json() };
}

async function cookieDe(base) {
  const res = await fetch(`${base}/auth/entrar`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'jaume@ejemplo.com', contrasena: CONTRASENA }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

test('subir, listar, ver el fichero, marcar, ordenar y borrar', () =>
  conServidor(async ({ db, base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);

    // Subir tres: entran en los huecos 1, 2 y 3
    const subida = await subir(base, cookie, id, [await imagen(), await imagen('#aa0000'), await imagen('#00aa00')]);
    assert.equal(subida.status, 201);
    assert.deepEqual(subida.json.subidas.map((f) => f.orden), [1, 2, 3]);

    // Listar: el GET de siempre, con la url para el <img>
    const lista = (await pide(`/fotos/${id}`)).json;
    assert.equal(lista.length, 3);
    assert.ok(lista.every((f) => f.url === `/api/fotos/${id}/${f.id}/archivo`));
    assert.ok(lista.every((f) => f.publica === 1 && f.es_dano === 0 && f.ruta_photocall === null));

    // El fichero se guarda en disco reducido a 1600 px y se sirve con sesión
    assert.ok(existsSync(join(carpeta, lista[0].ruta_original)));
    const archivo = await fetch(`${base}/fotos/${id}/${lista[0].id}/archivo`, { headers: { cookie } });
    assert.equal(archivo.status, 200);
    const meta = await sharp(Buffer.from(await archivo.arrayBuffer())).metadata();
    assert.equal(meta.width, 1600);
    assert.equal(meta.format, 'jpeg');

    // Marcar la 3 como daño y fuera de la web
    const marca = await pide(`/fotos/${id}/${lista[2].id}`, { method: 'PATCH', body: { es_dano: true, publica: false } });
    assert.equal(marca.status, 200);
    assert.equal(marca.json.es_dano, 1);
    assert.equal(marca.json.publica, 0);

    // Ordenar: cambiar la 1 con la 2 y mandar la 3 al hueco 16
    const [a, b, c] = lista;
    const orden = await pide(`/fotos/${id}/orden`, {
      method: 'PUT', body: { fotos: [{ id: a.id, orden: 2 }, { id: b.id, orden: 1 }, { id: c.id, orden: 16 }] },
    });
    assert.equal(orden.status, 200);
    assert.deepEqual(orden.json.map((f) => [f.id, f.orden]), [[b.id, 1], [a.id, 2], [c.id, 16]]);

    // Borrar la que está en el hueco 1: desaparecen la fila y el fichero, y el hueco queda libre
    const borra = await pide(`/fotos/${id}/${b.id}`, { method: 'DELETE' });
    assert.equal(borra.status, 200);
    assert.deepEqual(borra.json.map((f) => f.id), [a.id, c.id]);
    assert.ok(!existsSync(join(carpeta, b.ruta_original)));

    // Una nueva entra en el primer hueco libre, el 1
    const otra = await subir(base, cookie, id, [await imagen()]);
    assert.equal(otra.json.subidas[0].orden, 1);

    const acciones = db.prepare("SELECT accion FROM auditoria WHERE accion LIKE 'fotos_%' OR entidad = 'foto'").all().map((x) => x.accion);
    assert.deepEqual(acciones, ['fotos_subida', 'edicion', 'fotos_orden', 'borrado', 'fotos_subida']);
  }));

test('máximo 25 fotos por coche', () =>
  conServidor(async ({ base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);
    const pequena = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).jpeg().toBuffer();

    assert.equal((await subir(base, cookie, id, Array(24).fill(pequena))).status, 201);
    const demasiadas = await subir(base, cookie, id, [pequena, pequena]);
    assert.equal(demasiadas.status, 409);
    assert.match(demasiadas.json.error, /Caben 1/);
    assert.equal((await subir(base, cookie, id, [pequena])).status, 201);
    assert.equal((await pide(`/fotos/${id}`)).json.length, 25);
  }));

test('dos subidas a la vez no dejan dos fotos en el mismo hueco', () =>
  conServidor(async ({ base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);
    const lote = [await imagen(), await imagen(), await imagen()];

    const [a, b] = await Promise.all([subir(base, cookie, id, lote), subir(base, cookie, id, lote)]);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const ordenes = (await pide(`/fotos/${id}`)).json.map((f) => f.orden);
    assert.deepEqual(ordenes, [1, 2, 3, 4, 5, 6]);
  }));

test('las fotos HEIC del iPhone se rechazan con un aviso claro', () =>
  conServidor(async ({ base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);
    const enviar = async (tipo, nombre) => {
      const form = new FormData();
      form.append('fotos', new Blob([Buffer.from('ftypheic')], { type: tipo }), nombre);
      const res = await fetch(`${base}/fotos/${id}`, { method: 'POST', headers: { cookie }, body: form });
      return { status: res.status, json: await res.json() };
    };

    // Con su tipo, como la manda un Mac
    const conTipo = await enviar('image/heic', 'IMG_0001.HEIC');
    assert.equal(conTipo.status, 415);
    assert.match(conTipo.json.error, /HEIC.*JPG/);

    // Sin tipo, como suele llegar desde Windows: se reconoce por la extensión
    const sinTipo = await enviar('', 'IMG_0002.heic');
    assert.equal(sinTipo.status, 415);
    assert.equal((await pide(`/fotos/${id}`)).json.length, 0);
  }));

test('peticiones mal hechas', () =>
  conServidor(async ({ base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);

    // Sin sesión no se sube nada
    assert.equal((await subir(base, null, id, [await imagen()])).status, 401);

    // Coche que no existe
    assert.equal((await subir(base, cookie, 999, [await imagen()])).status, 404);

    // Un fichero que dice ser imagen y no lo es: no se guarda nada, ni en la base ni en disco
    const enDisco = () => (existsSync(join(carpeta, String(id))) ? readdirSync(join(carpeta, String(id))).length : 0);
    const antes = enDisco();
    const falsa = await subir(base, cookie, id, [Buffer.from('esto no es una foto')]);
    assert.equal(falsa.status, 400);
    assert.equal((await pide(`/fotos/${id}`)).json.length, 0);
    assert.equal(enDisco(), antes);

    // Orden incompleto o con dos fotos en el mismo hueco
    const subidas = (await subir(base, cookie, id, [await imagen(), await imagen()])).json.subidas;
    const [x, y] = subidas;
    const incompleto = await pide(`/fotos/${id}/orden`, { method: 'PUT', body: { fotos: [{ id: x.id, orden: 2 }] } });
    assert.equal(incompleto.status, 400);
    const repetido = await pide(`/fotos/${id}/orden`, { method: 'PUT', body: { fotos: [{ id: x.id, orden: 3 }, { id: y.id, orden: 3 }] } });
    assert.equal(repetido.status, 400);
    const fuera = await pide(`/fotos/${id}/orden`, { method: 'PUT', body: { fotos: [{ id: x.id, orden: 26 }, { id: y.id, orden: 1 }] } });
    assert.equal(fuera.status, 400);

    // Marcas que no son true o false, y una foto de otro coche
    assert.equal((await pide(`/fotos/${id}/${x.id}`, { method: 'PATCH', body: { publica: 'si' } })).status, 400);
    const otro = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '9999 zzz', bastidor: null } })).json;
    assert.equal((await pide(`/fotos/${otro.id}/${x.id}`, { method: 'DELETE' })).status, 404);
  }));

test('las fotos subidas cuentan para poder publicar', () =>
  conServidor(async ({ base, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const cookie = await cookieDe(base);
    const pequena = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).jpeg().toBuffer();

    await subir(base, cookie, id, Array(14).fill(pequena));
    let cambio = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    assert.equal(cambio.status, 409);

    await subir(base, cookie, id, [pequena]);
    cambio = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    assert.equal(cambio.status, 200);
  }));
