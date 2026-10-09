// Dueño: Victor. Portales a mano (docs/portales.md): ninguno de los tres deja cargar los coches sin un
// intermediario, así que el panel deja el anuncio listo para copiar, quien lo sube lo marca como publicado
// y, al vender, confirma la baja en cada portal. La retirada al vender (retirada.js) pone en «retirar» lo
// publicado; aquí se confirma. La web no va aquí: la lleva el conector de WordPress.
//
//   GET /api/portales?estado=retirar   → los anuncios en ese estado, con su coche (los dos roles)
//   GET /api/portales/:vehiculoId      → el estado en cada portal y el anuncio listo para copiar
//   PUT /api/portales/:vehiculoId/:canal { estado: 'publicado', enlace? } | { estado: 'retirado' }
// Sin dinero interno: el anuncio solo lleva el PVP, que sale en la web.
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { ENTERO } from '../../fechas.js';
import { versionFoto } from '../fotos/routes.js';
import { PORTALES } from './retirada.js';

export const NOMBRES = { coches_net: 'Coches.net', milanuncios: 'Milanuncios', wallapop: 'Wallapop' };
const ESTADOS = ['pendiente', 'publicado', 'retirar', 'retirado', 'error'];
const A_LA_VENTA = ['publicado', 'reservado'];
const DE_BAJA = ['publicado', 'retirar', 'error']; // lo que se puede confirmar como quitado

const COMBUSTIBLE = { gasolina: 'gasolina', diesel: 'diésel', hibrido: 'híbrido', hibrido_enchufable: 'híbrido enchufable', electrico: 'eléctrico', glp: 'GLP' };
const CAMBIO = { manual: 'cambio manual', automatico: 'cambio automático' };
const miles = (n) => n.toLocaleString('es-ES', { useGrouping: 'always' });

function esEnlace(texto) {
  if (texto.length > 500) return false;
  try {
    return ['http:', 'https:'].includes(new URL(texto).protocol);
  } catch {
    return false;
  }
}

/** El anuncio, igual para los tres portales. Solo datos de la ficha: nada de frases que la ficha no respalde. */
export function anuncioDe(v, extras, fotos, empresa) {
  const nombre = [v.marca, v.modelo, v.version].filter(Boolean).join(' ');
  const titulo = [
    [nombre, v.potencia_cv ? `${v.potencia_cv} CV` : null].filter(Boolean).join(' '),
    v.anio, v.kilometros != null ? `${miles(v.kilometros)} km` : null,
  ].filter(Boolean).join(' · ');

  const lineas = [];
  const motor = [v.potencia_cv ? `${v.potencia_cv} CV` : null, COMBUSTIBLE[v.combustible] ?? v.combustible, CAMBIO[v.cambio]].filter(Boolean);
  lineas.push(`${nombre}${motor.length ? `, ${motor.join(', ')}` : ''}.`);
  const uso = [v.anio ? `Año ${v.anio}` : null, v.kilometros != null ? `${miles(v.kilometros)} km` : null].filter(Boolean);
  if (uso.length) lineas.push(`${uso.join(' con ')}.`);
  if (v.garantia_meses) lineas.push(`${v.garantia_meses} meses de garantía.`);
  if (extras.length) lineas.push(`Equipamiento: ${extras.join(', ').toLowerCase()}.`);
  const carroceria = [
    v.etiqueta_dgt ? `Etiqueta DGT ${v.etiqueta_dgt}` : null, v.puertas ? `${v.puertas} puertas` : null,
    v.plazas ? `${v.plazas} plazas` : null, v.color_exterior ? `Color ${v.color_exterior}` : null,
  ].filter(Boolean);
  if (carroceria.length) lineas.push(`${carroceria.join('. ')}.`);
  lineas.push(['Pro Service Rubí', empresa?.poblacion, empresa?.telefono].filter(Boolean).join(' · '));
  if (v.referencia) lineas.push(`Ref. ${v.referencia}`);

  return {
    titulo,
    precio_euros: v.pvp_cent == null ? null : Math.round(v.pvp_cent / 100),
    descripcion: lineas.join('\n'),
    video_url: v.video_url ?? null,
    fotos: fotos.map((f) => ({ id: f.id, orden: f.orden, url: `/api/fotos/${f.vehiculo_id}/${f.id}/archivo?v=${encodeURIComponent(versionFoto(f))}` })),
  };
}

export function rutasPortales(db) {
  const r = Router();
  const leerCoche = db.prepare('SELECT * FROM vehiculos WHERE id = ?');
  const publicaciones = db.prepare(`SELECT * FROM publicaciones WHERE vehiculo_id = ? AND canal IN (${PORTALES.map(() => '?').join(',')})`);
  const extras = db.prepare('SELECT e.nombre FROM vehiculo_extras ve JOIN extras e ON e.id = ve.extra_id WHERE ve.vehiculo_id = ? ORDER BY e.nombre');
  // Las que salen en la web, en su orden: las mismas que manda el conector de WordPress
  const fotosPublicas = db.prepare('SELECT * FROM fotos WHERE vehiculo_id = ? AND publica = 1 AND es_dano = 0 ORDER BY orden');

  const portalesDe = (vehiculoId) => {
    const filas = new Map(publicaciones.all(vehiculoId, ...PORTALES).map((p) => [p.canal, p]));
    return PORTALES.map((canal) => {
      const p = filas.get(canal);
      return {
        canal, nombre: NOMBRES[canal], estado: p?.estado ?? 'sin_publicar', enlace: p?.enlace ?? null,
        publicado_en: p?.publicado_en ?? null, retirado_en: p?.retirado_en ?? null, actualizado_en: p?.actualizado_en ?? null,
      };
    });
  };

  const cocheDe = (req, res) => {
    if (!ENTERO.test(req.params.vehiculoId)) { res.status(404).json({ error: 'No existe' }); return null; }
    const v = leerCoche.get(Number(req.params.vehiculoId));
    if (!v) res.status(404).json({ error: 'No existe' });
    return v ?? null;
  };

  r.get('/', (req, res) => {
    const { estado } = req.query;
    if (estado !== undefined && !ESTADOS.includes(estado)) return res.status(400).json({ error: `estado tiene que ser ${ESTADOS.join(', ')}` });
    const filas = db.prepare(`SELECT p.id, p.vehiculo_id, p.canal, p.estado, p.enlace, p.publicado_en, p.retirado_en, p.actualizado_en,
                                     v.referencia, v.matricula, v.marca, v.modelo, v.estado AS vehiculo_estado
                                FROM publicaciones p JOIN vehiculos v ON v.id = p.vehiculo_id
                               WHERE p.canal IN (${PORTALES.map(() => '?').join(',')}) ${estado ? 'AND p.estado = ?' : ''}
                               ORDER BY p.actualizado_en, p.id`).all(...PORTALES, ...(estado ? [estado] : []));
    res.json(filas.map((p) => ({ ...p, nombre: NOMBRES[p.canal] })));
  });

  r.get('/:vehiculoId', (req, res) => {
    const v = cocheDe(req, res);
    if (!v) return;
    const empresa = db.prepare('SELECT poblacion, telefono FROM empresa WHERE id = 1').get();
    res.json({
      vehiculo: { id: v.id, referencia: v.referencia, matricula: v.matricula, marca: v.marca, modelo: v.modelo, version: v.version, estado: v.estado },
      a_la_venta: A_LA_VENTA.includes(v.estado),
      portales: portalesDe(v.id),
      anuncio: anuncioDe(v, extras.all(v.id).map((e) => e.nombre), fotosPublicas.all(v.id), empresa),
    });
  });

  r.put('/:vehiculoId/:canal', (req, res) => {
    const v = cocheDe(req, res);
    if (!v) return;
    const { canal } = req.params;
    if (!PORTALES.includes(canal)) return res.status(404).json({ error: `Portal desconocido: ${PORTALES.join(', ')}` });
    const { estado, enlace, ...resto } = req.body ?? {};
    const errores = [];
    if (Object.keys(resto).length) errores.push(`Campo desconocido: ${Object.keys(resto).join(', ')}`);
    if (!['publicado', 'retirado'].includes(estado)) errores.push('estado tiene que ser publicado o retirado');
    if (enlace != null && enlace !== '' && (typeof enlace !== 'string' || !esEnlace(enlace.trim()))) errores.push('enlace tiene que ser la dirección del anuncio (https://…)');
    if (estado === 'retirado' && enlace !== undefined) errores.push('enlace solo va al marcarlo publicado');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    const antes = publicaciones.all(v.id, ...PORTALES).find((p) => p.canal === canal) ?? null;
    if (estado === 'publicado' && !A_LA_VENTA.includes(v.estado)) {
      return res.status(409).json({ error: 'Solo se anuncia en los portales un coche publicado o reservado' });
    }
    if (estado === 'retirado' && !DE_BAJA.includes(antes?.estado)) {
      return res.status(409).json({ error: `En ${NOMBRES[canal]} no consta publicado: no hay nada que retirar` });
    }

    const link = estado === 'publicado' ? (enlace?.trim() || null) : antes?.enlace ?? null;
    db.transaction(() => {
      if (estado === 'publicado') {
        db.prepare(`INSERT INTO publicaciones (vehiculo_id, canal, estado, enlace, publicado_en, retirado_en)
                    VALUES (?, ?, 'publicado', ?, datetime('now'), NULL)
                    ON CONFLICT (vehiculo_id, canal) DO UPDATE SET estado = 'publicado', enlace = excluded.enlace,
                      publicado_en = CASE WHEN publicaciones.estado = 'publicado' THEN publicaciones.publicado_en ELSE datetime('now') END,
                      retirado_en = NULL, actualizado_en = datetime('now')`).run(v.id, canal, link);
      } else {
        db.prepare("UPDATE publicaciones SET estado = 'retirado', retirado_en = datetime('now'), actualizado_en = datetime('now') WHERE id = ?").run(antes.id);
      }
      const fila = db.prepare('SELECT id FROM publicaciones WHERE vehiculo_id = ? AND canal = ?').get(v.id, canal);
      registrar(db, {
        usuarioId: req.usuario.id, entidad: 'publicacion', entidadId: fila.id, accion: 'estado',
        antes: { canal, estado: antes?.estado ?? 'sin_publicar', enlace: antes?.enlace ?? null }, despues: { estado, enlace: link },
      });
    })();
    res.json(portalesDe(v.id).find((p) => p.canal === canal));
  });

  return r;
}
