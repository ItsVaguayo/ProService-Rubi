// Dueña: Hafsa. Tablero de stock por estado. Pendiente: alta de coche, ficha y fotos.
import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [estados, setEstados] = useState([]);
  const [coches, setCoches] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api('/vehiculos/estados'), api('/vehiculos')])
      .then(([e, c]) => { setEstados(e); setCoches(c); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">No conecta con la API: {error}</p>;

  return (
    <main>
      <header>
        <h1>Stock</h1>
        <span>{coches.length} coches</span>
      </header>
      <section className="tablero">
        {estados.map((e) => {
          const lista = coches.filter((c) => c.estado === e.id);
          return (
            <div key={e.id} className="columna">
              <h2>{e.nombre} <small>{lista.length}</small></h2>
              {lista.map((c) => (
                <article key={c.id} className="tarjeta">
                  <strong>{c.marca} {c.modelo}</strong>
                  <span>{c.matricula} · {c.kilometros?.toLocaleString('es-ES')} km</span>
                </article>
              ))}
            </div>
          );
        })}
      </section>
    </main>
  );
}
