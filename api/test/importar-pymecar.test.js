// Migración desde Pymecar: plantillas CSV → proveedores, clientes y coches (stock vivo e histórico de ventas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrirDb } from '../src/db.js';
import { leerCsv } from '../src/migracion/leer-csv.js';
import { importar, eurosACent, dia } from '../src/migracion/importar.js';
import { ventasDelMes } from '../src/modules/informes/ventas.js';

const plantilla = (nombre) => leerCsv(readFileSync(new URL(`../../docs/migracion/${nombre}`, import.meta.url), 'utf8'));
const PLANTILLAS = () => ({ proveedores: plantilla('proveedores.csv'), clientes: plantilla('clientes.csv'), vehiculos: plantilla('vehiculos.csv') });
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
  const db = abrirDb(':memory:');
  const informe = importar(db, PLANTILLAS());
  assert.equal(informe.ensayo, true);
  assert.equal(informe.aplicado, false);
  assert.deepEqual(informe.errores, []);
  assert.deepEqual([informe.proveedores.nuevos, informe.clientes.nuevos, informe.vehiculos.nuevos, informe.vehiculos.vendidos], [1, 1, 2, 1]);
  assert.deepEqual([cuenta(db, 'proveedores'), cuenta(db, 'clientes'), cuenta(db, 'vehiculos'), cuenta(db, 'historial_estados')], [0, 0, 0, 0]);
  db.close();
});

test('migración: aplicar guarda; el stock sin fotos espera en «Pendiente de fotos» y la venta cuenta en su mes', () => {
  const db = abrirDb(':memory:');
  const informe = importar(db, PLANTILLAS(), { ensayo: false });
  assert.equal(informe.aplicado, true);
  assert.deepEqual(informe.avisos.map((a) => a.fila), [2]);

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
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'migracion'").get().n, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gastos").get().n, 0, 'los costes van con el libro de gastos');

  // Repetir la carga no duplica nada
  const otra = importar(db, PLANTILLAS(), { ensayo: false });
  assert.deepEqual([otra.proveedores.ya_estaban, otra.clientes.ya_estaban, otra.vehiculos.ya_estaban, otra.vehiculos.nuevos], [1, 1, 2, 0]);
  assert.equal(cuenta(db, 'vehiculos'), 2);
  db.close();
});

test('migración: con un solo error no se guarda nada, y el informe dice qué fila y por qué', () => {
  const db = abrirDb(':memory:');
  const datos = PLANTILLAS();
  datos.clientes.push({ nombre: 'Sin letra', nif: '12345678A' });
  datos.vehiculos.push(
    { matricula: '0000CCC', marca: 'Kia', modelo: 'Niro', pvp: 'mucho', coste_taller: '300' },
    { matricula: '0000DDD', marca: 'Kia', modelo: 'Ceed', cambio: 'semiautomático' },
    { matricula: '0000EEE', marca: 'Kia', modelo: 'Rio', estado: 'vendido' },
    { matricula: '0000FFF', marca: 'Kia', modelo: 'Picanto', comprador_nif: '00000000T', fecha_venta: '01/01/2026', fecha_alta: '01/02/2026' },
  );
  const informe = importar(db, datos, { ensayo: false });
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
