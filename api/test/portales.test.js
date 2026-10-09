// Portales a mano: anuncio listo para copiar, marcar publicado con su enlace y confirmar la baja al vender.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';

async function publicado(db, pide, cambios = {}) {
  const { id } = (await pide('/vehiculos', { method: 'POST', body: { ...coche, ...cambios } })).json;
  meterFotos(db, id, 15);
  assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } })).status, 200);
  return id;
}
const marcar = (pide, id, canal, body, como = 'comercial') => pide(`/portales/${id}/${canal}`, { method: 'PUT', body, como });

test('portales: el anuncio sale de la ficha, con las fotos públicas en orden y sin dinero interno', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide, { video_url: 'https://www.youtube.com/watch?v=abc' });
    await pide(`/vehiculos/${id}/extras`, { method: 'PUT', body: { extras: ['Navegador'] } });
    db.prepare('UPDATE fotos SET es_dano = 1 WHERE vehiculo_id = ? AND orden = 2').run(id);

    const r = await pide(`/portales/${id}`, { como: 'comercial' });
    assert.equal(r.status, 200);
    assert.equal(r.json.a_la_venta, true);
    assert.deepEqual(r.json.portales.map((p) => [p.canal, p.estado]), [['coches_net', 'sin_publicar'], ['milanuncios', 'sin_publicar'], ['wallapop', 'sin_publicar']]);
    const a = r.json.anuncio;
    assert.equal(a.titulo, 'Renault Clio Zen 90 CV · 2021 · 45.000 km');
    assert.equal(a.precio_euros, 12900);
    assert.match(a.descripcion, /^Renault Clio Zen, 90 CV, gasolina, cambio manual\.\nAño 2021 con 45\.000 km\.\n12 meses de garantía\.\nEquipamiento: navegador\./);
    assert.match(a.descripcion, /Ref\. PS-\d{5}$/);
    assert.equal(a.video_url, 'https://www.youtube.com/watch?v=abc');
    assert.equal(a.fotos.length, 14, 'sin la de daños');
    assert.deepEqual(a.fotos.slice(0, 2).map((f) => f.orden), [1, 3]);
    assert.match(a.fotos[0].url, new RegExp(`^/api/fotos/${id}/\\d+/archivo\\?v=`));
    assert.ok(!/precio_compra|margen|9000|proveedor/.test(JSON.stringify(r.json)), 'nada de lo de dentro');
  }));

test('portales: marcar publicado con su enlace; al vender queda en «retirar» y sale el aviso; confirmar la baja lo quita', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    const p = await marcar(pide, id, 'wallapop', { estado: 'publicado', enlace: ' https://es.wallapop.com/item/clio-123 ' });
    assert.equal(p.status, 200);
    assert.equal(p.json.estado, 'publicado');
    assert.equal(p.json.enlace, 'https://es.wallapop.com/item/clio-123');
    assert.ok(p.json.publicado_en);
    assert.equal((await marcar(pide, id, 'coches_net', { estado: 'publicado' })).json.enlace, null, 'el enlace es opcional');

    assert.equal((await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'vendido' } })).status, 200);
    const porRetirar = (await pide('/portales?estado=retirar', { como: 'comercial' })).json;
    assert.deepEqual(porRetirar.map((x) => x.canal).sort(), ['coches_net', 'wallapop']);
    assert.equal(porRetirar[0].vehiculo_estado, 'vendido');
    const aviso = (await pide('/avisos', { como: 'comercial' })).json.find((x) => x.tipo === 'vendidos_publicados');
    assert.match(aviso.texto, /Coches\.net, Wallapop|Wallapop, Coches\.net/);

    // Vendido: ya no se puede anunciar, solo retirar
    assert.equal((await marcar(pide, id, 'milanuncios', { estado: 'publicado' })).status, 409);
    const baja = await marcar(pide, id, 'wallapop', { estado: 'retirado' });
    assert.equal(baja.status, 200);
    assert.equal(baja.json.estado, 'retirado');
    assert.ok(baja.json.retirado_en);
    assert.equal(baja.json.enlace, 'https://es.wallapop.com/item/clio-123', 'el enlace se queda de recuerdo');
    await marcar(pide, id, 'coches_net', { estado: 'retirado' });
    assert.equal((await pide('/avisos')).json.some((x) => x.tipo === 'vendidos_publicados'), false, 'sin nada por retirar, sin aviso');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE entidad = 'publicacion'").get().n, 6, 'dos altas, dos «retirar» al vender y dos bajas');
  }));

test('portales: lo que no se puede', () =>
  conServidor(async ({ db, pide }) => {
    const id = await publicado(db, pide);
    const enTaller = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '9999ZZZ', bastidor: null } })).json.id;
    assert.equal((await marcar(pide, enTaller, 'wallapop', { estado: 'publicado' })).status, 409, 'un coche que no está a la venta');
    assert.equal((await marcar(pide, id, 'wallapop', { estado: 'retirado' })).status, 409, 'nada que retirar');
    assert.equal((await marcar(pide, id, 'web', { estado: 'publicado' })).status, 404, 'la web va por WordPress');
    assert.equal((await marcar(pide, id, 'wallapop', { estado: 'publicado', enlace: 'javascript:alert(1)' })).status, 400);
    assert.equal((await marcar(pide, id, 'wallapop', { estado: 'pendiente' })).status, 400);
    assert.equal((await marcar(pide, id, 'wallapop', { estado: 'publicado', otro: 1 })).status, 400);
    assert.equal((await pide('/portales/abc')).status, 404);
    assert.equal((await pide('/portales/999')).status, 404);
    assert.equal((await pide('/portales?estado=raro')).status, 400);
    assert.equal((await pide('/portales', { como: null })).status, 401);
  }));
