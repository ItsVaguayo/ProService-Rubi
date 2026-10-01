import { useEffect, useState } from 'react';
import Galeria from '../components/Galeria.jsx';
import Matricula from '../components/Matricula.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import RecorridoEstado from '../components/RecorridoEstado.jsx';
import GestorFotos from '../components/GestorFotos.jsx';
import Pendiente from '../components/Pendiente.jsx';
import { getEstados, getVehiculo, getFotos, urlFoto, ENDPOINTS_PENDIENTES } from '../lib/servicios.js';
import { BLOQUES, OPCIONES } from '../lib/campos.js';
import { nombreEstado } from '../lib/estados.js';
import { eurCent, km, num, fecha, diasEnStock, etiqueta } from '../lib/formato.js';
import { useRol } from '../lib/rol.js';

const SECCIONES = [
  { id: 'ficha', texto: 'Ficha' },
  { id: 'fotos', texto: 'Fotos' },
  { id: 'dinero', texto: 'Dinero', soloGerencia: true },
];

export default function FichaCoche({ id }) {
  const { rol } = useRol();
  const [estados, setEstados] = useState([]);
  const [v, setV] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState(null);

  const cargar = () =>
    Promise.all([getEstados(), getVehiculo(id), getFotos(id)])
      .then(([e, coche, f]) => { setEstados(e); setV(coche); setFotos(f); })
      .catch((e) => setError(e.message));

  useEffect(() => { setV(null); setError(null); cargar(); }, [id]);

  if (error) {
    return (
      <section className="pagina">
        <div className="vacio">
          <h2>No se puede abrir la ficha</h2>
          <p>{error}</p>
          <a href="#/stock" className="boton boton--secundario">Volver al stock</a>
        </div>
      </section>
    );
  }
  if (!v) return <section className="pagina"><div className="cargando" aria-busy="true">Cargando ficha…</div></section>;

  const gerencia = rol === 'gerencia';
  const dias = diasEnStock(v.creado_en);
  const enWeb = estados.find((e) => e.id === v.estado)?.web;
  const srcs = fotos.map((f) => urlFoto(f));

  return (
    <>
      <section className="ficha-hero">
        <div className="ficha-hero__dentro">
          <nav className="migas" aria-label="Ruta"><a href="#/stock">Stock</a><span aria-hidden="true">/</span>{v.referencia}</nav>
          <div className="ficha-hero__rejilla">
            <Galeria fotos={srcs} alt={`${v.marca} ${v.modelo}`} marca={v.marca} />
            <div className="ficha-hero__info">
              <EstadoBadge id={v.estado} nombre={nombreEstado(estados, v.estado)} />
              <p className="ficha-hero__marca">{v.marca}</p>
              <h1 className="ficha-hero__modelo">{v.modelo}</h1>
              <p className="ficha-hero__version">{v.version}</p>
              <div className="ficha-hero__ident">
                <Matricula valor={v.matricula} tam="grande" />
                <dl>
                  <div><dt>Referencia</dt><dd>{v.referencia}</dd></div>
                  <div><dt>En stock</dt><dd className={dias >= 60 ? 'alerta' : ''}>{dias} {dias === 1 ? 'día' : 'días'}</dd></div>
                  <div><dt>Propiedad</dt><dd>{etiqueta('propiedad', v.propiedad)}</dd></div>
                </dl>
              </div>
              <ul className="cifras">
                <li><span>Año</span>{v.anio}</li>
                <li><span>Kilómetros</span>{num(v.kilometros)}</li>
                <li><span>Potencia</span>{v.potencia_cv} CV</li>
                <li><span>Precio público</span>{eurCent(v.pvp_cent)}</li>
              </ul>
              <div className="ficha-hero__acciones">
                <button className="boton boton--claro" disabled title={ENDPOINTS_PENDIENTES.editar}>Editar ficha</button>
                {enWeb && <a className="boton boton--contorno" href={`#/catalogo/${v.id}`}>Ver en la vista pública</a>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pagina pagina--ficha">
        <div className="bloque-estado">
          <div className="bloque-estado__cab">
            <h2>Recorrido</h2>
            <p>Pulsa un paso para mover el coche. Queda apuntado en el historial.</p>
          </div>
          <RecorridoEstado estados={estados} vehiculo={v} onCambio={cargar} />
        </div>

        <nav className="subnav" aria-label="Secciones de la ficha">
          {SECCIONES.filter((s) => !s.soloGerencia || gerencia).map((s) => (
            <a key={s.id} href={`#/coche/${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}>
              {s.texto}
            </a>
          ))}
        </nav>

        <section id="ficha" className="seccion">
          <h2 className="seccion__titulo">Ficha</h2>
          <Pendiente compacto titulo="Solo lectura">Para editar falta {ENDPOINTS_PENDIENTES.editar}.</Pendiente>
          <div className="datos-bloques">
            {BLOQUES.filter((b) => !b.soloGerencia).map((b) => (
              <div key={b.id} className="datos">
                <h3>{b.titulo}{b.nota && <small>{b.nota}</small>}</h3>
                <dl>
                  {b.campos.map((c) => (
                    <div key={c.id} className={c.ancho ? 'ancho' : ''}>
                      <dt>{c.label}</dt>
                      <dd className={c.mono || c.tipo === 'matricula' ? 'mono' : ''}>{valorCampo(c, v[c.id])}</dd>
                    </div>
                  ))}
                </dl>
                {b.pendiente === 'extras' && (
                  <Pendiente compacto titulo="Extras">Falta la lista cerrada (C8) y su endpoint en la API.</Pendiente>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="fotos" className="seccion">
          <h2 className="seccion__titulo">Fotos</h2>
          <GestorFotos existentes={fotos} />
        </section>

        {gerencia && (
          <section id="dinero" className="seccion">
            <h2 className="seccion__titulo">Dinero <small>Solo gerencia</small></h2>
            <Dinero v={v} />
          </section>
        )}
      </section>
    </>
  );
}

function valorCampo(c, valor) {
  if (valor == null || valor === '') return '—';
  if (c.cent) return eurCent(valor);
  if (c.tipo === 'date') return fecha(valor);
  if (c.id === 'kilometros') return km(valor);
  if (c.tipo === 'select') return OPCIONES[c.id]?.find(([v]) => v === valor)?.[1] ?? valor;
  if (c.sufijo && c.tipo === 'number') return `${num(valor)} ${c.sufijo}`;
  if (c.tipo === 'number') return num(valor);
  return etiqueta(c.id, valor);
}

// Desglose de costes con barra proporcional, precio y margen bruto calculados por la API.
function Dinero({ v }) {
  const costes = [
    v.propiedad === 'deposito' ? ['Pago al dueño', v.pago_propietario_cent] : ['Compra', v.precio_compra_cent],
    ['Transporte', v.coste_transporte_cent],
    ['Taller o mecánica', v.coste_taller_cent],
    ['Preparación y limpieza', v.coste_preparacion_cent],
    ['Impuestos y gestoría', v.coste_impuestos_cent],
  ];
  return (
    <div className="dinero">
      <div className="dinero__costes">
        <div className="barra-costes" aria-hidden="true">
          {costes.map(([t, x], i) => x > 0 && <span key={t} className={`c${i}`} style={{ flexGrow: x }} title={`${t}: ${eurCent(x)}`} />)}
        </div>
        <dl>
          {costes.map(([t, x], i) => (
            <div key={t}><dt><i className={`c${i}`} />{t}</dt><dd>{eurCent(x)}</dd></div>
          ))}
          <div className="total"><dt>Coste total</dt><dd>{eurCent(v.coste_total_cent)}</dd></div>
        </dl>
      </div>
      <div className="dinero__precios">
        <dl>
          <div><dt>Precio público</dt><dd>{eurCent(v.pvp_cent)}</dd></div>
          <div><dt>Precio financiado</dt><dd>{eurCent(v.precio_financiado_cent)}</dd></div>
          <div><dt>Mínimo aceptable</dt><dd>{eurCent(v.precio_minimo_cent)}</dd></div>
          <div><dt>Régimen de IVA</dt><dd>{v.regimen_iva === 'deducible' ? 'IVA deducible' : v.regimen_iva ?? '—'}</dd></div>
        </dl>
        <div className={`margen ${v.margen_cent != null && v.margen_cent < 0 ? 'negativo' : ''}`}>
          <span>Margen bruto</span>
          <strong>{eurCent(v.margen_cent)}</strong>
          <small>
            {v.margen_cent == null ? 'Falta el precio público o lo que costó el coche.' : 'Precio público menos coste total. El neto espera a la regla de IVA (9.1).'}
          </small>
        </div>
      </div>
    </div>
  );
}
