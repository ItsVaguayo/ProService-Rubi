import { useEffect, useMemo, useState } from 'react';
import BarraFiltros from '../components/BarraFiltros.jsx';
import TarjetaCoche from '../components/TarjetaCoche.jsx';
import { getFeedWeb } from '../lib/servicios.js';
import { definicionFiltros, aplicarFiltros, buscar } from '../lib/filtros.js';
import { usePortadas } from '../lib/usePortadas.js';
import { UBICACION_PUBLICA } from '../lib/config.js';

// Vista previa de la web: lee el mismo feed que el plugin de WordPress (sin datos internos).
export default function Catalogo() {
  const [coches, setCoches] = useState(null);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [texto, setTexto] = useState('');

  useEffect(() => {
    getFeedWeb().then(setCoches).catch((e) => setError(e.message));
  }, []);

  const defs = useMemo(() => definicionFiltros({ publica: true }), []);
  const lista = coches ?? [];
  const portadas = usePortadas(lista, { soloPublicas: true });
  const filtrados = useMemo(
    () => buscar(aplicarFiltros(lista, filtros, defs), texto, ['marca', 'modelo', 'version']),
    [lista, filtros, defs, texto],
  );
  const disponibles = lista.filter((c) => c.estado === 'publicado').length;

  return (
    <div className="publica">
      <p className="aviso-vista">Vista pública: así sale el stock en la web. La web real es el plugin de WordPress.</p>

      <section className="hero hero--catalogo">
        <div className="hero__dentro">
          <p className="antetitulo">Coches de ocasión · {UBICACION_PUBLICA}</p>
          <h1 className="titular">
            {coches == null ? '—' : disponibles}
            <span> {disponibles === 1 ? 'coche disponible' : 'coches disponibles'}</span>
          </h1>
          <p className="hero__texto">Todos con garantía mínima de 12 meses.</p>
        </div>
      </section>

      <section className="pagina">
        <div className="barra-herramientas">
          <BarraFiltros coches={lista} defs={defs} filtros={filtros} setFiltros={setFiltros} texto={texto} setTexto={setTexto}
            placeholder="Busca por marca, modelo o versión" />
        </div>
        <p className="resultado" aria-live="polite">{filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}</p>

        {error ? (
          <div className="vacio"><h2>No se ha podido cargar el stock</h2><p>{error}</p></div>
        ) : coches && lista.length === 0 ? (
          <div className="vacio">
            <h2>No hay coches publicados</h2>
            <p>En la web solo salen los coches en «Publicado», «Reservado con señal» y «Vendido, pendiente de entrega».</p>
          </div>
        ) : coches && filtrados.length === 0 ? (
          <div className="vacio">
            <h2>Ningún coche cumple estos filtros</h2>
            <button className="boton boton--secundario" onClick={() => { setFiltros({}); setTexto(''); }}>Quitar filtros</button>
          </div>
        ) : (
          <div className="rejilla rejilla--publica">
            {filtrados.map((c, i) => (
              <TarjetaCoche key={c.id} coche={c} foto={portadas[c.id]} estadoNombre={c.estado} publica indice={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
