import { useState } from 'react';
import { cambiarEstado } from '../lib/servicios.js';
import { tonoEstado } from '../lib/estados.js';
import { toast } from '../lib/toast.js';

// El recorrido del coche de «Pendiente de recoger» a «Entregado». Un clic en un paso lo mueve ahí (C4: se
// puede saltar estados y volver atrás). Si la API rechaza el cambio, se enseña su motivo.
export default function RecorridoEstado({ estados, vehiculo, onCambio }) {
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState(null);
  const actual = estados.findIndex((e) => e.id === vehiculo.estado);

  async function mover(id) {
    if (id === vehiculo.estado || enviando) return;
    setEnviando(id);
    setError(null);
    try {
      await cambiarEstado(vehiculo.id, id);
      const nombre = estados.find((e) => e.id === id)?.nombre;
      toast(`Movido a «${nombre}»`);
      onCambio?.(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="recorrido">
      <ol className="recorrido__pasos">
        {estados.map((e, i) => (
          <li key={e.id} className={`${i < actual ? 'hecho' : ''} ${i === actual ? 'actual' : ''} tono-${tonoEstado(e.id)}`}>
            <button onClick={() => mover(e.id)} disabled={!!enviando} aria-current={i === actual ? 'step' : undefined}
              title={i === actual ? 'Estado actual' : `Mover a «${e.nombre}»`}>
              <span className="recorrido__nodo" aria-hidden="true">{enviando === e.id ? '' : i + 1}</span>
              <span className="recorrido__nombre">{e.nombre}</span>
            </button>
          </li>
        ))}
      </ol>
      {error && <p className="error-linea" role="alert">La API no ha aceptado el cambio: {error}</p>}
    </div>
  );
}
