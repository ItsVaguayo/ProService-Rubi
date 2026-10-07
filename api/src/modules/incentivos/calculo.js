// Dueño: David. Incentivos de los comerciales (T12): cuánto se le paga a cada uno por lo vendido en un mes.
//
// Todo en enteros. El porcentaje va en centésimas (500 = 5 %) y el dinero en céntimos, y se redondea una
// sola vez, al final de cada coche: con decimales, 0.1 + 0.2 no da 0.3.
// El margen es el de margen.js (hoy el bruto; cuando Victor tenga el neto con REBU o IVA, se cambia aquí).
import { margenBruto } from '../margen.js';
import { ventasDelMes } from '../informes/ventas.js';

export const TIPOS_REGLA = ['porcentaje_margen', 'fijo_por_coche'];
export const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const margenDe = margenBruto;

/** Incentivo de un coche según la regla, en céntimos enteros. Sin regla, sin margen o con pérdida, 0. */
export function incentivoDeCoche(regla, margenCent) {
  if (!regla) return 0;
  if (regla.tipo === 'fijo_por_coche') return regla.valor;
  if (margenCent == null || margenCent <= 0) return 0;
  return Math.round((margenCent * regla.valor) / 10000);
}

/**
 * Por comercial: { usuario_id, nombre, rol, regla, coches: [{ id, referencia, marca, modelo, fecha_venta,
 * margen_cent, incentivo_cent }], total_cent, liquidado }. Salen los que vendieron algo ese mes y los
 * comerciales activos aunque no vendieran nada. `sin_vendedor`: ventas sin usuario (no deberían existir).
 */
export function calcularIncentivos(db, mes) {
  const reglas = new Map(db.prepare('SELECT usuario_id, tipo, valor, actualizado_en FROM incentivos_reglas').all().map((r) => [r.usuario_id, r]));
  const liquidados = new Map(db.prepare('SELECT usuario_id, coches, importe_cent, liquidado_en, liquidado_por FROM incentivos_liquidados WHERE mes = ?')
    .all(mes).map((l) => [l.usuario_id, l]));
  const usuarios = new Map(db.prepare('SELECT id, nombre, rol, activo FROM usuarios').all().map((u) => [u.id, u]));

  const porUsuario = new Map();
  const fila = (id) => {
    if (!porUsuario.has(id)) {
      const u = usuarios.get(id);
      const regla = reglas.get(id) ?? null;
      porUsuario.set(id, {
        usuario_id: id, nombre: u?.nombre ?? null, rol: u?.rol ?? null,
        regla: regla && { tipo: regla.tipo, valor: regla.valor },
        coches: [], total_cent: 0, liquidado: liquidados.get(id) ?? null,
      });
    }
    return porUsuario.get(id);
  };

  for (const u of usuarios.values()) if (u.rol === 'comercial' && u.activo) fila(u.id);

  let sinVendedor = 0;
  for (const v of ventasDelMes(db, mes)) {
    if (v.vendio_id == null) { sinVendedor++; continue; }
    const f = fila(v.vendio_id);
    const margen = margenDe(v);
    const incentivo = incentivoDeCoche(f.regla, margen);
    f.coches.push({ id: v.id, referencia: v.referencia, marca: v.marca, modelo: v.modelo, fecha_venta: v.fecha_venta,
      margen_cent: margen, incentivo_cent: incentivo });
    f.total_cent += incentivo;
  }
  // Quien ya cobró ese mes sale aunque luego se deshiciera su venta: lo pagado no desaparece
  for (const id of liquidados.keys()) fila(id);

  const comerciales = [...porUsuario.values()].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es') || a.usuario_id - b.usuario_id);
  return { mes, comerciales, sin_vendedor: sinVendedor };
}
