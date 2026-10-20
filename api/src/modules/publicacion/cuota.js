// Dueño: Victor. Cuota orientativa de la web y los portales (5.7 del briefing: «orientativa», sin financiera
// ni condiciones a la vista). Las condiciones son las de la calculadora de Pymecar (docs/pymecar.md, dudas
// B13 y E2): 7,5 % de interés anual y 10 años. Se cambian con CUOTA_TIN y CUOTA_MESES; CUOTA_MESES=0 la apaga.
//
// Préstamo francés sin entrada ni comisiones, sobre el precio si financia y, si no lo tiene, sobre el PVP.
// Se redondea hacia arriba al euro: «Desde X €/mes» nunca promete menos de lo que sale la cuenta.
//
// Un anuncio con cifras de coste del crédito tiene que llevar un ejemplo representativo con la TAE y el
// importe total adeudado (Ley 16/2011 de crédito al consumo, art. 9). La TAE sale aquí sin comisiones: si la
// financiera cobra apertura, la de verdad es más alta (duda E9).

export const CUOTA_POR_DEFECTO = Object.freeze({ tin: 7.5, meses: 120 });

/** Las condiciones de la cuota según el .env, o null si está apagada. Un valor imposible para el arranque. */
export function condicionesCuota(env = process.env) {
  const tin = env.CUOTA_TIN === undefined || env.CUOTA_TIN === '' ? CUOTA_POR_DEFECTO.tin : Number(env.CUOTA_TIN);
  const meses = env.CUOTA_MESES === undefined || env.CUOTA_MESES === '' ? CUOTA_POR_DEFECTO.meses : Number(env.CUOTA_MESES);
  if (!Number.isFinite(tin) || tin < 0 || tin > 30) throw new Error(`CUOTA_TIN tiene que ser un porcentaje entre 0 y 30 (hay «${env.CUOTA_TIN}»)`);
  if (!Number.isInteger(meses) || meses < 0 || meses > 180) throw new Error(`CUOTA_MESES tiene que ser un número de meses entre 0 y 180 (hay «${env.CUOTA_MESES}»)`);
  return meses === 0 ? null : { tin, meses };
}

/** Cuota exacta en céntimos de un capital en céntimos, o null si no hay capital o la cuota está apagada. */
function cuotaCent(capitalCent, condiciones) {
  if (!condiciones || !Number.isFinite(capitalCent) || capitalCent <= 0) return null;
  const { tin, meses } = condiciones;
  const r = tin / 100 / 12;
  return Math.round(r === 0 ? capitalCent / meses : (capitalCent * r) / (1 - (1 + r) ** -meses));
}

/** Euros al mes de un capital en céntimos, redondeados hacia arriba, o null si no hay capital o está apagada. */
export function cuotaMensual(capitalCent, condiciones) {
  const cent = cuotaCent(capitalCent, condiciones);
  return cent === null ? null : Math.ceil(cent / 100);
}

/** El capital de la cuota de un coche: el precio si financia y, si no lo tiene, el PVP. */
const capitalDe = (v) => v.precio_financiado_cent ?? v.pvp_cent;

export const cuotaDe = (v, condiciones) => cuotaMensual(capitalDe(v), condiciones);

/** TAE sin comisiones, en %: el TIN mensual capitalizado doce veces. */
export const taeSinComisiones = (tin) => Math.round(((1 + tin / 100 / 12) ** 12 - 1) * 10000) / 100;

/** El ejemplo representativo de un coche: capital, cuota exacta, TIN, TAE y total adeudado, o null sin cuota. */
export function ejemploDe(v, condiciones) {
  const capital = capitalDe(v);
  const cuota = cuotaCent(capital, condiciones);
  if (cuota === null) return null;
  return { capital_cent: capital, cuota_cent: cuota, meses: condiciones.meses, tin: condiciones.tin,
    tae: taeSinComisiones(condiciones.tin), total_cent: cuota * condiciones.meses };
}

const euros = (cent, decimales) => (cent / 100).toLocaleString('es-ES',
  { useGrouping: 'always', minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const porcentaje = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** La letra pequeña de la cuota de un coche, para la web (campo cuota_condiciones) y los portales. */
export function textoCondiciones(v, condiciones) {
  const e = ejemploDe(v, condiciones);
  if (!e) return null;
  return `Ejemplo para ${euros(e.capital_cent, 0)} € sin entrada: ${e.meses} cuotas de ${euros(e.cuota_cent, 2)} €, `
    + `TIN ${porcentaje(e.tin)} %, TAE ${porcentaje(e.tae)} %, importe total adeudado ${euros(e.total_cent, 2)} €. `
    + 'Sin comisiones. Orientativa y sujeta a la aprobación de la financiera.';
}
