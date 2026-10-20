// Genera las cuatro plantillas de la migración (docs/migracion.md) con datos INVENTADOS y el volumen de
// un caso real, para ensayar la migración entera sin el export de Pymecar:
//
//   node scripts/generar-migracion-ficticia.js --dir ./data/migracion-ficticia [--stock 50] [--ventas-por-anio 50] [--anios 5]
//
// Por defecto, el peor caso del briefing: 50 coches en stock y 5 años de ventas a 50 al año (Pymecar
// enseñaba unos 8 en stock y unas 50 ventas al año). Todo pasa las mismas validaciones que la API: NIF y
// CIF con su letra, IBAN con su control, matrículas únicas, facturas sin huecos por serie y el IVA del
// REBU calculado como lo hace la plataforma. Siempre salen los mismos datos (semilla fija), para que dos
// ensayos se puedan comparar. Nombres y documentos son ficticios: «Ficticio» va en todos los nombres.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: './data/migracion-ficticia' },
    stock: { type: 'string', default: '50' },
    'ventas-por-anio': { type: 'string', default: '50' },
    anios: { type: 'string', default: '5' },
    hoy: { type: 'string' }, // AAAA-MM-DD, para los tests; por defecto, hoy
  },
});
const STOCK = Number(values.stock);
const VENTAS_ANIO = Number(values['ventas-por-anio']);
const ANIOS = Number(values.anios);
const HOY = values.hoy ? new Date(`${values.hoy}T12:00:00Z`) : new Date();
const DIR = resolve(values.dir);

// Aleatorio con semilla (mulberry32): mismos datos en cada ensayo
let semilla = 20261028;
const azar = () => {
  semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
const digitos = (n) => Array.from({ length: n }, () => entre(0, 9)).join('');

// --- Documentos válidos (mismas reglas que terceros/fiscal.js) ------------------------------------------
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const dni = () => { const n = digitos(8); return n + LETRAS_DNI[Number(n) % 23]; };
const nie = () => { const p = entre(0, 2); const n = digitos(7); return 'XYZ'[p] + n + LETRAS_DNI[Number(`${p}${n}`) % 23]; };
function cif(letra = 'B') {
  const n = digitos(7).split('').map(Number);
  let suma = 0;
  n.forEach((d, i) => { if (i % 2 === 1) suma += d; else { const x = d * 2; suma += Math.floor(x / 10) + (x % 10); } });
  return letra + n.join('') + ((10 - (suma % 10)) % 10);
}
function iban() {
  const cuenta = digitos(20);
  const numero = BigInt(`${cuenta}142800`); // ES = 14 28, control 00
  return `ES${String(98n - (numero % 97n)).padStart(2, '0')}${cuenta}`;
}
const usados = new Set();
const unico = (fn) => { let v; do v = fn(); while (usados.has(v)); usados.add(v); return v; };
const matricula = () => unico(() => digitos(4) + Array.from({ length: 3 }, () => uno('BCDFGHJKLMNPRSTVWXYZ')).join(''));
const bastidor = (prefijo) => unico(() => (prefijo + 'ZZZ' + Array.from({ length: 11 }, () => uno('ABCDEFGHJKLMNPRSTUVWXYZ0123456789')).join('')).slice(0, 17));

// --- Formatos como los guarda Excel en español ---------------------------------------------------------
const dia = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const euros = (cent) => {
  const signo = cent < 0 ? '-' : ''; const a = Math.abs(cent);
  return `${signo}${Math.floor(a / 100).toLocaleString('es-ES', { useGrouping: 'always' })},${String(a % 100).padStart(2, '0')}`;
};
const sumarDias = (d, n) => new Date(d.getTime() + n * 86400000);
const celda = (v) => (v === undefined || v === null ? '' : String(v));
function csv(nombre, columnas, filas) {
  const texto = [columnas.join(';'), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(';'))].join('\r\n') + '\r\n';
  writeFileSync(join(DIR, nombre), texto);
  return filas.length;
}

// --- Catálogo de coches creíbles ---------------------------------------------------------------------
const MODELOS = [
  ['Seat', 'Ibiza', '1.0 TSI Style', 'gasolina', 'utilitario', 95, 999, 'VSS'], ['Seat', 'Arona', '1.0 TSI Xcellence', 'gasolina', 'suv', 110, 999, 'VSS'],
  ['Volkswagen', 'Golf', '2.0 TDI Life', 'diesel', 'compacto', 115, 1968, 'WVW'], ['Volkswagen', 'Polo', '1.0 TSI R-Line', 'gasolina', 'utilitario', 95, 999, 'WVW'],
  ['Renault', 'Clio', '1.0 TCe Zen', 'gasolina', 'utilitario', 90, 999, 'VF1'], ['Renault', 'Captur', 'E-Tech Plug-in', 'hibrido_enchufable', 'suv', 160, 1598, 'VF1'],
  ['Peugeot', '3008', '1.5 BlueHDi GT Line', 'diesel', 'suv', 130, 1499, 'VF3'], ['Peugeot', '208', '1.2 PureTech Active', 'gasolina', 'utilitario', 75, 1199, 'VF3'],
  ['Citroën', 'C3 Aircross', '1.2 PureTech Shine', 'gasolina', 'suv', 110, 1199, 'VF7'], ['Citroën', 'Berlingo', '1.5 BlueHDi XL', 'diesel', 'monovolumen', 130, 1499, 'VF7'],
  ['Kia', 'Niro', '1.6 HEV Drive', 'hibrido', 'suv', 141, 1580, 'KNA'], ['Kia', 'Sportage', '1.6 GDi Drive', 'gasolina', 'suv', 132, 1591, 'KNA'],
  ['Hyundai', 'i20', '1.2 MPI Klass', 'gasolina', 'utilitario', 84, 1197, 'KMH'], ['Toyota', 'C-HR', '125H Advance', 'hibrido', 'suv', 122, 1798, 'NMT'],
  ['Toyota', 'Proace', '2.0 D-4D Verso', 'diesel', 'furgoneta', 150, 1997, 'YAR'], ['Ford', 'Puma', '1.0 EcoBoost MHEV ST-Line', 'gasolina', 'suv', 125, 999, 'WF0'],
  ['Nissan', 'Qashqai', '1.5 dCi N-Connecta', 'diesel', 'suv', 115, 1461, 'SJN'], ['Mercedes-Benz', 'Vito', '114 CDI Larga', 'diesel', 'furgoneta', 136, 2143, 'WDF'],
];
const COLORES = ['blanco', 'gris', 'negro', 'azul', 'rojo', 'plata'];
const ETIQUETA = { gasolina: 'C', diesel: 'C', hibrido: 'ECO', hibrido_enchufable: '0' };
const ESTADOS_STOCK = ['pendiente_recoger', 'en_transporte', 'recibido', 'en_taller', 'en_preparacion', 'pendiente_fotos', 'publicado', 'publicado', 'publicado', 'publicado', 'reservado'];

mkdirSync(DIR, { recursive: true });

// --- Proveedores --------------------------------------------------------------------------------------
const proveedores = [];
for (let i = 1; i <= 60; i++) {
  const tipo = i <= 30 ? 'profesional' : i <= 45 ? 'particular' : i <= 52 ? 'subasta' : 'comisionista';
  const clase = i > 55 ? 'acreedor' : 'proveedor';
  proveedores.push({
    nombre: tipo === 'particular' ? `Particular Ficticio ${i}` : `Proveedor Ficticio ${i} SL`,
    nif: unico(() => (tipo === 'particular' ? dni() : cif('B'))), tipo, clase,
    direccion: `C/ Inventada ${i}`, codigo_postal: '08191', poblacion: 'Rubí', provincia: 'Barcelona', pais: 'ES',
    telefono: `93${digitos(7)}`, email: `proveedor${i}@ficticio.example`, iban: tipo === 'particular' ? '' : iban(),
    forma_pago: uno(['transferencia', 'contado', 'pago_30']), notas: 'Dato ficticio de ensayo',
  });
}
const vendedores = proveedores.filter((p) => p.clase === 'proveedor');

// --- Clientes, coches y facturas --------------------------------------------------------------------------
const clientes = [];
function nuevoCliente() {
  const i = clientes.length + 1;
  const empresa = azar() < 0.12;
  const c = {
    nombre: empresa ? `Cliente Ficticio ${i} SL` : `Cliente Ficticio ${i}`, nif: unico(() => (empresa ? cif('B') : azar() < 0.1 ? nie() : dni())),
    tipo: empresa ? 'empresa' : 'particular', direccion: `Av. Ficticia ${i}`, codigo_postal: '08191', poblacion: 'Rubí', provincia: 'Barcelona',
    pais: 'ES', telefono: `6${digitos(8)}`, email: `cliente${i}@ficticio.example`, origen: uno(['tienda', 'web', 'coches.net', 'wallapop']),
    estado_comercial: 'ganado', notas: 'Dato ficticio de ensayo',
  };
  clientes.push(c);
  return c;
}

const vehiculos = [];
function nuevoCoche(alta) {
  const [marca, modelo, version, combustible, carroceria, cv, cc, wmi] = uno(MODELOS);
  const anio = alta.getUTCFullYear() - entre(1, 8);
  const compra = entre(60, 260) * 10000; // de 6.000 a 26.000 €
  const pvp = Math.round((compra * (1.15 + azar() * 0.15)) / 10000) * 10000;
  const deposito = azar() < 0.2;
  const p = uno(vendedores);
  return {
    ref_pymecar: `PYM-${vehiculos.length + 1}`, matricula: matricula(), bastidor: bastidor(wmi), marca, modelo, version, anio,
    fecha_matriculacion: dia(new Date(Date.UTC(anio, entre(0, 11), entre(1, 28)))), kilometros: entre(15, 180) * 1000, combustible,
    cambio: azar() < 0.3 ? 'automatico' : 'manual', potencia_cv: cv, cilindrada: cc, traccion: 'delantera', etiqueta_dgt: ETIQUETA[combustible],
    carroceria, puertas: carroceria === 'furgoneta' ? 4 : 5, plazas: carroceria === 'furgoneta' ? 8 : 5, color_exterior: uno(COLORES), tapiceria: 'tela',
    uso_anterior: azar() < 0.8 ? 'particular' : 'profesional', garantia_meses: 12, ubicacion: uno(['patio_taller', 'parking']), num_llaves: entre(1, 2),
    propiedad: deposito ? 'deposito' : 'propio', regimen_iva: azar() < 0.9 ? 'REBU' : 'deducible',
    precio_compra: deposito ? '' : euros(compra), pvp: euros(pvp), _compra: deposito ? Math.round(pvp * 0.88) : compra, _pvp: pvp,
    propietario_nombre: deposito ? `Propietario Ficticio ${vehiculos.length + 1}` : '', propietario_telefono: deposito ? `6${digitos(8)}` : '',
    pago_propietario: deposito ? euros(Math.round(pvp * 0.88)) : '', proveedor_nif: deposito ? '' : p.nif,
    fecha_alta: dia(alta),
  };
}

// Ventas: repartidas en los últimos ANIOS años, la más reciente hace 3 días
const facturas = [];
const totalVentas = VENTAS_ANIO * ANIOS;
const ventas = Array.from({ length: totalVentas }, (_, i) => sumarDias(HOY, -3 - Math.floor((i * 365 * ANIOS) / totalVentas) - entre(0, 2)))
  .sort((a, b) => a - b);
const porSerie = {};
for (const fechaVenta of ventas) {
  const coche = nuevoCoche(sumarDias(fechaVenta, -entre(20, 90)));
  const cliente = clientes.length > 20 && azar() < 0.08 ? uno(clientes) : nuevoCliente(); // alguno repite
  coche.comprador_nif = cliente.nif;
  coche.fecha_venta = dia(fechaVenta);
  vehiculos.push(coche);

  const serie = `V${String(fechaVenta.getUTCFullYear()).slice(2)}`;
  porSerie[serie] = (porSerie[serie] ?? 0) + 1;
  const precio = coche._pvp - entre(0, 5) * 10000; // a veces se rebaja al vender
  const rebu = coche.regimen_iva === 'REBU';
  const margen = Math.max(precio - coche._compra, 0);
  const base = rebu ? Math.round(margen / 1.21) : Math.round(precio / 1.21);
  const iva = rebu ? margen - base : precio - base;
  facturas.push({
    codigo: `${serie}-${String(porSerie[serie]).padStart(5, '0')}`, fecha: dia(fechaVenta), vencimiento: '', cliente_nif: cliente.nif,
    matricula: coche.matricula, regimen: rebu ? 'REBU' : 'general', precio: euros(precio), compra: rebu ? euros(coche._compra) : '',
    base: euros(base), iva_pct: 21, iva: euros(iva), suplidos: '', total: euros(precio), forma_pago: uno(['transferencia', 'contado', 'tarjeta']),
    uso_destino: cliente.tipo === 'empresa' ? 'profesional' : 'particular', garantia_tipo: 'directa', garantia_meses: 12,
    km_entrega: coche.kilometros, observaciones: 'Dato ficticio de ensayo',
    cobrado: '',
    _precio: precio,
  });
}
// Las dos más recientes: una sin cobrar y otra a medias, como puede pasar de verdad. El resto, cobradas
if (facturas.length >= 2) {
  facturas.at(-1).cobrado = euros(0);
  facturas.at(-2).cobrado = euros(Math.round(facturas.at(-2)._precio / 2));
}

// Stock vivo
for (let i = 0; i < STOCK; i++) {
  const coche = nuevoCoche(sumarDias(HOY, -entre(1, 120)));
  coche.estado = uno(ESTADOS_STOCK);
  vehiculos.push(coche);
}
// 30 clientes que preguntaron y no compraron
for (let i = 0; i < 30; i++) Object.assign(nuevoCliente(), { estado_comercial: uno(['interesado', 'me_lo_pienso', 'perdido']) });

const COL_PROV = ['nombre', 'nif', 'tipo', 'clase', 'direccion', 'codigo_postal', 'poblacion', 'provincia', 'pais', 'telefono', 'movil', 'email', 'iban', 'forma_pago', 'persona_contacto', 'notas'];
const COL_CLI = ['nombre', 'nif', 'tipo', 'direccion', 'codigo_postal', 'poblacion', 'provincia', 'pais', 'telefono', 'email', 'origen', 'estado_comercial', 'notas'];
const COL_VEH = ['ref_pymecar', 'matricula', 'bastidor', 'marca', 'modelo', 'version', 'anio', 'fecha_matriculacion', 'kilometros', 'combustible', 'cambio', 'potencia_cv', 'cilindrada', 'traccion', 'etiqueta_dgt', 'carroceria', 'puertas', 'plazas', 'color_exterior', 'tapiceria', 'uso_anterior', 'garantia_meses', 'ubicacion', 'num_llaves', 'propiedad', 'regimen_iva', 'precio_compra', 'pvp', 'propietario_nombre', 'propietario_telefono', 'pago_propietario', 'proveedor_nif', 'comprador_nif', 'estado', 'fecha_alta', 'fecha_venta'];
const COL_FAC = ['codigo', 'fecha', 'vencimiento', 'cliente_nif', 'matricula', 'regimen', 'precio', 'compra', 'base', 'iva_pct', 'iva', 'suplidos', 'total', 'forma_pago', 'uso_destino', 'garantia_tipo', 'garantia_meses', 'km_entrega', 'observaciones', 'cobrado'];

console.log(`Plantillas ficticias en ${DIR}:`);
console.log(`  proveedores.csv  ${csv('proveedores.csv', COL_PROV, proveedores)}`);
console.log(`  clientes.csv     ${csv('clientes.csv', COL_CLI, clientes)}`);
console.log(`  vehiculos.csv    ${csv('vehiculos.csv', COL_VEH, vehiculos)} (${STOCK} en stock y ${totalVentas} vendidos)`);
console.log(`  facturas.csv     ${csv('facturas.csv', COL_FAC, facturas)} (${Object.entries(porSerie).map(([s, n]) => `${s}: ${n}`).join(', ')})`);
