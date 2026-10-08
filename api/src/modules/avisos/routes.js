// Dueño: Victor. Avisos del panel (ampliación del 7-oct, bloque 9, T16). Solo lee: no tiene tablas.
//   GET /api/avisos → los dos roles. Gerencia lo ve todo. El comercial, sus tareas y los avisos de coches y
//                     contactos: nunca los cobros vencidos ni ningún importe (como en incentivos).
// El correo diario (duda H13) y las citas de mañana van aparte, cuando existan.
import { Router } from 'express';
import { ZONA, hoyLocal } from '../../fechas.js';
import { estadoCobro } from '../facturacion/routes.js';

export const DIAS_PARADO = 60;         // publicado desde hace más de esto: aviso
export const DIAS_PARADO_ALTA = 90;    // y desde aquí, con gravedad alta
export const HORAS_SIN_ATENDER = 24;
export const DIAS_ITV = 30;            // la ITV que caduca en estos días

const DIA_MS = 86400000;
const GRAVEDAD = { alta: 0, media: 1 };
const esGerencia = (u) => u?.rol === 'gerencia';

const fechaSql = (s) => new Date(`${s.replace(' ', 'T')}Z`);
const diasDesde = (s, ahora = new Date()) => Math.floor((ahora - fechaSql(s)) / DIA_MS);
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diaEsp = (dia) => dia.slice(0, 10).split('-').reverse().join('/');
const euros = (cent) => `${(cent / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
const coche = (v) => `${v.marca} ${v.modelo} ${v.matricula}`;

/** 'AAAA-MM-DD HH:MM' de ahora en Rubí: el formato de actividades.programada_para. */
const ahoraLocal = (ahora = new Date()) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(ahora);

export function rutasAvisos(db) {
  const r = Router();

  const consultas = {
    // programada_para va en hora de Rubí; hecha_en vacía = pendiente
    tareas: db.prepare(`
      SELECT a.id, a.descripcion, a.programada_para, a.responsable_id, u.nombre AS responsable_nombre,
             COALESCE(c.nombre, k.nombre) AS quien
        FROM actividades a
        JOIN usuarios u ON u.id = a.responsable_id
        LEFT JOIN clientes c ON c.id = a.cliente_id
        LEFT JOIN contactos k ON k.id = a.contacto_id
       WHERE a.tipo = 'tarea' AND a.hecha_en IS NULL AND a.programada_para < ?
         AND (? IS NULL OR a.responsable_id = ?)`),
    // recibido_en, en UTC como la base
    contactos: db.prepare(`
      SELECT id, nombre, tipo, recibido_en FROM contactos
       WHERE atendido_en IS NULL AND recibido_en <= datetime('now', ?)`),
    // Desde la primera vez que pasó a «Publicado»: volver de una reserva cancelada no pone el contador a cero.
    // Sin historial (coches metidos a mano), desde el alta, como en informes.
    parados: db.prepare(`
      SELECT * FROM (
        SELECT v.id, v.marca, v.modelo, v.matricula,
               COALESCE((SELECT MIN(h.fecha) FROM historial_estados h WHERE h.vehiculo_id = v.id AND h.a = 'publicado'), v.creado_en) AS desde
          FROM vehiculos v WHERE v.estado = 'publicado')
       WHERE desde <= datetime('now', ?)`),
    vendidosPublicados: db.prepare(`
      SELECT v.id, v.marca, v.modelo, v.matricula, v.estado,
             GROUP_CONCAT(p.canal, ', ') AS canales, MIN(p.actualizado_en) AS desde
        FROM vehiculos v JOIN publicaciones p ON p.vehiculo_id = v.id
       WHERE v.estado IN ('vendido', 'entregado') AND p.estado = 'retirar'
       GROUP BY v.id`),
    // itv_caducidad es un día de aquí ('AAAA-MM-DD')
    itv: db.prepare(`
      SELECT id, marca, modelo, matricula, itv_caducidad FROM vehiculos
       WHERE estado NOT IN ('vendido', 'entregado') AND itv_caducidad IS NOT NULL AND itv_caducidad <= ?`),
    // Emitidas de venta con vencimiento pasado; el saldo y si está anulada, con estadoCobro de facturación
    facturas: db.prepare(`
      SELECT f.id, f.codigo, f.tipo, f.estado, f.vencimiento, f.total_cent, c.nombre AS cliente_nombre,
             (SELECT COALESCE(SUM(k.importe_cent), 0) FROM cobros k WHERE k.factura_id = f.id) AS cobrado_cent,
             EXISTS (SELECT 1 FROM facturas r WHERE r.rectifica_id = f.id) AS anulada
        FROM facturas f JOIN clientes c ON c.id = f.cliente_id
       WHERE f.estado = 'emitida' AND f.tipo = 'venta' AND f.vencimiento IS NOT NULL AND f.vencimiento < ?`),
  };

  r.get('/', (req, res) => {
    const gerencia = esGerencia(req.usuario);
    const hoy = hoyLocal();
    const avisos = [];

    // 1. Tareas vencidas: de un día anterior, alta; de hoy, media
    const soloDe = gerencia ? null : req.usuario.id;
    for (const t of consultas.tareas.all(ahoraLocal(), soloDe, soloDe)) {
      const para = t.quien ? ` (${t.quien})` : '';
      const de = gerencia ? ` · ${t.responsable_nombre}` : '';
      avisos.push({
        tipo: 'tareas_vencidas', gravedad: t.programada_para.slice(0, 10) < hoy ? 'alta' : 'media',
        texto: `Tarea vencida: ${t.descripcion}${para}${de}`, enlace: 'crm.html', fecha: t.programada_para,
      });
    }

    // 2. Contactos de la web sin atender
    for (const c of consultas.contactos.all(`-${HORAS_SIN_ATENDER} hours`)) {
      avisos.push({
        tipo: 'contactos_sin_atender', gravedad: 'alta',
        texto: `${c.nombre} escribió por la web (${c.tipo}) y sigue sin atender`, enlace: 'contactos.html', fecha: c.recibido_en,
      });
    }

    // 3. Coches publicados hace mucho
    for (const v of consultas.parados.all(`-${DIAS_PARADO} days`)) {
      const dias = diasDesde(v.desde);
      avisos.push({
        tipo: 'coches_parados', gravedad: dias >= DIAS_PARADO_ALTA ? 'alta' : 'media',
        texto: `${coche(v)} lleva ${dias} días publicado`, enlace: `coche.html?id=${v.id}`, fecha: v.desde,
      });
    }

    // 4. Vendidos o entregados que siguen en algún portal
    for (const v of consultas.vendidosPublicados.all()) {
      avisos.push({
        tipo: 'vendidos_publicados', gravedad: 'alta',
        texto: `${coche(v)} está ${v.estado} y sigue por retirar en ${v.canales}`, enlace: `coche.html?id=${v.id}`, fecha: v.desde,
      });
    }

    // 5. ITV caducada (alta) o que caduca pronto (media), de los coches en stock
    for (const v of consultas.itv.all(sumarDias(hoy, DIAS_ITV))) {
      const caducada = v.itv_caducidad < hoy;
      avisos.push({
        tipo: 'itv', gravedad: caducada ? 'alta' : 'media',
        texto: `${coche(v)}: la ITV ${caducada ? 'caducó' : 'caduca'} el ${diaEsp(v.itv_caducidad)}`,
        enlace: `coche.html?id=${v.id}`, fecha: v.itv_caducidad,
      });
    }

    // 6. Cobros vencidos: solo gerencia, que es quien ve importes
    if (gerencia) {
      for (const f of consultas.facturas.all(hoy)) {
        if (estadoCobro({ ...f, anulada: !!f.anulada }, hoy) !== 'vencida') continue;
        avisos.push({
          tipo: 'cobros_vencidos', gravedad: 'alta',
          texto: `${f.codigo} de ${f.cliente_nombre}: ${euros(f.total_cent - f.cobrado_cent)} sin cobrar`,
          enlace: `factura.html?id=${f.id}`, fecha: f.vencimiento,
        });
      }
    }

    // Lo grave primero y, dentro, lo más antiguo
    avisos.sort((a, b) => GRAVEDAD[a.gravedad] - GRAVEDAD[b.gravedad] || a.fecha.localeCompare(b.fecha));
    res.json(avisos);
  });

  return r;
}
