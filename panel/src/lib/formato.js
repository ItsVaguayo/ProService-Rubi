const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat('es-ES');

export const eur = (v) => (v == null || v === '' ? '—' : euros.format(v));
// La API guarda los importes en céntimos (campos *_cent).
export const eurCent = (c) => (c == null ? '—' : euros.format(c / 100));
export const deCent = (c) => (c == null ? null : c / 100);
export const aCent = (euros) => Math.round(Number(euros) * 100);
export const km = (v) => (v == null ? '—' : `${numero.format(v)} km`);
export const num = (v) => (v == null || v === '' ? '—' : numero.format(v));

export function fecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Días desde el alta (creado_en viene de SQLite en UTC: "2026-09-30 10:00:00").
export function diasEnStock(creadoEn) {
  if (!creadoEn) return null;
  const ms = Date.now() - new Date(creadoEn.replace(' ', 'T') + 'Z').getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

const ETIQUETAS = {
  cambio: { manual: 'Manual', automatico: 'Automático' },
  ubicacion: { patio_taller: 'Patio del taller', parking: 'Parking' },
  propiedad: { propio: 'Propio', deposito: 'En depósito' },
};

export function etiqueta(campo, valor) {
  if (valor == null || valor === '') return '—';
  return ETIQUETAS[campo]?.[valor] ?? capital(String(valor));
}

export const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Mismo cálculo que api/src/modules/margen.js, para enseñarlo mientras se rellena el alta.
// Aquí los valores van en euros, tal y como están escritos en el formulario.
// En depósito la base es lo que se paga al dueño; si falta la base o el PVP, no hay número.
const vacio = (x) => x == null || x === '';

export function costeTotal(v) {
  const base = v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent;
  if (vacio(base)) return null;
  return ['coste_transporte_cent', 'coste_taller_cent', 'coste_preparacion_cent', 'coste_impuestos_cent']
    .reduce((s, c) => s + (Number(v[c]) || 0), Number(base));
}

export function margenBruto(v) {
  const coste = costeTotal(v);
  if (vacio(v.pvp_cent) || coste == null) return null;
  return Number(v.pvp_cent) - coste;
}
