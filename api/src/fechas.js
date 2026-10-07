// Fechas comunes a todos los módulos.
//
// Dos relojes distintos, a propósito:
//   · Las marcas de la base (creado_en, historial_estados.fecha, hecha_en…) van en UTC: las pone SQLite con
//     datetime('now'). Los informes de ventas cuentan los meses con ellas, en UTC.
//   · Las fechas que escribe una persona o que van a un libro (la fecha de un gasto o de una factura, el
//     día que se paga) son días de aquí, de Rubí. Para esas, hoyLocal() y mesLocal(), nunca toISOString().

export const ZONA = 'Europe/Madrid';
export const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const ENTERO = /^[1-9]\d*$/;

/** 'AAAA-MM-DD' de hoy en Rubí (a las 00:30 del 1 de enero ya es el año nuevo, no el 31 de diciembre). */
export function hoyLocal(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** 'AAAA-MM' del mes en curso en Rubí. */
export const mesLocal = (ahora = new Date()) => hoyLocal(ahora).slice(0, 7);

/** ¿Existe ese día? (rechaza 2026-02-30) */
export function diaValido(texto) {
  const m = DIA.exec(texto);
  if (!m) return false;
  const [a, mes, d] = m.slice(1).map(Number);
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}
