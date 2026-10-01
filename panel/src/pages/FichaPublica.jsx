import { useEffect, useState } from 'react';
import Galeria from '../components/Galeria.jsx';
import Drawer from '../components/Drawer.jsx';
import Pendiente from '../components/Pendiente.jsx';
import { getFeedWeb, getFotos, urlFoto, ENDPOINTS_PENDIENTES } from '../lib/servicios.js';
import { eur, eurCent, deCent, num, etiqueta } from '../lib/formato.js';
import { textoValor } from '../lib/filtros.js';
import { TIN_ORIENTATIVO, PLAZOS_MESES, WHATSAPP, TELEFONO, UBICACION_PUBLICA } from '../lib/config.js';
import { toast } from '../lib/toast.js';

// Ficha pública (5.6). Lee del feed de la web, así que nunca ve datos internos.
export default function FichaPublica({ id }) {
  const [v, setV] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null);

  useEffect(() => {
    setV(null);
    Promise.all([getFeedWeb(), getFotos(id).catch(() => [])])
      .then(([feed, f]) => {
        const coche = feed.find((c) => String(c.id) === String(id));
        if (!coche) throw new Error('Este coche no está publicado en la web.');
        setV(coche);
        setFotos(f.filter((x) => x.publica));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="publica">
        <section className="pagina"><div className="vacio"><h2>No disponible</h2><p>{error}</p>
          <a className="boton boton--secundario" href="#/catalogo">Ver todos los coches</a></div></section>
      </div>
    );
  }
  if (!v) return <div className="publica"><section className="pagina"><div className="cargando" aria-busy="true">Cargando…</div></section></div>;

  const nombre = `${v.marca} ${v.modelo}`;
  const cerrado = v.estado === 'reservado' || v.estado === 'vendido';
  const textoWhatsApp = encodeURIComponent(`Hola, me interesa el ${nombre} ${v.version} (${v.referencia}) de ${eurCent(v.pvp_cent)}.`);

  async function compartir() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: nombre, text: `${nombre} ${v.version}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado');
      }
    } catch { /* cancelado por el usuario */ }
  }

  const acciones = [
    { id: 'contacto', texto: 'Contactar', principal: true },
    WHATSAPP
      ? { id: 'whatsapp', texto: 'WhatsApp', href: `https://wa.me/${WHATSAPP}?text=${textoWhatsApp}` }
      : { id: 'whatsapp', texto: 'WhatsApp', motivo: 'Falta el número de WhatsApp (E1)' },
    TELEFONO
      ? { id: 'llamar', texto: 'Llamar', href: `tel:${TELEFONO.replace(/\s/g, '')}` }
      : { id: 'llamar', texto: 'Llamar', motivo: 'Falta el teléfono (E1)' },
    { id: 'prueba', texto: 'Pedir prueba de conducción' },
    { id: 'cuota', texto: 'Calcular cuota' },
    { id: 'financiacion', texto: 'Pedir financiación' },
    { id: 'tasacion', texto: 'Tasar mi coche' },
    { id: 'compartir', texto: 'Compartir', onClick: compartir },
  ];

  const specs = [
    ['Año', v.anio],
    ['Kilómetros', `${num(v.kilometros)} km`],
    ['Combustible', etiqueta('combustible', v.combustible)],
    ['Cambio', etiqueta('cambio', v.cambio)],
    ['Potencia', `${v.potencia_cv} CV`],
    ['Etiqueta', textoValor('etiqueta_dgt', v.etiqueta_dgt)],
  ];

  return (
    <div className="publica">
      <p className="aviso-vista">Vista pública: así sale la ficha en la web.</p>

      <section className="fp-hero">
        <div className="fp-hero__dentro">
          <nav className="migas migas--claras" aria-label="Ruta"><a href="#/catalogo">Coches de ocasión</a><span aria-hidden="true">/</span>{nombre}</nav>
          <div className="fp-hero__titulo">
            <p className="fp-hero__marca">{v.marca}</p>
            <h1>{v.modelo}</h1>
            <p className="fp-hero__version">{v.version}</p>
          </div>
          <Galeria fotos={fotos.map((f) => urlFoto(f))} alt={nombre} marca={v.marca} />
          <ul className="fp-specs">
            {specs.map(([k, x]) => <li key={k}><span>{k}</span><strong>{x}</strong></li>)}
          </ul>
        </div>
      </section>

      <section className="pagina fp-cuerpo">
        <div className="fp-detalle">
          <Grupo titulo="Mecánica" filas={[
            ['Combustible', etiqueta('combustible', v.combustible)], ['Cambio', etiqueta('cambio', v.cambio)],
            ['Potencia', `${v.potencia_cv} CV`], ['Cilindrada', `${num(v.cilindrada)} cm³`],
            ['Tracción', etiqueta('traccion', v.traccion)], ['Emisiones CO₂', `${v.emisiones_co2} g/km`],
            ['Etiqueta DGT', textoValor('etiqueta_dgt', v.etiqueta_dgt)],
          ]} />
          <Grupo titulo="Carrocería" filas={[
            ['Carrocería', etiqueta('carroceria', v.carroceria)], ['Puertas', v.puertas], ['Plazas', v.plazas],
            ['Color', etiqueta('color_exterior', v.color_exterior)], ['Tapicería', etiqueta('tapiceria', v.tapiceria)],
            ['Llantas', v.llantas],
          ]} />
          <Grupo titulo="Garantía y ubicación" filas={[
            ['Garantía', `${v.garantia_meses} meses`], ['Ubicación', UBICACION_PUBLICA], ['Referencia', v.referencia],
          ]} />
          {v.video_url && <Video url={v.video_url} titulo={nombre} />}
        </div>

        <aside className="fp-compra">
          <div className="fp-compra__caja">
            {cerrado && <p className={`fp-compra__estado ${v.estado}`}>{v.estado === 'reservado' ? 'Reservado' : 'Vendido'}</p>}
            <p className="fp-compra__label">Precio</p>
            <p className="fp-compra__precio">{eurCent(v.pvp_cent)}</p>
            {v.precio_financiado_cent != null && (
              <p className="fp-compra__fin">Precio financiado <strong>{eurCent(v.precio_financiado_cent)}</strong></p>
            )}
            <div className="fp-acciones">
              {acciones.map((a) =>
                a.href ? (
                  <a key={a.id} className="boton boton--contorno-oscuro" href={a.href} target={a.id === 'whatsapp' ? '_blank' : undefined} rel="noreferrer">{a.texto}</a>
                ) : (
                  <button key={a.id} className={`boton ${a.principal ? '' : 'boton--contorno-oscuro'}`} disabled={!!a.motivo}
                    title={a.motivo} onClick={a.onClick ?? (() => setPanel(a.id))}>
                    {a.texto}
                  </button>
                ),
              )}
            </div>
            {(!WHATSAPP || !TELEFONO) && <p className="fp-compra__nota">WhatsApp y llamada se activan cuando tengamos los números (E1).</p>}
          </div>
        </aside>
      </section>

      {panel === 'cuota' && (
        <Drawer titulo="Calcular cuota" subtitulo={`${nombre} · orientativa`} onCerrar={() => setPanel(null)}>
          <Calculadora precio={deCent(v.precio_financiado_cent ?? v.pvp_cent)} />
        </Drawer>
      )}
      {['contacto', 'prueba', 'financiacion', 'tasacion'].includes(panel) && (
        <Drawer titulo={TITULOS[panel]} subtitulo={nombre} onCerrar={() => setPanel(null)}>
          <Formulario tipo={panel} />
        </Drawer>
      )}
    </div>
  );
}

const TITULOS = {
  contacto: 'Contactar',
  prueba: 'Pedir prueba de conducción',
  financiacion: 'Pedir financiación',
  tasacion: 'Tasar mi coche',
};

function Grupo({ titulo, filas }) {
  return (
    <div className="fp-grupo">
      <h2>{titulo}</h2>
      <dl>{filas.map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x ?? '—'}</dd></div>)}</dl>
    </div>
  );
}

function Video({ url, titulo }) {
  const idYt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];
  if (!idYt) return null;
  return (
    <div className="fp-grupo">
      <h2>Vídeo</h2>
      <div className="video">
        <iframe src={`https://www.youtube-nocookie.com/embed/${idYt}`} title={`Vídeo del ${titulo}`} loading="lazy" allowFullScreen />
      </div>
    </div>
  );
}

// Cuota con sistema francés. Sin TIN del cliente no se calcula nada (E2).
function Calculadora({ precio }) {
  const [entrada, setEntrada] = useState('');
  const [plazo, setPlazo] = useState(PLAZOS_MESES?.[Math.floor((PLAZOS_MESES.length - 1) / 2)] ?? '');
  const capital = Math.max(0, (precio ?? 0) - (Number(entrada) || 0));
  const i = TIN_ORIENTATIVO / 100 / 12;
  const cuota = TIN_ORIENTATIVO != null && plazo ? (i === 0 ? capital / plazo : (capital * i) / (1 - (1 + i) ** -plazo)) : null;

  return (
    <div className="calculadora">
      <div className="campo">
        <label htmlFor="calc-entrada">Entrada</label>
        <div className="campo__control con-sufijo">
          <input id="calc-entrada" type="number" min="0" inputMode="numeric" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          <span className="campo__sufijo">€</span>
        </div>
      </div>
      {PLAZOS_MESES && (
        <div className="campo">
          <span className="campo__label">Plazo</span>
          <div className="plazos" role="radiogroup" aria-label="Plazo en meses">
            {PLAZOS_MESES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={plazo === p} className={plazo === p ? 'activo' : ''} onClick={() => setPlazo(p)}>{p}</button>
            ))}
          </div>
        </div>
      )}
      <div className="calculadora__resultado">
        <span>Cuota orientativa</span>
        <strong>{cuota != null ? `${eur(Math.round(cuota))}/mes` : '—'}</strong>
        <small>A financiar {eur(capital)}. Cálculo orientativo: no es una oferta de financiación.</small>
      </div>
      {TIN_ORIENTATIVO == null && (
        <Pendiente titulo="Sin tipo de interés">
          La cuota no se calcula hasta que el cliente nos dé el tipo de interés orientativo y los plazos (E2). No se publica un tipo inventado.
        </Pendiente>
      )}
    </div>
  );
}

const CAMPOS_FORM = {
  contacto: [['nombre', 'Nombre'], ['telefono', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['mensaje', 'Mensaje', 'textarea']],
  prueba: [['nombre', 'Nombre'], ['telefono', 'Teléfono', 'tel'], ['mensaje', '¿Cuándo te viene bien?', 'textarea']],
  financiacion: [['nombre', 'Nombre'], ['telefono', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['mensaje', 'Mensaje', 'textarea']],
  // E4, a falta de respuesta: marca, modelo, año, km, teléfono y hasta 5 fotos.
  tasacion: [['marca', 'Marca'], ['modelo', 'Modelo'], ['anio', 'Año', 'number'], ['kilometros', 'Kilómetros', 'number'],
    ['telefono', 'Teléfono', 'tel'], ['fotos', 'Fotos (hasta 5)', 'file']],
};

function Formulario({ tipo }) {
  const [acepta, setAcepta] = useState(false);
  return (
    <form className="formulario" onSubmit={(e) => e.preventDefault()}>
      {tipo === 'financiacion' && <p className="formulario__nota">La financiación es orientativa: te llamamos para estudiarla contigo.</p>}
      {CAMPOS_FORM[tipo].map(([id, label, t]) => (
        <div key={id} className="campo">
          <label htmlFor={`f-${id}`}>{label}</label>
          {t === 'textarea' ? (
            <textarea id={`f-${id}`} rows={4} />
          ) : t === 'file' ? (
            <input id={`f-${id}`} type="file" accept="image/*" multiple onChange={(e) => {
              if (e.target.files.length > 5) { toast('Máximo 5 fotos', 'error'); e.target.value = ''; }
            }} />
          ) : (
            <input id={`f-${id}`} type={t ?? 'text'} inputMode={t === 'number' ? 'numeric' : undefined} autoComplete={id === 'nombre' ? 'name' : id === 'email' ? 'email' : id === 'telefono' ? 'tel' : 'off'} />
          )}
        </div>
      ))}
      {/* Campo trampa contra spam: las personas no lo ven */}
      <input type="text" name="web" tabIndex={-1} autoComplete="off" className="trampa" aria-hidden="true" />
      <label className="casilla">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
        <span>He leído y acepto la política de privacidad.</span>
      </label>
      <button className="boton" type="submit" disabled title={ENDPOINTS_PENDIENTES.contactos}>Enviar</button>
      <Pendiente compacto titulo="Envío pendiente">Falta {ENDPOINTS_PENDIENTES.contactos}. El enlace a la política depende de la web (E5).</Pendiente>
    </form>
  );
}
