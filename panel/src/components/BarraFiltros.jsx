import { useEffect, useRef, useState } from 'react';
import { opcionesDe, limitesDe, estaActivo, aplicarFiltros } from '../lib/filtros.js';
import { num } from '../lib/formato.js';

// Buscador y filtros en píldoras. Cada píldora abre su panel; en móvil, los paneles salen desde abajo.
export default function BarraFiltros({ coches, defs, filtros, setFiltros, texto, setTexto, placeholder }) {
  const [abierto, setAbierto] = useState(null);
  const raiz = useRef(null);

  useEffect(() => {
    const fuera = (e) => raiz.current && !raiz.current.contains(e.target) && setAbierto(null);
    const esc = (e) => e.key === 'Escape' && setAbierto(null);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const poner = (id, v) => setFiltros((f) => ({ ...f, [id]: v }));
  const activos = defs.filter((d) => !d.motivo && estaActivo(d, filtros[d.id]));

  return (
    <div className="filtros" ref={raiz}>
      <label className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <span className="oculto">Buscar</span>
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} />
      </label>

      <div className="pildoras" role="toolbar" aria-label="Filtros">
        {defs.map((d) => {
          const activo = estaActivo(d, filtros[d.id]);
          return (
            <div key={d.id} className="pildora-cont">
              <button
                className={`pildora ${activo ? 'activa' : ''} ${d.motivo ? 'bloqueada' : ''}`}
                aria-expanded={abierto === d.id}
                onClick={() => setAbierto(abierto === d.id ? null : d.id)}
              >
                {d.label}
                {activo && <span className="pildora__n">{d.tipo === 'lista' ? filtros[d.id].length : '•'}</span>}
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
              </button>
              {abierto === d.id && (
                <div className="panel-filtro" role="dialog" aria-label={d.label}>
                  <div className="panel-filtro__cab">
                    <strong>{d.label}</strong>
                    <button className="enlace" onClick={() => setAbierto(null)}>Cerrar</button>
                  </div>
                  {d.motivo ? (
                    <p className="panel-filtro__motivo">{d.motivo}</p>
                  ) : d.tipo === 'lista' ? (
                    <Lista d={d} coches={coches} filtros={filtros} defs={defs} valor={filtros[d.id] ?? []} poner={(v) => poner(d.id, v)} />
                  ) : (
                    <Rango d={d} coches={coches} valor={filtros[d.id] ?? {}} poner={(v) => poner(d.id, v)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activos.length > 0 && (
        <div className="chips">
          {activos.map((d) => (
            <button key={d.id} className="chip" onClick={() => poner(d.id, undefined)} aria-label={`Quitar filtro ${d.label}`}>
              {d.label}: {resumen(d, filtros[d.id], coches)}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button className="enlace" onClick={() => setFiltros({})}>Quitar todos</button>
        </div>
      )}
    </div>
  );
}

function Lista({ d, coches, filtros, defs, valor, poner }) {
  // Las opciones salen de los coches que cumplen el resto de filtros (el modelo depende de la marca).
  const base = aplicarFiltros(coches, filtros, defs, d.id);
  const opciones = opcionesDe(base, d.id);
  if (!opciones.length) return <p className="panel-filtro__motivo">No hay valores con los filtros actuales.</p>;
  const alternar = (v) => poner(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);
  return (
    <ul className="opciones">
      {opciones.map((o) => (
        <li key={o.valor}>
          <label className={valor.includes(o.valor) ? 'marcada' : ''}>
            <input type="checkbox" checked={valor.includes(o.valor)} onChange={() => alternar(o.valor)} />
            <span className="opciones__caja" aria-hidden="true" />
            <span className="opciones__texto">{o.texto}</span>
            <span className="opciones__n">{o.n}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function Rango({ d, coches, valor, poner }) {
  const lim = limitesDe(coches, d);
  if (!lim) return <p className="panel-filtro__motivo">Ningún coche tiene este dato.</p>;
  const cambiar = (lado, v) => poner({ ...valor, [lado]: v === '' ? undefined : Number(v) });
  const fmt = (n) => (d.sinMiles ? n : num(n));
  return (
    <div className="rango">
      <p className="rango__lim">
        Entre {fmt(lim.min)} y {fmt(lim.max)} {d.unidad ?? ''}
      </p>
      <div className="rango__campos">
        <label>
          <span>Desde</span>
          <input type="number" inputMode="numeric" step={d.paso ?? 1} placeholder={String(lim.min)}
            value={valor.min ?? ''} onChange={(e) => cambiar('min', e.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="number" inputMode="numeric" step={d.paso ?? 1} placeholder={String(lim.max)}
            value={valor.max ?? ''} onChange={(e) => cambiar('max', e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function resumen(d, v, coches) {
  if (d.tipo === 'lista') {
    const textos = opcionesDe(coches, d.id).filter((o) => v.includes(o.valor)).map((o) => o.texto);
    return textos.length > 2 ? `${textos.slice(0, 2).join(', ')} y ${textos.length - 2} más` : textos.join(', ');
  }
  const f = (n) => (d.sinMiles ? n : num(n));
  if (v.min != null && v.max != null) return `${f(v.min)}–${f(v.max)}`;
  return v.min != null ? `desde ${f(v.min)}` : `hasta ${f(v.max)}`;
}
