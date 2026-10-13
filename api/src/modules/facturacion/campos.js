// Dueño: Victor. Lista blanca de lo que se escribe en un borrador de factura. Como en el resto de módulos:
// los nombres de columna nunca salen del cuerpo de la petición.
import { diaValido } from '../../fechas.js';
import { FORMAS_PAGO } from '../terceros/campos.js';

const CAMPOS = {
  fecha: { dia: true },
  vencimiento: { dia: true },
  cliente_id: { id: true },
  vehiculo_id: { id: true },
  precio_cent: { cent: true },
  suplidos_cent: { cent: true },
  regimen: { opciones: ['REBU', 'general'] },
  forma_pago: { opciones: FORMAS_PAGO },
  uso_destino: { opciones: ['particular', 'profesional'] },
  garantia_tipo: { opciones: ['directa', 'comprada', 'sin'] },
  garantia_meses: { entero: [0, 36] },
  km_entrega: { entero: [0, 9999999] },
  observaciones: { texto: 2000 },
  // 0019: un coche que entrega el cliente como parte del pago, con su valor (al emitir, se apunta como cobro)
  parte_pago_cent: { cent: true },
  parte_pago_vehiculo: { texto: 200 },
  parte_pago_vehiculo_id: { id: true },
};
const NO_VACIOS = ['fecha', 'cliente_id', 'precio_cent', 'regimen'];

export function limpiarFactura(cuerpo) {
  const errores = [];
  const datos = {};
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { datos, errores: ['El cuerpo tiene que ser un objeto'] };
  for (const [campo, valor] of Object.entries(cuerpo)) {
    const def = CAMPOS[campo];
    if (!def) { errores.push(`Campo desconocido o que no se puede cambiar: ${campo}`); continue; }
    if (valor === null || valor === '') {
      if (NO_VACIOS.includes(campo)) errores.push(`${campo} no puede quedar vacío`);
      else datos[campo] = campo === 'suplidos_cent' ? 0 : null;
      continue;
    }
    if (def.id || def.cent || def.entero) {
      const [min, max] = def.entero ?? [def.id ? 1 : 0, Number.MAX_SAFE_INTEGER];
      if (!Number.isInteger(valor) || valor < min || valor > max) errores.push(`${campo} tiene que ser un número entero${def.cent ? ' de céntimos' : ''} entre ${min} y ${max}`);
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
