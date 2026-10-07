// Dueño: Victor. Informes de los lunes (12.1, 12.2 y duda F2): ventas del mes con su margen, stock por
// antigüedad y los coches que más llevan. Todo sale de la base: la ficha de cada coche y su historial
// de estados. Solo gerencia (se monta con requiereRol en app.js).
//
// Qué cuenta como venta y quién la hizo está en ventas.js. El precio de venta es su PVP y el margen, el
// neto de margen.js (después del IVA de la venta y con los gastos del coche). Los gastos de estructura
// (los del libro que no son de ningún coche) se restan aparte para sacar el resultado del mes.
// Los meses van en hora UTC, como las fechas de la base: una venta a las 00:30 del día 1 cuenta en el
// mes anterior. Para unos informes de lunes no cambia nada.
import { Router } from 'express';
import { costeTotal, ivaDeLaVenta, margenNeto, regimenDe } from '../margen.js';
import { ventasDelMes } from './ventas.js';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA_MS = 86400000;
const TRAMOS = [
  { nombre: 'Menos de 30 días', desde: 0, hasta: 30 },
  { nombre: 'De 30 a 60 días', desde: 30, hasta: 60 },
  { nombre: 'De 60 a 90 días', desde: 60, hasta: 90 },
  { nombre: 'Más de 90 días', desde: 90, hasta: Infinity },
];

const fechaSql = (s) => new Date(`${s.replace(' ', 'T')}Z`);
const dias = (desde, hasta = new Date()) => Math.max(0, Math.floor((hasta - fechaSql(desde)) / DIA_MS));
const mesActual = () => new Date().toISOString().slice(0, 7);
function mesAnterior(mes) {
  const [anio, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, m - 2, 1)).toISOString().slice(0, 7);
}

export function rutasInformes(db) {
  const r = Router();

  const enStock = db.prepare(`
    SELECT v.id, v.referencia, v.matricula, v.marca, v.modelo, v.version, v.propiedad, v.estado,
           COALESCE((SELECT MIN(h.fecha) FROM historial_estados h WHERE h.vehiculo_id = v.id), v.creado_en) AS fecha_alta
      FROM vehiculos v WHERE v.estado NOT IN ('vendido', 'entregado')`);

  const gastosEstructura = db.prepare(`SELECT COALESCE(SUM(base_cent), 0) AS n FROM gastos
                                         WHERE vehiculo_id IS NULL AND tipo <> 'rebu' AND substr(fecha, 1, 7) = ?`);

  const mesesConVentas = db.prepare(`
    SELECT DISTINCT substr(fecha, 1, 7) AS mes FROM historial_estados WHERE a IN ('vendido', 'entregado')`);

  const ventas = (mes) => ventasDelMes(db, mes).map((v) => ({
    id: v.id, referencia: v.referencia, matricula: v.matricula, marca: v.marca, modelo: v.modelo, version: v.version,
    propiedad: v.propiedad, estado: v.estado, fecha_venta: v.fecha_venta, vendio: v.vendio ?? null,
    precio_venta_cent: v.pvp_cent, coste_total_cent: costeTotal(v), regimen: regimenDe(v), iva_venta_cent: ivaDeLaVenta(v), margen_cent: margenNeto(v),
    dias_en_stock: dias(v.fecha_alta, fechaSql(v.fecha_venta)),
  }));

  const mesPedido = (req, res) => {
    const mes = req.query.mes ?? mesActual();
    if (!MES.test(mes)) {
      res.status(400).json({ error: 'El mes va como AAAA-MM, por ejemplo 2026-09' });
      return null;
    }
    return mes;
  };

  r.get('/', (req, res) => {
    const mes = mesPedido(req, res);
    if (!mes) return;
    const lista = ventas(mes);
    const conMargen = lista.filter((v) => v.margen_cent != null);
    const margen = conMargen.reduce((s, v) => s + v.margen_cent, 0);
    const suma = (campo) => lista.reduce((s, v) => s + (v[campo] ?? 0), 0);

    const stock = enStock.all().map((v) => ({ ...v, dias: dias(v.fecha_alta) })).sort((a, b) => b.dias - a.dias);
    const meses = new Set([mesActual(), mes, ...mesesConVentas.all().map((f) => f.mes)]);

    res.json({
      mes,
      meses: [...meses].sort().reverse(),
      resumen: {
        vendidos: lista.length,
        vendidos_mes_anterior: ventasDelMes(db, mesAnterior(mes)).length,
        facturado_cent: suma('precio_venta_cent'),
        margen_cent: conMargen.length ? margen : null,
        margen_medio_cent: conMargen.length ? Math.round(margen / conMargen.length) : null,
        ventas_sin_margen: lista.length - conMargen.length, // les falta el coste o el precio: no se inventa
        // Gastos del libro que no son de ningún coche (alquiler, luz, gestoría…), sin IVA, y lo que queda
        gastos_estructura_cent: gastosEstructura.get(mes).n,
        resultado_cent: conMargen.length ? margen - gastosEstructura.get(mes).n : null,
        dias_medios_venta: lista.length ? Math.round(suma('dias_en_stock') / lista.length) : null,
      },
      ventas: lista,
      stock: {
        total: stock.length,
        propios: stock.filter((v) => v.propiedad !== 'deposito').length,
        deposito: stock.filter((v) => v.propiedad === 'deposito').length,
        tramos: TRAMOS.map((t) => ({ nombre: t.nombre, desde: t.desde, n: stock.filter((v) => v.dias >= t.desde && v.dias < t.hasta).length })),
        mas_antiguos: stock.slice(0, 5),
      },
    });
  });

  // Las ventas del mes para el gestor, en CSV que Excel abre bien en español: «;» entre columnas,
  // coma decimal y BOM para los acentos.
  r.get('/ventas.csv', (req, res) => {
    const mes = mesPedido(req, res);
    if (!mes) return;
    const euros = (cent) => (cent == null ? '' : (cent / 100).toFixed(2).replace('.', ','));
    const columnas = [
      ['Fecha de venta', (v) => v.fecha_venta.slice(0, 10)],
      ['Referencia', (v) => v.referencia],
      ['Matrícula', (v) => v.matricula],
      ['Marca', (v) => v.marca],
      ['Modelo', (v) => v.modelo],
      ['Versión', (v) => v.version],
      ['Propiedad', (v) => (v.propiedad === 'deposito' ? 'Depósito' : 'Propio')],
      ['Vendió', (v) => v.vendio],
      ['Precio de venta (€)', (v) => euros(v.precio_venta_cent)],
      ['Coste total (€)', (v) => euros(v.coste_total_cent)],
      ['Régimen', (v) => (v.regimen === 'REBU' ? 'REBU' : 'General')],
      ['IVA de la venta (€)', (v) => euros(v.iva_venta_cent)],
      ['Margen neto (€)', (v) => euros(v.margen_cent)],
      ['Días en stock', (v) => v.dias_en_stock],
    ];
    const lineas = [columnas.map(([nombre]) => celda(nombre)), ...ventas(mes).map((v) => columnas.map(([, valor]) => celda(valor(v))))];
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="ventas-${mes}.csv"`);
    res.send(`﻿${lineas.map((l) => l.join(';')).join('\r\n')}\r\n`);
  });

  return r;
}

// Una celda de CSV. Entre comillas si lleva «;», comillas o saltos. Y si empieza por = + - @, con un
// apóstrofo delante: así Excel no la ejecuta como fórmula (una marca escrita a mala idea, por ejemplo).
function celda(valor) {
  let t = valor == null ? '' : String(valor);
  if (/^[=+\-@]/.test(t) && !/^-?\d+(,\d+)?$/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
