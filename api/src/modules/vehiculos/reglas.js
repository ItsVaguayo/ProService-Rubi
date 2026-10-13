// Condiciones de los estados. Duda C4 (opción por defecto): un coche puede moverse a cualquier
// estado, pero salir en la web (publicado, reservado, vendido) exige la ficha completa y las fotos,
// y eso tiene que seguir cumpliéndose mientras esté ahí: al editarlo y al tocar sus fotos.
import { OBLIGATORIOS_PUBLICAR } from './campos.js';
import { ESTADOS_WEB } from '../estados.js';

export const FOTOS_MINIMAS = Number(process.env.FOTOS_MINIMAS || 15); // 4.1: mínimo 15

export const enLaWeb = (estado) => ESTADOS_WEB.includes(estado);

// Vender o entregar un coche reservado cierra su reserva como «vendida».
const ESTADOS_QUE_CIERRAN_RESERVA = ['vendido', 'entregado'];
export const cierraLaReserva = (destino) => ESTADOS_QUE_CIERRAN_RESERVA.includes(destino);

// Datos obligatorios para estar en la web que el coche no tiene.
export function faltanParaPublicar(vehiculo) {
  return OBLIGATORIOS_PUBLICAR.filter((c) => vehiculo[c] == null || vehiculo[c] === '');
}

// Fotos que cuentan para la web: públicas y que no son de daños.
export function fotosParaLaWeb(db, vehiculoId) {
  return db.prepare('SELECT COUNT(*) AS n FROM fotos WHERE vehiculo_id = ? AND publica = 1 AND es_dano = 0').get(vehiculoId).n;
}

// Devuelve la lista de motivos por los que no se puede pasar a `destino`. Vacía = se puede.
export function motivosParaNoEntrar(db, vehiculo, destino) {
  const motivos = [];
  const reserva = db.prepare('SELECT cliente FROM reservas WHERE vehiculo_id = ? AND activa = 1').get(vehiculo.id);

  // Entrar en la web desde fuera (publicar, o saltar de taller a vendido) exige la ficha y las fotos.
  // Dentro de la web ya se cumple: editar y tocar fotos no dejan romperlo.
  if (enLaWeb(destino) && !enLaWeb(vehiculo.estado)) {
    const faltan = faltanParaPublicar(vehiculo);
    if (faltan.length) motivos.push(`Faltan datos para publicar: ${faltan.join(', ')}`);
    const n = fotosParaLaWeb(db, vehiculo.id);
    if (n < FOTOS_MINIMAS) motivos.push(`Tiene ${n} fotos y hacen falta al menos ${FOTOS_MINIMAS}`);
  }

  if (destino === 'reservado' && !reserva) motivos.push('Para reservar hay que crear la reserva con la señal');

  // Salir de «Reservado» sin venderlo dejaría la reserva colgando: se cancela antes desde la ficha,
  // que es donde se apunta si se devuelve la señal.
  if (reserva && destino !== 'reservado' && !cierraLaReserva(destino)) {
    motivos.push(`Tiene una reserva activa de ${reserva.cliente}: cancélala antes desde la ficha`);
  }

  return motivos;
}

// El precio tachado de una oferta tiene que ser mayor que el que se pide: si no, el anuncio engaña.
export function errorDePrecios(v) {
  if (v.precio_sin_oferta_cent == null || v.pvp_cent == null) return null;
  return v.precio_sin_oferta_cent > v.pvp_cent ? null : 'El precio sin oferta (el tachado) tiene que ser mayor que el PVP';
}
