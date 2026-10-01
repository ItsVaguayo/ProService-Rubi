import ImagenCoche from './ImagenCoche.jsx';
import Matricula from './Matricula.jsx';
import EstadoBadge from './EstadoBadge.jsx';
import { eurCent, km, diasEnStock, etiqueta } from '../lib/formato.js';

// Una tarjeta para el stock interno (con matrícula, estado y días) y otra para la vista pública.
export default function TarjetaCoche({ coche, foto, estadoNombre, publica = false, indice = 0 }) {
  const href = publica ? `#/catalogo/${coche.id}` : `#/coche/${coche.id}`;
  const dias = diasEnStock(coche.creado_en);
  const cerrado = publica && (coche.estado === 'reservado' || coche.estado === 'vendido');

  return (
    <a href={href} className={`tarjeta ${publica ? 'tarjeta--publica' : ''}`} style={{ '--i': Math.min(indice, 12) }}>
      <div className="tarjeta__foto">
        <ImagenCoche src={foto} alt={`${coche.marca} ${coche.modelo}`} marca={coche.marca} />
        {estadoNombre && (!publica || cerrado) && (
          <EstadoBadge id={coche.estado} nombre={publica ? (coche.estado === 'reservado' ? 'Reservado' : 'Vendido') : estadoNombre} sobreImagen />
        )}
      </div>
      <div className="tarjeta__cuerpo">
        <div className="tarjeta__titulo">
          <span className="tarjeta__marca">{coche.marca}</span>
          <h3>{coche.modelo}</h3>
          <p className="tarjeta__version">{coche.version}</p>
        </div>
        <ul className="tarjeta__datos">
          <li>{coche.anio}</li>
          <li>{km(coche.kilometros)}</li>
          <li>{etiqueta('combustible', coche.combustible)}</li>
          <li>{etiqueta('cambio', coche.cambio)}</li>
        </ul>
        <div className="tarjeta__pie">
          {publica ? (
            <span className="tarjeta__etiqueta-dgt" title="Etiqueta DGT">{coche.etiqueta_dgt}</span>
          ) : (
            <Matricula valor={coche.matricula} tam="pequena" />
          )}
          <span className="tarjeta__precio">{eurCent(coche.pvp_cent)}</span>
        </div>
        {!publica && dias != null && (
          <p className={`tarjeta__dias ${dias >= 60 ? 'alerta' : ''}`}>{dias === 1 ? '1 día' : `${dias} días`} en stock · {coche.referencia}</p>
        )}
      </div>
    </a>
  );
}
