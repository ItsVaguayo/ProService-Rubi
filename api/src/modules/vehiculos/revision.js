// Dueño: Victor. La revisión del coche, como la pestaña de Pymecar (migración 0019): lo que se recibe con él,
// lo que se entrega con él y el estado de cada componente. «Revisado» = la revisión de componentes está hecha,
// con quién y cuándo. Los dos roles: aquí no hay dinero. El estado de los componentes va como anexo del
// contrato de compraventa (contratos/plantillas.js).
import { registrar } from '../auditoria.js';

export const FASES = ['recepcion', 'entrega', 'componentes'];
export const ESTADOS_COMPONENTE = ['controlado', 'sustituido', 'cubierto'];

// Para deshacer la transacción entera cuando no se puede dar por revisado
class NoRevisado extends Error {}

/** { revisado_en, revisado_por, revisado_por_nombre, recepcion: [...], entrega: [...], componentes: [...] } */
export function revisionDe(db, vehiculoId) {
  const v = db.prepare(`SELECT v.revisado_en, v.revisado_por, u.nombre AS revisado_por_nombre
                          FROM vehiculos v LEFT JOIN usuarios u ON u.id = v.revisado_por WHERE v.id = ?`).get(vehiculoId);
  const filas = db.prepare(`SELECT e.id, e.fase, e.nombre, COALESCE(r.marcado, 0) AS marcado, r.estado, r.nota
                              FROM revision_elementos e
                              LEFT JOIN vehiculo_revision r ON r.elemento_id = e.id AND r.vehiculo_id = ?
                             WHERE e.activo = 1 OR r.vehiculo_id IS NOT NULL
                             ORDER BY e.fase, e.orden, e.id`).all(vehiculoId);
  const de = (fase) => filas.filter((f) => f.fase === fase);
  return {
    ...v,
    recepcion: de('recepcion').map(({ id, nombre, marcado }) => ({ id, nombre, marcado: !!marcado })),
    entrega: de('entrega').map(({ id, nombre, marcado }) => ({ id, nombre, marcado: !!marcado })),
    componentes: de('componentes').map(({ id, nombre, estado, nota }) => ({ id, nombre, estado: estado ?? null, nota: nota ?? null })),
  };
}

/**
 * Cambia solo lo que llega: { recepcion?: { id: bool }, entrega?: { id: bool },
 * componentes?: { id: { estado?, nota? } }, revisado?: bool }. Devuelve los errores (vacío si se guardó).
 * «revisado: true» exige que todos los componentes tengan su estado.
 */
export function guardarRevision(db, vehiculo, cuerpo, usuario) {
  const errores = [];
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return ['El cuerpo tiene que ser un objeto'];
  const desconocidos = Object.keys(cuerpo).filter((k) => ![...FASES, 'revisado'].includes(k));
  if (desconocidos.length) errores.push(`Campo desconocido: ${desconocidos.join(', ')}`);
  if (cuerpo.revisado !== undefined && typeof cuerpo.revisado !== 'boolean') errores.push('revisado tiene que ser true o false');

  const elementos = new Map(db.prepare('SELECT id, fase, nombre FROM revision_elementos').all().map((e) => [String(e.id), e]));
  const cambios = []; // { elemento, marcado?, estado?, nota? }
  for (const fase of FASES) {
    const lista = cuerpo[fase];
    if (lista === undefined) continue;
    if (!lista || typeof lista !== 'object' || Array.isArray(lista)) { errores.push(`${fase} tiene que ser un objeto { id: valor }`); continue; }
    for (const [id, valor] of Object.entries(lista)) {
      const e = elementos.get(id);
      if (!e || e.fase !== fase) { errores.push(`${fase}: no hay ningún elemento ${id}`); continue; }
      if (fase !== 'componentes') {
        if (typeof valor !== 'boolean') errores.push(`${e.nombre}: tiene que ser true o false`);
        else cambios.push({ elemento: e, marcado: valor ? 1 : 0 });
        continue;
      }
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) { errores.push(`${e.nombre}: tiene que ser { estado, nota }`); continue; }
      const extra = Object.keys(valor).filter((k) => !['estado', 'nota'].includes(k));
      if (extra.length) errores.push(`${e.nombre}: campo desconocido ${extra.join(', ')}`);
      const cambio = { elemento: e };
      if (valor.estado !== undefined) {
        if (valor.estado !== null && !ESTADOS_COMPONENTE.includes(valor.estado)) errores.push(`${e.nombre}: el estado tiene que ser ${ESTADOS_COMPONENTE.join(', ')} o null`);
        else cambio.estado = valor.estado;
      }
      if (valor.nota !== undefined) {
        if (valor.nota !== null && (typeof valor.nota !== 'string' || valor.nota.length > 500)) errores.push(`${e.nombre}: la nota es texto de hasta 500 caracteres`);
        else cambio.nota = valor.nota?.trim() || null;
      }
      cambios.push(cambio);
    }
  }
  if (!cambios.length && cuerpo.revisado === undefined && !errores.length) errores.push('Sin cambios');
  if (errores.length) return errores;

  try {
    db.transaction(() => {
      const leer = db.prepare('SELECT * FROM vehiculo_revision WHERE vehiculo_id = ? AND elemento_id = ?');
      const antes = revisionDe(db, vehiculo.id);
      for (const c of cambios) {
        const fila = leer.get(vehiculo.id, c.elemento.id);
        const nueva = {
          marcado: c.marcado ?? fila?.marcado ?? 0,
          estado: 'estado' in c ? c.estado : fila?.estado ?? null,
          nota: 'nota' in c ? c.nota : fila?.nota ?? null,
        };
        db.prepare(`INSERT INTO vehiculo_revision (vehiculo_id, elemento_id, marcado, estado, nota) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (vehiculo_id, elemento_id) DO UPDATE SET marcado = excluded.marcado, estado = excluded.estado,
                      nota = excluded.nota, actualizado_en = datetime('now')`).run(vehiculo.id, c.elemento.id, nueva.marcado, nueva.estado, nueva.nota);
      }
      // Revisado: con todos los componentes vistos. Si después se deja alguno sin estado, deja de estar revisado.
      const sinVer = revisionDe(db, vehiculo.id).componentes.filter((c) => !c.estado).map((c) => c.nombre);
      if (cuerpo.revisado === true) {
        if (sinVer.length) throw new NoRevisado(`Para darlo por revisado falta el estado de: ${sinVer.join(', ')}`);
        if (!antes.revisado_en) db.prepare("UPDATE vehiculos SET revisado_en = datetime('now'), revisado_por = ? WHERE id = ?").run(usuario.id, vehiculo.id);
      } else if (cuerpo.revisado === false || (antes.revisado_en && sinVer.length)) {
        db.prepare('UPDATE vehiculos SET revisado_en = NULL, revisado_por = NULL WHERE id = ?').run(vehiculo.id);
      }
      registrar(db, {
        usuarioId: usuario.id, entidad: 'vehiculo', entidadId: vehiculo.id, accion: 'revision',
        despues: { ...Object.fromEntries(FASES.filter((f) => cuerpo[f] !== undefined).map((f) => [f, cuerpo[f]])), ...(cuerpo.revisado !== undefined && { revisado: cuerpo.revisado }) },
      });
    })();
  } catch (e) {
    if (e instanceof NoRevisado) return [e.message];
    throw e;
  }
  return [];
}
