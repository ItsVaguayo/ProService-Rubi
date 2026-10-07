// Coste, IVA de la venta y margen de un coche, en céntimos. Se calculan, no se guardan, para que nunca descuadren.
//
// Los costes salen del libro de gastos (bloque 2): los cuatro de la ficha (transporte, taller, preparación e
// impuestos, sin IVA) más cualquier otro gasto apuntado a ese coche, menos la factura de compra en REBU, que
// ya es el precio de compra. Las consultas los traen con COSTES_SQL.
//
// La base es lo que costó el coche: el precio de compra o, en depósito, lo pactado con el dueño.
//
// IVA de la venta (docs/pymecar.md, comprobado con una venta real: 14.000 → 15.975, IVA 342,77):
//   REBU      IVA = (venta − compra) × 21/121, y 0 si se vende con pérdida (no se compensa).
//             Los gastos no entran: su IVA se deduce aparte.
//   General   IVA = el 21 % que va dentro del precio de venta: venta − venta/1,21.
//   Depósito  como en Pymecar: al venderlo se le compra al dueño y se vende en REBU.
// Sin régimen, REBU (duda B5). Las fórmulas las tiene que confirmar la gestoría (duda H7).
//
// Margen bruto = venta − coste total. Margen neto = margen bruto − IVA de la venta.
// Si falta la base o el PVP, todo es null: mejor no dar número que dar uno inventado.

export const IVA_GENERAL = 21;
export const CASILLAS_COSTE = ['transporte', 'taller', 'preparacion', 'impuestos'];

// Columnas calculadas para una consulta sobre vehiculos con alias `v`
export const COSTES_SQL = [
  ...CASILLAS_COSTE.map((k) => `(SELECT COALESCE(SUM(g.base_cent), 0) FROM gastos g WHERE g.vehiculo_id = v.id AND g.coste_ficha = '${k}') AS coste_${k}_cent`),
  "(SELECT COALESCE(SUM(g.base_cent), 0) FROM gastos g WHERE g.vehiculo_id = v.id AND g.coste_ficha IS NULL AND g.tipo <> 'rebu') AS coste_otros_cent",
].join(',\n      ');

export function costesDelCoche(v) {
  return [...CASILLAS_COSTE.map((k) => `coste_${k}_cent`), 'coste_otros_cent'].reduce((s, c) => s + (v[c] ?? 0), 0);
}

const baseDe = (v) => (v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent);
export const regimenDe = (v) => (v.propiedad === 'deposito' ? 'REBU' : v.regimen_iva ?? 'REBU');

export function costeTotal(v) {
  const base = baseDe(v);
  return base == null ? null : base + costesDelCoche(v);
}

export function margenBruto(v) {
  const coste = costeTotal(v);
  return v.pvp_cent == null || coste == null ? null : v.pvp_cent - coste;
}

export function ivaDeLaVenta(v) {
  const base = baseDe(v);
  if (v.pvp_cent == null || base == null) return null;
  if (regimenDe(v) === 'REBU') return Math.max(0, Math.round(((v.pvp_cent - base) * IVA_GENERAL) / (100 + IVA_GENERAL)));
  return v.pvp_cent - Math.round((v.pvp_cent * 100) / (100 + IVA_GENERAL));
}

export function margenNeto(v) {
  const bruto = margenBruto(v);
  const iva = ivaDeLaVenta(v);
  return bruto == null || iva == null ? null : bruto - iva;
}
