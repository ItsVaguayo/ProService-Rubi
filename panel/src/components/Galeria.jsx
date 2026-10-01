import { useEffect, useState } from 'react';
import ImagenCoche from './ImagenCoche.jsx';

// Galería de la ficha: foto grande, flechas, teclado y miniaturas.
export default function Galeria({ fotos, alt, marca }) {
  const [i, setI] = useState(0);
  const n = fotos.length;

  useEffect(() => setI(0), [n]);

  if (!n) return <ImagenCoche alt={alt} marca={marca} className="galeria__vacia" />;

  const ir = (d) => setI((x) => (x + d + n) % n);
  const teclado = (e) => {
    if (e.key === 'ArrowRight') ir(1);
    if (e.key === 'ArrowLeft') ir(-1);
  };

  return (
    <div className="galeria" onKeyDown={teclado}>
      <div className="galeria__principal" tabIndex={0} aria-label={`Foto ${i + 1} de ${n}`} aria-roledescription="galería">
        {fotos.map((src, k) => (
          <img key={src + k} src={src} alt={`${alt}, foto ${k + 1}`} className={k === i ? 'visible' : ''} loading={k === 0 ? 'eager' : 'lazy'} />
        ))}
        {n > 1 && (
          <>
            <button className="galeria__flecha galeria__flecha--izq" onClick={() => ir(-1)} aria-label="Foto anterior">‹</button>
            <button className="galeria__flecha galeria__flecha--der" onClick={() => ir(1)} aria-label="Foto siguiente">›</button>
          </>
        )}
        <span className="galeria__contador">{i + 1} / {n}</span>
      </div>
      {n > 1 && (
        <div className="galeria__miniaturas">
          {fotos.map((src, k) => (
            <button key={src + k} className={k === i ? 'activa' : ''} onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
