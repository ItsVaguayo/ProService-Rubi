// Dueño: Victor. Los libros que pide Hacienda y que hoy saca Pymecar (docs/pymecar.md, «Libros»):
//   Libro de ingresos  Las facturas emitidas, por orden. En REBU, la base y el IVA son los del margen.
//   Libro de REBU      Cada coche vendido en REBU: de quién se compró y por cuánto, y a quién se vendió.
//   Libro de gastos    Lo apuntado en el libro de David (T14), por número de registro. Aquí solo se lee.
// En pantalla (JSON, con totales) y en CSV para la gestoría. Periodo: ?anio=2026 y, si se quiere, &trimestre=1..4;
// o ?desde= ?hasta= (AAAA-MM-DD). Sin nada, el año en curso.
import { Router } from 'express';
import { diaValido, hoyLocal } from '../../fechas.js';
import { eurosCsv as euros, enviarCsv } from '../../csv.js';

const FORMA = { a_la_vista: 'A la vista', contado: 'Contado', pago_30: 'Pago a 30 días', pago_30_60: 'Pago a 30 y 60 días', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

export function rutasLibros(db) {
  const r = Router();

  const periodo = (req, res) => {
    const hoy = hoyLocal();
    let { desde, hasta } = req.query;
    const { anio, trimestre } = req.query;
    if (anio !== undefined || trimestre !== undefined) {
      if (!/^\d{4}$/.test(anio ?? '') || (trimestre !== undefined && !/^[1-4]$/.test(trimestre))) {
        res.status(400).json({ error: 'anio va como 2026 y trimestre de 1 a 4' });
        return null;
      }
      const [mi, mf] = trimestre ? [(trimestre - 1) * 3 + 1, trimestre * 3] : [1, 12];
      desde = `${anio}-${String(mi).padStart(2, '0')}-01`;
      hasta = new Date(Date.UTC(Number(anio), mf, 0)).toISOString().slice(0, 10); // último día del mes mf
    }
    desde ??= `${hoy.slice(0, 4)}-01-01`;
    hasta ??= `${hoy.slice(0, 4)}-12-31`;
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
    const filas = rebu(p);
    res.json({ ...p, filas, totales: Object.fromEntries(['compra_cent', 'base_cent', 'iva_cent', 'total_venta_cent'].map((c) => [c, filas.reduce((s, f) => s + (f[c] ?? 0), 0)])) });
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

  // --- Libro de gastos: el de David (gastos), por número de registro ---
  const TIPO_GASTO = { general: 'Gasto general', irpf: 'Gasto con IRPF', comision: 'Comisiones agentes', rebu: 'Factura con REBU', vehiculo: 'Gasto vehículo' };
  const CONCEPTO = { alquileres: 'Alquileres', carburantes: 'Carburantes', comisiones: 'Comisiones', compras: 'Compras', electricidad: 'Electricidad',
    gestorias: 'Gestorías', papelerias: 'Papelerías', publicidad: 'Publicidad', vehiculos: 'Vehículos' };
  const gastos = (p) => db.prepare(`
      SELECT g.*, COALESCE(pr.nombre, c.nombre, u.nombre) AS quien, COALESCE(pr.nif, c.nif) AS quien_nif,
             v.marca, v.modelo, v.matricula
        FROM gastos g
        LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
        LEFT JOIN clientes c ON c.id = g.cliente_id
        LEFT JOIN usuarios u ON u.id = g.usuario_id
        LEFT JOIN vehiculos v ON v.id = g.vehiculo_id
       WHERE g.fecha BETWEEN ? AND ? ORDER BY g.numero`).all(p.desde, p.hasta)
    .map((g) => ({
      numero: g.numero, fecha: g.fecha, factura_proveedor: g.factura_proveedor, quien: g.quien, quien_nif: g.quien_nif,
      tipo: g.tipo, concepto: g.concepto, descripcion: g.descripcion, vehiculo: g.matricula ? `${g.marca} ${g.modelo} (${g.matricula})` : null,
      base_cent: g.base_cent, iva_pct: g.iva_pct, iva_cent: g.iva_cent, irpf_pct: g.irpf_pct, irpf_cent: g.irpf_cent, total_cent: g.total_cent, pagado_en: g.pagado_en,
    }));

  r.get('/gastos', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    const filas = gastos(p);
    res.json({ ...p, filas, totales: Object.fromEntries(['base_cent', 'iva_cent', 'irpf_cent', 'total_cent'].map((c) => [c, filas.reduce((s, f) => s + f[c], 0)])) });
  });
  r.get('/gastos.csv', (req, res) => {
    const p = periodo(req, res);
    if (!p) return;
    enviarCsv(res, `libro-gastos-${p.desde}-${p.hasta}.csv`, [
      ['Nº', (g) => g.numero], ['Fecha', (g) => g.fecha], ['Factura proveedor', (g) => g.factura_proveedor], ['Proveedor / cliente', (g) => g.quien],
      ['NIF', (g) => g.quien_nif], ['Tipo', (g) => TIPO_GASTO[g.tipo] ?? g.tipo], ['Concepto', (g) => CONCEPTO[g.concepto] ?? g.concepto],
      ['Observaciones', (g) => g.descripcion], ['Vehículo', (g) => g.vehiculo], ['Base (€)', (g) => euros(g.base_cent)], ['IVA (%)', (g) => g.iva_pct],
      ['IVA (€)', (g) => euros(g.iva_cent)], ['IRPF (%)', (g) => g.irpf_pct], ['IRPF (€)', (g) => euros(g.irpf_cent)], ['Total (€)', (g) => euros(g.total_cent)],
      ['Pagado', (g) => g.pagado_en ?? ''],
    ], gastos(p));
  });

  return r;
}
