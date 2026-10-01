// Placa española con el marcado de base.css: la franja azul con la «E» la pone el CSS.
export function formatoMatricula(m = '') {
  const limpia = m.toUpperCase().replace(/[\s-]/g, '');
  const moderna = limpia.match(/^(\d{4})([A-Z]{3})$/);
  return moderna ? `${moderna[1]} ${moderna[2]}` : limpia;
}

export default function Matricula({ valor, tam = 'normal' }) {
  if (!valor) return null;
  return (
    <span className={`matricula ${tam === 'normal' ? '' : `matricula--${tam}`}`} aria-label={`Matrícula ${valor}`}>
      {formatoMatricula(valor)}
    </span>
  );
}
