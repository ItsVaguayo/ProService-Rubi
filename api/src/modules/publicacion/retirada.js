// Dueño: David. Retirada (plan, semana 3): cuando un coche deja de estar a la venta, sus anuncios en los
// portales quedan en «retirar» hasta que alguien confirme la baja en cada uno. Hoy se les olvida (briefing
// 6.6). Pasa al venderlo o entregarlo, y también si vuelve al taller o a preparación desde «Publicado»: un
// coche que no se puede vender no puede seguir anunciado. La retirada automática espera a que Diego elija la
// vía de cada portal (docs/portales.md).
//
// La web no entra aquí: el conector de WordPress ya pasa el post a borrador al sincronizar.
import { registrarAlCambiarEstado } from '../vehiculos/eventos.js';
import { registrar } from '../auditoria.js';

export const PORTALES = ['coches_net', 'milanuncios', 'wallapop'];
const A_LA_VENTA = ['publicado', 'reservado'];
const aLaVenta = (estado) => A_LA_VENTA.includes(estado);

// «error» también se retira: no se sabe si el anuncio llegó a salir.
const A_RETIRAR = ['publicado', 'error'];

/** Lo que pasa con los anuncios de un coche al cambiar de estado. Síncrono y solo base de datos. */
export function alCambiarEstado(db, { vehiculo, de, a, usuario }) {
  let filas = [];
  if (aLaVenta(de) && !aLaVenta(a)) {
    filas = db.prepare(`SELECT * FROM publicaciones WHERE vehiculo_id = ? AND canal IN (${PORTALES.map(() => '?').join(',')})
                          AND estado IN (${A_RETIRAR.map(() => '?').join(',')})`).all(vehiculo.id, ...PORTALES, ...A_RETIRAR);
    for (const p of filas) cambiar(db, p, 'retirar', usuario);
  } else if (!aLaVenta(de) && aLaVenta(a)) {
    // Vuelve a estar a la venta (una venta anulada, o sale del taller): lo que aún no se había quitado sigue
    // publicado y vuelve a contar como tal. Lo ya retirado se queda así: hay que volver a subirlo.
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
