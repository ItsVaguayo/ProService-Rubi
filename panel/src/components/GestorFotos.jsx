import { useEffect, useRef, useState } from 'react';
import Pendiente from './Pendiente.jsx';
import { FOTOS_MIN, FOTOS_MAX, ORDEN_FOTOS } from '../lib/config.js';
import { ENDPOINTS_PENDIENTES, urlFoto } from '../lib/servicios.js';

// Fotos del coche: las que ya tiene en la API y las que Jaume prepara desde el ordenador (arrastrar varias,
// ordenar arrastrando, marcar daños y si se ven en la web). El envío espera a POST /api/fotos/:id.
export default function GestorFotos({ existentes = [] }) {
  const [preparadas, setPreparadas] = useState([]);
  const [encima, setEncima] = useState(false);
  const [arrastrando, setArrastrando] = useState(null);
  const input = useRef(null);
  const urls = useRef([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const total = existentes.length + preparadas.length;
  const hueco = FOTOS_MAX - total;

  function anadir(files) {
    const imagenes = [...files].filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, hueco));
    const nuevas = imagenes.map((f) => {
      const url = URL.createObjectURL(f);
      urls.current.push(url);
      return { id: url, url, nombre: f.name, es_dano: false, publica: true };
    });
    setPreparadas((p) => [...p, ...nuevas]);
  }

  const cambiar = (id, datos) => setPreparadas((p) => p.map((f) => (f.id === id ? { ...f, ...datos } : f)));
  const quitar = (id) => setPreparadas((p) => p.filter((f) => f.id !== id));
  function mover(desde, hasta) {
    if (hasta < 0 || hasta >= preparadas.length || desde === hasta) return;
    setPreparadas((p) => {
      const copia = [...p];
      const [f] = copia.splice(desde, 1);
      copia.splice(hasta, 0, f);
      return copia;
    });
  }

  const estado =
    total < FOTOS_MIN
      ? { tono: 'falta', texto: `Faltan ${FOTOS_MIN - total} para poder publicar` }
      : { tono: 'ok', texto: total === FOTOS_MAX ? 'Completo: 25 de 25' : 'Suficientes para publicar' };

  return (
    <div className="fotos">
      <div className="fotos__estado">
        <div>
          <p className="fotos__cuenta"><strong>{total}</strong> / {FOTOS_MAX}</p>
          <p className={`fotos__texto fotos__texto--${estado.tono}`}>{estado.texto}</p>
        </div>
        <div className="medidor" aria-hidden="true">
          {Array.from({ length: FOTOS_MAX }, (_, k) => (
            <span key={k} className={`${k < existentes.length ? 'subida' : k < total ? 'preparada' : ''} ${k === FOTOS_MIN - 1 ? 'minimo' : ''}`} />
          ))}
        </div>
        <ul className="fotos__leyenda">
          <li><i className="subida" />En la API ({existentes.length})</li>
          <li><i className="preparada" />Preparadas aquí ({preparadas.length})</li>
          <li><i className="minimo" />Mínimo {FOTOS_MIN}</li>
        </ul>
      </div>

      {existentes.length > 0 && (
        <div className="fotos__grid">
          {existentes.map((f, k) => (
            <figure key={f.id} className="foto">
              <div className="foto__img"><img src={urlFoto(f)} alt={`Foto ${k + 1}`} loading="lazy" /></div>
              <figcaption>
                <span className="foto__orden">{String(k + 1).padStart(2, '0')}</span>
                <span className="foto__hueco">{ORDEN_FOTOS[k] ?? 'Libre'}</span>
              </figcaption>
              <div className="foto__marcas">
                {f.es_dano ? <span className="marca-foto marca-foto--dano">Daño</span> : null}
                <span className="marca-foto">{f.publica ? 'Se ve en la web' : 'Solo interna'}</span>
                <span className="marca-foto">{f.ruta_photocall ? 'Photocall listo' : 'Sin photocall'}</span>
              </div>
            </figure>
          ))}
        </div>
      )}

      {hueco > 0 && (
        <div
          className={`soltar ${encima ? 'soltar--encima' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => { e.preventDefault(); setEncima(false); anadir(e.dataTransfer.files); }}
        >
          <p><strong>Arrastra aquí las fotos del coche</strong></p>
          <p>Varias a la vez, en el orden en que las hiciste. Caben {hueco} más.</p>
          <button className="boton boton--secundario" onClick={() => input.current.click()}>Elegir fotos</button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { anadir(e.target.files); e.target.value = ''; }} />
        </div>
      )}

      {preparadas.length > 0 && (
        <>
          <p className="fotos__ayuda">Arrastra una foto sobre otra para cambiar el orden. Las fotos de daños no se ven en la web salvo que lo marques.</p>
          <ol className="fotos__grid">
            {preparadas.map((f, k) => {
              const pos = existentes.length + k;
              return (
                <li
                  key={f.id}
                  className={`foto foto--preparada ${arrastrando === k ? 'foto--arrastrando' : ''}`}
                  draggable
                  onDragStart={() => setArrastrando(k)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); mover(arrastrando, k); setArrastrando(null); }}
                  onDragEnd={() => setArrastrando(null)}
                >
                  <div className="foto__img"><img src={f.url} alt={`Foto preparada ${pos + 1}: ${f.nombre}`} /></div>
                  <div className="foto__cab">
                    <span className="foto__orden">{String(pos + 1).padStart(2, '0')}</span>
                    <span className="foto__hueco">{ORDEN_FOTOS[pos] ?? 'Libre'}</span>
                  </div>
                  <div className="foto__controles">
                    <label className="interruptor">
                      <input type="checkbox" checked={f.es_dano}
                        onChange={(e) => cambiar(f.id, { es_dano: e.target.checked, publica: e.target.checked ? false : f.publica })} />
                      <span>Daño</span>
                    </label>
                    <label className="interruptor">
                      <input type="checkbox" checked={f.publica} onChange={(e) => cambiar(f.id, { publica: e.target.checked })} />
                      <span>En la web</span>
                    </label>
                  </div>
                  <div className="foto__acciones">
                    <button onClick={() => mover(k, k - 1)} disabled={k === 0} aria-label="Mover antes">←</button>
                    <button onClick={() => mover(k, k + 1)} disabled={k === preparadas.length - 1} aria-label="Mover después">→</button>
                    <button onClick={() => quitar(f.id)} className="quitar" aria-label="Quitar foto">Quitar</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <div className="fotos__envio">
        <button className="boton" disabled title={ENDPOINTS_PENDIENTES.subirFotos}>
          Subir {preparadas.length || ''} {preparadas.length === 1 ? 'foto' : 'fotos'}
        </button>
        <button className="boton boton--secundario" disabled title={ENDPOINTS_PENDIENTES.photocall}>Generar photocall</button>
      </div>
      <Pendiente titulo="Falta en la API">
        Subir, borrar y reordenar fotos ({ENDPOINTS_PENDIENTES.subirFotos}). El photocall espera al fondo del cliente y al OK del gasto (D2, D3).
        Las fotos preparadas aquí no se guardan al salir de la ficha.
      </Pendiente>
    </div>
  );
}
