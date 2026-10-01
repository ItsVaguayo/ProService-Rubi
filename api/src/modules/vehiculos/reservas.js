// Dueño: Victor. Liberar una reserva, a mano (cancelar) o sola al caducar (2.4, duda C6).
// Reservar está en routes.js.
import { registrar } from '../auditoria.js';
import { emitirCambioEstado } from './eventos.js';

// Deja la reserva inactiva y, si el coche seguía «Reservado», lo devuelve a «Publicado».
// Va dentro de una transacción. `usuario` es null cuando caduca sola: no la libera nadie.
export function liberarReserva(db, { reserva, vehiculo, usuario = null, accion }) {
  db.prepare('UPDATE reservas SET activa = 0 WHERE id = ?').run(reserva.id);
  registrar(db, { usuarioId: usuario?.id, entidad: 'reserva', entidadId: reserva.id, accion });
  if (vehiculo.estado === 'reservado') {
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
