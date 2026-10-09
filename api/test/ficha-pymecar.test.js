// Lo de la ficha y la factura de Pymecar (migración 0019): precio sin oferta, seguro de flota, revisión con su
// anexo en el contrato y el coche entregado como parte del pago.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor, coche } from './ayuda.js';

const CLIENTE = { nombre: 'Laura Gil', nif: '12345678Z', direccion: 'C/ Major 12', codigo_postal: '08191', poblacion: 'Rubí' };
const alta = (pide, cambios = {}, como = 'gerencia') => pide('/vehiculos', { method: 'POST', body: { ...coche, bastidor: null, ...cambios }, como });

test('ficha: precio sin oferta (mayor que el PVP, lo escribe también el comercial) y seguro de flota', () =>
  conServidor(async ({ pide }) => {
    const v = await alta(pide, { matricula: '1111AAA', pvp_cent: 1290000, precio_sin_oferta_cent: 1390000, seguro_flota: 'con' });
    assert.equal(v.status, 201);
    assert.equal(v.json.precio_sin_oferta_cent, 1390000);
    assert.equal(v.json.seguro_flota, 'con');
    assert.equal((await pide(`/vehiculos/${v.json.id}`, { como: 'comercial' })).json.precio_sin_oferta_cent, 1390000, 'sale en la web: no es dinero de dentro');

    assert.equal((await alta(pide, { matricula: '2222AAA', pvp_cent: 1290000, precio_sin_oferta_cent: 1290000 })).status, 400, 'igual al PVP, no');
    // Subir el PVP por encima del tachado tampoco: el anuncio diría que baja cuando sube
    const subir = await pide(`/vehiculos/${v.json.id}`, { method: 'PUT', body: { pvp_cent: 1490000 }, como: 'comercial' });
    assert.equal(subir.status, 400);
    assert.match(subir.json.error, /mayor que el PVP/);
    assert.equal((await pide(`/vehiculos/${v.json.id}`, { method: 'PUT', body: { pvp_cent: 1490000, precio_sin_oferta_cent: null } })).status, 200, 'quitando la oferta, sí');
    assert.equal((await pide(`/vehiculos/${v.json.id}`, { method: 'PUT', body: { seguro_flota: 'quizás' } })).status, 400);
    assert.equal((await pide(`/vehiculos/${v.json.id}`, { method: 'PUT', body: { seguro_flota: 'baja_solicitada' } })).json.seguro_flota, 'baja_solicitada');
  }));

test('revisión: recepción, entrega y componentes; «revisado» exige todos los componentes y si falla no guarda nada', () =>
  conServidor(async ({ db, pide }) => {
    const { id } = (await alta(pide, { matricula: '3333AAA' })).json;
    const r0 = (await pide(`/vehiculos/${id}/revision`, { como: 'comercial' })).json;
    assert.deepEqual([r0.recepcion.length, r0.entrega.length, r0.componentes.length], [5, 6, 16]);
    assert.equal(r0.revisado_en, null);
    const idDe = (lista, nombre) => r0[lista].find((e) => e.nombre === nombre).id;
    const motor = idDe('componentes', 'Motor');
    const frenos = idDe('componentes', 'Frenos');

    const guardar = (body, como = 'comercial') => pide(`/vehiculos/${id}/revision`, { method: 'PUT', body, como });
    const r1 = await guardar({ recepcion: { [idDe('recepcion', 'Segunda llave')]: true }, componentes: { [motor]: { estado: 'controlado' }, [frenos]: { estado: 'sustituido', nota: 'Pastillas delanteras' } } });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.recepcion.find((e) => e.nombre === 'Segunda llave').marcado, true);
    assert.deepEqual(r1.json.componentes.find((c) => c.id === frenos), { id: frenos, nombre: 'Frenos', estado: 'sustituido', nota: 'Pastillas delanteras' });

    // Con componentes sin ver no se da por revisado, y lo que venía en la misma petición tampoco se guarda
    const luces = idDe('componentes', 'Luces');
    const mal = await guardar({ componentes: { [luces]: { estado: 'controlado' } }, revisado: true });
    assert.equal(mal.status, 400);
    assert.match(mal.json.error, /falta el estado de: Embrague/);
    assert.equal((await pide(`/vehiculos/${id}/revision`)).json.componentes.find((c) => c.id === luces).estado, null, 'todo o nada');

    const todos = Object.fromEntries(r0.componentes.map((c) => [c.id, { estado: 'controlado' }]));
    delete todos[frenos];
    const ok = await guardar({ componentes: todos, revisado: true });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.revisado_en);
    assert.equal(ok.json.revisado_por_nombre, 'Comercial');
    assert.ok((await pide(`/vehiculos/${id}`)).json.revisado_en, 'la ficha lo dice');

    // Dejar un componente sin estado le quita el «revisado»
    assert.equal((await guardar({ componentes: { [motor]: { estado: null } } })).json.revisado_en, null);

    for (const body of [{ recepcion: { [motor]: true } }, { componentes: { [motor]: { estado: 'roto' } } }, { componentes: { [motor]: 'bien' } }, { otra: 1 }, {}]) {
      assert.equal((await guardar(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'revision'").get().n, 3);
  }));

test('factura: coche entregado como parte del pago; al emitir es un cobro y sale en el contrato con el anexo', () =>
  conServidor(async ({ db, pide }) => {
    await pide('/facturas/empresa', { method: 'PUT', body: { direccion: 'Ctra. de Terrassa, 83', codigo_postal: '08191', poblacion: 'Rubí' } });
    const c = (await pide('/clientes', { method: 'POST', body: CLIENTE })).json;
    const v = (await alta(pide, { matricula: '4444AAA' })).json;
    const entregado = (await alta(pide, { matricula: '5555BBB', marca: 'Seat', modelo: 'Ibiza' })).json;

    const borrador = (body) => pide('/facturas', { method: 'POST', body: { cliente_id: c.id, vehiculo_id: v.id, ...body } });
    assert.equal((await borrador({ parte_pago_cent: 300000 })).status, 400, 'sin decir qué coche');
    assert.equal((await borrador({ parte_pago_cent: 9900000, parte_pago_vehiculo: 'Un Ferrari' })).status, 400, 'más que la factura');
    assert.equal((await borrador({ parte_pago_cent: 300000, parte_pago_vehiculo_id: v.id })).status, 400, 'el mismo coche que se vende');
    const f = await borrador({ parte_pago_cent: 300000, parte_pago_vehiculo_id: entregado.id });
    assert.equal(f.status, 201);
    assert.equal(f.json.parte_pago_vehiculo, 'Seat Ibiza 5555BBB', 'la descripción sale de su ficha');

    // La revisión del coche vendido, para el anexo
    const r = (await pide(`/vehiculos/${v.id}/revision`)).json;
    await pide(`/vehiculos/${v.id}/revision`, { method: 'PUT', body: {
      componentes: { [r.componentes[0].id]: { estado: 'controlado' }, [r.componentes[3].id]: { estado: 'sustituido', nota: 'Discos nuevos' } },
      entrega: { [r.entrega[0].id]: true, [r.entrega[2].id]: true },
    } });

    const e = await pide(`/facturas/${f.json.id}/emitir`, { method: 'POST' });
    assert.equal(e.status, 200);
    const factura = (await pide(`/facturas/${f.json.id}`)).json;
    assert.deepEqual(factura.cobros.map((k) => [k.forma_pago, k.importe_cent, k.fecha, k.nota]), [['parte_pago', 300000, factura.fecha, 'Coche entregado: Seat Ibiza 5555BBB']]);
    assert.equal(factura.estado_cobro, 'parcial');
    assert.equal(factura.saldo_cent, factura.total_cent - 300000);

    const contrato = (await pide('/contratos', { method: 'POST', body: { tipo: 'compraventa', factura_id: f.json.id } })).json.contenido;
    const pago = contrato.secciones[0].items.find((i) => i.texto === 'Forma de pago:').lista;
    assert.deepEqual(pago, ['ENTREGA DE VEHÍCULO USADO (Seat Ibiza 5555BBB): 3.000 €', `TRANSFERENCIA: ${(factura.saldo_cent / 100).toLocaleString('es-ES', { useGrouping: 'always' })} €`]);
    assert.deepEqual(contrato.anexo, {
      titulo: 'Anexo: estado del vehículo', revisado: null,
      componentes: [{ nombre: 'Motor', estado: 'Controlado', nota: null }, { nombre: 'Frenos', estado: 'Sustituido', nota: 'Discos nuevos' }],
      entrega: ['Segunda llave', 'Rueda de recambio'],
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE entidad = 'cobro' AND accion = 'alta'").get().n, 1);
  }));

test('contrato: sin revisión, sin anexo', () =>
  conServidor(async ({ pide }) => {
    await pide('/facturas/empresa', { method: 'PUT', body: { direccion: 'Ctra. de Terrassa, 83', codigo_postal: '08191', poblacion: 'Rubí' } });
    const c = (await pide('/clientes', { method: 'POST', body: CLIENTE })).json;
    const v = (await alta(pide, { matricula: '6666AAA' })).json;
    const f = (await pide('/facturas', { method: 'POST', body: { cliente_id: c.id, vehiculo_id: v.id } })).json;
    await pide(`/facturas/${f.id}/emitir`, { method: 'POST' });
    assert.equal((await pide('/contratos', { method: 'POST', body: { tipo: 'compraventa', factura_id: f.id } })).json.contenido.anexo, null);
  }));
