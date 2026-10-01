// Dueña: Hafsa. Layout y rutas del panel.
import { useMemo, useState } from 'react';
import Cabecera from './components/Cabecera.jsx';
import Toasts from './components/Toasts.jsx';
import Stock from './pages/Stock.jsx';
import FichaCoche from './pages/FichaCoche.jsx';
import Alta from './pages/Alta.jsx';
import Catalogo from './pages/Catalogo.jsx';
import FichaPublica from './pages/FichaPublica.jsx';
import { useRuta } from './lib/router.js';
import { RolContext, rolGuardado, guardarRol } from './lib/rol.js';

export default function App() {
  const { pagina, id } = useRuta();
  const [rol, setRolEstado] = useState(rolGuardado);
  const valorRol = useMemo(() => ({ rol, setRol: (r) => { setRolEstado(r); guardarRol(r); } }), [rol]);

  let contenido;
  if (pagina === 'coche' && id) contenido = <FichaCoche id={id} />;
  else if (pagina === 'alta') contenido = <Alta />;
  else if (pagina === 'catalogo' && id) contenido = <FichaPublica id={id} />;
  else if (pagina === 'catalogo') contenido = <Catalogo />;
  else contenido = <Stock />;

  return (
    <RolContext.Provider value={valorRol}>
      <a className="saltar" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Ir al contenido
      </a>
      <Cabecera pagina={pagina} />
      <main id="contenido" tabIndex={-1} key={`${pagina}/${id ?? ''}`} className="entrada">
        {contenido}
      </main>
      <Toasts />
    </RolContext.Provider>
  );
}
