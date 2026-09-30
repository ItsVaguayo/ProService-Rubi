// Dueña: Hafsa. Tablero de stock por estado. Pendiente: alta de coche, ficha y fotos.
// El formulario de entrar es provisional: lo justo para que el panel funcione con la API con sesión.
import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [estados, setEstados] = useState([]);
  const [coches, setCoches] = useState([]);
  const [error, setError] = useState(null);
  const [sinSesion, setSinSesion] = useState(false);

  const cargar = () =>
    Promise.all([api('/vehiculos/estados'), api('/vehiculos')])
      .then(([e, c]) => { setEstados(e); setCoches(c); setSinSesion(false); setError(null); })
      .catch((e) => (e.status === 401 ? setSinSesion(true) : setError(e.message)));

  useEffect(() => { cargar(); }, []);

  if (sinSesion) return <Entrar alEntrar={cargar} />;
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

function Entrar({ alEntrar }) {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);

  const enviar = (ev) => {
    ev.preventDefault();
    api('/auth/entrar', { method: 'POST', body: { email, contrasena } })
      .then(alEntrar)
      .catch((e) => setError(e.message));
  };

  return (
    <main>
      <form className="entrar" onSubmit={enviar}>
        <h1>Entrar</h1>
        <input type="email" autoComplete="username" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" autoComplete="current-password" placeholder="Contraseña" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        <button type="submit">Entrar</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
