// Condiciones para entrar en un estado. Duda C4 (opción por defecto): un coche puede moverse
// a cualquier estado, pero hay estados a los que solo se entra si se cumplen sus condiciones.
import { OBLIGATORIOS_PUBLICAR } from './campos.js';

export const FOTOS_MINIMAS = Number(process.env.FOTOS_MINIMAS || 15); // 4.1: mínimo 15

// Devuelve la lista de motivos por los que no se puede pasar a `destino`. Vacía = se puede.
export function motivosParaNoEntrar(db, vehiculo, destino) {
  const motivos = [];

  if (destino === 'publicado') {
    const faltan = OBLIGATORIOS_PUBLICAR.filter((c) => vehiculo[c] == null || vehiculo[c] === '');
    if (faltan.length) motivos.push(`Faltan datos para publicar: ${faltan.join(', ')}`);

    const { n } = db
      .prepare('SELECT COUNT(*) AS n FROM fotos WHERE vehiculo_id = ? AND publica = 1 AND es_dano = 0')
      .get(vehiculo.id);
    if (n < FOTOS_MINIMAS) motivos.push(`Tiene ${n} fotos y hacen falta al menos ${FOTOS_MINIMAS}`);
  }

  if (destino === 'reservado') {
    const reserva = db.prepare('SELECT 1 FROM reservas WHERE vehiculo_id = ? AND activa = 1').get(vehiculo.id);
    if (!reserva) motivos.push('Para reservar hay que crear la reserva con la señal');
  }

  return motivos;
}
