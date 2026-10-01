// Condiciones de los estados. Duda C4 (opción por defecto): un coche puede moverse a cualquier
// estado, pero salir en la web (publicado, reservado, vendido) exige la ficha completa y las fotos,
// y eso tiene que seguir cumpliéndose mientras esté ahí: al editarlo y al tocar sus fotos.
import { OBLIGATORIOS_PUBLICAR } from './campos.js';
import { ESTADOS_WEB } from '../estados.js';

export const FOTOS_MINIMAS = Number(process.env.FOTOS_MINIMAS || 15); // 4.1: mínimo 15

export const enLaWeb = (estado) => ESTADOS_WEB.includes(estado);

// Una reserva se cierra sola si el coche pasa a uno de estos: la venta la consume.
const ESTADOS_QUE_CIERRAN_RESERVA = ['vendido', 'entregado'];

export function datosQueFaltan(vehiculo) {
  return OBLIGATORIOS_PUBLICAR.filter((c) => vehiculo[c] == null || vehiculo[c] === '');
}

/** Fotos que cuentan para la web: públicas y que no son de daños. */
export function fotosParaLaWeb(db, vehiculoId) {
  return db.prepare('SELECT COUNT(*) AS n FROM fotos WHERE vehiculo_id = ? AND publica = 1 AND es_dano = 0').get(vehiculoId).n;
}

/** Lo que impide que un coche esté en la web, con `n` fotos válidas. Vacío = puede estar. */
export function motivosParaEstarEnLaWeb(vehiculo, n) {
  const motivos = [];
  const faltan = datosQueFaltan(vehiculo);
  if (faltan.length) motivos.push(`Faltan datos para publicar: ${faltan.join(', ')}`);
  if (n < FOTOS_MINIMAS) motivos.push(`Tiene ${n} fotos y hacen falta al menos ${FOTOS_MINIMAS}`);
  return motivos;
}

// Devuelve la lista de motivos por los que no se puede pasar a `destino`. Vacía = se puede.
export function motivosParaNoEntrar(db, vehiculo, destino) {
  const motivos = [];
  const reserva = db.prepare('SELECT cliente FROM reservas WHERE vehiculo_id = ? AND activa = 1').get(vehiculo.id);

  // Entrar en la web desde fuera (por ejemplo, de taller a vendido): la misma exigencia que publicar.
  // Dentro de la web ya se cumple, porque editar y tocar fotos no deja romperla.
  if (enLaWeb(destino) && !enLaWeb(vehiculo.estado)) {
    motivos.push(...motivosParaEstarEnLaWeb(vehiculo, fotosParaLaWeb(db, vehiculo.id)));
  }

  if (destino === 'reservado' && !reserva) motivos.push('Para reservar hay que crear la reserva con la señal');

  // Salir de «Reservado» a cualquier sitio que no sea la venta deja la reserva colgando: se cancela antes,
  // apuntando si se devuelve la señal.
  if (reserva && destino !== 'reservado' && !ESTADOS_QUE_CIERRAN_RESERVA.includes(destino)) {
    motivos.push(`Tiene una reserva activa de ${reserva.cliente}: cancélala antes desde la ficha`);
  }

  return motivos;
}

export const cierraLaReserva = (destino) => ESTADOS_QUE_CIERRAN_RESERVA.includes(destino);
