// Dueño: Victor. Cuota orientativa de la web y los portales (5.7 del briefing: «orientativa», sin financiera
// ni condiciones a la vista). Las condiciones son las de la calculadora de Pymecar (docs/pymecar.md, dudas
// B13 y E2): 7,5 % de interés anual y 10 años. Se cambian con CUOTA_TIN y CUOTA_MESES; CUOTA_MESES=0 la apaga.
//
// Préstamo francés sin entrada ni comisiones, sobre el precio si financia y, si no lo tiene, sobre el PVP.
// Se redondea hacia arriba al euro: «Desde X €/mes» nunca promete menos de lo que sale la cuenta.

export const CUOTA_POR_DEFECTO = Object.freeze({ tin: 7.5, meses: 120 });

/** Las condiciones de la cuota según el .env, o null si está apagada. Un valor imposible para el arranque. */
export function condicionesCuota(env = process.env) {
  const tin = env.CUOTA_TIN === undefined || env.CUOTA_TIN === '' ? CUOTA_POR_DEFECTO.tin : Number(env.CUOTA_TIN);
  const meses = env.CUOTA_MESES === undefined || env.CUOTA_MESES === '' ? CUOTA_POR_DEFECTO.meses : Number(env.CUOTA_MESES);
  if (!Number.isFinite(tin) || tin < 0 || tin > 30) throw new Error(`CUOTA_TIN tiene que ser un porcentaje entre 0 y 30 (hay «${env.CUOTA_TIN}»)`);
  if (!Number.isInteger(meses) || meses < 0 || meses > 180) throw new Error(`CUOTA_MESES tiene que ser un número de meses entre 0 y 180 (hay «${env.CUOTA_MESES}»)`);
  return meses === 0 ? null : { tin, meses };
}

/** Euros al mes de un capital en céntimos, o null si no hay capital o la cuota está apagada. */
export function cuotaMensual(capitalCent, condiciones) {
  if (!condiciones || !Number.isFinite(capitalCent) || capitalCent <= 0) return null;
  const { tin, meses } = condiciones;
  const r = tin / 100 / 12;
  const cent = r === 0 ? capitalCent / meses : (capitalCent * r) / (1 - (1 + r) ** -meses);
  return Math.ceil(Math.round(cent) / 100);
}

/** La cuota de un coche: sobre el precio si financia y, si no lo tiene, sobre el PVP. */
export const cuotaDe = (v, condiciones) => cuotaMensual(v.precio_financiado_cent ?? v.pvp_cent, condiciones);

/** La letra pequeña, para quien quiera enseñarla junto a la cuota (campo cuota_condiciones de la web). */
export function textoCondiciones(condiciones) {
  if (!condiciones) return null;
  const tin = condiciones.tin.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return `Cuota orientativa: ${tin} % TIN, ${condiciones.meses} meses, sin entrada. Sujeta a la aprobación de la financiera.`;
}
