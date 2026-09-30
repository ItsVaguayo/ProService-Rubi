import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirDb } from '../src/db.js';
import { crearApp } from '../src/app.js';

const coche = {
  matricula: '1234ABC', bastidor: 'VF1RFB00000000001', marca: 'Renault', modelo: 'Clio', version: 'Zen',
  anio: 2021, fecha_matriculacion: '2021-03-10', kilometros: 45000, combustible: 'gasolina', cambio: 'manual',
  potencia_cv: 90, cilindrada: 999, traccion: 'delantera', emisiones_co2: 118, etiqueta_dgt: 'C',
  carroceria: 'utilitario', puertas: 5, plazas: 5, color_exterior: 'blanco', tapiceria: 'tela', llantas: '16"',
  precio_compra: 9000, coste_transporte: 200, coste_taller: 300, pvp: 12900,
};

async function conServidor(fn) {
  const server = crearApp(abrirDb(':memory:')).listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  try { await fn(base); } finally { server.close(); }
}

test('alta, margen, cambio de estado y feed web', () =>
  conServidor(async (base) => {
    const alta = await fetch(`${base}/vehiculos`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(coche),
    });
    assert.equal(alta.status, 201);
    const { id } = await alta.json();

    const ficha = await (await fetch(`${base}/vehiculos/${id}`)).json();
    assert.equal(ficha.referencia, 'PS-00001');
    assert.equal(ficha.coste_total, 9500);
    assert.equal(ficha.margen, 3400);

    let feed = await (await fetch(`${base}/publicacion/feed/web`)).json();
    assert.equal(feed.length, 0);

    const cambio = await fetch(`${base}/vehiculos/${id}/estado`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ estado: 'publicado' }),
    });
    assert.equal(cambio.status, 200);

    feed = await (await fetch(`${base}/publicacion/feed/web`)).json();
    assert.equal(feed.length, 1);
    assert.equal(feed[0].precio_compra, undefined);
  }));
