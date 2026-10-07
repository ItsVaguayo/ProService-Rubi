// Dueño: David. Alta de un gasto en el libro (T14). La usan el POST de /api/gastos y la liquidación de
// incentivos (T12). Todo dentro de una transacción: así dos altas a la vez nunca cogen el mismo número.
import { registrar } from '../auditoria.js';
import { conDefectos, importes, reglasIncumplidas } from './calculo.js';

export class ErrorGasto extends Error {
  constructor(errores) {
    super(errores.join('. '));
    this.errores = errores;
  }
}

/**
 * `datos` ya limpios (gastos/campos.js). Calcula los importes, comprueba las reglas, pone el siguiente
 * número de registro e inserta. Devuelve el id. Si algo no cuadra, lanza ErrorGasto (y no se guarda nada).
 * Si se llama dentro de otra transacción (la de liquidar un incentivo), se une a ella.
 */
export function apuntarGasto(db, datos, usuarioId) {
  return db.transaction(() => {
    const g = conDefectos(datos);
    const errores = reglasIncumplidas(g);
    if (errores.length) throw new ErrorGasto(errores);
    Object.assign(g, importes(g));
    g.numero = db.prepare('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM gastos').get().n;
    g.creado_por = usuarioId;
    const columnas = Object.keys(g).filter((c) => g[c] !== undefined);
    const id = Number(db.prepare(`INSERT INTO gastos (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
      .run(...columnas.map((c) => g[c])).lastInsertRowid);
    registrar(db, { usuarioId, entidad: 'gasto', entidadId: id, accion: 'alta', despues: g });
    return id;
  })();
}
