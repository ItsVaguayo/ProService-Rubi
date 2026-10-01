import { useState } from 'react';
import { ROLES, useRol } from '../lib/rol.js';

const NAV = [
  { ruta: 'stock', texto: 'Stock', activa: ['stock', 'coche'] },
  { ruta: 'alta', texto: 'Dar de alta', activa: ['alta'] },
  { ruta: 'catalogo', texto: 'Vista pública', activa: ['catalogo'] },
];

export default function Cabecera({ pagina }) {
  const { rol, setRol } = useRol();
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="cabecera">
      <div className="cabecera__fila">
        <a href="#/stock" className="marca-ps" aria-label="Pro Service Rubí, ir al stock">
          <img className="logo" src="/img/logo-proservice.webp" alt="Pro Service Rubí" />
        </a>

        <button
          className="cabecera__menu" aria-expanded={abierto} aria-controls="nav-principal"
          onClick={() => setAbierto((a) => !a)}
        >
          <span /><span /><span className="oculto">Menú</span>
        </button>

        <nav id="nav-principal" className={`nav ${abierto ? 'nav--abierta' : ''}`} onClick={() => setAbierto(false)}>
          {NAV.map((n) => (
            <a key={n.ruta} href={`#/${n.ruta}`} className={n.activa.includes(pagina) ? 'activa' : ''}
              aria-current={n.activa.includes(pagina) ? 'page' : undefined}>
              {n.texto}
            </a>
          ))}
        </nav>

        <div className="rol" role="group" aria-label="Ver el panel como">
          {ROLES.map((r) => (
            <button key={r.id} className={rol === r.id ? 'activo' : ''} aria-pressed={rol === r.id} onClick={() => setRol(r.id)}>
              {r.nombre}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
