import { useEffect, useRef } from 'react';

// Panel lateral para los formularios de la ficha pública. En móvil ocupa la pantalla desde abajo.
export default function Drawer({ titulo, subtitulo, onCerrar, children }) {
  const ref = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && cerrar.current();
    document.addEventListener('keydown', esc);
    document.body.classList.add('sin-scroll');
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.classList.remove('sin-scroll');
    };
  }, []);

  return (
    <div className="drawer-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <div className="drawer__cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button className="drawer__cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="drawer__cuerpo">{children}</div>
      </aside>
    </div>
  );
}
