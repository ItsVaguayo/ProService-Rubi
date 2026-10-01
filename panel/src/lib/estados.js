// Fase de cada estado: los 10 estados van en los 5 colores de base.css (llegada, preparacion,
// venta, reservado, vendido). Los estados y sus nombres vienen siempre de GET /vehiculos/estados.
const TONO = {
  pendiente_recoger: 'llegada',
  en_transporte: 'llegada',
  recibido: 'llegada',
  en_taller: 'preparacion',
  en_preparacion: 'preparacion',
  pendiente_fotos: 'preparacion',
  publicado: 'venta',
  reservado: 'reservado',
  vendido: 'vendido',
  entregado: 'vendido',
};

export const tonoEstado = (id) => TONO[id] ?? 'llegada';
export const nombreEstado = (estados, id) => estados.find((e) => e.id === id)?.nombre ?? id;
