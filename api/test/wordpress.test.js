import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirDb } from '../src/db.js';
import { adaptar, diagnosticar, sincronizar, vincular, MAPA_POR_DEFECTO } from '../src/modules/publicacion/wordpress.js';

// --- WordPress simulado: lo justo de la API REST que usa el conector ---------------------------------
function wordpressFalso({ acfExpuesto = false } = {}) {
  const estado = { posts: new Map([[500, { id: 500, title: 'VOLKSWAGEN GOLF A MANO', status: 'publish' }]]), terminos: [], medios: 0, siguiente: 1000, peticiones: [] };
  const ACF = { precio: { type: ['number', 'null'] }, kilometros: { type: ['number', 'null'] }, estado_venta: { type: ['string', 'null'] }, galeria: { type: ['string', 'null'] } };
  const servidor = createServer((req, res) => {
    let cuerpo = [];
    req.on('data', (t) => cuerpo.push(t));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const ruta = url.pathname.replace(/^\/wp-json/, '');
      const json = (codigo, datos) => { res.writeHead(codigo, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(datos)); };
      estado.peticiones.push(`${req.method} ${ruta}`);
      if (req.headers.authorization !== `Basic ${Buffer.from('editor:clave buena').toString('base64')}`) {
        return json(401, { code: 'incorrect_password', message: 'La contraseña no es correcta.' });
      }
      const datos = () => JSON.parse(Buffer.concat(cuerpo).toString() || '{}');
      if (ruta === '/') return json(200, { name: 'WordPress falso' });
      if (ruta === '/wp/v2/users/me') return json(200, { slug: 'editor', roles: ['editor'], capabilities: { publish_posts: true, edit_others_posts: true, upload_files: true, manage_categories: true } });
      if (ruta === '/wp/v2/types/coches') return json(200, { rest_base: 'coches' });
      if (ruta === '/wp/v2/taxonomies/marca') return json(200, { rest_base: 'marca' });
      if (req.method === 'OPTIONS' && ruta === '/wp/v2/coches') {
        return json(200, { schema: { properties: { title: {}, status: {}, slug: {}, marca: {}, id: { readonly: true }, acf: { properties: acfExpuesto ? ACF : [] } } } });
      }
      if (ruta === '/wp/v2/marca' && req.method === 'GET') return json(200, estado.terminos.filter((t) => t.name.toLowerCase().includes(url.searchParams.get('search').toLowerCase())));
      if (ruta === '/wp/v2/marca' && req.method === 'POST') { const t = { id: estado.siguiente++, name: datos().name }; estado.terminos.push(t); return json(201, t); }
      if (ruta === '/wp/v2/media' && req.method === 'POST') {
        assert.match(req.headers['content-disposition'], /filename="PS-\d{5}-\d{2}\.png"/);
        estado.medios++;
        return json(201, { id: estado.siguiente++ });
      }
      const m = ruta.match(/^\/wp\/v2\/coches(?:\/(\d+))?$/);
      if (m && req.method === 'POST') {
        const d = datos();
        if (d.acf && !acfExpuesto) return json(400, { code: 'rest_invalid_param', message: 'acf no admitido' });
        if (m[1]) {
          const post = estado.posts.get(Number(m[1]));
          if (!post) return json(404, { code: 'rest_post_invalid_id', message: 'ID de entrada no válido.' });
          Object.assign(post, d);
          return json(200, post);
        }
        const post = { id: estado.siguiente++, ...d };
        estado.posts.set(post.id, post);
        return json(201, post);
      }
      json(404, { code: 'rest_no_route', message: `Sin ruta ${req.method} ${ruta}` });
    });
  });
  return { servidor, estado };
}

async function conEscenario(opciones, fn) {
  const { servidor, estado } = wordpressFalso(opciones);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const uploads = mkdtempSync(join(tmpdir(), 'ps-wp-'));
  const db = abrirDb(':memory:');
  const cfg = { url: `http://127.0.0.1:${servidor.address().port}`, usuario: 'editor', clave: 'clave buena', tipo: 'coches', taxonomia: 'marca', mapa: MAPA_POR_DEFECTO, uploads, fotosPorPasada: 40 };
  const coche = (id, marca, estadoCoche = 'publicado', fotos = 0) => {
    db.prepare(`INSERT INTO vehiculos (id, matricula, marca, modelo, version, estado, kilometros, pvp_cent, precio_compra_cent)
                VALUES (?, ?, ?, 'Modelo', 'Versión', ?, 50000, 1290000, 900000)`).run(id, `M${id}`, marca, estadoCoche);
    db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);
    for (let f = 1; f <= fotos; f++) {
      mkdirSync(join(uploads, `vehiculos/${id}`), { recursive: true });
      writeFileSync(join(uploads, `vehiculos/${id}/${f}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)').run(id, f, `vehiculos/${id}/${f}.png`);
    }
  };
  try {
    await fn({ db, cfg, estado, coche, servidor });
  } finally {
    servidor.closeAllConnections();
    servidor.close();
    db.close();
    rmSync(uploads, { recursive: true, force: true });
  }
}

// --- Pruebas -----------------------------------------------------------------------------------------

test('diagnóstico: con ACF oculto avisa de que solo van título, estado y marca', () =>
  conEscenario({}, async ({ cfg }) => {
    const d = await diagnosticar(cfg);
    assert.equal(d.autenticado, true);
    assert.equal(d.usuario, 'editor');
    assert.equal(d.acf.expuesto, false);
    assert.ok(d.camposEscribibles.includes('marca') && !d.camposEscribibles.includes('id'));
    assert.ok(d.avisos.some((a) => a.includes('Mostrar en la API REST')));
    assert.ok(d.mapa.every((m) => m.estado === 'ACF no expuesto'));
  }));

test('diagnóstico: contraseña mala no entra y lo dice', () =>
  conEscenario({}, async ({ cfg }) => {
    const d = await diagnosticar({ ...cfg, clave: 'mala' });
    assert.equal(d.autenticado, false);
    assert.match(d.avisos[0], /incorrectos/);
  }));

test('sin ACF: publica título, estado y marca; no sube fotos; la segunda pasada no reenvía', () =>
  conEscenario({}, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    coche(2, 'seat', 'reservado');
    coche(3, 'Kia', 'en_taller');
    const r = await sincronizar(db, cfg);
    assert.equal(r.creados, 2);
    assert.equal(estado.medios, 0, 'sin galería expuesta no se suben fotos');
    const posts = [...estado.posts.values()].filter((p) => p.id !== 500);
    assert.deepEqual(posts.map((p) => p.title).sort(), ['Seat Modelo Versión', 'seat Modelo Versión']);
    assert.ok(posts.every((p) => p.status === 'publish' && p.acf === undefined));
    assert.equal(estado.terminos.length, 1, 'la marca se crea una vez aunque venga en minúsculas');
    assert.deepEqual(posts[0].marca, [estado.terminos[0].id]);

    const otra = await sincronizar(db, cfg);
    assert.equal(otra.sin_cambios, 2);
    assert.equal(estado.peticiones.filter((p) => p.startsWith('POST /wp/v2/coches')).length, 2, 'nada se reenvía');
  }));

test('con ACF: precio en euros, galería y fotos subidas una sola vez', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    await sincronizar(db, cfg);
    const post = [...estado.posts.values()].find((p) => p.title === 'Seat Modelo Versión');
    assert.equal(post.acf.precio, 12900);
    assert.equal(post.acf.kilometros, 50000);
    assert.equal(post.acf.estado_venta, 'publicado');
    assert.equal(post.acf.galeria.split(',').length, 3, 'galería como texto porque el esquema dice string');
    assert.equal(post.acf.precio_compra, undefined);
    assert.equal(estado.medios, 3);

    db.prepare('UPDATE vehiculos SET pvp_cent = 1250000 WHERE id = 1').run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.actualizados, 1);
    assert.equal(post.acf.precio, 12500);
    assert.equal(estado.medios, 3, 'las fotos no se vuelven a subir');
  }));

test('fotos de más: como mucho N por pasada y la siguiente termina', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    const r = await sincronizar(db, { ...cfg, fotosPorPasada: 2 });
    assert.equal(r.fotos_subidas, 2);
    assert.equal(r.fotos_pendientes, 1);
    assert.equal(db.prepare('SELECT huella FROM wp_posts').get().huella, null);
    const r2 = await sincronizar(db, { ...cfg, fotosPorPasada: 2 });
    assert.equal(r2.fotos_subidas, 1);
    assert.equal(estado.medios, 3);
  }));

test('retirar: un coche entregado pasa a borrador, nunca se borra', () =>
  conEscenario({}, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    coche(2, 'Kia');
    await sincronizar(db, cfg);
    db.prepare("UPDATE vehiculos SET estado = 'entregado' WHERE id = 1").run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.retirados, 1);
    const id = db.prepare('SELECT wp_post_id FROM wp_posts WHERE vehiculo_id = 1').get().wp_post_id;
    assert.equal(estado.posts.get(id).status, 'draft');
    assert.equal(db.prepare('SELECT estado FROM wp_posts WHERE vehiculo_id = 1').get().estado, 'retirado');
  }));

test('si borran el post a mano en WordPress, se vuelve a crear', () =>
  conEscenario({}, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    await sincronizar(db, cfg);
    estado.posts.clear();
    db.prepare('UPDATE vehiculos SET pvp_cent = 1 WHERE id = 1').run();
    db.prepare("UPDATE wp_posts SET huella = 'otra'").run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.creados, 1);
    assert.equal(estado.posts.size, 1);
  }));

test('vincular un post que ya existía: se actualiza ese post y no se crea otro', () =>
  conEscenario({}, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Volkswagen');
    vincular(db, 1, 500);
    const r = await sincronizar(db, cfg);
    assert.equal(r.actualizados, 1);
    assert.equal(r.creados, 0);
    assert.equal(estado.posts.get(500).title, 'Volkswagen Modelo Versión');
    coche(2, 'Kia');
    assert.throws(() => vincular(db, 2, 500), /ya es del coche 1/);
  }));

test('WordPress caído o feed vacío: no se toca nada', () =>
  conEscenario({}, async ({ db, cfg, estado, coche, servidor }) => {
    coche(1, 'Seat');
    await sincronizar(db, cfg);
    db.prepare("UPDATE vehiculos SET estado = 'en_taller'").run();
    const vacio = await sincronizar(db, cfg);
    assert.equal(vacio.retirados, 0);
    assert.match(vacio.errores[0], /No se retira nada sin forzar/);
    assert.equal([...estado.posts.values()].filter((p) => p.status === 'publish').length, 2);

    servidor.closeAllConnections();
    await new Promise((r) => servidor.close(r));
    await assert.rejects(sincronizar(db, cfg), /No se puede publicar/);
    assert.equal(db.prepare('SELECT estado FROM wp_posts').get().estado, 'publicado');
  }));

test('adaptar: el valor sigue al tipo que anuncia la web', () => {
  assert.equal(adaptar(12900, { type: ['string', 'null'] }), '12900');
  assert.equal(adaptar('62000', { type: ['number', 'null'] }), 62000);
  assert.equal(adaptar([4, 5], { type: ['string', 'null'] }), '4,5');
  assert.deepEqual(adaptar([4, 5], { type: ['array', 'null'] }), [4, 5]);
  assert.equal(adaptar(null, { type: ['number', 'null'] }), null);
});
