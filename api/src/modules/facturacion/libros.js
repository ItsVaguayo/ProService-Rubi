// Dueño: Victor. Los libros que pide Hacienda y que hoy saca Pymecar (docs/pymecar.md, «Libros»):
//   Libro de ingresos  Las facturas emitidas, por orden. En REBU, la base y el IVA son los del margen.
//   Libro de REBU      Cada coche vendido en REBU: de quién se compró y por cuánto, y a quién se vendió.
// En pantalla (JSON) y en CSV para la gestoría. Periodo: ?desde= ?hasta= (AAAA-MM-DD); sin ellos, el año en curso.
// El libro de gastos es /api/gastos (T14 de David).
import { Router } from 'express';
import { diaValido, hoyLocal } from '../../fechas.js';
import { eurosCsv as euros, enviarCsv } from '../../csv.js';

const FORMA = { a_la_vista: 'A la vista', contado: 'Contado', pago_30: 'Pago a 30 días', pago_30_60: 'Pago a 30 y 60 días', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

export function rutasLibros(db) {
  const r = Router();

  const periodo = (req, res) => {
    const hoy = hoyLocal();
    const desde = req.query.desde ?? `${hoy.slice(0, 4)}-01-01`;
    const hasta = req.query.hasta ?? hoy;
    if (!diaValido(desde) || !diaValido(hasta) || desde > hasta) {
      res.status(400).json({ error: 'desde y hasta van como AAAA-MM-DD, y desde no puede ser posterior' });
      return null;
    }
    return { desde, hasta };
  };

  const emitidas = (desde, hasta, extra = '') => db.prepare(`SELECT * FROM facturas
      WHERE estado = 'emitida' AND fecha BETWEEN ? AND ? ${extra} ORDER BY emitida_en, id`).all(desde, hasta)
    .map((f) => ({ ...f, cliente: JSON.parse(f.datos_cliente), coche: f.datos_vehiculo ? JSON.parse(f.datos_vehiculo) : null }));

  // --- Libro de ingresos ---
  const ingresos = (p) => emitidas(p.desde, p.hasta).map((f) => ({
    codigo: f.codigo, serie: f.serie, numero: f.numero, fecha: f.fecha, tipo: f.tipo, regimen: f.regimen,
    cliente: f.cliente.nombre, nif: f.cliente.nif, forma_pago: f.forma_pago,
    base_cent: f.base_cent, iva_pct: f.iva_pct, iva_cent: f.iva_cent, suplidos_cent: f.suplidos_cent, total_cent: f.total_cent,
  }));
  const totales = (filas) => Object.fromEntries(['base_cent', 'iva_cent', 'suplidos_cent', 'total_cent'].map((c) => [c, filas.reduce((s, f) => s + f[c], 0)]));

  r.get('/ingresos', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    const filas = ingresos(p);
    res.json({ ...p, filas, totales: totales(filas) });
  });
  r.get('/ingresos.csv', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    enviarCsv(res, `libro-ingresos-${p.desde}-${p.hasta}.csv`, [
      ['Serie', (f) => f.serie], ['Número', (f) => f.codigo], ['Fecha', (f) => f.fecha], ['Cliente', (f) => f.cliente], ['NIF', (f) => f.nif],
      ['Forma de pago', (f) => FORMA[f.forma_pago] ?? f.forma_pago], ['Régimen', (f) => (f.regimen === 'REBU' ? 'REBU' : 'General')],
      ['Base imponible (€)', (f) => euros(f.base_cent)], ['IVA (%)', (f) => f.iva_pct], ['IVA (€)', (f) => euros(f.iva_cent)],
      ['Suplidos (€)', (f) => euros(f.suplidos_cent)], ['Total (€)', (f) => euros(f.total_cent)],
    ], ingresos(p));
  });

  // --- Libro de REBU: una línea por coche vendido en REBU (y su rectificativa, en negativo) ---
  const rebu = (p) => emitidas(p.desde, p.hasta, "AND regimen = 'REBU'").map((f, i) => ({
    numero: i + 1, codigo: f.codigo, tipo: f.tipo,
    vehiculo: f.coche ? `${f.coche.marca} ${f.coche.modelo} (${f.coche.matricula})` : '',
    fecha_compra: f.coche?.fecha_compra ?? null, proveedor: f.coche?.proveedor_nombre ?? null, proveedor_nif: f.coche?.proveedor_nif ?? null,
    compra_cent: f.compra_cent,
    fecha_venta: f.fecha, cliente: f.cliente.nombre, cliente_nif: f.cliente.nif,
    base_cent: f.base_cent, iva_cent: f.iva_cent, total_venta_cent: f.precio_cent,
  }));

  r.get('/rebu', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    res.json({ ...p, filas: rebu(p) });
  });
  r.get('/rebu.csv', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    enviarCsv(res, `libro-rebu-${p.desde}-${p.hasta}.csv`, [
      ['Nº', (f) => f.numero], ['Vehículo', (f) => f.vehiculo], ['Fecha de compra', (f) => f.fecha_compra], ['Proveedor', (f) => f.proveedor],
      ['NIF proveedor', (f) => f.proveedor_nif], ['Compra (€)', (f) => euros(f.compra_cent)], ['Fecha de venta', (f) => f.fecha_venta],
      ['Factura', (f) => f.codigo], ['Cliente', (f) => f.cliente], ['NIF cliente', (f) => f.cliente_nif],
      ['Base imponible (€)', (f) => euros(f.base_cent)], ['IVA (€)', (f) => euros(f.iva_cent)], ['Total venta (€)', (f) => euros(f.total_venta_cent)],
    ], rebu(p));
  });

  return r;
}
