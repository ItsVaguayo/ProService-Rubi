// Filtros del buscador (briefing 5.4). "lista" = elegir valores, "rango" = desde / hasta.
// "motivo" deja el filtro visible pero desactivado, con la razón.
import { TIN_ORIENTATIVO, UBICACION_PUBLICA } from './config.js';
import { etiqueta } from './formato.js';

export function definicionFiltros({ publica }) {
  return [
    { id: 'marca', label: 'Marca', tipo: 'lista' },
    { id: 'modelo', label: 'Modelo', tipo: 'lista', dependeDe: 'marca' },
    { id: 'pvp_cent', label: 'Precio', tipo: 'rango', unidad: '€', paso: 500, cent: true },
    {
      id: 'cuota', label: 'Cuota mensual', tipo: 'rango', unidad: '€/mes',
      motivo: TIN_ORIENTATIVO == null ? 'Falta el tipo de interés orientativo del cliente (E2).' : null,
    },
    { id: 'kilometros', label: 'Kilómetros', tipo: 'rango', unidad: 'km', paso: 5000 },
    { id: 'anio', label: 'Año', tipo: 'rango', sinMiles: true },
    { id: 'combustible', label: 'Combustible', tipo: 'lista' },
    { id: 'cambio', label: 'Cambio', tipo: 'lista' },
    { id: 'carroceria', label: 'Carrocería', tipo: 'lista' },
    { id: 'etiqueta_dgt', label: 'Etiqueta DGT', tipo: 'lista' },
    { id: 'color_exterior', label: 'Color', tipo: 'lista' },
    { id: 'plazas', label: 'Plazas', tipo: 'lista' },
    publica
      ? { id: 'ubicacion', label: 'Ubicación', tipo: 'lista', motivo: `En la web todos los coches salen en ${UBICACION_PUBLICA} (C9).` }
      : { id: 'ubicacion', label: 'Ubicación', tipo: 'lista' },
  ];
}

const clave = (v) => (v == null ? '' : String(v).trim().toLowerCase());

export function textoValor(campo, v) {
  if (campo === 'etiqueta_dgt') return v === 'SIN' ? 'Sin etiqueta' : v === '0' ? '0 emisiones' : v;
  if (campo === 'plazas') return `${v} plazas`;
  return etiqueta(campo, v);
}

// Valores distintos de un campo, con cuántos coches tiene cada uno.
export function opcionesDe(coches, campo) {
  const mapa = new Map();
  for (const c of coches) {
    if (c[campo] == null || c[campo] === '') continue;
    const k = clave(c[campo]);
    const prev = mapa.get(k);
    mapa.set(k, { valor: k, texto: prev?.texto ?? textoValor(campo, c[campo]), n: (prev?.n ?? 0) + 1 });
  }
  return [...mapa.values()].sort((a, b) =>
    campo === 'plazas' ? Number(a.valor) - Number(b.valor) : a.texto.localeCompare(b.texto, 'es'),
  );
}

// Los rangos se escriben en la unidad que se lee: euros aunque la API mande céntimos.
const valorRango = (c, d) => (typeof c[d.id] === 'number' ? (d.cent ? c[d.id] / 100 : c[d.id]) : null);

export function limitesDe(coches, d) {
  const vals = coches.map((c) => valorRango(c, d)).filter((v) => v != null);
  return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
}

export function estaActivo(def, v) {
  if (!v) return false;
  return def.tipo === 'lista' ? v.length > 0 : v.min != null || v.max != null;
}

export function aplicarFiltros(coches, filtros, defs, excepto = null) {
  return coches.filter((c) =>
    defs.every((d) => {
      if (d.id === excepto || d.motivo) return true;
      const v = filtros[d.id];
      if (!estaActivo(d, v)) return true;
      if (d.tipo === 'lista') return v.includes(clave(c[d.id]));
      const x = valorRango(c, d);
      if (x == null) return false;
      return (v.min == null || x >= v.min) && (v.max == null || x <= v.max);
    }),
  );
}

export function buscar(coches, texto, campos) {
  const q = texto.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return coches;
  return coches.filter((c) => {
    const pajar = campos.map((k) => c[k] ?? '').join(' ').toLowerCase();
    const sinEspacios = pajar.replace(/\s/g, '');
    return q.split(' ').every((t) => pajar.includes(t) || sinEspacios.includes(t));
  });
}
