// Dueño: Victor. Cerrar una reserva: a mano (cancelar), sola al caducar o al vender el coche (2.4, duda C6).
// Reservar está en routes.js.
import { registrar } from '../auditoria.js';
import { emitirCambioEstado } from './eventos.js';

// Acción de la auditoría → cómo queda apuntado el cierre en la reserva (migración 0007).
const CIERRES = { cancelacion: 'cancelada', caducada: 'caducada', venta: 'vendida' };

// Deja la reserva inactiva con su cierre y, si se cancela o caduca con el coche aún «Reservado», lo
// devuelve a «Publicado». En una venta el estado lo cambia quien vende. Va dentro de una transacción.
// `usuario` es null cuando caduca sola: no la libera nadie. `senalDevuelta`: true, false o null (sin apuntar).
export function liberarReserva(db, { reserva, vehiculo, usuario = null, accion, senalDevuelta = null }) {
  const cierre = CIERRES[accion];
  if (!cierre) throw new Error(`Cierre de reserva desconocido: ${accion}`);
  db.prepare("UPDATE reservas SET activa = 0, cierre = ?, cerrada_en = datetime('now'), senal_devuelta = ? WHERE id = ?")
    .run(cierre, senalDevuelta === null ? null : Number(senalDevuelta), reserva.id);
  registrar(db, {
    usuarioId: usuario?.id, entidad: 'reserva', entidadId: reserva.id, accion,
    despues: { cierre, ...(senalDevuelta === null ? {} : { senal_devuelta: senalDevuelta }) },
  });
  if (accion !== 'venta' && vehiculo.estado === 'reservado') {
    db.prepare("UPDATE vehiculos SET estado = 'publicado', actualizado_en = datetime('now') WHERE id = ?").run(vehiculo.id);
    db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id) VALUES (?,?,?,?)').run(vehiculo.id, 'reservado', 'publicado', usuario?.id ?? null);
    emitirCambioEstado(db, { vehiculo, de: 'reservado', a: 'publicado', usuario });
  }
}

// Libera las reservas activas cuya fecha de caducidad ya ha pasado. Devuelve cuántas ha liberado.
// Cada una en su transacción y con su propio try: si una falla (se avisa en el log), las demás
// se liberan igual y la que falló se vuelve a intentar en la siguiente pasada.
// Los oyentes de alCambiarEstado reciben `usuario: null`: tienen que aguantarlo.
export function caducarReservas(db) {
  const vencidas = db
    .prepare("SELECT * FROM reservas WHERE activa = 1 AND caduca_en IS NOT NULL AND caduca_en <= datetime('now')")
    .all();
  const leerCoche = db.prepare('SELECT * FROM vehiculos WHERE id = ?');
  let liberadas = 0;
  for (const reserva of vencidas) {
    try {
      db.transaction(() => liberarReserva(db, { reserva, vehiculo: leerCoche.get(reserva.vehiculo_id), usuario: null, accion: 'caducada' }))();
      liberadas++;
    } catch (e) {
      console.error(`[reservas] no se ha podido caducar la reserva ${reserva.id}: ${e.message}`);
    }
  }
  return liberadas;
}
