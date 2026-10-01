import { OPCIONES, SUGERENCIAS } from '../lib/campos.js';

// Un campo del formulario de alta, según su definición en lib/campos.js.
export default function Campo({ def, valor, onChange, error }) {
  const id = `campo-${def.id}`;
  const comun = {
    id,
    name: def.id,
    value: valor ?? '',
    'aria-invalid': !!error,
    'aria-describedby': error || def.ayuda ? `${id}-ayuda` : undefined,
    onChange: (e) => onChange(def.id, e.target.value),
  };

  let control;
  if (def.soloLectura) {
    control = <input {...comun} readOnly placeholder="Automática" tabIndex={-1} />;
  } else if (def.tipo === 'select') {
    control = (
      <select {...comun}>
        <option value="">Elegir…</option>
        {OPCIONES[def.id].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    );
  } else if (def.tipo === 'textarea') {
    control = <textarea {...comun} rows={3} />;
  } else if (def.tipo === 'sugerencia') {
    control = (
      <>
        <input {...comun} list={`${id}-lista`} autoComplete="off" />
        <datalist id={`${id}-lista`}>{SUGERENCIAS[def.id].map((s) => <option key={s} value={s} />)}</datalist>
      </>
    );
  } else if (def.tipo === 'matricula') {
    control = (
      <input {...comun} className="entrada-matricula" autoComplete="off" spellCheck={false} placeholder="0000 AAA"
        onChange={(e) => onChange(def.id, e.target.value.toUpperCase())} />
    );
  } else {
    control = (
      <input {...comun} type={['number', 'date', 'url', 'tel'].includes(def.tipo) ? def.tipo : 'text'}
        inputMode={def.cent ? 'decimal' : def.tipo === 'number' ? 'numeric' : undefined}
        step={def.cent ? '0.01' : undefined}
        min={def.min} max={def.tipo === 'number' ? def.max : undefined} maxLength={def.tipo ? undefined : def.max}
        className={def.mono ? 'mono' : undefined}
        onChange={(e) => onChange(def.id, def.mono ? e.target.value.toUpperCase() : e.target.value)} />
    );
  }

  return (
    <div className={`campo ${def.ancho ? 'campo--ancho' : ''} ${error ? 'campo--error' : ''}`}>
      <label htmlFor={id}>
        {def.label}
        {def.obligatorio && <span className="obligatorio" aria-label="obligatorio">*</span>}
      </label>
      <div className={`campo__control ${def.sufijo ? 'con-sufijo' : ''}`}>
        {control}
        {def.sufijo && <span className="campo__sufijo">{def.sufijo}</span>}
      </div>
      {(error || def.ayuda) && (
        <p id={`${id}-ayuda`} className={error ? 'campo__error' : 'campo__ayuda'}>{error || def.ayuda}</p>
      )}
    </div>
  );
}
