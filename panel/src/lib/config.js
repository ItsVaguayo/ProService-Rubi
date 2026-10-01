// Datos que tiene que dar el cliente. Mientras valgan null, la interfaz enseña la acción desactivada
// con el motivo, en lugar de inventarse un valor (ver docs/dudas.md).

// E2: tipo de interés orientativo y plazos de la calculadora. Sin defecto: no se publica un TIN inventado.
export const TIN_ORIENTATIVO = null; // p. ej. 7.99 (en %)
export const PLAZOS_MESES = null; // p. ej. [24, 36, 48, 60, 72, 84]

// E1: número de WhatsApp y teléfono donde llegan los contactos. Sin defecto.
export const WHATSAPP = null; // p. ej. '34600000000'
export const TELEFONO = null; // p. ej. '+34 93 000 00 00'

// 4.3 / D1: de 15 a 25 fotos en orden fijo. El orden por escrito sigue pendiente; esto es el defecto de dudas.md.
export const FOTOS_MIN = 15;
export const FOTOS_MAX = 25;
export const ORDEN_FOTOS = [
  'Frontal', '3/4 delantero', 'Lateral', '3/4 trasero', 'Trasera',
  'Interior delantero', 'Interior trasero', 'Cuadro con km', 'Maletero', 'Motor',
];

// C9: en la web la ubicación sale solo como «Rubí».
export const UBICACION_PUBLICA = 'Rubí';

// 2.4: señal mínima de una reserva.
export const SENAL_MINIMA = 300;
