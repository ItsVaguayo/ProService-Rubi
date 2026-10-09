// Migración desde Pymecar: plantillas CSV → proveedores, clientes y coches (stock vivo e histórico de ventas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrirDb } from '../src/db.js';
import { leerCsv } from '../src/migracion/leer-csv.js';
import { importar, eurosACent, dia } from '../src/migracion/importar.js';
import { ventasDelMes } from '../src/modules/informes/ventas.js';
import { crearUsuario } from '../src/modules/auth/sesiones.js';
import { conServidor, coche } from './ayuda.js';

const plantilla = (nombre) => leerCsv(readFileSync(new URL(`../../docs/migracion/${nombre}`, import.meta.url), 'utf8'));
const PLANTILLAS = () => ({ proveedores: plantilla('proveedores.csv'), clientes: plantilla('clientes.csv'), vehiculos: plantilla('vehiculos.csv'), facturas: plantilla('facturas.csv') });
// Base en memoria con una persona de gerencia: las facturas se apuntan a su nombre
function baseNueva() {
  const db = abrirDb(':memory:');
  const usuarioId = crearUsuario(db, { email: 'jaume@ejemplo.com', nombre: 'Jaume', rol: 'gerencia', contrasena: 'contrasena-de-prueba' });
  return { db, usuarioId };
}
const cuenta = (db, tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;

test('migración: leer CSV de Excel en español (punto y coma, BOM, comillas) y también con comas', () => {
  assert.deepEqual(leerCsv('﻿Nombre;Notas\r\nAna;"dice ""hola""; y se va"\r\n\r\nLuis;"dos\nlíneas"\r\n'),
    [{ nombre: 'Ana', notas: 'dice "hola"; y se va' }, { nombre: 'Luis', notas: 'dos\nlíneas' }]);
  assert.deepEqual(leerCsv('a,b\n1,"2,5"'), [{ a: '1', b: '2,5' }]);
  assert.deepEqual(leerCsv('llantas;x\n16";1'), [{ llantas: '16"', x: '1' }]);
  assert.deepEqual(leerCsv(''), []);
});

test('migración: importes en euros y fechas como las escribe Excel', () => {
  assert.equal(eurosACent('12.900,50'), 1290050);
  assert.equal(eurosACent('12900,5'), 1290050);
  assert.equal(eurosACent('12900.50'), 1290050);
  assert.equal(eurosACent('12.900'), 1290000);
  assert.equal(eurosACent('1.290.000'), 129000000);
  assert.equal(eurosACent('9000 €'), 900000);
  assert.equal(eurosACent('doce'), null);
  assert.equal(eurosACent('-5'), null);
  assert.equal(dia('10/03/2021'), '2021-03-10');
  assert.equal(dia('1-3-2021'), '2021-03-01');
  assert.equal(dia('2021-03-10'), '2021-03-10');
  assert.equal(dia('31/02/2021'), null);
});

test('migración: el ensayo lo comprueba todo y no guarda nada', () => {
  const { db, usuarioId } = baseNueva();
  const informe = importar(db, PLANTILLAS(), { usuarioId });
  assert.equal(informe.ensayo, true);
  assert.equal(informe.aplicado, false);
  assert.deepEqual(informe.errores, []);
  assert.deepEqual([informe.proveedores.nuevos, informe.clientes.nuevos, informe.vehiculos.nuevos, informe.vehiculos.vendidos, informe.facturas.nuevos], [1, 1, 2, 1, 1]);
  assert.deepEqual([cuenta(db, 'proveedores'), cuenta(db, 'clientes'), cuenta(db, 'vehiculos'), cuenta(db, 'historial_estados'), cuenta(db, 'facturas'), cuenta(db, 'cobros')], [0, 0, 0, 0, 0, 0]);
  db.close();
});

test('migración: aplicar guarda; el stock sin fotos espera en «Pendiente de fotos» y la venta cuenta en su mes', () => {
  const { db, usuarioId } = baseNueva();
  const informe = importar(db, PLANTILLAS(), { ensayo: false, usuarioId });
  assert.equal(informe.aplicado, true);
  assert.deepEqual(informe.avisos.filter((a) => a.fichero === 'vehiculos.csv').map((a) => a.fila), [2]);

  const stock = db.prepare("SELECT * FROM vehiculos WHERE matricula = '0000AAA'").get();
  assert.equal(stock.estado, 'pendiente_fotos');
  assert.match(stock.referencia, /^PS-\d{5}$/);
  assert.equal(stock.pvp_cent, 1290000);
  assert.equal(stock.precio_compra_cent, 900000);
  assert.equal(stock.kilometros, 45000);
  assert.equal(stock.fecha_matriculacion, '2021-03-10');
  assert.equal(stock.llantas, '16"');
  assert.equal(stock.creado_en, '2026-09-15 12:00:00');
  assert.equal(stock.proveedor_id, db.prepare("SELECT id FROM proveedores WHERE nif = 'B12345674'").get().id);

  const vendido = db.prepare("SELECT * FROM vehiculos WHERE matricula = '0000BBB'").get();
  assert.equal(vendido.estado, 'entregado', 'el histórico no sale en la web');
  assert.equal(vendido.comprador_id, db.prepare("SELECT id FROM clientes WHERE nif = '12345678Z'").get().id);
  assert.deepEqual(db.prepare('SELECT de, a, fecha, usuario_id FROM historial_estados WHERE vehiculo_id = ? ORDER BY id').all(vendido.id), [
    { de: null, a: 'recibido', fecha: '2026-01-02 12:00:00', usuario_id: null },
    { de: 'recibido', a: 'vendido', fecha: '2026-02-20 12:00:00', usuario_id: null },
    { de: 'vendido', a: 'entregado', fecha: '2026-02-20 12:00:01', usuario_id: null },
  ]);
  assert.deepEqual(ventasDelMes(db, '2026-02').map((v) => v.matricula), ['0000BBB']);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'migracion'").get().n, 5);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gastos").get().n, 0, 'los costes van con el libro de gastos');

  // Repetir la carga no duplica nada
  const otra = importar(db, PLANTILLAS(), { ensayo: false, usuarioId });
  assert.deepEqual([otra.proveedores.ya_estaban, otra.clientes.ya_estaban, otra.vehiculos.ya_estaban, otra.vehiculos.nuevos, otra.facturas.ya_estaban], [1, 1, 2, 0, 1]);
  assert.equal(cuenta(db, 'cobros'), 1);
  assert.equal(cuenta(db, 'vehiculos'), 2);
  db.close();
});

test('migración: con un solo error no se guarda nada, y el informe dice qué fila y por qué', () => {
  const { db, usuarioId } = baseNueva();
  const datos = PLANTILLAS();
  datos.clientes.push({ nombre: 'Sin letra', nif: '12345678A' });
  datos.vehiculos.push(
    { matricula: '0000CCC', marca: 'Kia', modelo: 'Niro', pvp: 'mucho', coste_taller: '300' },
    { matricula: '0000DDD', marca: 'Kia', modelo: 'Ceed', cambio: 'semiautomático' },
    { matricula: '0000EEE', marca: 'Kia', modelo: 'Rio', estado: 'vendido' },
    { matricula: '0000FFF', marca: 'Kia', modelo: 'Picanto', comprador_nif: '00000000T', fecha_venta: '01/01/2026', fecha_alta: '01/02/2026' },
  );
  const informe = importar(db, datos, { ensayo: false, usuarioId });
  assert.equal(informe.aplicado, false);
  assert.deepEqual(informe.errores.map((e) => [e.fichero, e.fila]), [['clientes.csv', 3], ['vehiculos.csv', 4], ['vehiculos.csv', 5], ['vehiculos.csv', 6], ['vehiculos.csv', 7]]);
  assert.match(informe.errores[1].errores.join(' '), /pvp tiene que ser un importe.*coste_taller: los costes van con el libro de gastos/);
  assert.match(informe.errores[2].errores.join(' '), /La base no lo acepta/);
  assert.match(informe.errores[3].errores.join(' '), /falta fecha_venta/);
  assert.match(informe.errores[4].errores.join(' '), /fecha_venta es anterior.*No hay ningún cliente con NIF 00000000T/);
  assert.deepEqual([cuenta(db, 'proveedores'), cuenta(db, 'clientes'), cuenta(db, 'vehiculos')], [0, 0, 0], 'nada guardado');
  db.close();
});

test('migración: columnas que no existen y datos de la ficha que la API no aceptaría', () => {
  const db = abrirDb(':memory:');
  const informe = importar(db, {
    proveedores: [{ nombre: 'X', colorin: 'rojo' }],
    vehiculos: [{ matricula: '', marca: 'Kia', modelo: 'Rio' }, { matricula: '1111AAA', marca: 'Kia', modelo: 'Rio', anio: 'dos mil', video_url: 'javascript:alert(1)' }],
  });
  assert.deepEqual(informe.errores.map((e) => e.errores.join(' ')), [
    'Columna desconocida: colorin',
    'Falta matricula',
    'anio tiene que ser un número entero: «dos mil» video_url tiene que ser un enlace que empiece por https://',
  ]);
  db.close();
});

// Facturas de Pymecar: Pymecar no se renueva, así que sus facturas se quedan aquí, con su número y sus cobros
const FACTURA = (cambios = {}) => ({ codigo: 'V26-00005', fecha: '20/02/2026', cliente_nif: '12345678Z', matricula: '0000BBB', regimen: 'REBU',
  precio: '9.900,00', compra: '7.000,00', forma_pago: 'transferencia', ...cambios });

test('migración: las facturas de Pymecar entran emitidas, cobradas, en los libros, y la serie sigue por la siguiente', () =>
  conServidor(async ({ db, pide }) => {
    const usuarioId = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia'").get().id;
    const datos = PLANTILLAS();
    datos.facturas.push(
      FACTURA({ codigo: 'F-V26-00006', fecha: '21/02/2026', matricula: '', precio: '1.000', compra: '', regimen: 'general', cobrado: '0' }),
      FACTURA({ codigo: 'R26-00001', fecha: '25/02/2026', matricula: '', precio: '-1.000', compra: '', regimen: 'general', rectifica: 'V26-00006', motivo: 'Venta anulada' }),
    );
    const informe = importar(db, datos, { ensayo: false, usuarioId });
    assert.deepEqual(informe.errores, []);
    assert.equal(informe.facturas.nuevos, 3);
    assert.equal(informe.facturas.cobros, 1, 'la cobrada entera; la de cobrado 0 queda sin cobro');
    assert.ok(informe.avisos.some((a) => a.fichero === 'facturas.csv' && /datos de la empresa que hay hoy/.test(a.aviso)), 'avisa de que la empresa es la de hoy');
    assert.match(informe.avisos.find((a) => a.fichero === 'facturas.csv' && /faltan/.test(a.aviso)).aviso, /V26 faltan números: V26-00001, V26-00002, V26-00003, V26-00004/);

    const lista = (await pide('/facturas')).json.facturas;
    const v5 = lista.find((f) => f.codigo === 'V26-00005');
    assert.equal(v5.estado_cobro, 'cobrada');
    assert.deepEqual([v5.base_cent, v5.iva_cent, v5.total_cent, v5.compra_cent], [239669, 50331, 990000, 700000]);
    assert.equal(v5.datos_cliente.nif, '12345678Z');
    assert.equal(v5.datos_vehiculo.matricula, '0000BBB');
    assert.equal(v5.datos_vehiculo.proveedor_nif, 'B12345674', 'para el libro REBU');
    assert.equal(v5.emitida_por, usuarioId);
    assert.equal(lista.find((f) => f.codigo === 'V26-00006').estado_cobro, 'anulada');
    const r1 = lista.find((f) => f.codigo === 'R26-00001');
    assert.deepEqual([r1.tipo, r1.total_cent, r1.base_cent], ['rectificativa', -100000, -82645]);

    const ingresos = (await pide('/facturas/libros/ingresos?anio=2026&trimestre=1')).json;
    assert.deepEqual(ingresos.filas.map((f) => f.codigo), ['V26-00005', 'V26-00006', 'R26-00001']);
    const [rebu] = (await pide('/facturas/libros/rebu?anio=2026')).json.filas;
    assert.deepEqual([rebu.codigo, rebu.fecha_compra, rebu.proveedor_nif, rebu.compra_cent, rebu.cliente_nif], ['V26-00005', '2026-01-02', 'B12345674', 700000, '12345678Z']);

    // La primera factura nueva desde el panel coge el número siguiente al de Pymecar
    assert.equal((await pide('/facturas/series')).json.find((x) => x.serie === 'V26').codigo_siguiente, 'V26-00007');
    const c = db.prepare("SELECT id FROM clientes WHERE nif = '12345678Z'").get().id;
    const v = (await pide('/vehiculos', { method: 'POST', body: { ...coche, matricula: '7777ZZZ', bastidor: null } })).json;
    const b = (await pide('/facturas', { method: 'POST', body: { cliente_id: c, vehiculo_id: v.id } })).json;
    assert.equal((await pide(`/facturas/${b.id}/emitir`, { method: 'POST' })).json.codigo, 'V26-00007');
  }));

test('migración: facturas que no se pueden cargar, y avisos de lo que no cuadra', () => {
  const { db, usuarioId } = baseNueva();
  const datos = PLANTILLAS();
  datos.facturas = [
    FACTURA({ base: '2.000,00' }),
    FACTURA({ codigo: '26-5' }),
    FACTURA({ codigo: 'V26-00009', cliente_nif: '00000000T' }),
    FACTURA({ codigo: 'R26-00002', precio: '500', rectifica: 'V26-00099' }),
    FACTURA({ codigo: 'V26-00010', iva_pct: '16', otra: 'x' }),
  ];
  const informe = importar(db, datos, { usuarioId });
  assert.deepEqual(informe.errores.map((e) => e.fila), [3, 4, 6, 5]);
  const de = (fila) => informe.errores.find((e) => e.fila === fila).errores.join(' ');
  assert.match(de(3), /codigo tiene que ser como V26-00038/);
  assert.match(de(4), /No hay ningún cliente con NIF 00000000T/);
  assert.match(de(5), /precio va en negativo en una rectificativa.*No hay ninguna factura de venta V26-00099.*necesita el motivo/);
  assert.match(de(6), /Columna desconocida: otra.*iva_pct tiene que ser 0, 10, 21/);
  assert.match(informe.avisos.find((a) => a.fila === 2 && a.fichero === 'facturas.csv').aviso, /base de Pymecar \(2000\.00\) no cuadra .*\(2396\.69\)/);
  assert.equal(importar(db, PLANTILLAS()).errores[0].errores[0], 'Hace falta un usuario de gerencia activo: las facturas se apuntan a su nombre');
  db.close();
});
