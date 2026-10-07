// Dueño: Victor. Los importes de una factura de venta de un coche, en céntimos.
//
//   REBU     El cliente ve un solo total, sin IVA desglosado. Para los libros se separa el margen
//            (precio − compra) en base e IVA, como hace Pymecar: margen 1.975 → base 1.632,23 + IVA 342,77.
//            Con pérdida, base e IVA son 0. Es la misma cuenta que margen.js (ivaDeLaVenta).
//   General  El 21 % va dentro del precio: base = precio / 1,21, IVA = precio − base.
// Los suplidos (gestoría pagada por cuenta del cliente) van fuera de la base y del IVA: se suman al total.

export const IVA_GENERAL = 21;

export function importesFactura({ regimen, precio_cent, compra_cent, suplidos_cent = 0, iva_pct = IVA_GENERAL }) {
  let base_cent;
  let iva_cent;
  if (regimen === 'REBU') {
    const margen = Math.max(0, precio_cent - (compra_cent ?? 0));
    iva_cent = Math.round((margen * iva_pct) / (100 + iva_pct));
    base_cent = margen - iva_cent;
  } else {
    base_cent = Math.round((precio_cent * 100) / (100 + iva_pct));
    iva_cent = precio_cent - base_cent;
  }
  return { base_cent, iva_pct, iva_cent, total_cent: precio_cent + suplidos_cent };
}
