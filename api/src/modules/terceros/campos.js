// Lista blanca de campos de clientes y proveedores. Como en vehiculos/campos.js: los nombres de
// columna nunca salen del cuerpo de la petición.
import { normalizarNif, tipoNif } from './fiscal.js';

export const TELEFONO = /^[+\d][\d\s().-]{5,19}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMUNES = {
  nombre: { max: 150 },
  nif: { nif: true },
  direccion: { max: 200 },
  codigo_postal: { max: 10 },
  poblacion: { max: 100 },
  provincia: { max: 100 },
  pais: { max: 2 },
  telefono: { telefono: true },
  email: { email: true },
  notas: { max: 2000 },
  activo: { booleano: true },
};

export const ESTADOS_COMERCIALES = ['nuevo', 'interesado', 'me_lo_pienso', 'negociando', 'ganado', 'perdido'];

export const CAMPOS_CLIENTE = {
  ...COMUNES, tipo: { opciones: ['particular', 'empresa'] }, origen: { max: 50 },
  estado_comercial: { opciones: ESTADOS_COMERCIALES }, // embudo del CRM (0009)
};
export const CAMPOS_PROVEEDOR = { ...COMUNES, tipo: { opciones: ['profesional', 'particular', 'subasta', 'comisionista'] } };

// Devuelve { datos, errores }. Con `parcial` (edición) no se exige el nombre.
export function limpiarTercero(cuerpo, campos, { parcial = false } = {}) {
  const errores = [];
  const datos = {};
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { datos, errores: ['El cuerpo tiene que ser un objeto'] };

  for (const [campo, valor] of Object.entries(cuerpo)) {
    const def = campos[campo];
    if (!def) { errores.push(`Campo desconocido: ${campo}`); continue; }
    if (valor === null || valor === '') { datos[campo] = null; continue; }
    if (def.booleano) {
      if (typeof valor !== 'boolean') errores.push(`${campo} tiene que ser true o false`);
      else datos[campo] = valor ? 1 : 0;
      continue;
    }
    if (typeof valor !== 'string') { errores.push(`${campo} tiene que ser texto`); continue; }
    const v = valor.trim();
    if (def.opciones && !def.opciones.includes(v)) errores.push(`${campo} tiene que ser ${def.opciones.join(', ')}`);
    else if (def.nif && !tipoNif(v)) errores.push('El DNI, NIE o CIF no es válido');
    else if (def.telefono && !TELEFONO.test(v)) errores.push('El teléfono no es válido');
    else if (def.email && !EMAIL.test(v)) errores.push('El correo no es válido');
    else if (def.max && v.length > def.max) errores.push(`${campo} es demasiado largo`);
    else datos[campo] = def.nif ? normalizarNif(v) : campo === 'pais' ? v.toUpperCase() : v;
  }

  if (!parcial && datos.nombre == null && !errores.some((e) => e.includes('nombre'))) errores.push('Falta el nombre');
  if (parcial && 'nombre' in datos && datos.nombre == null) errores.push('nombre no puede quedar vacío');
  for (const campo of ['tipo', 'estado_comercial']) if (campo in datos && datos[campo] == null) errores.push(`${campo} no puede quedar vacío`);
  if ('pais' in datos && datos.pais == null) errores.push('pais no puede quedar vacío');
  if ('activo' in datos && datos.activo == null) errores.push('activo no puede quedar vacío');
  return { datos, errores };
}
