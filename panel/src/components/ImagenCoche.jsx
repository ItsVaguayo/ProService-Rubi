import { useState } from 'react';

// Foto del coche o, si aún no tiene, la silueta con la marca de fondo.
export default function ImagenCoche({ src, alt, marca, className = '' }) {
  const [rota, setRota] = useState(false);
  if (src && !rota) {
    return (
      <div className={`imagen-coche ${className}`}>
        <img src={src} alt={alt} loading="lazy" onError={() => setRota(true)} />
      </div>
    );
  }
  return (
    <div className={`imagen-coche imagen-coche--vacia ${className}`} role="img" aria-label={`${alt}: sin fotos todavía`}>
      {marca && <span className="imagen-coche__marca" aria-hidden="true" style={{ "--len": Math.max(marca.length, 3) }}>{marca}</span>}
      <Silueta />
      <span className="imagen-coche__nota">Sin fotos</span>
    </div>
  );
}

export function Silueta() {
  return (
    <svg className="silueta" viewBox="0 0 400 130" aria-hidden="true">
      <path
        d="M18 98 L24 82 Q30 72 62 68 L118 62 Q152 36 198 32 L258 32 Q292 34 322 58 L360 63 Q384 67 388 84 L390 98"
        fill="none" strokeWidth="1.6"
      />
      <path d="M130 62 Q158 42 196 40 L200 62 Z M208 40 L256 40 Q282 42 304 60 L208 62 Z" fill="none" strokeWidth="1.2" />
      <path d="M18 98 L70 98 M122 98 L290 98 M342 98 L390 98" fill="none" strokeWidth="1.6" />
      <circle cx="96" cy="98" r="22" fill="none" strokeWidth="1.6" />
      <circle cx="96" cy="98" r="11" fill="none" strokeWidth="1" />
      <circle cx="316" cy="98" r="22" fill="none" strokeWidth="1.6" />
      <circle cx="316" cy="98" r="11" fill="none" strokeWidth="1" />
    </svg>
  );
}
