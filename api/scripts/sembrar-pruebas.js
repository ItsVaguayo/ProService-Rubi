// Siembra una base de PRUEBAS con los coches de ejemplo, fotos, reservas, historial, contactos y dos usuarios.
//   npm run seed                      → api/data/pruebas.db y sus fotos en api/data/uploads-pruebas (con --reset)
//   DB_PATH=/ruta/pruebas.db node scripts/sembrar-pruebas.js [--reset]
// Con --reset borra la base y las fotos antes de sembrar. Nunca contra la base real.
import { parseArgs } from 'node:util';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { abrirDb } from '../src/db.js';
import { crearUsuario } from '../src/modules/auth/sesiones.js';
import { separarCostes, guardarCostes } from '../src/modules/vehiculos/costes.js';
import { importesFactura } from '../src/modules/facturacion/importes.js';
import { apuntarGasto } from '../src/modules/gastos/apuntar.js';
import { CONTRASENA_PRUEBAS, USUARIOS_PRUEBAS } from './usuarios-pruebas.js';

const { values } = parseArgs({ options: { reset: { type: 'boolean', default: false } } });
const RUTA_DB = resolve(process.env.DB_PATH || './data/pruebas.db');
const DIR_FOTOS = resolve(process.env.UPLOADS_PATH || join(dirname(RUTA_DB), 'uploads-pruebas'));
const CONTRASENA = CONTRASENA_PRUEBAS;

if (!/prueba/i.test(RUTA_DB)) {
  console.error(`Por seguridad, la base de pruebas tiene que llevar «prueba» en el nombre: ${RUTA_DB}`);
  process.exit(1);
}
// --reset borra la carpeta de fotos entera: tiene que ser también de pruebas, nunca la de las fotos reales
if (values.reset && !/prueba/i.test(DIR_FOTOS)) {
  console.error(`Por seguridad, con --reset la carpeta de fotos tiene que llevar «prueba» en la ruta: ${DIR_FOTOS}`);
  process.exit(1);
}
if (values.reset) {
  for (const sufijo of ['', '-wal', '-shm']) rmSync(RUTA_DB + sufijo, { force: true });
  rmSync(DIR_FOTOS, { recursive: true, force: true });
}

const db = abrirDb(RUTA_DB);
if (db.prepare('SELECT COUNT(*) AS n FROM vehiculos').get().n > 0) {
  console.error('La base ya tiene coches. Usa --reset para empezar de cero.');
  process.exit(1);
}

// --- PNG de un color con una franja, sin dependencias ------------------------------------------
function png(ruta, [r, g, b], ancho = 800, alto = 600) {
  const fila = Buffer.alloc(1 + ancho * 3);
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const oscuro = y > alto * 0.62 && y < alto * 0.78; // franja: la «carretera»
    for (let x = 0; x < ancho; x++) {
      const k = oscuro ? 0.55 : 1;
      fila[1 + x * 3] = r * k; fila[2 + x * 3] = g * k; fila[3 + x * 3] = b * k;
    }
    filas.push(Buffer.from(fila));
  }
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo);
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, datos])) >>> 0);
    return Buffer.concat([largo, t, datos, crc]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0); cabecera.writeUInt32BE(alto, 4); cabecera[8] = 8; cabecera[9] = 2;
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera), trozo('IDAT', deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0)),
  ]));
}

// --- Datos -------------------------------------------------------------------------------------
const tecnica = { traccion: 'delantera', puertas: 5, plazas: 5, tapiceria: 'tela', garantia_meses: 12, ubicacion: 'parking', regimen_iva: 'REBU' };
const euros = (e) => Math.round(e * 100);

// dias = cuántos días lleva en stock; fotos = cuántas tiene; color = color de las fotos de prueba
// «Citroën C3» → «citroen-c3», el nombre de su foto de portada
const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const COCHES = [
  { estado: 'publicado', dias: 34, fotos: 15, color: [120, 124, 130], d: { matricula: '4821LKM', proveedor_nombre: 'Subastas Vallès', proveedor_telefono: '931112233', bastidor: 'VSSZZZKHZLR000001', marca: 'Seat', modelo: 'Ateca', version: '1.5 TSI Style', anio: 2020, fecha_matriculacion: '2020-05-12', kilometros: 62000, combustible: 'gasolina', cambio: 'manual', potencia_cv: 150, cilindrada: 1498, emisiones_co2: 136, etiqueta_dgt: 'C', carroceria: 'suv', color_exterior: 'gris', llantas: '18" aleación', precio_compra_cent: euros(16500), coste_transporte_cent: euros(250), coste_taller_cent: euros(420), coste_preparacion_cent: euros(180), coste_impuestos_cent: euros(310), pvp_cent: euros(20900), precio_financiado_cent: euros(19900), precio_minimo_cent: euros(19800) } },
  { estado: 'reservado', dias: 51, fotos: 16, color: [235, 235, 232], reserva: { cliente: 'Marta López', senal: 500 }, d: { matricula: '7390KXB', bastidor: 'NMTKZ3BX10R000002', marca: 'Toyota', modelo: 'C-HR', version: '125H Advance', anio: 2019, fecha_matriculacion: '2019-03-02', kilometros: 81200, combustible: 'hibrido', cambio: 'automatico', potencia_cv: 122, cilindrada: 1798, emisiones_co2: 101, etiqueta_dgt: 'ECO', carroceria: 'suv', color_exterior: 'blanco', llantas: '18" aleación', propiedad: 'deposito', propietario_nombre: 'Jordi Puig', propietario_telefono: '600111222', pago_propietario_cent: euros(19000), coste_preparacion_cent: euros(150), pvp_cent: euros(21500), precio_financiado_cent: euros(20500) } },
  { estado: 'publicado', dias: 12, fotos: 18, color: [40, 70, 140], d: { matricula: '2215LBC', proveedor_nombre: 'Particular (Sabadell)', proveedor_telefono: '644555666', bastidor: 'WVWZZZCDZMW000003', marca: 'Volkswagen', modelo: 'Golf', version: '2.0 TDI Life', anio: 2021, fecha_matriculacion: '2021-01-20', kilometros: 54700, combustible: 'diesel', cambio: 'manual', potencia_cv: 115, cilindrada: 1968, emisiones_co2: 112, etiqueta_dgt: 'C', carroceria: 'compacto', color_exterior: 'azul', llantas: '16" aleación', precio_compra_cent: euros(15800), coste_transporte_cent: euros(300), coste_taller_cent: euros(120), coste_preparacion_cent: euros(150), pvp_cent: euros(19900), precio_financiado_cent: euros(18900) } },
  { estado: 'publicado', dias: 97, fotos: 15, color: [170, 30, 30], d: { matricula: '9018LDF', bastidor: 'VF1RJA00000000004', marca: 'Renault', modelo: 'Clio', version: '1.0 TCe Zen', anio: 2021, fecha_matriculacion: '2021-06-15', kilometros: 45300, combustible: 'gasolina', cambio: 'manual', potencia_cv: 90, cilindrada: 999, emisiones_co2: 118, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'rojo', llantas: '16"', propiedad: 'deposito', propietario_nombre: 'Anna Soler', propietario_telefono: '600333444', pago_propietario_cent: euros(12000), coste_taller_cent: euros(90), pvp_cent: euros(13900), precio_financiado_cent: euros(13200) } },
  { estado: 'vendido', dias: 64, vendidoHace: 1, vendio: 'comercial', fotos: 15, color: [245, 245, 245], d: { matricula: '6604KCS', bastidor: 'WDF44770300000005', marca: 'Mercedes-Benz', modelo: 'Vito', version: '114 CDI Larga', anio: 2018, fecha_matriculacion: '2018-09-04', kilometros: 142000, combustible: 'diesel', cambio: 'manual', potencia_cv: 136, cilindrada: 2143, emisiones_co2: 178, etiqueta_dgt: 'B', carroceria: 'furgoneta', plazas: 8, color_exterior: 'blanco', llantas: '16"', precio_compra_cent: euros(18500), coste_transporte_cent: euros(450), coste_taller_cent: euros(980), coste_preparacion_cent: euros(220), coste_impuestos_cent: euros(400), pvp_cent: euros(22900) } },
  { estado: 'publicado', dias: 8, fotos: 20, color: [90, 95, 100], d: { matricula: '3380LGH', bastidor: 'KNACC81CGN5000006', marca: 'Kia', modelo: 'Niro', version: '1.6 HEV Drive', anio: 2022, fecha_matriculacion: '2022-02-10', kilometros: 31000, combustible: 'hibrido', cambio: 'automatico', potencia_cv: 141, cilindrada: 1580, emisiones_co2: 99, etiqueta_dgt: 'ECO', carroceria: 'suv', color_exterior: 'gris', llantas: '16" aleación', propiedad: 'deposito', propietario_nombre: 'Taller Vallès SL', propietario_telefono: '937000000', pago_propietario_cent: euros(21500), pvp_cent: euros(23900), precio_financiado_cent: euros(22900) } },
  { estado: 'publicado', dias: 71, fotos: 15, color: [225, 225, 220], d: { matricula: '1147KYM', bastidor: 'VSSZZZKJZKR000007', marca: 'Seat', modelo: 'Ibiza', version: '1.0 TSI FR', anio: 2019, fecha_matriculacion: '2019-07-30', kilometros: 73500, combustible: 'gasolina', cambio: 'manual', potencia_cv: 115, cilindrada: 999, emisiones_co2: 116, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'blanco', llantas: '17" aleación', precio_compra_cent: euros(10200), coste_transporte_cent: euros(200), coste_taller_cent: euros(350), pvp_cent: euros(12500) } },
  { estado: 'publicado', dias: 23, fotos: 17, color: [25, 25, 28], d: { matricula: '5562LCN', proveedor_nombre: 'Autos Terrassa SL', proveedor_telefono: '937778899', bastidor: 'VF3MCYHZRLS000008', marca: 'Peugeot', modelo: '3008', version: '1.5 BlueHDi Allure', anio: 2020, fecha_matriculacion: '2020-10-01', kilometros: 88000, combustible: 'diesel', cambio: 'automatico', potencia_cv: 130, cilindrada: 1499, emisiones_co2: 124, etiqueta_dgt: 'C', carroceria: 'suv', color_exterior: 'negro', llantas: '18" aleación', precio_compra_cent: euros(17600), coste_transporte_cent: euros(350), coste_taller_cent: euros(610), coste_preparacion_cent: euros(160), pvp_cent: euros(21900), precio_financiado_cent: euros(20900) } },
  // Aún no están a la venta: dan vida al tablero
  { estado: 'en_taller', dias: 6, fotos: 1, d: { matricula: '8890KZT', bastidor: 'WAUZZZ8V0KA000009', marca: 'Audi', modelo: 'A3', version: 'Sportback 30 TFSI', anio: 2019, kilometros: 69000, combustible: 'gasolina', cambio: 'manual', precio_compra_cent: euros(17900), coste_taller_cent: euros(640) } },
  { estado: 'pendiente_fotos', dias: 15, fotos: 4, color: [200, 120, 40], d: { matricula: '4473LBW', bastidor: 'VF7SXHMZ6LT000010', marca: 'Citroën', modelo: 'C3', version: '1.2 PureTech Shine', anio: 2020, fecha_matriculacion: '2020-11-18', kilometros: 38500, combustible: 'gasolina', cambio: 'manual', potencia_cv: 83, cilindrada: 1199, emisiones_co2: 119, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'naranja', precio_compra_cent: euros(9800), coste_preparacion_cent: euros(140), pvp_cent: euros(12900) } },
  { estado: 'en_preparacion', dias: 3, fotos: 1, d: { matricula: '2031LFK', marca: 'Dacia', modelo: 'Sandero', version: 'Stepway TCe', anio: 2021, kilometros: 41000, combustible: 'glp', cambio: 'manual', precio_compra_cent: euros(10300) } },
  { estado: 'pendiente_recoger', dias: 1, fotos: 1, d: { matricula: '0917KSP', marca: 'Ford', modelo: 'Transit Custom', propiedad: 'deposito', propietario_nombre: 'Construccions Rubí SL', propietario_telefono: '936000000' } },
  // Ya vendidos y entregados: no salen en el tablero, pero dan las ventas de septiembre y octubre a los informes
  { estado: 'entregado', dias: 58, vendidoHace: 20, fotos: 1, d: { matricula: '6127KWR', bastidor: 'VF1RJA00000000013', marca: 'Renault', modelo: 'Clio', version: '1.5 Blue dCi Intens', anio: 2020, fecha_matriculacion: '2020-04-21', kilometros: 67400, combustible: 'diesel', cambio: 'manual', potencia_cv: 115, cilindrada: 1461, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'gris', precio_compra_cent: euros(10400), coste_transporte_cent: euros(180), coste_taller_cent: euros(260), coste_preparacion_cent: euros(140), pvp_cent: euros(12900) } },
  { estado: 'entregado', dias: 47, vendidoHace: 9, vendio: 'comercial', fotos: 1, d: { matricula: '3392LBN', bastidor: 'NMTKZ3BX10R000014', marca: 'Toyota', modelo: 'C-HR', version: '180H GR Sport', anio: 2021, fecha_matriculacion: '2021-09-08', kilometros: 52800, combustible: 'hibrido', cambio: 'automatico', potencia_cv: 184, cilindrada: 1987, etiqueta_dgt: 'ECO', carroceria: 'suv', color_exterior: 'blanco', propiedad: 'deposito', propietario_nombre: 'Laura Casals', propietario_telefono: '611222333', pago_propietario_cent: euros(22800), coste_preparacion_cent: euros(160), pvp_cent: euros(25400) } },
  { estado: 'entregado', dias: 63, vendidoHace: 27, fotos: 1, d: { matricula: '8815KTD', bastidor: 'VSSZZZKJZKR000015', marca: 'Seat', modelo: 'Ibiza', version: '1.0 TSI Style', anio: 2019, fecha_matriculacion: '2019-02-14', kilometros: 81900, combustible: 'gasolina', cambio: 'manual', potencia_cv: 95, cilindrada: 999, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'rojo', precio_compra_cent: euros(8700), coste_transporte_cent: euros(150), coste_taller_cent: euros(410), coste_preparacion_cent: euros(120), pvp_cent: euros(10900) } },
  { estado: 'entregado', dias: 80, vendidoHace: 35, vendio: 'comercial', fotos: 1, d: { matricula: '4470LDX', bastidor: 'VF3MCYHZRLS000016', marca: 'Peugeot', modelo: '3008', version: '1.2 PureTech Active', anio: 2020, fecha_matriculacion: '2020-06-30', kilometros: 59300, combustible: 'gasolina', cambio: 'manual', potencia_cv: 130, cilindrada: 1199, etiqueta_dgt: 'C', carroceria: 'suv', color_exterior: 'azul', precio_compra_cent: euros(16900), coste_transporte_cent: euros(320), coste_taller_cent: euros(540), coste_preparacion_cent: euros(170), coste_impuestos_cent: euros(290), pvp_cent: euros(20500) } },
];

// --- Siembra -----------------------------------------------------------------------------------
const RECORRIDO = ['pendiente_recoger', 'en_transporte', 'recibido', 'en_taller', 'en_preparacion', 'pendiente_fotos', 'publicado', 'reservado', 'vendido', 'entregado'];
const haceDias = (n) => `datetime('now', '-${n} days')`;

db.transaction(() => {
  const [jaume, comercial] = USUARIOS_PRUEBAS.map((u) => crearUsuario(db, { ...u, contrasena: CONTRASENA }));

  // Extras del catálogo cerrado (migración 0003): aquí no se crean, solo se marcan.
  const idDeExtra = db.prepare('SELECT id FROM extras WHERE nombre = ?');
  const extras = ['Navegador', 'Cámara de marcha atrás', 'Sensores de aparcamiento traseros', 'Control de crucero', 'Apple CarPlay', 'Climatizador', 'Faros LED', 'Llantas de aleación']
    .map((nombre) => {
      const extra = idDeExtra.get(nombre);
      if (!extra) throw new Error(`El extra «${nombre}» no está en el catálogo`);
      return extra.id;
    });

  COCHES.forEach((c, i) => {
    const datos = { ...tecnica, ...c.d };
    if (datos.propiedad === 'deposito') delete datos.regimen_iva;
    const costes = separarCostes(datos); // van al libro de gastos (0012), no a la tabla vehiculos
    const cols = Object.keys(datos);
    const id = Number(db.prepare(`INSERT INTO vehiculos (${cols.join(',')}, estado, creado_en, actualizado_en)
                                  VALUES (${cols.map(() => '?').join(',')}, ?, ${haceDias(c.dias)}, ${haceDias(Math.min(c.dias, 2))})`)
      .run(...cols.map((k) => datos[k]), c.estado).lastInsertRowid);
    db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);
    guardarCostes(db, id, costes, jaume);

    // Historial: la preparación ocupa los primeros días (hasta 12) y el último estado, el resto.
    // Así un coche con 97 días en stock lleva unos 85 a la venta, que es lo que ve el tablero.
    // Un coche vendido sin reserva no pasa por «Reservado»
    const pasos = RECORRIDO.slice(0, RECORRIDO.indexOf(c.estado) + 1).filter((e) => e !== 'reservado' || c.estado === 'reservado' || c.reserva);
    const preparacion = Math.min(12, Math.floor(c.dias / 2));
    pasos.forEach((estado, n) => {
      const ultimo = n === pasos.length - 1;
      let dia = ultimo && n > 0 ? c.dias - preparacion : Math.round(c.dias - (preparacion * n) / Math.max(pasos.length - 1, 1));
      // Las ventas, en su día: vendido hace vendidoHace días y entregado tres días después
      if (c.vendidoHace != null && estado === 'vendido') dia = c.vendidoHace;
      if (c.vendidoHace != null && estado === 'entregado') dia = Math.max(0, c.vendidoHace - 3);
      const quien = estado === 'vendido' && c.vendio === 'comercial' ? comercial : jaume;
      db.prepare(`INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, ?, ?, ?, ${haceDias(dia)})`)
        .run(id, n ? pasos[n - 1] : null, estado, quien);
    });

    // La portada es una foto real del modelo si la hay en scripts/fotos-portada (ver su CREDITOS.md);
    // el resto, imágenes de color.
    const portada = new URL(`./fotos-portada/${slug(`${c.d.marca}-${c.d.modelo}`)}.jpg`, import.meta.url);
    for (let f = 1; f <= c.fotos; f++) {
      if (f === 1 && existsSync(portada)) {
        const relativa = `vehiculos/${id}/01.jpg`;
        mkdirSync(dirname(join(DIR_FOTOS, relativa)), { recursive: true });
        copyFileSync(portada, join(DIR_FOTOS, relativa));
        db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)').run(id, f, relativa);
        continue;
      }
      const relativa = `vehiculos/${id}/${String(f).padStart(2, '0')}.png`;
      const tono = 0.8 + (f % 5) * 0.06;
      png(join(DIR_FOTOS, relativa), (c.color ?? [128, 128, 128]).map((v) => Math.min(255, Math.round(v * tono)))); // sin color: gris
      db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)').run(id, f, relativa);
    }

    extras.slice(0, 3 + (i % 5)).forEach((extra) => db.prepare('INSERT INTO vehiculo_extras VALUES (?, ?)').run(id, extra));

    if (c.reserva) {
      db.prepare(`INSERT INTO reservas (vehiculo_id, cliente, senal_cent, fecha, caduca_en) VALUES (?, ?, ?, ${haceDias(2)}, datetime('now', '+5 days'))`)
        .run(id, c.reserva.cliente, euros(c.reserva.senal));
    }
  });
})();

// Contactos de la web: uno de un coche que lleva más de un día sin atender, otro de hoy y uno ya atendido
db.transaction(() => {
  const coche = (matricula) => db.prepare('SELECT id FROM vehiculos WHERE matricula = ?').get(matricula)?.id ?? null;
  const ins = db.prepare(`INSERT INTO contactos (nombre, telefono, email, tipo, vehiculo_id, mensaje, recibido_en, atendido_en, atendido_por)
                          VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?)`);
  ins.run('Marta Soler', '600 111 222', null, 'prueba', coche('4821LKM'), '¿Se puede probar el sábado por la mañana?', '-30 hours', null, null);
  ins.run('Iván Roca', '611 333 444', 'ivan@example.com', 'financiacion', coche('2215LBC'), 'Quiero pagarlo en 60 meses, ¿cuánto sería al mes?', '-3 hours', null, null);
  ins.run('Nuria Pons', '622 555 666', null, 'tasacion', null, 'Opel Corsa 2016, 98.000 km. Lo daría como parte del pago.', '-2 days', new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' '), 1);
})();

// Clientes y proveedores (0008). Los proveedores escritos en la ficha se unen a su fila; uno sin coches.
db.transaction(() => {
  const ins = db.prepare('INSERT INTO proveedores (tipo, nombre, nif, telefono, poblacion) VALUES (?, ?, ?, ?, ?)');
  const tipos = { 'Subastas Vallès': 'subasta', 'Particular (Sabadell)': 'particular' };
  for (const { proveedor_nombre: nombre, proveedor_telefono: telefono } of db.prepare(
    'SELECT DISTINCT proveedor_nombre, proveedor_telefono FROM vehiculos WHERE proveedor_nombre IS NOT NULL').all()) {
    const id = ins.run(tipos[nombre] ?? 'profesional', nombre, null, telefono, null).lastInsertRowid;
    db.prepare('UPDATE vehiculos SET proveedor_id = ? WHERE proveedor_nombre = ? AND proveedor_telefono IS ?').run(id, nombre, telefono);
  }
  ins.run('comisionista', 'Jordi Mas (comisionista)', null, '655 777 888', 'Terrassa');

  const cli = db.prepare('INSERT INTO clientes (tipo, nombre, nif, telefono, email, direccion, codigo_postal, poblacion, provincia, origen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const clientes = [
    cli.run('particular', 'Laura Gil Ferrer', '12345678Z', '633 222 111', 'laura@example.com', 'C/ Major 12', '08191', 'Rubí', 'Barcelona', 'tienda').lastInsertRowid,
    cli.run('particular', 'Pau Serra Vidal', 'X1234567L', '644 888 999', null, 'Av. Barcelona 40, 2º 1ª', '08191', 'Rubí', 'Barcelona', 'web').lastInsertRowid,
    cli.run('empresa', 'Reformas Vallès SL', 'B12345674', '937 001 122', 'admin@example.com', 'Pol. Ind. Can Rosés, nave 4', '08191', 'Rubí', 'Barcelona', 'teléfono').lastInsertRowid,
  ];
  // Los vendidos se reparten entre los clientes, para que sus fichas tengan coches
  db.prepare("SELECT id FROM vehiculos WHERE estado IN ('vendido', 'entregado') ORDER BY id").all()
    .forEach((v, i) => db.prepare('UPDATE vehiculos SET comprador_id = ? WHERE id = ?').run(clientes[i % clientes.length], v.id));
  db.prepare("UPDATE contactos SET cliente_id = (SELECT id FROM clientes WHERE nombre = 'Pau Serra Vidal') WHERE nombre = 'Nuria Pons'").run();

  // CRM (0009 y 0010): más clientes, repartidos por el embudo, y actividades de hoy, atrasadas y hechas
  const mas = [
    ['particular', 'Jordi Camps', null, '611 222 333', 'web', 'nuevo'],
    ['particular', 'Sílvia Moreno', null, '651 230 984', 'tienda', 'interesado'],
    ['particular', 'Oriol Batlle', null, '622 444 555', 'teléfono', 'me_lo_pienso'],
    ['particular', 'Enric Puig', null, '633 777 888', 'web', 'perdido'],
    ['particular', 'Montse Ribas', null, '644 101 202', 'web', 'nuevo'],
    ['particular', 'Albert Ferrer', null, '655 303 404', 'tienda', 'nuevo'],
    ['particular', 'Carla Vidal', null, '666 505 606', 'web', 'interesado'],
    ['particular', 'Xavi Soler', null, '677 707 808', 'teléfono', 'interesado'],
    ['particular', 'Núria Casals', null, '688 909 010', 'web', 'me_lo_pienso'],
    ['empresa', 'Jardineria Rubí SL', 'B65432109', '935 887 766', 'teléfono', 'negociando'],
    ['particular', 'Pere Martí', null, '699 121 314', 'tienda', 'negociando'],
    ['particular', 'Anna Roig', null, '610 151 617', 'web', 'perdido'],
  ];
  for (const [tipo, nombre, nif, tel, origen, estado] of mas) {
    db.prepare('INSERT INTO clientes (tipo, nombre, nif, telefono, origen, estado_comercial, poblacion) VALUES (?, ?, ?, ?, ?, ?, ?)').run(tipo, nombre, nif, tel, origen, estado, 'Rubí');
  }
  db.prepare("UPDATE clientes SET estado_comercial = 'ganado' WHERE nombre IN ('Laura Gil Ferrer', 'Pau Serra Vidal')").run();
  db.prepare("UPDATE clientes SET estado_comercial = 'negociando' WHERE nombre = 'Reformas Vallès SL'").run();
  const cliente = (nombre) => db.prepare('SELECT id FROM clientes WHERE nombre = ?').get(nombre).id;
  const jaume = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia' ORDER BY id LIMIT 1").get().id;
  const comercial = db.prepare("SELECT id FROM usuarios WHERE rol = 'comercial' ORDER BY id LIMIT 1").get().id;
  // Hora de aquí, como la guarda el panel: 'AAAA-MM-DD HH:MM'
  const dia = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const act = db.prepare(`INSERT INTO actividades (tipo, cliente_id, descripcion, programada_para, hecha_en, resultado, responsable_id, creado_por)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  act.run('llamada', cliente('Reformas Vallès SL'), 'Pasarles el presupuesto del rotulista para la Vito.', `${dia(0)} 09:30`, new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' '), 'Les va bien, lo hablan el lunes', jaume, jaume);
  act.run('llamada', cliente('Jordi Camps'), 'Explicarle la financiación del Golf a 48 meses.', `${dia(0)} 11:30`, null, null, comercial, jaume);
  act.run('visita', cliente('Sílvia Moreno'), 'Viene a ver el Kia con su pareja. Tenerlo lavado y en la puerta.', `${dia(0)} 12:00`, null, null, comercial, comercial);
  act.run('llamada', cliente('Oriol Batlle'), '¿Se ha decidido por el 3008? Puedo bajar 400 € si cierra esta semana.', `${dia(0)} 17:30`, null, null, jaume, jaume);
  act.run('tarea', cliente('Oriol Batlle'), 'Mirar precios del 3008 en Coches.net para comparar.', `${dia(-2)} 10:00`, null, null, jaume, jaume);
  act.run('whatsapp', cliente('Laura Gil Ferrer'), 'Pedirle una reseña en Google.', `${dia(3)} 10:00`, null, null, comercial, jaume);
  act.run('nota', cliente('Enric Puig'), 'Se quedó un Tucson en otro concesionario. Motivo: precio.', null, new Date(Date.now() - 16 * 86400000).toISOString().slice(0, 19).replace('T', ' '), null, jaume, jaume);

  // Más recordatorios de prueba: atrasados, de hoy (de los dos), hechos con resultado y de los próximos días
  const haceHoras = (h) => new Date(Date.now() - h * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  act.run('llamada', cliente('Montse Ribas'), 'Preguntó por el Ibiza en la web. Llamarla para ofrecerle una prueba.', `${dia(-1)} 16:00`, null, null, comercial, comercial);
  act.run('tarea', cliente('Pere Martí'), 'Pedir a la financiera la respuesta del préstamo.', `${dia(-3)} 12:00`, null, null, jaume, jaume);
  act.run('whatsapp', cliente('Carla Vidal'), 'Mandarle las fotos del interior del Kia y el informe de la revisión.', `${dia(0)} 10:00`, haceHoras(2), 'Le han gustado; quiere venir el sábado', comercial, comercial);
  act.run('prueba', cliente('Xavi Soler'), 'Prueba del Golf. Depósito lleno y el seguro de prueba a mano.', `${dia(0)} 13:00`, null, null, comercial, jaume);
  act.run('email', cliente('Jardineria Rubí SL'), 'Enviar la oferta de las dos furgonetas con la tasación de la vieja.', `${dia(0)} 16:00`, null, null, jaume, jaume);
  act.run('tarea', cliente('Núria Casals'), 'Preparar comparativa del 3008 frente al Tucson que le ofrecen en Sabadell.', `${dia(0)} 18:30`, null, null, comercial, comercial);
  act.run('visita', cliente('Albert Ferrer'), 'Viene con su Corsa para tasarlo. Llevarlo al taller antes de darle precio.', `${dia(1)} 10:30`, null, null, comercial, jaume);
  act.run('llamada', cliente('Pere Martí'), 'Confirmar la fecha de entrega del C-HR.', `${dia(1)} 12:00`, null, null, jaume, jaume);
  act.run('prueba', cliente('Carla Vidal'), 'Prueba del Kia con su pareja.', `${dia(2)} 11:00`, null, null, comercial, comercial);
  act.run('tarea', cliente('Jardineria Rubí SL'), 'Mirar si la Vito del proveedor llega antes de fin de mes.', `${dia(2)} 17:00`, null, null, jaume, jaume);
  act.run('whatsapp', cliente('Jordi Camps'), 'Recordarle que traiga la última nómina para la financiación.', `${dia(3)} 09:30`, null, null, comercial, comercial);
  act.run('llamada', cliente('Núria Casals'), 'Llamar después de que pruebe el de Sabadell. Margen hasta 300 €.', `${dia(4)} 18:00`, null, null, comercial, jaume);
  act.run('email', cliente('Reformas Vallès SL'), 'Mandar la propuesta de la segunda furgoneta para primavera.', `${dia(5)} 10:00`, null, null, jaume, jaume);
  act.run('llamada', cliente('Pau Serra Vidal'), 'Llamada del mes: qué tal va con el C-HR.', `${dia(6)} 11:00`, null, null, comercial, jaume);
  act.run('tarea', cliente('Montse Ribas'), 'Si no contesta, mandarle un WhatsApp con dos coches parecidos.', `${dia(9)} 10:00`, null, null, comercial, comercial);
  act.run('llamada', cliente('Anna Roig'), 'No le daban la financiación.', `${dia(-12)} 11:00`, haceHoras(12 * 24), 'Se lo ha comprado su hermano', jaume, jaume);
  // Dos de contactos de la web que aún no son clientes
  const actContacto = db.prepare(`INSERT INTO actividades (tipo, contacto_id, descripcion, programada_para, responsable_id, creado_por)
                                  VALUES (?, (SELECT id FROM contactos WHERE nombre = ?), ?, ?, ?, ?)`);
  actContacto.run('llamada', 'Iván Roca', 'Devolverle la llamada: quiere saber la cuota a 60 meses.', `${dia(0)} 15:30`, comercial, comercial);
  actContacto.run('tarea', 'Marta Soler', 'Buscarle un Ateca con menos de 60.000 km.', `${dia(1)} 17:30`, jaume, jaume);
})();

// Hasta aquí, los coches de la ficha. Los de la historia de abajo se vendieron antes del arranque y se
// facturaron en Pymecar: no llevan factura nuestra.
const ultimoCocheActual = db.prepare('SELECT MAX(id) AS n FROM vehiculos').get().n;

// Historia para los informes: once meses de ventas pasadas (entre 2 y 5 coches entregados al mes, con su
// compra, su PVP, quién vendió y su comprador, así salen también sus facturas) y los gastos fijos de la
// tienda de cada mes. Determinista: cada siembra da lo mismo, para poder comparar capturas.
db.transaction(() => {
  const jaume = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia' ORDER BY id LIMIT 1").get().id;
  const comercial = db.prepare("SELECT id FROM usuarios WHERE rol = 'comercial' ORDER BY id LIMIT 1").get().id;
  const clientes = db.prepare('SELECT id FROM clientes ORDER BY id').all().map((c) => c.id);
  const MODELOS = [['Seat', 'León', '1.5 TSI FR', 'gasolina'], ['Volkswagen', 'Polo', '1.0 TSI', 'gasolina'], ['Toyota', 'Corolla', '125H Active', 'hibrido'],
    ['Renault', 'Mégane', '1.5 dCi', 'diesel'], ['Peugeot', '208', '1.2 PureTech', 'gasolina'], ['Kia', 'Sportage', '1.6 CRDi', 'diesel'],
    ['Opel', 'Corsa', '1.2', 'gasolina'], ['Hyundai', 'Tucson', '1.6 TGDI', 'gasolina'], ['Dacia', 'Sandero', '1.0 TCe', 'glp']];
  const POR_MES = [3, 2, 4, 3, 5, 2, 3, 4, 3, 2, 4]; // de hace 11 meses a hace 1
  let n = 0;
  const hist = db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, ?, ?, ?, ?)');
  POR_MES.forEach((cuantos, k) => {
    const mesesAtras = 11 - k;
    for (let j = 0; j < cuantos; j++, n++) {
      const [marca, modelo, version, combustible] = MODELOS[n % MODELOS.length];
      const pvp = (9000 + ((n * 2371) % 17000)) * 100;
      const compra = Math.round(pvp * (0.78 + (n % 5) * 0.02) / 1000) * 1000;
      // El día de la venta: dentro de ese mes (UTC), repartido
      const ahora = new Date();
      const venta = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - mesesAtras, 3 + ((j * 7 + n) % 24), 11));
      const sql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
      const alta = new Date(venta.getTime() - (25 + (n % 50)) * 86400000);
      const matricula = `${String(1000 + n * 37).slice(-4)}${'BCDFGHJKLMNPRSTVWXYZ'[n % 20]}${'KLM'[n % 3]}${'BCD'[n % 3]}`;
      const id = Number(db.prepare(`INSERT INTO vehiculos (matricula, marca, modelo, version, combustible, anio, kilometros, propiedad, estado,
                                      pvp_cent, precio_compra_cent, regimen_iva, comprador_id, creado_en, actualizado_en)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, 'propio', 'entregado', ?, ?, 'REBU', ?, ?, ?)`)
        .run(matricula, marca, modelo, version, combustible, 2016 + (n % 7), 40000 + ((n * 9173) % 120000), pvp, compra,
          clientes[n % clientes.length], sql(alta), sql(venta)).lastInsertRowid);
      db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);
      hist.run(id, null, 'pendiente_recoger', jaume, sql(alta));
      hist.run(id, 'pendiente_recoger', 'publicado', jaume, sql(new Date(alta.getTime() + 10 * 86400000)));
      hist.run(id, 'publicado', 'vendido', n % 3 === 0 ? jaume : comercial, sql(venta));
      hist.run(id, 'vendido', 'entregado', jaume, sql(new Date(venta.getTime() + 3 * 86400000)));
    }
  });
  // Gastos fijos de la tienda, cada mes de los últimos doce (los de un coche ya los pone cada ficha)
  const FIJOS = [['alquileres', 'Alquiler de la nave', 120000, 'irpf', 19], ['electricidad', 'Luz', 21000, 'general', 0],
    ['gestorias', 'Contabilidad', 18000, 'irpf', 15], ['publicidad', 'Coches.net, cuota', 28900, 'general', 0]];
  const ahora = new Date();
  for (let mesesAtras = 11; mesesAtras >= 1; mesesAtras--) {
    const dia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - mesesAtras, 2)).toISOString().slice(0, 10);
    FIJOS.forEach(([concepto, descripcion, base, tipo, irpf], i) => {
      const g = apuntarGasto(db, { fecha: dia, concepto, descripcion: `${descripcion}, ${dia.slice(0, 7)}`, base_cent: base + (mesesAtras * 137 * (i + 1)) % 2000,
        tipo, irpf_pct: irpf, forma_pago: 'transferencia' }, jaume);
      db.prepare('UPDATE gastos SET pagado_en = ? WHERE id = ?').run(dia, g);
    });
  }
})();

// Facturación (0013): el domicilio fiscal ya lo pone la migración 0015 (el de sus contratos de Pymecar),
// la serie V26 siguiendo a Pymecar (iba por la 38) y una factura por cada coche vendido con comprador:
// las entregadas, cobradas; la vendida más reciente, con la señal y el resto pendiente; una vencida a medias.
db.transaction(() => {
  const anio = new Date().getFullYear();
  const serie = `V${String(anio).slice(2)}`;
  db.prepare("INSERT INTO series (serie, tipo, anio, ultimo) VALUES (?, 'venta', ?, 38)").run(serie, anio);
  const jaume = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia' ORDER BY id LIMIT 1").get().id;
  const empresa = JSON.stringify(db.prepare('SELECT * FROM empresa').get());
  const vendidos = db.prepare(`SELECT v.*, (SELECT MAX(h.fecha) FROM historial_estados h WHERE h.vehiculo_id = v.id AND h.a = 'vendido') AS vendido_en
                                 FROM vehiculos v WHERE v.comprador_id IS NOT NULL AND v.id <= ? ORDER BY vendido_en, v.id`).all(ultimoCocheActual);
  const sumarDias = (dia, n) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
  vendidos.forEach((v, i) => {
    const fecha = (v.vendido_en ?? v.creado_en).slice(0, 10);
    const numero = db.prepare('UPDATE series SET ultimo = ultimo + 1 WHERE serie = ? RETURNING ultimo').get(serie).ultimo;
    const compra = v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent;
    const regimen = v.propiedad !== 'deposito' && v.regimen_iva === 'deducible' ? 'general' : 'REBU';
    const imp = importesFactura({ regimen, precio_cent: v.pvp_cent, compra_cent: compra });
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(v.comprador_id);
    const vencimiento = i === 0 ? sumarDias(fecha, 10) : sumarDias(fecha, 30); // la más antigua, vencida
    const id = db.prepare(`INSERT INTO facturas (estado, serie, numero, codigo, fecha, vencimiento, cliente_id, vehiculo_id, regimen, precio_cent, compra_cent,
                             base_cent, iva_pct, iva_cent, total_cent, forma_pago, garantia_tipo, garantia_meses, datos_empresa, datos_cliente, datos_vehiculo,
                             creado_por, emitida_por, emitida_en)
                           VALUES ('emitida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 21, ?, ?, 'transferencia', 'directa', 12, ?, ?, ?, ?, ?, ?)`)
      .run(serie, numero, `${serie}-${String(numero).padStart(5, '0')}`, fecha, vencimiento, v.comprador_id, v.id, regimen, v.pvp_cent, compra,
        imp.base_cent, imp.iva_cent, imp.total_cent, empresa, JSON.stringify(cliente),
        JSON.stringify({ marca: v.marca, modelo: v.modelo, version: v.version, matricula: v.matricula, bastidor: v.bastidor, kilometros: v.kilometros, fecha_compra: v.creado_en.slice(0, 10), proveedor_nombre: v.proveedor_nombre }),
        jaume, jaume, `${fecha} 12:00:00`).lastInsertRowid;
    const cobro = db.prepare('INSERT INTO cobros (factura_id, fecha, importe_cent, forma_pago, creado_por) VALUES (?, ?, ?, ?, ?)');
    if (v.estado === 'entregado' && i !== 0) cobro.run(id, sumarDias(fecha, 2), imp.total_cent, 'transferencia', jaume);
    else cobro.run(id, fecha, 50000, 'contado', jaume); // la señal; el resto, pendiente
  });
})();

// Agenda de pruebas (bloque 10): de hace tres días a dentro de una semana, con todos los estados. Las horas,
// en punto o y media dentro del horario; el domingo no hay pruebas. Una pedida desde la web lleva su contacto.
db.transaction(() => {
  const jaume = db.prepare("SELECT id FROM usuarios WHERE rol = 'gerencia' ORDER BY id LIMIT 1").get().id;
  const coche = (matricula) => db.prepare('SELECT id FROM vehiculos WHERE matricula = ?').get(matricula)?.id
    ?? db.prepare("SELECT id FROM vehiculos WHERE estado = 'publicado' ORDER BY id LIMIT 1").get().id;
  const publicados = db.prepare("SELECT id FROM vehiculos WHERE estado = 'publicado' ORDER BY id").all().map((v) => v.id);
  const dia = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const domingo = (n) => new Date(Date.now() + n * 86400000).getDay() === 0;
  const sabado = (n) => new Date(Date.now() + n * 86400000).getDay() === 6;
  const ins = db.prepare(`INSERT INTO citas (vehiculo_id, inicio, estado, nombre, telefono, cliente_id, contacto_id, origen, notas, creado_por)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const cliente = (nombre) => db.prepare('SELECT id FROM clientes WHERE nombre = ?').get(nombre)?.id ?? null;
  const PLAN = [
    [-3, '10:30', 'hecha', 'Marta López Garcia', '611 000 111', null, null],
    [-3, '17:00', 'hecha', 'Oriol Batlle', '622 444 555', 'Oriol Batlle', null],
    [-2, '11:00', 'no_vino', 'Laia Font', '688 402 277', null, null],
    [-1, '12:00', 'hecha', 'Sílvia Moreno', '651 230 984', 'Sílvia Moreno', 'Viene con su pareja'],
    [0, '18:00', 'confirmada', 'Xavi Soler', '677 707 808', 'Xavi Soler', 'Depósito lleno y seguro de prueba a mano'],
    [0, '18:30', 'pedida', 'Jordi Camps', '611 222 333', 'Jordi Camps', null],
    [1, '10:00', 'pedida', 'Marta Soler Bosch', '600 111 222', null, 'web'],
    [1, '12:00', 'confirmada', 'Carla Vidal', '666 505 606', 'Carla Vidal', 'Prueba del Kia con su pareja'],
    [2, '17:30', 'confirmada', 'Àngel Serrano', '630 778 015', null, null],
    [3, '10:30', 'pedida', 'Pere Vidal', '664 019 283', null, null],
    [5, '11:00', 'confirmada', 'Núria Casals', '688 909 010', 'Núria Casals', 'Segunda prueba: quiere comparar con el de Sabadell'],
  ];
  PLAN.forEach(([n, hora, estado, nombre, telefono, nombreCliente, nota], i) => {
    let d = n;
    while (domingo(d) || (sabado(d) && hora >= '14:00')) d += 1; // fuera de horario: al siguiente día con horario
    const vehiculo = publicados[i % publicados.length];
    let contactoId = null;
    if (nota === 'web') {
      contactoId = Number(db.prepare("INSERT INTO contactos (nombre, telefono, tipo, vehiculo_id, mensaje, recibido_en) VALUES (?, ?, 'prueba', ?, ?, datetime('now', '-5 hours'))")
        .run(nombre, telefono, vehiculo, `Pide prueba el ${dia(d).split('-').reverse().join('/')} a las ${hora}.`).lastInsertRowid);
    }
    try {
      ins.run(vehiculo, `${dia(d)} ${hora}`, estado, nombre, telefono, nombreCliente ? cliente(nombreCliente) : null, contactoId,
        nota === 'web' ? 'web' : 'panel', nota === 'web' ? null : nota, nota === 'web' ? null : jaume);
    } catch { /* dos cayeron a la misma hora al saltar el domingo: se queda la primera */ }
  });
  // Y una petición de prueba de la web sin hora: para «Dar cita» desde Contactos
  db.prepare("INSERT INTO contactos (nombre, telefono, tipo, vehiculo_id, mensaje, recibido_en) VALUES ('Laia Puig', '699 321 654', 'prueba', ?, '¿Puedo probarlo el sábado por la mañana?', datetime('now', '-2 hours'))")
    .run(coche('2215LBC'));
})();

const n = db.prepare('SELECT COUNT(*) n FROM vehiculos').get().n;
const f = db.prepare('SELECT COUNT(*) n FROM fotos').get().n;
console.log(`Base de pruebas sembrada en ${RUTA_DB}: ${n} coches, ${f} fotos en ${DIR_FOTOS}`);
console.log(`Usuarios: jaume@pruebas.local (gerencia) y comercial@pruebas.local (comercial), contraseña ${CONTRASENA}`);
db.close();
