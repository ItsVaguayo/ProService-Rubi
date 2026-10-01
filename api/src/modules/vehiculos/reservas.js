// Dueño: Victor. Cierre y caducidad de las reservas (2.4, duda C6).
import { registrar } from '../auditoria.js';
import { emitirCambioEstado } from './eventos.js';

/**
 * Cierra la reserva activa de un coche. `cierre`: cancelada, caducada o vendida.
 * Se llama dentro de la transacción del cambio que la provoca.
 */
export function cerrarReserva(db, reserva, cierre, { usuarioId = null, senalDevuelta = null } = {}) {
  db.prepare(`UPDATE reservas SET activa = 0, cierre = ?, cerrada_en = datetime('now'), senal_devuelta = ?
               WHERE id = ?`).run(cierre, senalDevuelta === null ? null : Number(senalDevuelta), reserva.id);
  registrar(db, {
    usuarioId, entidad: 'reserva', entidadId: reserva.id,
    accion: cierre === 'caducada' ? 'caducidad' : cierre === 'vendida' ? 'venta' : 'cancelacion',
    despues: { cierre, ...(senalDevuelta === null ? {} : { senal_devuelta: senalDevuelta }) },
  });
}

/**
 * Cierra las reservas que han pasado su fecha y devuelve sus coches a «Publicado».
 * No lo hace nadie: queda en el historial y en la auditoría sin usuario.
 * Se llama antes de leer o tocar coches, y cada hora desde el servidor. Devuelve cuántas cerró.
 */
export function caducarReservas(db) {
  const caducadas = db.prepare(`SELECT r.*, v.estado AS estado_coche FROM reservas r JOIN vehiculos v ON v.id = r.vehiculo_id
                                 WHERE r.activa = 1 AND r.caduca_en IS NOT NULL AND r.caduca_en <= datetime('now')`).all();
  if (!caducadas.length) return 0;
  db.transaction(() => {
    for (const reserva of caducadas) {
      cerrarReserva(db, reserva, 'caducada');
      if (reserva.estado_coche === 'reservado') {
        const vehiculo = db.prepare('SELECT * FROM vehiculos WHERE id = ?').get(reserva.vehiculo_id);
        db.prepare("UPDATE vehiculos SET estado = 'publicado', actualizado_en = datetime('now') WHERE id = ?").run(vehiculo.id);
        db.prepare("INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id) VALUES (?, 'reservado', 'publicado', NULL)").run(vehiculo.id);
        emitirCambioEstado(db, { vehiculo, de: 'reservado', a: 'publicado', usuario: null });
      }
    }
  })();
  return caducadas.length;
}
