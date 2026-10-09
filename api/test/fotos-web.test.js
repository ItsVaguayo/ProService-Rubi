// Fotos desde la ficha de la web (briefing 4.5): los coches que llegan de Pymecar sin fotos las bajan de WordPress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { abrirDb } from '../src/db.js';
import { configDesdeEntorno, vincular } from '../src/modules/publicacion/wordpress.js';
import { traerFotosDeLaWeb } from '../src/modules/publicacion/fotos-web.js';
import { conServidor } from './ayuda.js';

const png = (color) => sharp({ create: { width: 40, height: 30, channels: 3, background: color } }).png().toBuffer();

// WordPress falso: la ficha 500 con foto destacada (10), galería de ACF opcional y fotos adjuntas
async function webFalsa({ galeria = null } = {}) {
  const imagenes = { '/wp-content/uploads/a.png': await png('red'), '/wp-content/uploads/b.png': await png('blue'), '/wp-content/uploads/c.png': await png('green') };
  const pedidas = [];
  let base;
  const medio = (id, fichero, extra = {}) => ({ id, mime_type: 'image/png', source_url: `${base}/wp-content/uploads/${fichero}`, ...extra });
  // Las direcciones llevan el puerto, que no se sabe hasta arrancar: se construyen al pedirlas
  const medios = () => ({
    10: medio(10, 'a.png'), 11: medio(11, 'b.png'), 12: medio(12, 'c.png'),
    13: { id: 13, mime_type: 'image/png', source_url: 'https://otra-web.example/foto.png' },
    14: medio(14, 'no-es-imagen.png'), 15: { id: 15, mime_type: 'application/pdf', source_url: 'x' },
  });
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    pedidas.push(url.pathname + url.search);
    const json = (datos, codigo = 200) => { res.writeHead(codigo, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(datos)); };
    if (url.pathname.startsWith('/wp-content/')) {
      if (url.pathname.endsWith('no-es-imagen.png')) { res.writeHead(200); return res.end('hola'); }
      const img = imagenes[url.pathname];
      if (!img) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(img);
    }
    const ruta = url.pathname.replace(/^\/wp-json/, '');
    if (ruta === '/wp/v2/types/coches') return json({ rest_base: 'coches' });
    if (ruta === '/wp/v2/coches/500') return json({ id: 500, featured_media: 10, acf: galeria ? { galeria } : {} });
    const m = ruta.match(/^\/wp\/v2\/media\/(\d+)$/);
    if (m) return medios()[m[1]] ? json(medios()[m[1]]) : json({ code: 'rest_post_invalid_id' }, 404);
    if (ruta === '/wp/v2/media' && url.searchParams.get('parent') === '500') return json([10, 13, 11, 14, 15, 12].map((id) => medios()[id]));
    json({ code: 'rest_no_route' }, 404);
  });
  await new Promise((r) => servidor.listen(0, r));
  base = `http://localhost:${servidor.address().port}`;
  return { base, pedidas, cerrar: () => servidor.close() };
}

async function preparar(opciones) {
  const web = await webFalsa(opciones);
  const uploads = mkdtempSync(join(tmpdir(), 'fotos-web-'));
  const db = abrirDb(':memory:');
  const id = Number(db.prepare("INSERT INTO vehiculos (matricula, marca, modelo, estado) VALUES ('0000AAA', 'Seat', 'Ibiza', 'pendiente_fotos')").run().lastInsertRowid);
  db.prepare("UPDATE vehiculos SET referencia = 'PS-00001' WHERE id = ?").run(id);
  const cfg = configDesdeEntorno({ WP_URL: web.base, WP_USUARIO: 'editor', WP_CLAVE_APLICACION: 'clave', UPLOADS_PATH: uploads });
  const fin = () => { web.cerrar(); db.close(); rmSync(uploads, { recursive: true, force: true }); };
  return { web, uploads, db, id, cfg, fin };
}

test('fotos de la web: destacada primero y después las adjuntas; nada de fuera del dominio ni lo que no es imagen', async () => {
  const { db, id, cfg, uploads, fin } = await preparar();
  try {
    vincular(db, id, 500);
    const r = await traerFotosDeLaWeb(db, cfg, id, { usuarioId: null });
    assert.equal(r.traidas, 3);
    assert.equal(r.saltadas.length, 2);
    assert.match(r.saltadas.join(' | '), /13: está fuera de localhost:\d+ \| 14: /);
    const fotos = db.prepare('SELECT f.orden, f.ruta_original, f.publica, m.wp_media_id FROM fotos f JOIN wp_medios m ON m.foto_id = f.id WHERE f.vehiculo_id = ? ORDER BY f.orden').all(id);
    assert.deepEqual(fotos.map((f) => [f.orden, f.wp_media_id, f.publica]), [[1, 10, 1], [2, 11, 1], [3, 12, 1]], 'la sincronización no las vuelve a subir');
    const jpg = readFileSync(join(uploads, fotos[0].ruta_original));
    assert.equal((await sharp(jpg).metadata()).format, 'jpeg', 'reducidas a JPG como las del panel');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'fotos_desde_web'").get().n, 1);

    // Con fotos ya no se traen otra vez
    await assert.rejects(traerFotosDeLaWeb(db, cfg, id), { status: 409, message: /ya tiene fotos/ });
  } finally { fin(); }
});

test('fotos de la web: con la galería de ACF expuesta, en su orden', async () => {
  const { db, id, cfg, web, fin } = await preparar({ galeria: [12, { id: 11 }, 99] });
  try {
    vincular(db, id, 500);
    const r = await traerFotosDeLaWeb(db, cfg, id);
    assert.equal(r.traidas, 3);
    assert.deepEqual(db.prepare('SELECT m.wp_media_id FROM fotos f JOIN wp_medios m ON m.foto_id = f.id WHERE f.vehiculo_id = ? ORDER BY f.orden').all(id).map((f) => f.wp_media_id), [10, 12, 11]);
    assert.ok(!web.pedidas.some((p) => p.includes('parent=')), 'con galería no hacen falta las adjuntas');
  } finally { fin(); }
});

test('fotos de la web: sin vincular, o un coche que no existe', async () => {
  const { db, id, cfg, uploads, fin } = await preparar();
  try {
    await assert.rejects(traerFotosDeLaWeb(db, cfg, id), { status: 409, message: /no está vinculado/ });
    await assert.rejects(traerFotosDeLaWeb(db, cfg, 999), { status: 404 });
    assert.equal(existsSync(join(uploads, String(id))), false);
  } finally { fin(); }
});

test('fotos de la web: las rutas son de gerencia y necesitan WordPress configurado', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/wordpress/fotos/1', { method: 'POST', como: 'comercial' })).status, 403);
    const sinWp = await pide('/wordpress/fotos/1', { method: 'POST' });
    assert.equal(sinWp.status, 503, 'sin WP_URL');
    assert.equal((await pide('/wordpress/fotos/abc', { method: 'POST' })).status, 404);
  }));
