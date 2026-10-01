import { useEffect, useMemo, useState } from 'react';
import RailEstados from '../components/RailEstados.jsx';
import BarraFiltros from '../components/BarraFiltros.jsx';
import TarjetaCoche from '../components/TarjetaCoche.jsx';
import ImagenCoche from '../components/ImagenCoche.jsx';
import Matricula from '../components/Matricula.jsx';
import { getEstados, getVehiculos, cambiarEstado } from '../lib/servicios.js';
import { definicionFiltros, aplicarFiltros, buscar } from '../lib/filtros.js';
import { usePortadas } from '../lib/usePortadas.js';
import { nombreEstado, tonoEstado } from '../lib/estados.js';
import { km, diasEnStock } from '../lib/formato.js';
import { toast } from '../lib/toast.js';

const CAMPOS_BUSQUEDA = ['matricula', 'marca', 'modelo', 'version', 'referencia', 'bastidor'];

function vistaGuardada() {
  try { return localStorage.getItem('ps-vista') || 'tablero'; } catch { return 'tablero'; }
}

export default function Stock() {
  const [estados, setEstados] = useState([]);
  const [coches, setCoches] = useState(null);
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [texto, setTexto] = useState('');
  const [vista, setVista] = useState(vistaGuardada);

  const cargar = () =>
    Promise.all([getEstados(), getVehiculos()])
      .then(([e, c]) => { setEstados(e); setCoches(c); setError(null); })
      .catch((e) => setError(e.message));

  useEffect(() => { cargar(); }, []);

  const elegirVista = (v) => {
    setVista(v);
    try { localStorage.setItem('ps-vista', v); } catch { /* sin almacenamiento */ }
  };

  const defs = useMemo(() => definicionFiltros({ publica: false }), []);
  const lista = coches ?? [];
  const portadas = usePortadas(lista);
  const filtrados = useMemo(
    () => buscar(aplicarFiltros(lista, filtros, defs), texto, CAMPOS_BUSQUEDA).filter((c) => !estado || c.estado === estado),
    [lista, filtros, defs, texto, estado],
  );

  async function mover(coche, nuevo) {
    try {
      await cambiarEstado(coche.id, nuevo);
      toast(`${coche.marca} ${coche.modelo} movido a «${nombreEstado(estados, nuevo)}»`);
      cargar();
    } catch (e) {
      toast(`No se ha movido: ${e.message}`, 'error');
    }
  }

  if (error) {
    return (
      <section className="pagina">
        <div className="vacio">
          <h2>No conecta con la API</h2>
          <p>{error}. Comprueba que la API está arrancada en el puerto 3001 (<code>npm run dev</code>).</p>
          <button className="boton" onClick={cargar}>Reintentar</button>
        </div>
      </section>
    );
  }

  const aLaVenta = lista.filter((c) => c.estado === 'publicado').length;
  const preparando = lista.filter((c) => tonoEstado(c.estado) === 'preparacion' || tonoEstado(c.estado) === 'llegada').length;
  const viejos = lista.filter((c) => (diasEnStock(c.creado_en) ?? 0) >= 60 && !['vendido', 'entregado'].includes(c.estado)).length;

  return (
    <>
      <section className="hero hero--stock">
        <div className="hero__dentro">
          <p className="antetitulo">Stock</p>
          <h1 className="titular">
            {coches == null ? '—' : lista.length}
            <span> {lista.length === 1 ? 'coche' : 'coches'}</span>
          </h1>
          <ul className="hero__datos">
            <li><strong>{aLaVenta}</strong> publicados</li>
            <li><strong>{preparando}</strong> sin publicar todavía</li>
            <li className={viejos ? 'alerta' : ''}><strong>{viejos}</strong> con más de 60 días</li>
          </ul>
          <a href="#/alta" className="boton boton--claro">Dar de alta un coche</a>
        </div>
      </section>

      <section className="pagina">
        {estados.length > 0 && <RailEstados estados={estados} coches={lista} activo={estado} onElegir={setEstado} />}

        <div className="barra-herramientas">
          <BarraFiltros coches={lista} defs={defs} filtros={filtros} setFiltros={setFiltros} texto={texto} setTexto={setTexto}
            placeholder="Matrícula, marca, modelo, referencia o VIN" />
          <div className="conmutador" role="group" aria-label="Vista">
            {[['tablero', 'Tablero'], ['tarjetas', 'Tarjetas']].map(([v, t]) => (
              <button key={v} className={vista === v ? 'activo' : ''} aria-pressed={vista === v} onClick={() => elegirVista(v)}>{t}</button>
            ))}
          </div>
        </div>

        <p className="resultado" aria-live="polite">
          {filtrados.length} de {lista.length} {estado && `· ${nombreEstado(estados, estado)}`}
        </p>

        {coches && lista.length === 0 ? (
          <div className="vacio">
            <h2>Todavía no hay coches</h2>
            <p>Da de alta el primero y aparecerá aquí en «Pendiente de recoger».</p>
            <a href="#/alta" className="boton">Dar de alta un coche</a>
          </div>
        ) : coches && filtrados.length === 0 ? (
          <div className="vacio">
            <h2>Ningún coche cumple estos filtros</h2>
            <button className="boton boton--secundario" onClick={() => { setFiltros({}); setTexto(''); setEstado(null); }}>Quitar filtros</button>
          </div>
        ) : vista === 'tablero' ? (
          <div className="tablero">
            {estados.filter((e) => !estado || e.id === estado).map((e) => {
              const col = filtrados.filter((c) => c.estado === e.id);
              return (
                <section key={e.id} className={`columna tono-${tonoEstado(e.id)}`} aria-label={e.nombre}>
                  <h2><span className="columna__punto" aria-hidden="true" />{e.nombre}<small>{col.length}</small></h2>
                  {col.map((c) => (
                    <FichaMini key={c.id} coche={c} foto={portadas[c.id]} estados={estados} onMover={(n) => mover(c, n)} />
                  ))}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rejilla">
            {filtrados.map((c, i) => (
              <TarjetaCoche key={c.id} coche={c} foto={portadas[c.id]} estadoNombre={nombreEstado(estados, c.estado)} indice={i} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Tarjeta compacta del tablero, con el cambio de estado a un clic.
function FichaMini({ coche, foto, estados, onMover }) {
  const dias = diasEnStock(coche.creado_en);
  return (
    <article className="mini">
      <a href={`#/coche/${coche.id}`} className="mini__enlace">
        <ImagenCoche src={foto} alt={`${coche.marca} ${coche.modelo}`} className="mini__foto" />
        <div>
          <strong>{coche.marca} {coche.modelo}</strong>
          <span>{coche.version}</span>
        </div>
      </a>
      <div className="mini__pie">
        <Matricula valor={coche.matricula} tam="pequena" />
        <span>{km(coche.kilometros)}</span>
        {dias != null && <span className={dias >= 60 ? 'alerta' : ''}>{dias} d</span>}
      </div>
      <label className="mini__mover">
        <span className="oculto">Mover a otro estado</span>
        <select value={coche.estado} onChange={(e) => onMover(e.target.value)}>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.id === coche.estado ? `Estado: ${e.nombre}` : `Mover a ${e.nombre}`}</option>)}
        </select>
      </label>
    </article>
  );
}
