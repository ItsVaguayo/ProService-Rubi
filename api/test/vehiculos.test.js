import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche, meterFotos } from './ayuda.js';
import { ESTADOS } from '../src/modules/estados.js';

test('recorrido: alta, margen, publicar con fotos y feed web', () =>
  conServidor(async ({ db, pide }) => {
    const alta = await pide('/vehiculos', { method: 'POST', body: coche });
    assert.equal(alta.status, 201);
    const { id } = alta.json;

    const ficha = (await pide(`/vehiculos/${id}`)).json;
    assert.equal(ficha.referencia, 'PS-00001');
    assert.equal(ficha.matricula, '1234ABC', 'la matrícula se normaliza');
    assert.equal(ficha.bastidor, 'VF1RFB00000000001');
    assert.equal(ficha.coste_total_cent, 950000);
    assert.equal(ficha.margen_cent, 340000);

    let feed = (await pide('/publicacion/feed/web', { como: null })).json;
    assert.equal(feed.length, 0);

    meterFotos(db, id, 15);
    const cambio = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    assert.equal(cambio.status, 200);

    feed = (await pide('/publicacion/feed/web', { como: null })).json;
    assert.equal(feed.length, 1);
    assert.equal(feed[0].pvp_cent, 1290000);
    for (const interno of ['precio_compra_cent', 'precio_minimo_cent', 'regimen_iva', 'pago_propietario_cent', 'propietario_nombre', 'margen_cent']) {
      assert.equal(feed[0][interno], undefined, `el feed no puede llevar ${interno}`);
    }

    const historial = db.prepare('SELECT de, a, usuario_id FROM historial_estados WHERE vehiculo_id = ? ORDER BY id').all(id);
    assert.deepEqual(historial.map((h) => h.a), ['pendiente_recoger', 'publicado']);
    assert.ok(historial.every((h) => h.usuario_id), 'cada cambio lleva usuario');
  }));

test('sin sesión no se ve ni se toca nada interno', () =>
  conServidor(async ({ pide }) => {
    assert.equal((await pide('/vehiculos', { como: null })).status, 401);
    assert.equal((await pide('/vehiculos', { method: 'POST', body: coche, como: null })).status, 401);
    assert.equal((await pide('/fotos/1', { como: null })).status, 401);
    assert.equal((await pide('/salud', { como: null })).status, 200);
  }));

test('login: contraseña mala da 401 y salir cierra la sesión', () =>
  conServidor(async ({ base, pide }) => {
    const malo = await fetch(`${base}/auth/entrar`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'jaume@ejemplo.com', contrasena: 'no-es-esta-no' }),
    });
    assert.equal(malo.status, 401);

    const yo = await pide('/auth/yo');
    assert.equal(yo.json.rol, 'gerencia');
    assert.equal(yo.json.hash, undefined);

    await pide('/auth/salir', { method: 'POST' });
    assert.equal((await pide('/auth/yo')).status, 401);
  }));

test('el comercial no ve ni escribe dinero interno', () =>
  conServidor(async ({ pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;

    const ficha = (await pide(`/vehiculos/${id}`, { como: 'comercial' })).json;
    const lista = (await pide('/vehiculos', { como: 'comercial' })).json;
    for (const v of [ficha, lista[0]]) {
      for (const campo of ['precio_compra_cent', 'coste_taller_cent', 'precio_minimo_cent', 'margen_cent', 'coste_total_cent', 'regimen_iva']) {
        assert.equal(v[campo], undefined, `el comercial no puede ver ${campo}`);
      }
      assert.equal(v.pvp_cent, 1290000, 'el PVP sí lo ve');
    }

    const edita = await pide(`/vehiculos/${id}`, { method: 'PUT', body: { precio_compra_cent: 1 }, como: 'comercial' });
    assert.equal(edita.status, 400);
    const kmOk = await pide(`/vehiculos/${id}`, { method: 'PUT', body: { kilometros: 46000 }, como: 'comercial' });
    assert.equal(kmOk.status, 200);
    assert.equal(kmOk.json.precio_compra_cent, undefined);
  }));

test('los nombres de columna no salen de la petición (inyección SQL)', () =>
  conServidor(async ({ db, pide }) => {
    const ataque = await pide('/vehiculos', {
      method: 'POST',
      body: { matricula: 'X1', marca: 'A', modelo: 'B', 'estado) VALUES (?);DROP TABLE vehiculos;--': 1 },
    });
    assert.equal(ataque.status, 400);
    assert.match(ataque.json.error, /Campo desconocido/);

    const colado = await pide('/vehiculos', { method: 'POST', body: { matricula: 'X2', marca: 'A', modelo: 'B', estado: 'entregado', id: 999 } });
    assert.equal(colado.status, 400, 'estado e id no se escriben por el alta');
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'vehiculos'").get());
  }));

test('alta mínima con matrícula, marca y modelo; tipos validados', () =>
  conServidor(async ({ pide }) => {
    const minima = await pide('/vehiculos', { method: 'POST', body: { matricula: '9999ZZZ', marca: 'Seat', modelo: 'Ibiza' } });
    assert.equal(minima.status, 201);

    const falta = await pide('/vehiculos', { method: 'POST', body: { marca: 'Seat', modelo: 'Ibiza' } });
    assert.equal(falta.status, 400);
    assert.match(falta.json.error, /Falta matricula/);

    const decimales = await pide('/vehiculos', { method: 'POST', body: { matricula: '1', marca: 'a', modelo: 'b', pvp_cent: 12.5 } });
    assert.equal(decimales.status, 400, 'el dinero va en céntimos enteros');

    const enumMalo = await pide('/vehiculos', { method: 'POST', body: { matricula: '2', marca: 'a', modelo: 'b', cambio: 'semiautomatico' } });
    assert.equal(enumMalo.status, 400);

    const borrar = await pide(`/vehiculos/${minima.json.id}`, { method: 'PUT', body: { matricula: '' } });
    assert.equal(borrar.status, 400, 'la matrícula no se puede vaciar');
  }));

test('matrícula y bastidor repetidos dan 409, también escritos distinto', () =>
  conServidor(async ({ pide }) => {
    await pide('/vehiculos', { method: 'POST', body: coche });
    const otraVez = await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '1234-ABC', bastidor: null } });
    assert.equal(otraVez.status, 409);
    const mismoVin = await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '5555XYZ', bastidor: 'VF1RFB 00000000001' } });
    assert.equal(mismoVin.status, 409);
    const sinVin = await pide('/vehiculos', { method: 'POST', body: { matricula: '6666XYZ', marca: 'a', modelo: 'b' } });
    const sinVin2 = await pide('/vehiculos', { method: 'POST', body: { matricula: '7777XYZ', marca: 'a', modelo: 'b' } });
    assert.equal(sinVin.status, 201);
    assert.equal(sinVin2.status, 201, 'varios coches sin bastidor todavía no chocan');
  }));

test('no se publica sin datos obligatorios ni con menos de 15 fotos', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: { matricula: '1111AAA', marca: 'Seat', modelo: 'Ibiza' } })).json;
    const sinDatos = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    assert.equal(sinDatos.status, 409);
    assert.match(sinDatos.json.error, /Faltan datos para publicar/);

    const completo = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '2222BBB', bastidor: 'OTRO1' } })).json;
    meterFotos(db, completo.id, 14);
    const pocas = await pide(`/vehiculos/${completo.id}/estado`, { method: 'PATCH', body: { estado: 'publicado' } });
    assert.equal(pocas.status, 409);
    assert.match(pocas.json.error, /14 fotos/);

    // Otros cambios no piden nada (duda C4: se puede mover a cualquier estado)
    const taller = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'en_taller' } });
    assert.equal(taller.status, 200);
  }));

test('reservado: hace falta la reserva y solo puede haber una activa', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    const sinReserva = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'reservado' } });
    assert.equal(sinReserva.status, 409);

    const reservar = db.prepare('INSERT INTO reservas (vehiculo_id, cliente, senal_cent) VALUES (?, ?, ?)');
    reservar.run(id, 'Cliente A', 30000);
    assert.throws(() => reservar.run(id, 'Cliente B', 50000), /UNIQUE/, 'dos reservas activas del mismo coche');
    assert.throws(() => reservar.run(id, 'Cliente C', 29999), /CHECK/, 'señal mínima de 300 €');

    const conReserva = await pide(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: 'reservado' } });
    assert.equal(conReserva.status, 200);
  }));

test('coche en depósito: el margen sale de lo que se paga al dueño', () =>
  conServidor(async ({ pide }) => {
    const deposito = {
      matricula: '3333CCC', marca: 'Kia', modelo: 'Niro', propiedad: 'deposito',
      pago_propietario_cent: 1500000, coste_preparacion_cent: 25000, pvp_cent: 1690000,
    };
    const { id } = (await pide('/vehiculos', { method: 'POST', body: deposito })).json;
    const ficha = (await pide(`/vehiculos/${id}`)).json;
    assert.equal(ficha.coste_total_cent, 1525000);
    assert.equal(ficha.margen_cent, 165000);

    const sinPago = (await pide('/vehiculos', { method: 'POST', body: { ...deposito, matricula: '4444DDD', pago_propietario_cent: null } })).json;
    assert.equal(sinPago.margen_cent, null, 'sin lo pactado con el dueño no se inventa un margen');
  }));

test('cada cambio deja rastro en auditoría', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = (await pide('/vehiculos', { method: 'POST', body: coche })).json;
    await pide(`/vehiculos/${id}`, { method: 'PUT', body: { pvp_cent: 1250000 } });
    const filas = db.prepare("SELECT accion, antes, despues FROM auditoria WHERE entidad = 'vehiculo' AND entidad_id = ? ORDER BY id").all(id);
    assert.deepEqual(filas.map((f) => f.accion), ['alta', 'edicion']);
    assert.deepEqual(JSON.parse(filas[1].antes), { pvp_cent: 1290000 });
    assert.deepEqual(JSON.parse(filas[1].despues), { pvp_cent: 1250000 });
  }));

test('la lista de estados de la API coincide con la de la base de datos', () =>
  conServidor(async ({ db }) => {
    const ins = db.prepare("INSERT INTO vehiculos (matricula, marca, modelo, estado) VALUES (?, 'a', 'b', ?)");
    ESTADOS.forEach((e, i) => assert.doesNotThrow(() => ins.run(`E${i}`, e.id), `falta ${e.id} en el CHECK`));
    assert.throws(() => ins.run('EX', 'inventado'), /CHECK/);
  }));

test('JSON roto y rutas que no existen responden con error claro', () =>
  conServidor(async ({ base, pide }) => {
    const roto = await fetch(`${base}/auth/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(roto.status, 400);
    assert.equal((await pide('/no-existe')).status, 404);
  }));
