// Dueño: David. Retirada al vender (plan, semana 3): cuando un coche se vende o se entrega, sus anuncios
// en los portales quedan en «retirar» hasta que alguien confirme la baja en cada uno. Hoy se les olvida
// (briefing 6.6). La retirada automática espera a que Diego elija la vía de cada portal (docs/portales.md).
//
// La web no entra aquí: el conector de WordPress ya pasa el post a borrador al sincronizar.
import { registrarAlCambiarEstado } from '../vehiculos/eventos.js';
import { registrar } from '../auditoria.js';

export const PORTALES = ['coches_net', 'milanuncios', 'wallapop'];
const VENDIDO = ['vendido', 'entregado'];
const A_LA_VENTA = ['publicado', 'reservado'];

// «error» también se retira: no se sabe si el anuncio llegó a salir.
const A_RETIRAR = ['publicado', 'error'];

/** Lo que pasa con los anuncios de un coche al cambiar de estado. Síncrono y solo base de datos. */
export function alCambiarEstado(db, { vehiculo, de, a, usuario }) {
  let filas = [];
  if (VENDIDO.includes(a) && !VENDIDO.includes(de)) {
    filas = db.prepare(`SELECT * FROM publicaciones WHERE vehiculo_id = ? AND canal IN (${PORTALES.map(() => '?').join(',')})
                          AND estado IN (${A_RETIRAR.map(() => '?').join(',')})`).all(vehiculo.id, ...PORTALES, ...A_RETIRAR);
    for (const p of filas) cambiar(db, p, 'retirar', usuario);
  } else if (VENDIDO.includes(de) && A_LA_VENTA.includes(a)) {
    // Venta anulada: lo que aún no se había quitado sigue publicado y vuelve a contar como tal.
    // Lo ya retirado se queda así: hay que volver a subirlo.
    filas = db.prepare("SELECT * FROM publicaciones WHERE vehiculo_id = ? AND estado = 'retirar'").all(vehiculo.id);
    for (const p of filas) cambiar(db, p, 'publicado', usuario);
  }
  return filas.length;
}

function cambiar(db, publicacion, estado, usuario) {
  db.prepare("UPDATE publicaciones SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(estado, publicacion.id);
  registrar(db, {
    usuarioId: usuario?.id ?? null, entidad: 'publicacion', entidadId: publicacion.id, accion: 'estado',
    antes: { canal: publicacion.canal, estado: publicacion.estado }, despues: { estado },
  });
}

registrarAlCambiarEstado(alCambiarEstado);
