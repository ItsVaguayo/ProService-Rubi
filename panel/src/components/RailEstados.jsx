import { tonoEstado } from '../lib/estados.js';

// Los 10 estados en su orden, con cuántos coches hay en cada uno. Pulsar uno filtra el stock.
export default function RailEstados({ estados, coches, activo, onElegir }) {
  const total = coches.length || 1;
  return (
    <div className="rail" role="group" aria-label="Filtrar por estado">
      {estados.map((e, i) => {
        const n = coches.filter((c) => c.estado === e.id).length;
        const sel = activo === e.id;
        return (
          <button
            key={e.id}
            className={`rail__paso rail__paso--${tonoEstado(e.id)} ${sel ? 'activo' : ''} ${n === 0 ? 'rail__paso--vacio' : ''}`}
            aria-pressed={sel}
            onClick={() => onElegir(sel ? null : e.id)}
          >
            <span className="rail__orden">{String(i + 1).padStart(2, '0')}</span>
            <span className="rail__n">{n}</span>
            <span className="rail__nombre">{e.nombre}</span>
            <span className="rail__barra" style={{ '--p': n / total }} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
