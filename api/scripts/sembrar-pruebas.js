// Siembra una base de PRUEBAS con los coches de ejemplo, fotos, reservas, historial, contactos y dos usuarios.
//   npm run seed                      → api/data/pruebas.db y sus fotos en api/data/uploads-pruebas (con --reset)
//   DB_PATH=/ruta/pruebas.db node scripts/sembrar-pruebas.js [--reset]
// Con --reset borra la base y las fotos antes de sembrar. Nunca contra la base real.
import { parseArgs } from 'node:util';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { abrirDb } from '../src/db.js';
import { crearUsuario } from '../src/modules/auth/sesiones.js';

const { values } = parseArgs({ options: { reset: { type: 'boolean', default: false } } });
const RUTA_DB = resolve(process.env.DB_PATH || './data/pruebas.db');
const DIR_FOTOS = resolve(process.env.UPLOADS_PATH || join(dirname(RUTA_DB), 'uploads-pruebas'));
const CONTRASENA = 'pruebas-local-123';

if (!/prueba/i.test(RUTA_DB)) {
  console.error(`Por seguridad, la base de pruebas tiene que llevar «prueba» en el nombre: ${RUTA_DB}`);
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
const COCHES = [
  { estado: 'publicado', dias: 34, fotos: 15, color: [120, 124, 130], d: { matricula: '4821LKM', proveedor_nombre: 'Subastas Vallès', proveedor_telefono: '931112233', bastidor: 'VSSZZZKHZLR000001', marca: 'Seat', modelo: 'Ateca', version: '1.5 TSI Style', anio: 2020, fecha_matriculacion: '2020-05-12', kilometros: 62000, combustible: 'gasolina', cambio: 'manual', potencia_cv: 150, cilindrada: 1498, emisiones_co2: 136, etiqueta_dgt: 'C', carroceria: 'suv', color_exterior: 'gris', llantas: '18" aleación', precio_compra_cent: euros(16500), coste_transporte_cent: euros(250), coste_taller_cent: euros(420), coste_preparacion_cent: euros(180), coste_impuestos_cent: euros(310), pvp_cent: euros(20900), precio_financiado_cent: euros(19900), precio_minimo_cent: euros(19800) } },
  { estado: 'reservado', dias: 51, fotos: 16, color: [235, 235, 232], reserva: { cliente: 'Marta López', senal: 500 }, d: { matricula: '7390KXB', bastidor: 'NMTKZ3BX10R000002', marca: 'Toyota', modelo: 'C-HR', version: '125H Advance', anio: 2019, fecha_matriculacion: '2019-03-02', kilometros: 81200, combustible: 'hibrido', cambio: 'automatico', potencia_cv: 122, cilindrada: 1798, emisiones_co2: 101, etiqueta_dgt: 'ECO', carroceria: 'suv', color_exterior: 'blanco', llantas: '18" aleación', propiedad: 'deposito', propietario_nombre: 'Jordi Puig', propietario_telefono: '600111222', pago_propietario_cent: euros(19000), coste_preparacion_cent: euros(150), pvp_cent: euros(21500), precio_financiado_cent: euros(20500) } },
  { estado: 'publicado', dias: 12, fotos: 18, color: [40, 70, 140], d: { matricula: '2215LBC', proveedor_nombre: 'Particular (Sabadell)', proveedor_telefono: '644555666', bastidor: 'WVWZZZCDZMW000003', marca: 'Volkswagen', modelo: 'Golf', version: '2.0 TDI Life', anio: 2021, fecha_matriculacion: '2021-01-20', kilometros: 54700, combustible: 'diesel', cambio: 'manual', potencia_cv: 115, cilindrada: 1968, emisiones_co2: 112, etiqueta_dgt: 'C', carroceria: 'compacto', color_exterior: 'azul', llantas: '16" aleación', precio_compra_cent: euros(15800), coste_transporte_cent: euros(300), coste_taller_cent: euros(120), coste_preparacion_cent: euros(150), pvp_cent: euros(19900), precio_financiado_cent: euros(18900) } },
  { estado: 'publicado', dias: 97, fotos: 15, color: [170, 30, 30], d: { matricula: '9018LDF', bastidor: 'VF1RJA00000000004', marca: 'Renault', modelo: 'Clio', version: '1.0 TCe Zen', anio: 2021, fecha_matriculacion: '2021-06-15', kilometros: 45300, combustible: 'gasolina', cambio: 'manual', potencia_cv: 90, cilindrada: 999, emisiones_co2: 118, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'rojo', llantas: '16"', propiedad: 'deposito', propietario_nombre: 'Anna Soler', propietario_telefono: '600333444', pago_propietario_cent: euros(12000), coste_taller_cent: euros(90), pvp_cent: euros(13900), precio_financiado_cent: euros(13200) } },
  { estado: 'vendido', dias: 64, fotos: 15, color: [245, 245, 245], d: { matricula: '6604KCS', bastidor: 'WDF44770300000005', marca: 'Mercedes-Benz', modelo: 'Vito', version: '114 CDI Larga', anio: 2018, fecha_matriculacion: '2018-09-04', kilometros: 142000, combustible: 'diesel', cambio: 'manual', potencia_cv: 136, cilindrada: 2143, emisiones_co2: 178, etiqueta_dgt: 'B', carroceria: 'furgoneta', plazas: 8, color_exterior: 'blanco', llantas: '16"', precio_compra_cent: euros(18500), coste_transporte_cent: euros(450), coste_taller_cent: euros(980), coste_preparacion_cent: euros(220), coste_impuestos_cent: euros(400), pvp_cent: euros(22900) } },
  { estado: 'publicado', dias: 8, fotos: 20, color: [90, 95, 100], d: { matricula: '3380LGH', bastidor: 'KNACC81CGN5000006', marca: 'Kia', modelo: 'Niro', version: '1.6 HEV Drive', anio: 2022, fecha_matriculacion: '2022-02-10', kilometros: 31000, combustible: 'hibrido', cambio: 'automatico', potencia_cv: 141, cilindrada: 1580, emisiones_co2: 99, etiqueta_dgt: 'ECO', carroceria: 'suv', color_exterior: 'gris', llantas: '16" aleación', propiedad: 'deposito', propietario_nombre: 'Taller Vallès SL', propietario_telefono: '937000000', pago_propietario_cent: euros(21500), pvp_cent: euros(23900), precio_financiado_cent: euros(22900) } },
  { estado: 'publicado', dias: 71, fotos: 15, color: [225, 225, 220], d: { matricula: '1147KYM', bastidor: 'VSSZZZKJZKR000007', marca: 'Seat', modelo: 'Ibiza', version: '1.0 TSI FR', anio: 2019, fecha_matriculacion: '2019-07-30', kilometros: 73500, combustible: 'gasolina', cambio: 'manual', potencia_cv: 115, cilindrada: 999, emisiones_co2: 116, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'blanco', llantas: '17" aleación', precio_compra_cent: euros(10200), coste_transporte_cent: euros(200), coste_taller_cent: euros(350), pvp_cent: euros(12500) } },
  { estado: 'publicado', dias: 23, fotos: 17, color: [25, 25, 28], d: { matricula: '5562LCN', proveedor_nombre: 'Autos Terrassa SL', proveedor_telefono: '937778899', bastidor: 'VF3MCYHZRLS000008', marca: 'Peugeot', modelo: '3008', version: '1.5 BlueHDi Allure', anio: 2020, fecha_matriculacion: '2020-10-01', kilometros: 88000, combustible: 'diesel', cambio: 'automatico', potencia_cv: 130, cilindrada: 1499, emisiones_co2: 124, etiqueta_dgt: 'C', carroceria: 'suv', color_exterior: 'negro', llantas: '18" aleación', precio_compra_cent: euros(17600), coste_transporte_cent: euros(350), coste_taller_cent: euros(610), coste_preparacion_cent: euros(160), pvp_cent: euros(21900), precio_financiado_cent: euros(20900) } },
  // Aún no están a la venta: dan vida al tablero
  { estado: 'en_taller', dias: 6, fotos: 0, d: { matricula: '8890KZT', bastidor: 'WAUZZZ8V0KA000009', marca: 'Audi', modelo: 'A3', version: 'Sportback 30 TFSI', anio: 2019, kilometros: 69000, combustible: 'gasolina', cambio: 'manual', precio_compra_cent: euros(17900), coste_taller_cent: euros(640) } },
  { estado: 'pendiente_fotos', dias: 15, fotos: 4, color: [200, 120, 40], d: { matricula: '4473LBW', bastidor: 'VF7SXHMZ6LT000010', marca: 'Citroën', modelo: 'C3', version: '1.2 PureTech Shine', anio: 2020, fecha_matriculacion: '2020-11-18', kilometros: 38500, combustible: 'gasolina', cambio: 'manual', potencia_cv: 83, cilindrada: 1199, emisiones_co2: 119, etiqueta_dgt: 'C', carroceria: 'utilitario', color_exterior: 'naranja', precio_compra_cent: euros(9800), coste_preparacion_cent: euros(140), pvp_cent: euros(12900) } },
  { estado: 'en_preparacion', dias: 3, fotos: 0, d: { matricula: '2031LFK', marca: 'Dacia', modelo: 'Sandero', version: 'Stepway TCe', anio: 2021, kilometros: 41000, combustible: 'glp', cambio: 'manual', precio_compra_cent: euros(10300) } },
  { estado: 'pendiente_recoger', dias: 1, fotos: 0, d: { matricula: '0917KSP', marca: 'Ford', modelo: 'Transit Custom', propiedad: 'deposito', propietario_nombre: 'Construccions Rubí SL', propietario_telefono: '936000000' } },
];

// --- Siembra -----------------------------------------------------------------------------------
const RECORRIDO = ['pendiente_recoger', 'en_transporte', 'recibido', 'en_taller', 'en_preparacion', 'pendiente_fotos', 'publicado', 'reservado', 'vendido'];
const haceDias = (n) => `datetime('now', '-${n} days')`;

db.transaction(() => {
  const jaume = crearUsuario(db, { email: 'jaume@pruebas.local', nombre: 'Jaume', rol: 'gerencia', contrasena: CONTRASENA });
  crearUsuario(db, { email: 'comercial@pruebas.local', nombre: 'Comercial', rol: 'comercial', contrasena: CONTRASENA });

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
    const cols = Object.keys(datos);
    const id = Number(db.prepare(`INSERT INTO vehiculos (${cols.join(',')}, estado, creado_en, actualizado_en)
                                  VALUES (${cols.map(() => '?').join(',')}, ?, ${haceDias(c.dias)}, ${haceDias(Math.min(c.dias, 2))})`)
      .run(...cols.map((k) => datos[k]), c.estado).lastInsertRowid);
    db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);

    // Historial: la preparación ocupa los primeros días (hasta 12) y el último estado, el resto.
    // Así un coche con 97 días en stock lleva unos 85 a la venta, que es lo que ve el tablero.
    const pasos = RECORRIDO.slice(0, RECORRIDO.indexOf(c.estado) + 1);
    const preparacion = Math.min(12, Math.floor(c.dias / 2));
    pasos.forEach((estado, n) => {
      const ultimo = n === pasos.length - 1;
      const dia = ultimo && n > 0 ? c.dias - preparacion : Math.round(c.dias - (preparacion * n) / Math.max(pasos.length - 1, 1));
      db.prepare(`INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, ?, ?, ?, ${haceDias(dia)})`)
        .run(id, n ? pasos[n - 1] : null, estado, jaume);
    });

    for (let f = 1; f <= c.fotos; f++) {
      const relativa = `vehiculos/${id}/${String(f).padStart(2, '0')}.png`;
      const tono = 0.8 + (f % 5) * 0.06;
      png(join(DIR_FOTOS, relativa), c.color.map((v) => Math.min(255, Math.round(v * tono))));
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

const n = db.prepare('SELECT COUNT(*) n FROM vehiculos').get().n;
const f = db.prepare('SELECT COUNT(*) n FROM fotos').get().n;
console.log(`Base de pruebas sembrada en ${RUTA_DB}: ${n} coches, ${f} fotos en ${DIR_FOTOS}`);
console.log(`Usuarios: jaume@pruebas.local (gerencia) y comercial@pruebas.local (comercial), contraseña ${CONTRASENA}`);
db.close();
