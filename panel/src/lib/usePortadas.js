import { useEffect, useState } from 'react';
import { getFotos, urlFoto } from './servicios.js';

// Primera foto (la de orden más bajo) de cada coche, para las tarjetas. Una petición por coche:
// con unos 50 en stock es asumible hasta que el listado traiga la portada.
export function usePortadas(coches, { soloPublicas = false } = {}) {
  const [portadas, setPortadas] = useState({});
  const clave = coches.map((c) => c.id).join(',');

  useEffect(() => {
    let vivo = true;
    Promise.all(
      coches.map((c) =>
        getFotos(c.id)
          .then((fotos) => [c.id, fotos.find((f) => !soloPublicas || f.publica)])
          .catch(() => [c.id, null]),
      ),
    ).then((pares) => {
      if (!vivo) return;
      setPortadas(Object.fromEntries(pares.map(([id, f]) => [id, f ? urlFoto(f) : null])));
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, soloPublicas]);

  return portadas;
}
