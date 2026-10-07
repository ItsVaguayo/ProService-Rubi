// Dueño: David. Lista blanca de campos de las actividades del CRM (T11). Como en terceros/campos.js:
// los nombres de columna nunca salen del cuerpo de la petición, solo de estas listas.

export const TIPOS = ['llamada', 'visita', 'whatsapp', 'email', 'prueba', 'tarea', 'nota'];

// 'AAAA-MM-DD HH:MM', hora de Rubí. Se guarda tal cual, así se ordena bien como texto.
export const FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
export const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const CAMPOS = {
  tipo: { opciones: TIPOS },
  descripcion: { texto: 2000 },
  cliente_id: { id: true },
  contacto_id: { id: true },
  vehiculo_id: { id: true },
  responsable_id: { id: true },
  programada_para: { fechaHora: true },
};

// Al editar solo se cambia esto: a quién y de qué va la actividad no se mueve (se crea otra).
const EDITABLES = ['tipo', 'descripcion', 'programada_para', 'responsable_id'];

/** ¿Existe esa fecha? (rechaza 2026-02-30 o 25:00) */
export function fechaValida(texto, patron = FECHA_HORA) {
  const m = patron.exec(texto);
  if (!m) return false;
  const [, a, mes, d, h = 0, min = 0] = m.map((x) => (x === undefined ? undefined : Number(x)));
  const f = new Date(Date.UTC(a, mes - 1, d, h, min));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d
    && f.getUTCHours() === h && f.getUTCMinutes() === min;
}

// Devuelve { datos, errores }. Con `edicion` solo se admiten los campos editables y no se exige nada.
export function limpiarActividad(cuerpo, { edicion = false } = {}) {
  const errores = [];
  const datos = {};
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { datos, errores: ['El cuerpo tiene que ser un objeto'] };

  for (const [campo, valor] of Object.entries(cuerpo)) {
    const def = CAMPOS[campo];
    if (!def || (edicion && !EDITABLES.includes(campo))) { errores.push(`Campo desconocido o que no se puede cambiar: ${campo}`); continue; }
    if (valor === null || valor === '') { datos[campo] = null; continue; }
    if (def.id) {
      if (!Number.isInteger(valor) || valor < 1) errores.push(`${campo} tiene que ser un número`);
      else datos[campo] = valor;
      continue;
    }
    if (typeof valor !== 'string') { errores.push(`${campo} tiene que ser texto`); continue; }
    const v = valor.trim();
    if (def.opciones && !def.opciones.includes(v)) errores.push(`${campo} tiene que ser ${def.opciones.join(', ')}`);
    else if (def.fechaHora && !fechaValida(v)) errores.push(`${campo} tiene que ser una fecha AAAA-MM-DD HH:MM`);
    else if (def.texto && v.length > def.texto) errores.push(`${campo} es demasiado largo`);
    else datos[campo] = v;
  }

  for (const campo of ['tipo', 'descripcion', 'responsable_id']) {
    if (campo in datos && datos[campo] == null) errores.push(`${campo} no puede quedar vacío`);
  }
  if (!edicion) {
    if (!('tipo' in datos) && !errores.some((e) => e.startsWith('tipo'))) errores.push('Falta el tipo');
    if (!('descripcion' in datos) && !errores.some((e) => e.startsWith('descripcion'))) errores.push('Falta la descripción');
    if (datos.cliente_id == null && datos.contacto_id == null && !errores.some((e) => /cliente_id|contacto_id/.test(e))) {
      errores.push('Hace falta un cliente o un contacto');
    }
  }
  return { datos, errores };
}
