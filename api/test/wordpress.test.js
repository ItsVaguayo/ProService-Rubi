import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirDb } from '../src/db.js';
import { adaptar, convertir, diagnosticar, sincronizar, vincular, MAPA_POR_DEFECTO } from '../src/modules/publicacion/wordpress.js';

// --- WordPress simulado: lo justo de la API REST que usa el conector ---------------------------------
// El grupo ACF con los campos y opciones que expone proservicerubi.com (leídos el 30-oct-2026)
const lista = (opciones, unica = false) => ({ type: ['string', 'array', 'int', 'null'], items: { type: ['string', 'int'], enum: opciones }, ...(unica ? { maxItems: 1 } : {}) });
const ACF_REAL = {
  precio: { type: ['number', 'null'], required: true }, financiado: { type: ['number', 'null'] },
  estado_coche: { ...lista(['En venta', 'Reservado', 'Vendido'], true), required: true }, imagen_principal: { type: ['integer', 'null'] },
  video: { type: ['string', 'null'] }, ano: { type: ['string', 'null'] },
  combustible: lista(['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'], true), kilometros: { type: ['number', 'null'] },
  cilindrada: { type: ['string', 'null'] }, potencia_cv: { type: ['number', 'null'] }, cambio: lista(['Manual', 'Automático'], true),
  uso_anterior: lista(['Particular', 'Empresa'], true),
  extras: { ...lista(['Aire acondicionado', 'Bluetooth', 'Cámara trasera', 'Climatizador', 'GPS', 'Llantas aleación', 'Techo solar']), type: ['integer', 'string', 'array', 'null'] },
  colores: { ...lista(['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul', 'Verde', 'Marrón Turmalina']), type: ['integer', 'string', 'array', 'null'] },
  referencia: { type: ['string', 'null'] },
};

function wordpressFalso({ acfExpuesto = false, sin = [], conCondiciones = false } = {}) {
  const estado = { posts: new Map([[500, { id: 500, title: 'VOLKSWAGEN GOLF A MANO', status: 'publish' }]]), terminos: [], medios: 0, adjuntos: new Map(), siguiente: 1000, peticiones: [] };
  const ACF = Object.fromEntries(Object.entries(ACF_REAL).filter(([k]) => !sin.includes(k)));
  if (conCondiciones) ACF.cuota_condiciones = { type: ['string', 'null'] };
  // Las 3 fotos que subieron a mano en la ficha del Golf (post 500)
  for (const id of [501, 502, 503]) estado.adjuntos.set(id, 500);
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
      if (ruta === '/wp/v2/media' && req.method === 'GET') {
        if (url.searchParams.get('include')) {
          return json(200, url.searchParams.get('include').split(',').map(Number).filter((id) => estado.adjuntos.has(id)).map((id) => ({ id, post: estado.adjuntos.get(id) })));
        }
        const padre = Number(url.searchParams.get('parent'));
        const pagina = Number(url.searchParams.get('page') || 1);
        const todas = [...estado.adjuntos].filter(([, p]) => p === padre).map(([id]) => ({ id }));
        if (pagina > 1 && todas.length <= (pagina - 1) * 100) return json(400, { code: 'rest_post_invalid_page_number', message: 'Página no válida' });
        return json(200, todas.slice((pagina - 1) * 100, pagina * 100));
      }
      if (ruta === '/wp/v2/media' && req.method === 'POST') {
        if (estado.fallarSubida) { estado.fallarSubida = false; return json(500, { code: 'error', message: 'Error al subir' }); }
        assert.match(req.headers['content-disposition'], /filename="PS-\d{5}-\d{2}\.png"/);
        // Como WordPress: no deja adjuntar a un post que no existe
        if (url.searchParams.get('post') && !estado.posts.has(Number(url.searchParams.get('post')))) return json(403, { code: 'rest_cannot_edit', message: 'No puedes editar este post' });
        estado.medios++;
        const id = estado.siguiente++;
        estado.adjuntos.set(id, Number(url.searchParams.get('post')) || 0);
        return json(201, { id });
      }
      const medio = ruta.match(/^\/wp\/v2\/media\/(\d+)$/);
      if (medio && req.method === 'GET') return json(200, { post: estado.adjuntos.get(Number(medio[1])) ?? 0 });
      if (medio && req.method === 'POST') {
        estado.adjuntos.set(Number(medio[1]), datos().post);
        return json(200, { id: Number(medio[1]), post: datos().post });
      }
      const m = ruta.match(/^\/wp\/v2\/coches(?:\/(\d+))?$/);
      if (m?.[1] && req.method === 'GET') {
        return estado.posts.has(Number(m[1])) ? json(200, { id: Number(m[1]) }) : json(404, { code: 'rest_post_invalid_id', message: 'ID de entrada no válido.' });
      }
      if (m && req.method === 'POST') {
        const d = datos();
        if (d.acf && !acfExpuesto) return json(400, { code: 'rest_invalid_param', message: 'acf no admitido' });
        // Como ACF: sin un campo obligatorio, o con un valor fuera de las opciones de una lista, rechaza el post entero
        if (d.acf && Object.entries(ACF).some(([campo, e]) => e.required && !(campo in d.acf))) return json(400, { code: 'rest_invalid_param', message: 'Invalid parameter(s): acf' });
        for (const [campo, valor] of Object.entries(d.acf ?? {})) {
          const opciones = ACF[campo]?.items?.enum;
          if (opciones && [].concat(valor ?? []).some((x) => !opciones.includes(x))) return json(400, { code: 'rest_invalid_param', message: `acf[${campo}] no es una opción` });
        }
        if (m[1]) {
          const post = estado.posts.get(Number(m[1]));
          if (!post) return json(404, { code: 'rest_post_invalid_id', message: 'ID de entrada no válido.' });
          // Como ACF por REST: solo cambian los campos que llegan
          Object.assign(post, d, d.acf ? { acf: { ...post.acf, ...d.acf } } : {});
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
    db.prepare(`INSERT INTO vehiculos (id, matricula, marca, modelo, version, estado, kilometros, combustible, pvp_cent, precio_compra_cent)
                VALUES (?, ?, ?, 'Modelo', 'Versión', ?, 50000, 'diesel', 1290000, 900000)`).run(id, `M${id}`, marca, estadoCoche);
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

const postDe = (estado, titulo = 'Seat Modelo Versión') => [...estado.posts.values()].find((p) => p.title === titulo);

test('diagnóstico: con su grupo ACF real el mapa casa entero; solo falta cuota_condiciones, con su aviso', () =>
  conEscenario({ acfExpuesto: true }, async ({ cfg }) => {
    const d = await diagnosticar(cfg);
    assert.deepEqual(d.mapa.filter((m) => m.estado !== 'ok').map((m) => m.campo), ['cuota_condiciones']);
    assert.ok(!d.avisos.some((a) => a.startsWith('Campos del mapa')), 'cuota_condiciones es opcional');
    assert.ok(d.avisos.some((a) => /cuota «Desde X €\/mes» pero no tiene el campo cuota_condiciones/.test(a)),
      'sin el ejemplo con la TAE, la cuota sola no cumple: aviso aparte');
  }));

test('diagnóstico: si quitan un campo del grupo, lo dice', () =>
  conEscenario({ acfExpuesto: true, sin: ['referencia'] }, async ({ cfg }) => {
    const d = await diagnosticar(cfg);
    assert.match(d.avisos.find((a) => a.startsWith('Campos del mapa')), /referencia/);
  }));

test('diagnóstico: con cuota_condiciones en la web no hay aviso de la cuota', () =>
  conEscenario({ acfExpuesto: true, conCondiciones: true }, async ({ cfg }) => {
    const d = await diagnosticar(cfg);
    assert.ok(!d.avisos.some((a) => /cuota_condiciones/.test(a)));
  }));

test('con ACF: la cuota «Desde X €/mes» va en «financiado», del precio si financia o del PVP, y sigue a los cambios', () =>
  conEscenario({ acfExpuesto: true, conCondiciones: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    await sincronizar(db, cfg);
    const post = postDe(estado);
    assert.equal(post.acf.financiado, 154, '12.900 € al 7,5 % en 120 meses');
    assert.match(post.acf.cuota_condiciones, /^Ejemplo para 12\.900 € sin entrada: 120 cuotas de 153,13 €, TIN 7,50 %, TAE 7,76 %, importe total adeudado 18\.375,60 €/);

    db.prepare('UPDATE vehiculos SET precio_financiado_cent = 1000000 WHERE id = 1').run();
    assert.equal((await sincronizar(db, cfg)).actualizados, 1);
    assert.equal(post.acf.financiado, 119, 'con precio si financia, sobre ese');
    assert.match(post.acf.cuota_condiciones, /^Ejemplo para 10\.000 € sin entrada: 120 cuotas de 118,70 €/, 'el ejemplo sigue al precio');
    assert.equal(post.acf.precio, 12900, 'el precio de la web sigue siendo el PVP');

    assert.equal((await sincronizar(db, { ...cfg, cuota: null })).actualizados, 1);
    assert.equal(post.acf.financiado, null, 'apagada (CUOTA_MESES=0) se vacía en la web');
  }));

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
    assert.equal(estado.medios, 0, 'sin ACF expuesto no se suben fotos');
    const posts = [...estado.posts.values()].filter((p) => p.id !== 500);
    assert.deepEqual(posts.map((p) => p.title).sort(), ['Seat Modelo Versión', 'seat Modelo Versión']);
    assert.ok(posts.every((p) => p.status === 'publish' && p.acf === undefined));
    assert.equal(estado.terminos.length, 1, 'la marca se crea una vez aunque venga en minúsculas');
    assert.deepEqual(posts[0].marca, [estado.terminos[0].id]);

    const otra = await sincronizar(db, cfg);
    assert.equal(otra.sin_cambios, 2);
    assert.equal(estado.peticiones.filter((p) => p.startsWith('POST /wp/v2/coches')).length, 2, 'nada se reenvía');
  }));

test('con ACF: sus nombres de campo, fotos adjuntas al post con la primera de principal, y subidas una sola vez', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    const r = await sincronizar(db, cfg);
    assert.deepEqual(r.errores, []);
    const post = postDe(estado);
    assert.equal(post.acf.precio, 12900);
    assert.equal(post.acf.kilometros, 50000);
    assert.equal(post.acf.estado_coche, 'En venta', 'el estado con el texto de su web');
    assert.equal(post.acf.combustible, 'Diésel', 'el combustible con su mayúscula y su acento');
    assert.equal(post.acf.referencia, 'PS-00001');
    assert.equal(post.acf.precio_compra, undefined);
    assert.equal(estado.medios, 3);
    const adjuntas = [...estado.adjuntos].filter(([, p]) => p === post.id).map(([id]) => id);
    assert.equal(adjuntas.length, 3, 'su galería son las fotos adjuntas al post');
    assert.equal(post.acf.imagen_principal, adjuntas[0], 'la primera, de foto principal');

    db.prepare('UPDATE vehiculos SET pvp_cent = 1250000 WHERE id = 1').run();
    assert.equal((await sincronizar(db, cfg)).actualizados, 1);
    assert.equal(post.acf.precio, 12500);
    assert.equal(estado.medios, 3, 'las fotos no se vuelven a subir');
    assert.equal(estado.peticiones.filter((p) => p === 'GET /wp/v2/media').length, 1, 'lo adjunto se repasa solo cuando cambian las fotos');
  }));

test('con ACF: año como fecha Ymd, cambio, potencia, cilindrada como texto, colores y extras en su lista', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    db.prepare(`UPDATE vehiculos SET fecha_matriculacion = '2019-03-02', anio = 2019, cambio = 'automatico', potencia_cv = 150,
                cilindrada = 1498, color_exterior = 'gris oscuro' WHERE id = 1`).run();
    for (const extra of ['Navegador', 'Bluetooth', 'Cámara de marcha atrás', 'Apple CarPlay']) {
      db.prepare('INSERT INTO vehiculo_extras (vehiculo_id, extra_id) SELECT 1, id FROM extras WHERE nombre = ?').run(extra);
    }
    coche(2, 'Kia');
    db.prepare("UPDATE vehiculos SET anio = 2017, combustible = 'glp', color_exterior = 'morado' WHERE id = 2").run();

    const r = await sincronizar(db, cfg);
    assert.deepEqual(r.errores, [], 'nada fuera de sus opciones llega a WordPress');
    const seat = postDe(estado).acf;
    assert.equal(seat.ano, '20190302');
    assert.equal(seat.cambio, 'Automático');
    assert.equal(seat.potencia_cv, 150);
    assert.equal(seat.cilindrada, '1498', 'su cilindrada es texto');
    assert.deepEqual(seat.colores, ['Gris'], '«gris oscuro» cae en «Gris»');
    assert.deepEqual(seat.extras.sort(), ['Bluetooth', 'Cámara trasera', 'GPS'], 'Apple CarPlay no está en su lista');

    const kia = postDe(estado, 'Kia Modelo Versión').acf;
    assert.equal(kia.ano, '20170101', 'sin fecha de matriculación, el 1 de enero del año');
    assert.equal(kia.combustible, null, 'fuera de sus opciones se vacía: no se queda el valor de antes');
    assert.deepEqual(kia.colores, []);
    assert.ok(r.avisos.some((a) => a === 'PS-00002: «GLP» no está entre las opciones de «combustible» de la web: no se manda'));
    assert.ok(r.avisos.some((a) => a.startsWith('PS-00002: «Morado» no está entre las opciones de «colores»')));
    assert.ok(r.avisos.some((a) => a.startsWith('PS-00001: «Apple CarPlay»')));

    assert.ok(!(await sincronizar(db, cfg)).avisos.some((a) => a.startsWith('PS-')), 'sin cambios no se repiten los avisos');
  }));

test('la referencia viaja a su campo; si un día lo quitan, se salta sin error', () =>
  conEscenario({ acfExpuesto: true, sin: ['referencia'] }, async ({ db, cfg, estado, coche }) => {
    coche(7, 'Seat');
    const r = await sincronizar(db, cfg);
    assert.deepEqual(r.errores, []);
    const post = postDe(estado);
    assert.equal(post.acf.referencia, undefined);
    assert.equal(post.acf.precio, 12900, 'lo demás llega igual');
  }));

test('solo se suben las fotos públicas que no son de daños', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    db.prepare('UPDATE fotos SET es_dano = 1 WHERE orden = 2').run();
    db.prepare('UPDATE fotos SET publica = 0 WHERE orden = 3').run();
    await sincronizar(db, cfg);
    assert.equal(estado.medios, 1);
    assert.ok(postDe(estado).acf.imagen_principal);
  }));

test('una reserva vencida se cierra antes de publicar: sale «En venta», no «Reservado»', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'reservado');
    db.prepare("INSERT INTO reservas (vehiculo_id, cliente, senal_cent, caduca_en) VALUES (1, 'Marta', 50000, datetime('now', '-1 hour'))").run();
    await sincronizar(db, cfg);
    assert.equal(postDe(estado).acf.estado_coche, 'En venta');
    assert.equal(db.prepare('SELECT estado FROM vehiculos WHERE id = 1').get().estado, 'publicado');
  }));

test('fotos de más: como mucho N por pasada y la siguiente termina y pone la principal', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    const r = await sincronizar(db, { ...cfg, fotosPorPasada: 2 });
    assert.equal(r.fotos_subidas, 2);
    assert.equal(r.fotos_pendientes, 1);
    assert.equal(db.prepare('SELECT huella FROM wp_posts').get().huella, null);
    assert.equal(postDe(estado).acf.imagen_principal, undefined, 'la principal espera a tenerlas todas');
    const r2 = await sincronizar(db, { ...cfg, fotosPorPasada: 2 });
    assert.equal(r2.fotos_subidas, 1);
    assert.equal(estado.medios, 3);
    assert.ok(postDe(estado).acf.imagen_principal);
    assert.equal([...estado.adjuntos.values()].filter((p) => p === postDe(estado).id).length, 3);
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

test('si borran el post a mano en WordPress, se vuelve a crear y le adjunta las fotos que ya estaban subidas', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    estado.posts.clear();
    for (const id of estado.adjuntos.keys()) estado.adjuntos.set(id, 0); // como WordPress: al borrar el post, sus adjuntas quedan sueltas
    db.prepare('UPDATE vehiculos SET pvp_cent = 1 WHERE id = 1').run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.creados, 1);
    assert.equal(estado.posts.size, 1);
    await sincronizar(db, cfg);
    const nuevo = [...estado.posts.values()][0];
    assert.equal(estado.medios, 2, 'no se vuelven a subir');
    assert.equal([...estado.adjuntos.values()].filter((p) => p === nuevo.id).length, 2, 'se adjuntan al post nuevo');
    assert.ok(nuevo.acf.imagen_principal);
  }));

test('una foto que se oculta en el panel se desadjunta del post (no se borra de su biblioteca)', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 3);
    await sincronizar(db, cfg);
    const post = postDe(estado);
    const oculta = db.prepare('SELECT wp_media_id FROM wp_medios m JOIN fotos f ON f.id = m.foto_id WHERE f.orden = 1').get().wp_media_id;
    db.prepare('UPDATE fotos SET publica = 0 WHERE orden = 1').run();
    await sincronizar(db, cfg);
    assert.equal(estado.adjuntos.get(oculta), 0, 'desadjuntada');
    assert.equal([...estado.adjuntos.values()].filter((p) => p === post.id).length, 2);
    assert.notEqual(post.acf.imagen_principal, oculta, 'la principal pasa a la siguiente');
    // Una foto nueva después: entra sin que la oculta cuente como «subida a mano»
    db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, 4, 'vehiculos/1/1.png')").run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.fotos_subidas, 1);
    assert.ok(!r.avisos.some((a) => /subidas a mano/.test(a)));
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

test('vincular una ficha hecha a mano con sus fotos: los datos se mandan, las fotos no se mezclan con las suyas', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Volkswagen', 'publicado', 2);
    vincular(db, 1, 500);
    const r = await sincronizar(db, cfg);
    assert.equal(estado.medios, 0);
    assert.equal(estado.posts.get(500).acf.precio, 12900);
    assert.equal(estado.posts.get(500).acf.imagen_principal, undefined, 'su foto principal se queda');
    assert.ok(r.avisos.some((a) => /el post 500 ya tiene 3 fotos subidas a mano/.test(a)));
    const otra = await sincronizar(db, cfg);
    assert.equal(otra.sin_cambios, 1, 'bloqueada, no se reenvía');
    assert.equal(estado.peticiones.filter((p) => p === 'GET /wp/v2/media').length, 1, 'ni se vuelve a mirar en cada pasada');

    // Las quitan del post en WordPress y vuelven a vincular: suben las nuestras
    estado.adjuntos.clear();
    vincular(db, 1, 500);
    await sincronizar(db, cfg);
    assert.equal(estado.medios, 2);
    assert.ok(estado.posts.get(500).acf.imagen_principal);
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

test('si falla una foto tras crear el post, la pasada siguiente sigue con ese post y no crea otro', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    estado.fallarSubida = true;
    const r = await sincronizar(db, cfg);
    assert.match(r.errores[0], /PS-00001: Error al subir/);
    await sincronizar(db, cfg);
    assert.equal([...estado.posts.values()].filter((p) => p.title === 'Seat Modelo Versión').length, 1);
    assert.ok(postDe(estado).acf.imagen_principal);
  }));

test('un formato viejo de WP_MAPA («galeria») se avisa y no se manda', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 1);
    const mapa = { pvp_cent: MAPA_POR_DEFECTO.pvp_cent, estado: MAPA_POR_DEFECTO.estado, fotos: MAPA_POR_DEFECTO.fotos, viejo: { acf: 'video', formato: 'galeria' } };
    const r = await sincronizar(db, { ...cfg, mapa });
    assert.deepEqual(r.errores, []);
    assert.ok(r.avisos.some((a) => /Formatos de WP_MAPA que el conector no entiende y no se mandan: viejo \(galeria\)/.test(a)));
    assert.ok(postDe(estado).acf.imagen_principal);
    assert.equal(postDe(estado).acf.video, undefined);
  }));

test('vincular una ficha sin fotos nuestras todavía no la bloquea: «Traer fotos» puede importar las suyas', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Volkswagen');
    vincular(db, 1, 500);
    await sincronizar(db, cfg);
    assert.equal(db.prepare('SELECT fotos_propias FROM wp_posts').get().fotos_propias, 0, 'sin mirar todavía');
    // Lo que hace «Traer fotos de la web»: sus 3 fotos pasan a ser nuestras, con su id de WordPress
    for (const [i, id] of [501, 502, 503].entries()) {
      const f = db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, ?, 'x.jpg')").run(i + 1).lastInsertRowid;
      db.prepare('INSERT INTO wp_medios (foto_id, wp_media_id) VALUES (?, ?)').run(f, id);
    }
    const r = await sincronizar(db, cfg);
    assert.ok(!r.avisos.some((a) => /subidas a mano/.test(a)));
    assert.equal(db.prepare('SELECT fotos_propias FROM wp_posts').get().fotos_propias, 1, 'todas las nuestras ya están en ella: sin mezcla, queda decidida');
    assert.equal(estado.posts.get(500).acf.imagen_principal, 501);
  }));

test('ficha bloqueada: el motivo queda en el estado del coche, no solo en la pasada que lo vio', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, coche }) => {
    coche(1, 'Volkswagen', 'publicado', 1);
    vincular(db, 1, 500);
    await sincronizar(db, cfg);
    db.prepare('UPDATE vehiculos SET pvp_cent = 1300000 WHERE id = 1').run();
    await sincronizar(db, cfg);
    const fila = db.prepare('SELECT ultimo_error, avisos FROM wp_posts').get();
    assert.match(fila.avisos, /post 500 ya tiene otras fotos subidas a mano/);
    assert.equal(fila.ultimo_error, null, 'es un aviso, no un error');
  }));

test('sin ninguna foto pública se vacía la foto principal; lo que suban a mano a un post nuestro no se toca', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    const post = postDe(estado);
    estado.adjuntos.set(9000, post.id); // la sube Francesc a mano
    db.prepare('UPDATE fotos SET publica = 0').run();
    await sincronizar(db, cfg);
    assert.equal(post.acf.imagen_principal, null);
    assert.deepEqual([...estado.adjuntos].filter(([, p]) => p === post.id).map(([id]) => id), [9000], 'las nuestras fuera, la suya se queda');
  }));

test('un campo obligatorio de su web sin valor: error claro y no se manda nada', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    db.prepare('UPDATE vehiculos SET pvp_cent = NULL WHERE id = 1').run();
    const r = await sincronizar(db, cfg);
    assert.match(r.errores[0], /PS-00001: falta «precio», obligatorio en la web/);
    assert.equal(estado.posts.size, 1, 'no se crea el post');
    const d = await diagnosticar({ ...cfg, mapa: { estado: MAPA_POR_DEFECTO.estado } });
    assert.ok(d.avisos.some((a) => /obligatorios de la web que el mapa no rellena: precio/.test(a)));
  }));

test('WP_MAPA sin formato manda texto, como antes', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat');
    db.prepare("UPDATE vehiculos SET video_url = 'https://youtu.be/x' WHERE id = 1").run();
    await sincronizar(db, { ...cfg, mapa: { ...MAPA_POR_DEFECTO, video_url: { acf: 'video' } } });
    assert.equal(postDe(estado).acf.video, 'https://youtu.be/x');
  }));

test('más de 100 fotos adjuntas: se piden todas, de 100 en 100', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    for (let id = 2000; id < 2100; id++) estado.adjuntos.set(id, 500); // justo 100 más las 3 suyas: 103
    coche(1, 'Volkswagen', 'publicado', 1);
    vincular(db, 1, 500);
    const r = await sincronizar(db, cfg);
    assert.ok(r.avisos.some((a) => /post 500 ya tiene 103 fotos/.test(a)));
  }));

test('fotos de daños o privadas no cuentan para decidir el bloqueo de una ficha vinculada', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, coche }) => {
    coche(1, 'Volkswagen', 'publicado', 1);
    db.prepare('UPDATE fotos SET es_dano = 1').run();
    vincular(db, 1, 500);
    await sincronizar(db, cfg);
    assert.equal(db.prepare('SELECT fotos_propias FROM wp_posts').get().fotos_propias, 0, 'sin decidir');
  }));

test('una foto nuestra adjunta a otra ficha no se mueve a esta', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 1);
    await sincronizar(db, cfg);
    const post = postDe(estado);
    const id = db.prepare('SELECT wp_media_id FROM wp_medios').get().wp_media_id;
    estado.adjuntos.set(id, 777); // alguien la reutilizó en otra ficha
    db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, 2, 'vehiculos/1/1.png')").run();
    await sincronizar(db, cfg);
    assert.equal(estado.adjuntos.get(id), 777);
    assert.ok(post.acf.imagen_principal);
  }));

test('los avisos de opciones quedan en el estado del coche, no solo en la primera pasada', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, coche }) => {
    coche(1, 'Seat', 'publicado', 1);
    db.prepare("UPDATE vehiculos SET combustible = 'glp' WHERE id = 1").run();
    await sincronizar(db, cfg);
    assert.equal((await sincronizar(db, cfg)).sin_cambios, 1);
    assert.match(db.prepare('SELECT avisos FROM wp_posts').get().avisos, /«GLP» no está entre las opciones de «combustible»/);
  }));

test('post borrado a mano con una foto nueva por subir: se vuelve a crear en vez de fallar en cada pasada', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 1);
    await sincronizar(db, cfg);
    estado.posts.clear();
    db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, 2, 'vehiculos/1/1.png')").run();
    const r = await sincronizar(db, cfg);
    assert.deepEqual(r.errores, []);
    assert.equal(r.creados, 1);
    await sincronizar(db, cfg);
    assert.ok(postDe(estado).acf.imagen_principal);
  }));

test('un error viejo se borra del estado aunque el coche no cambie', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, coche }) => {
    coche(1, 'Seat');
    await sincronizar(db, cfg);
    db.prepare("UPDATE wp_posts SET ultimo_error = 'tiempo agotado'").run();
    assert.equal((await sincronizar(db, cfg)).sin_cambios, 1);
    assert.equal(db.prepare('SELECT ultimo_error FROM wp_posts').get().ultimo_error, null);
  }));

test('revincular el mismo post conserva lo que se cuadró: una foto nuestra borrada no cuenta como ajena', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    const post = postDe(estado);
    db.prepare('DELETE FROM fotos WHERE orden = 1').run(); // se borra en el panel (y su fila de wp_medios con ella)
    db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, 3, 'vehiculos/1/2.png')").run();
    vincular(db, 1, post.id);
    const r = await sincronizar(db, cfg);
    assert.ok(!r.avisos.some((a) => /subidas a mano/.test(a)));
    assert.equal([...estado.adjuntos.values()].filter((p) => p === post.id).length, 2, 'la borrada fuera, la nueva dentro');
  }));

test('sin campo de foto principal en su web, las fotos se suben igual adjuntas al post', () =>
  conEscenario({ acfExpuesto: true, sin: ['imagen_principal'] }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    assert.equal([...estado.adjuntos.values()].filter((p) => p === postDe(estado).id).length, 2);
    assert.equal(postDe(estado).acf.imagen_principal, undefined);
  }));

test('vincular a una ficha hecha a mano un coche cuyas fotos están en otro post: se bloquea, no se mezcla', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    vincular(db, 1, 500);
    const r = await sincronizar(db, cfg);
    assert.ok(r.avisos.some((a) => /post 500 ya tiene 3 fotos subidas a mano/.test(a)));
    assert.equal(estado.posts.get(500).acf.imagen_principal, undefined);
  }));

test('una ficha con sus fotos traídas de la web queda decidida: una foto nueva después se sube sin bloquear', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Volkswagen');
    vincular(db, 1, 500);
    // «Traer fotos» trajo 2 de sus 3 (la 503 se quedó sin traer)
    for (const [i, id] of [501, 502].entries()) {
      const f = db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, ?, 'x.jpg')").run(i + 1).lastInsertRowid;
      db.prepare('INSERT INTO wp_medios (foto_id, wp_media_id) VALUES (?, ?)').run(f, id);
    }
    await sincronizar(db, cfg);
    assert.equal(db.prepare('SELECT fotos_propias FROM wp_posts').get().fotos_propias, 1);
    mkdirSync(join(cfg.uploads, 'v'), { recursive: true });
    writeFileSync(join(cfg.uploads, 'v/n.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    db.prepare("INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (1, 3, 'v/n.png')").run();
    const r = await sincronizar(db, cfg);
    assert.equal(r.fotos_subidas, 1);
    assert.ok(!r.avisos.some((a) => /subidas a mano/.test(a)));
    assert.equal(estado.adjuntos.get(503), 500, 'la suya que no se trajo, intacta');
  }));

test('una foto borrada de su biblioteca se vuelve a subir', () =>
  conEscenario({ acfExpuesto: true }, async ({ db, cfg, estado, coche }) => {
    coche(1, 'Seat', 'publicado', 2);
    await sincronizar(db, cfg);
    const id = db.prepare('SELECT wp_media_id FROM wp_medios LIMIT 1').get().wp_media_id;
    estado.adjuntos.delete(id); // la borran de Medios
    db.prepare("UPDATE wp_posts SET fotos_huella = NULL").run();
    await sincronizar(db, cfg);
    await sincronizar(db, cfg);
    assert.equal(estado.medios, 3, 'se sube otra vez');
    assert.equal([...estado.adjuntos.values()].filter((p) => p === postDe(estado).id).length, 2);
  }));

test('convertir: traduce valores, euros, mayúsculas y listas', () => {
  assert.equal(convertir('reservado', MAPA_POR_DEFECTO.estado), 'Reservado');
  assert.equal(convertir('vendido', MAPA_POR_DEFECTO.estado), 'Vendido');
  assert.equal(convertir('otro', MAPA_POR_DEFECTO.estado), 'otro', 'un valor sin traducción pasa tal cual');
  assert.equal(convertir(1290000, MAPA_POR_DEFECTO.pvp_cent), 12900);
  assert.deepEqual(convertir('negro', MAPA_POR_DEFECTO.color_exterior), ['Negro'], 'un color suelto, lista de uno');
  assert.deepEqual(convertir(['Navegador', 'Bluetooth'], MAPA_POR_DEFECTO.extras), ['GPS', 'Bluetooth']);
  assert.equal(convertir(null, MAPA_POR_DEFECTO.estado), null);
});

test('adaptar: el valor sigue al tipo que anuncia la web, y a sus opciones cerradas', () => {
  assert.equal(adaptar(12900, { type: ['string', 'null'] }), '12900');
  assert.equal(adaptar('62000', { type: ['number', 'null'] }), 62000);
  assert.equal(adaptar([4, 5], { type: ['string', 'null'] }), '4,5');
  assert.deepEqual(adaptar([4, 5], { type: ['array', 'null'] }), [4, 5]);
  assert.equal(adaptar(null, { type: ['number', 'null'] }), null);
  const colores = { type: ['string', 'array', 'null'], items: { enum: ['Blanco', 'Gris', 'Marrón Turmalina'] } };
  assert.deepEqual(adaptar(['marron turmalina', 'Gris perla', 'Morado'], colores), ['Marrón Turmalina', 'Gris']);
  assert.equal(adaptar('diesel', { type: ['string', 'null'], items: { enum: ['Gasolina', 'Diésel'] } }), 'Diésel');
  assert.equal(adaptar('GLP', { type: ['string', 'null'], items: { enum: ['Gasolina', 'Diésel'] } }), null);
  assert.equal(adaptar('Azul marino metalizado', { type: ['string'], items: { enum: ['Azul', 'Azul marino'] } }), 'Azul marino', 'la opción más larga que encaja');
  const fuera = [];
  adaptar(['Rojo', 'Morado'], colores, fuera);
  assert.deepEqual(fuera, ['Rojo', 'Morado'], 'los que no están en sus opciones se apuntan');
});
