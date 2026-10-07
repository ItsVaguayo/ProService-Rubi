// Dueño: David. Lista blanca de campos del libro de gastos (T14). Como en crm/campos.js: los nombres de
// columna nunca salen del cuerpo de la petición, solo de estas listas.
import { FORMAS_PAGO } from '../terceros/campos.js';

export const TIPOS = ['general', 'irpf', 'comision', 'rebu', 'vehiculo'];
export const CONCEPTOS = ['alquileres', 'carburantes', 'comisiones', 'compras', 'electricidad', 'gestorias', 'papelerias', 'publicidad', 'vehiculos'];
export const IVAS = [0, 4, 10, 21];
export const IRPFS = [0, 7, 15, 19]; // los que tiene configurados Pymecar
// Las de Pymecar, las mismas que en los proveedores (T15)
export { FORMAS_PAGO };

export const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Existe ese día? (rechaza 2026-02-30) */
export function diaValido(texto) {
  const m = DIA.exec(texto);
  if (!m) return false;
  const [a, mes, d] = m.slice(1).map(Number);
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}

const CAMPOS = {
  fecha: { dia: true },
  tipo: { opciones: TIPOS },
  concepto: { opciones: CONCEPTOS },
  descripcion: { texto: 2000 },
  factura_proveedor: { texto: 50 },
  proveedor_id: { id: true },
  cliente_id: { id: true },
  usuario_id: { id: true },
  vehiculo_id: { id: true },
  base_cent: { cent: true },
  iva_pct: { numeros: IVAS },
  irpf_pct: { numeros: IRPFS },
  forma_pago: { opciones: FORMAS_PAGO },
};

// Los importes los calcula el servidor: si llegan, es un error del panel y se dice.
const CALCULADOS = ['iva_cent', 'irpf_cent', 'total_cent'];

// Devuelve { datos, errores }. Solo forma y tipo de cada dato; las reglas por tipo están en calculo.js.
export function limpiarGasto(cuerpo) {
  const errores = [];
  const datos = {};
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { datos, errores: ['El cuerpo tiene que ser un objeto'] };

  for (const [campo, valor] of Object.entries(cuerpo)) {
    if (CALCULADOS.includes(campo)) { errores.push(`${campo} lo calcula el servidor: no se manda`); continue; }
    const def = CAMPOS[campo];
    if (!def) { errores.push(`Campo desconocido o que no se puede cambiar: ${campo}`); continue; }
    if (valor === null || valor === '') { datos[campo] = null; continue; }
    if (def.id || def.cent) {
      if (!Number.isInteger(valor) || valor < (def.id ? 1 : 0)) errores.push(`${campo} tiene que ser un número entero${def.cent ? ' de céntimos, sin decimales y no negativo' : ''}`);
      else datos[campo] = valor;
      continue;
    }
    if (def.numeros) {
      if (!def.numeros.includes(valor)) errores.push(`${campo} tiene que ser ${def.numeros.join(', ')}`);
      else datos[campo] = valor;
      continue;
    }
    if (typeof valor !== 'string') { errores.push(`${campo} tiene que ser texto`); continue; }
    const v = valor.trim();
    if (def.opciones && !def.opciones.includes(v)) errores.push(`${campo} tiene que ser ${def.opciones.join(', ')}`);
    else if (def.dia && !diaValido(v)) errores.push(`${campo} tiene que ser una fecha AAAA-MM-DD`);
    else if (def.texto && v.length > def.texto) errores.push(`${campo} es demasiado largo`);
    else datos[campo] = v;
  }
  return { datos, errores };
}
