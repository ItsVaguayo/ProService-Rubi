import { tonoEstado } from '../lib/estados.js';

export default function EstadoBadge({ id, nombre, sobreImagen = false }) {
  return (
    <span className={`estado estado--${tonoEstado(id)} ${sobreImagen ? 'estado--flotante' : ''}`}>
      {nombre}
    </span>
  );
}
