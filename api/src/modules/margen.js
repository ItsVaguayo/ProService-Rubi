// 3.5 Coste total y margen, en céntimos. Se calculan, no se guardan, para que nunca descuadren.
//
// Coche propio:    coste = compra + transporte + taller + preparación + impuestos
// Coche en depósito (dudas B3/B4, opción por defecto):
//                  coste = lo que se paga al dueño + los costes que asume el taller
// Si falta la base (compra o pago al dueño) o el PVP, el margen es null: mejor no dar número
// que dar uno inventado.

function costesPropios(v) {
  return (
    (v.coste_transporte_cent ?? 0) +
    (v.coste_taller_cent ?? 0) +
    (v.coste_preparacion_cent ?? 0) +
    (v.coste_impuestos_cent ?? 0)
  );
}

export function costeTotal(v) {
  const base = v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent;
  if (base == null) return null;
  return base + costesPropios(v);
}

// TODO(Victor): con REBU el IVA va sobre el margen, con deducible sobre el precio.
// Falta la regla exacta del cliente (9.1, duda B5) antes de dar el margen neto.
export function margenBruto(v) {
  const coste = costeTotal(v);
  if (v.pvp_cent == null || coste == null) return null;
  return v.pvp_cent - coste;
}
