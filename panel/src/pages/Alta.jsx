import { useMemo, useState } from 'react';
import Campo from '../components/Campo.jsx';
import Pendiente from '../components/Pendiente.jsx';
import { BLOQUES, campoVisible } from '../lib/campos.js';
import { crearVehiculo } from '../lib/servicios.js';
import { eur, aCent, costeTotal, margenBruto } from '../lib/formato.js';
import { useRol } from '../lib/rol.js';
import { ir } from '../lib/router.js';
import { toast } from '../lib/toast.js';

const inicial = () =>
  Object.fromEntries(BLOQUES.flatMap((b) => b.campos.filter((c) => c.defecto != null).map((c) => [c.id, String(c.defecto)])));

function validar(def, valor) {
  const vacio = valor == null || String(valor).trim() === '';
  if (vacio) return def.obligatorio ? 'Obligatorio' : null;
  if (def.tipo === 'number') {
    const n = Number(valor);
    if (Number.isNaN(n)) return 'Tiene que ser un número';
    if (def.min != null && n < def.min) return `Mínimo ${def.min}`;
    if (def.max != null && n > def.max) return `Máximo ${def.max}`;
    if (!def.cent && !Number.isInteger(n)) return 'Sin decimales';
  }
  if (def.id === 'bastidor' && String(valor).length !== 17) return 'El VIN tiene 17 caracteres';
  return null;
}

export default function Alta() {
  const { rol } = useRol();
  const gerencia = rol === 'gerencia';
  const bloques = BLOQUES.filter((b) => gerencia || !b.soloGerencia);
  const [datos, setDatos] = useState(inicial);
  const [tocados, setTocados] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState(null);

  const errores = useMemo(() => {
    const e = {};
    bloques.forEach((b) => b.campos.forEach((c) => {
      if (c.soloLectura || !campoVisible(c, datos)) return;
      const m = validar(c, datos[c.id]);
      if (m) e[c.id] = m;
    }));
    return e;
  }, [datos, bloques]);

  const cambiar = (id, valor) => {
    setDatos((d) => ({ ...d, [id]: valor }));
    setTocados((t) => ({ ...t, [id]: true }));
  };

  const pendientesDe = (b) => b.campos.filter((c) => errores[c.id]).length;
  const camposDe = (b) => b.campos.filter((c) => campoVisible(c, datos));
  const totalPendientes = Object.keys(errores).length;

  async function guardar(e) {
    e.preventDefault();
    if (totalPendientes) {
      setTocados(Object.fromEntries(Object.keys(errores).map((k) => [k, true])));
      document.getElementById(`campo-${Object.keys(errores)[0]}`)?.focus();
      return;
    }
    const cuerpo = {};
    bloques.forEach((b) => b.campos.forEach((c) => {
      const v = datos[c.id];
      if (c.soloLectura || !campoVisible(c, datos) || v == null || String(v).trim() === '') return;
      if (c.cent) cuerpo[c.id] = aCent(v);
      else if (c.tipo === 'number') cuerpo[c.id] = Number(v);
      else if (c.tipo === 'matricula') cuerpo[c.id] = v.replace(/[\s-]/g, '');
      else cuerpo[c.id] = String(v).trim();
    }));
    setEnviando(true);
    setErrorApi(null);
    try {
      const { id } = await crearVehiculo(cuerpo);
      toast(`${cuerpo.marca} ${cuerpo.modelo} dado de alta`);
      ir(`/coche/${id}`);
    } catch (err) {
      setErrorApi(traducirError(err.message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <section className="hero hero--corto">
        <div className="hero__dentro">
          <p className="antetitulo">Dar de alta</p>
          <h1 className="titular titular--medio">Un coche nuevo, una sola vez</h1>
          <p className="hero__texto">Entra en «Pendiente de recoger». Las fotos se añaden desde su ficha.</p>
        </div>
      </section>

      <form className="pagina alta" onSubmit={guardar} noValidate>
        <aside className="alta__indice">
          <ol>
            {bloques.map((b) => {
              const n = pendientesDe(b);
              return (
                <li key={b.id}>
                  <a href="#/alta" onClick={(e) => { e.preventDefault(); document.getElementById(`bloque-${b.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
                    <span className={`alta__check ${n ? '' : 'hecho'}`} aria-hidden="true" />
                    {b.titulo}
                    {n > 0 && <small>{n}</small>}
                  </a>
                </li>
              );
            })}
          </ol>
          {!gerencia && <p className="alta__nota">Los datos económicos solo los rellena gerencia.</p>}
        </aside>

        <div className="alta__bloques">
          {bloques.map((b) => (
            <fieldset key={b.id} id={`bloque-${b.id}`} className="bloque-form">
              <legend>
                {b.titulo}
                {b.nota && <small>{b.nota}</small>}
              </legend>
              <div className="bloque-form__campos">
                {camposDe(b).map((c) => (
                  <Campo key={c.id} def={c} valor={datos[c.id]} onChange={cambiar} error={tocados[c.id] ? errores[c.id] : null} />
                ))}
              </div>
              {b.pendiente === 'extras' && (
                <Pendiente compacto titulo="Extras">Falta la lista cerrada de extras (C8) y su endpoint en la API.</Pendiente>
              )}
              {b.id === 'dinero' && (
                <div className="resumen-margen">
                  <div><span>Coste total</span><strong>{eur(costeTotal(datos))}</strong></div>
                  <div className={margenBruto(datos) < 0 ? 'negativo' : ''}>
                    <span>Margen bruto</span><strong>{eur(margenBruto(datos))}</strong>
                  </div>
                  <p>El margen neto con REBU o IVA deducible queda pendiente de la regla del cliente (9.1).</p>
                </div>
              )}
            </fieldset>
          ))}
        </div>

        <div className="barra-guardar">
          <div className="barra-guardar__dentro">
            <p aria-live="polite">
              {totalPendientes ? `Quedan ${totalPendientes} ${totalPendientes === 1 ? 'campo' : 'campos'} por completar` : 'Todo listo para guardar'}
            </p>
            {errorApi && <p className="error-linea" role="alert">{errorApi}</p>}
            <button className="boton" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Dar de alta'}</button>
          </div>
        </div>
      </form>
    </>
  );
}

function traducirError(m) {
  if (/401|sesión/i.test(m)) return 'Tienes que entrar con tu usuario para dar de alta coches.';
  if (/UNIQUE.*matricula/.test(m)) return 'Ya hay un coche con esa matrícula.';
  if (/UNIQUE.*bastidor/.test(m)) return 'Ya hay un coche con ese VIN.';
  if (/CHECK/.test(m)) return `La API ha rechazado un valor: ${m}`;
  return `La API no ha guardado el coche: ${m}`;
}
