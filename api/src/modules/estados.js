// Estados del briefing (2.2). El orden es el recorrido normal del coche.
export const ESTADOS = [
  { id: 'pendiente_recoger', nombre: 'Pendiente de recoger', web: false },
  { id: 'en_transporte', nombre: 'En transporte', web: false },
  { id: 'recibido', nombre: 'Recibido, sin revisar', web: false },
  { id: 'en_taller', nombre: 'En taller o mecánica', web: false },
  { id: 'en_preparacion', nombre: 'En preparación y limpieza', web: false },
  { id: 'pendiente_fotos', nombre: 'Pendiente de fotos', web: false },
  { id: 'publicado', nombre: 'Publicado', web: true },
  { id: 'reservado', nombre: 'Reservado con señal', web: true }, // 2.4: "que se vea reservado"
  { id: 'vendido', nombre: 'Vendido, pendiente de entrega', web: true },
  { id: 'entregado', nombre: 'Entregado', web: false },
];

const IDS = new Set(ESTADOS.map((e) => e.id));

export function esEstadoValido(id) {
  return IDS.has(id);
}

export function visibleEnWeb(id) {
  return ESTADOS.find((e) => e.id === id)?.web ?? false;
}
