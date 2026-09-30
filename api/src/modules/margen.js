// 3.5 Coste total y margen. Se calculan, no se guardan, para que nunca descuadren.
export function costeTotal(v) {
  return (
    (v.precio_compra ?? 0) +
    (v.coste_transporte ?? 0) +
    (v.coste_taller ?? 0) +
    (v.coste_preparacion ?? 0) +
    (v.coste_impuestos ?? 0)
  );
}

// TODO(Victor): con REBU el IVA va sobre el margen, con deducible sobre el precio.
// Falta la regla exacta del cliente (9.1) antes de dar el margen neto.
export function margenBruto(v) {
  if (v.pvp == null) return null;
  return v.pvp - costeTotal(v);
}
