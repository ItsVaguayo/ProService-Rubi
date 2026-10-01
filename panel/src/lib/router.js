// Router mínimo por hash: #/stock, #/coche/12, #/alta, #/catalogo, #/catalogo/12
import { useEffect, useState } from 'react';

function leer() {
  const partes = (window.location.hash.replace(/^#\/?/, '') || 'stock').split('/');
  return { pagina: partes[0], id: partes[1] ?? null };
}

export function useRuta() {
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const alCambiar = () => {
      setRuta(leer());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}

export function ir(ruta) {
  window.location.hash = ruta;
}
