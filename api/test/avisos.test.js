// Bloque 9 (T16): avisos del panel. Los datos van directos a la base para poder fecharlos en el pasado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor } from './ayuda.js';
import { hoyLocal } from '../src/fechas.js';

const DIA_MS = 86400000;
const diaMas = (n) => new Date(Date.parse(`${hoyLocal()}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const deTipo = (avisos, tipo) => avisos.filter((a) => a.tipo === tipo);

let siguiente = 1;
/** Un coche directo en la base. publicadoHace: días desde que pasó a «Publicado» (en el historial). */
function meterCoche(db, { estado = 'publicado', itv = null, publicadoHace = null } = {}) {
  const n = siguiente++;
  const id = Number(db.prepare('INSERT INTO vehiculos (matricula, marca, modelo, estado, itv_caducidad) VALUES (?, ?, ?, ?, ?)')
    .run(`${String(n).padStart(4, '0')}BCD`, 'Seat', 'Ibiza', estado, itv).lastInsertRowid);
  if (publicadoHace !== null) {
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, fecha) VALUES (?, 'pendiente_fotos', 'publicado', datetime('now', ?))")
      .run(id, `-${publicadoHace} days`);
  }
  return id;
}
const idDe = (db, email) => db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email).id;

test('un coche sin problemas no genera ningún aviso', () =>
  conServidor(async ({ db, pide }) => {
    meterCoche(db, { publicadoHace: 10, itv: diaMas(200) });
    for (const como of ['gerencia', 'comercial']) {
      const r = await pide('/avisos', { como });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, [], como);
    }
  }));

test('sin sesión, 401', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/avisos', { como: null })).status, 401);
  }));

test('tareas vencidas: sin hacer y con fecha pasada; el comercial solo ve las suyas', () =>
  conServidor(async ({ db, pide }) => {
    const jaume = idDe(db, 'jaume@ejemplo.com');
    const comercial = idDe(db, 'comercial@ejemplo.com');
    const cliente = Number(db.prepare("INSERT INTO clientes (nombre) VALUES ('Laura Gil')").run().lastInsertRowid);
    const ins = db.prepare(`INSERT INTO actividades (tipo, cliente_id, descripcion, programada_para, hecha_en, responsable_id, creado_por)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);
    ins.run('tarea', cliente, 'Llamar por la financiación', '2026-01-05 10:00', null, comercial, jaume);
    ins.run('tarea', cliente, 'Pedir el permiso', '2026-01-04 10:00', null, jaume, jaume);
    ins.run('tarea', cliente, 'Ya hecha', '2026-01-03 10:00', '2026-01-03 11:00:00', comercial, jaume);
    ins.run('tarea', cliente, 'Futura', '2099-01-01 10:00', null, comercial, jaume);
    ins.run('llamada', cliente, 'Una llamada, no una tarea', '2026-01-02 10:00', null, comercial, jaume);

    const gerencia = deTipo((await pide('/avisos')).json, 'tareas_vencidas');
    assert.deepEqual(gerencia.map((a) => a.fecha), ['2026-01-04 10:00', '2026-01-05 10:00'], 'de la más vieja a la más nueva');
    assert.deepEqual(gerencia[1], {
      tipo: 'tareas_vencidas', gravedad: 'alta', texto: 'Tarea vencida: Llamar por la financiación (Laura Gil) · Comercial',
      enlace: 'crm.html', fecha: '2026-01-05 10:00',
    });

    const suyas = deTipo((await pide('/avisos', { como: 'comercial' })).json, 'tareas_vencidas');
    assert.equal(suyas.length, 1);
    assert.equal(suyas[0].texto, 'Tarea vencida: Llamar por la financiación (Laura Gil)');
  }));

test('contactos de la web sin atender con más de 24 horas', () =>
  conServidor(async ({ db, pide }) => {
    const ins = db.prepare("INSERT INTO contactos (nombre, telefono, tipo, recibido_en, atendido_en) VALUES (?, '600000000', 'prueba', datetime('now', ?), ?)");
    ins.run('Viejo', '-30 hours', null);
    ins.run('Reciente', '-2 hours', null);
    ins.run('Atendido', '-30 hours', '2026-01-01 10:00:00');

    for (const como of ['gerencia', 'comercial']) {
      const avisos = deTipo((await pide('/avisos', { como })).json, 'contactos_sin_atender');
      assert.equal(avisos.length, 1, como);
      assert.equal(avisos[0].gravedad, 'alta');
      assert.equal(avisos[0].enlace, 'contactos.html');
      assert.match(avisos[0].texto, /^Viejo escribió por la web \(prueba\)/);
    }
  }));

test('coches parados: publicados hace más de 60 días, alta desde 90', () =>
  conServidor(async ({ db, pide }) => {
    const setenta = meterCoche(db, { publicadoHace: 70 });
    const cien = meterCoche(db, { publicadoHace: 100 });
    meterCoche(db, { publicadoHace: 30 });
    meterCoche(db, { estado: 'reservado', publicadoHace: 100 });
    // Volvió de una reserva cancelada hace 5 días: cuenta desde la primera publicación
    const volvio = meterCoche(db, { publicadoHace: 80 });
    db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, fecha) VALUES (?, 'reservado', 'publicado', datetime('now', '-5 days'))").run(volvio);

    const avisos = deTipo((await pide('/avisos', { como: 'comercial' })).json, 'coches_parados');
    assert.deepEqual(avisos.map((a) => [a.enlace, a.gravedad]),
      [[`coche.html?id=${cien}`, 'alta'], [`coche.html?id=${volvio}`, 'media'], [`coche.html?id=${setenta}`, 'media']]);
    assert.match(avisos[0].texto, /^Seat Ibiza \d{4}BCD lleva 100 días publicado$/);
  }));

test('vendidos o entregados con publicaciones en «retirar»', () =>
  conServidor(async ({ db, pide }) => {
    const vendido = meterCoche(db, { estado: 'vendido' });
    const entregado = meterCoche(db, { estado: 'entregado' });
    const publicado = meterCoche(db, { publicadoHace: 1 });
    const ins = db.prepare('INSERT INTO publicaciones (vehiculo_id, canal, estado) VALUES (?, ?, ?)');
    ins.run(vendido, 'coches_net', 'retirar');
    ins.run(vendido, 'wallapop', 'retirar');
    ins.run(vendido, 'web', 'retirado');
    ins.run(entregado, 'milanuncios', 'retirado');
    ins.run(publicado, 'coches_net', 'retirar'); // aún no vendido: no es este aviso

    const avisos = deTipo((await pide('/avisos', { como: 'comercial' })).json, 'vendidos_publicados');
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].enlace, `coche.html?id=${vendido}`);
    assert.equal(avisos[0].gravedad, 'alta');
    assert.match(avisos[0].texto, /está vendido y sigue por retirar en (coches_net, wallapop|wallapop, coches_net)$/);
  }));

test('ITV de los coches en stock: caducada (alta) o en los próximos 30 días (media)', () =>
  conServidor(async ({ db, pide }) => {
    const caducada = meterCoche(db, { estado: 'en_taller', itv: diaMas(-3) });
    const pronto = meterCoche(db, { estado: 'reservado', itv: diaMas(10) });
    meterCoche(db, { estado: 'en_taller', itv: diaMas(60) });
    meterCoche(db, { estado: 'vendido', itv: diaMas(-3) });
    meterCoche(db, { estado: 'en_taller' }); // sin fecha de ITV

    const avisos = deTipo((await pide('/avisos', { como: 'comercial' })).json, 'itv');
    assert.deepEqual(avisos.map((a) => [a.enlace, a.gravedad, a.fecha]),
      [[`coche.html?id=${caducada}`, 'alta', diaMas(-3)], [`coche.html?id=${pronto}`, 'media', diaMas(10)]]);
    assert.match(avisos[0].texto, /la ITV caducó el \d{2}\/\d{2}\/\d{4}$/);
    assert.match(avisos[1].texto, /la ITV caduca el \d{2}\/\d{2}\/\d{4}$/);
  }));

test('cobros vencidos: gerencia los ve con el importe; el comercial, ni el aviso ni ningún importe', () =>
  conServidor(async ({ db, pide }) => {
    const jaume = idDe(db, 'jaume@ejemplo.com');
    const cliente = Number(db.prepare("INSERT INTO clientes (nombre) VALUES ('Laura Gil')").run().lastInsertRowid);
    let numero = 0;
    const factura = ({ vencimiento, cobrado = 0, estado = 'emitida' }) => {
      numero++;
      const emitida = estado === 'emitida';
      const id = Number(db.prepare(`INSERT INTO facturas (estado, serie, numero, codigo, fecha, vencimiento, cliente_id, precio_cent,
                                      base_cent, iva_cent, total_cent, creado_por)
                                    VALUES (?, ?, ?, ?, '2026-01-01', ?, ?, 1000000, 100000, 21000, 1000000, ?)`)
        .run(estado, emitida ? 'V26' : null, emitida ? numero : null, emitida ? `V26-0000${numero}` : null, vencimiento, cliente, jaume).lastInsertRowid);
      if (cobrado) {
        db.prepare("INSERT INTO cobros (factura_id, fecha, importe_cent, forma_pago, creado_por) VALUES (?, '2026-01-02', ?, 'transferencia', ?)")
          .run(id, cobrado, jaume);
      }
      return id;
    };
    db.prepare("INSERT INTO series (serie, tipo, anio, ultimo) VALUES ('V26', 'venta', 2026, 9)").run();
    const vencida = factura({ vencimiento: diaMas(-5), cobrado: 250000 });
    factura({ vencimiento: diaMas(-5), cobrado: 1000000 }); // cobrada
    factura({ vencimiento: diaMas(5) });                    // aún no vence
    factura({ vencimiento: diaMas(-5), estado: 'borrador' });
    meterCoche(db, { estado: 'en_taller', itv: diaMas(-1) }); // para que el comercial tenga algún aviso

    const gerencia = deTipo((await pide('/avisos')).json, 'cobros_vencidos');
    assert.equal(gerencia.length, 1);
    assert.equal(gerencia[0].enlace, `factura.html?id=${vencida}`);
    assert.equal(gerencia[0].fecha, diaMas(-5));
    assert.equal(gerencia[0].gravedad, 'alta');
    assert.match(gerencia[0].texto, /^V26-00001 de Laura Gil: 7\.500,00 € sin cobrar$/);

    const comercial = await pide('/avisos', { como: 'comercial' });
    assert.equal(comercial.status, 200);
    assert.ok(comercial.json.length > 0);
    assert.deepEqual(deTipo(comercial.json, 'cobros_vencidos'), []);
    const texto = JSON.stringify(comercial.json);
    assert.ok(!/€|_cent|V26-/.test(texto), 'ni importes ni facturas');
  }));

test('lo grave va primero', () =>
  conServidor(async ({ db, pide }) => {
    meterCoche(db, { publicadoHace: 70, itv: diaMas(200) });   // media
    meterCoche(db, { estado: 'en_taller', itv: diaMas(-1) }); // alta
    const avisos = (await pide('/avisos')).json;
    assert.deepEqual(avisos.map((a) => a.gravedad), ['alta', 'media']);
    for (const a of avisos) assert.deepEqual(Object.keys(a).sort(), ['enlace', 'fecha', 'gravedad', 'texto', 'tipo']);
  }));
