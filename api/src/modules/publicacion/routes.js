// Dueño: David. Web WordPress y portales (Coches.net, Milanuncios, Wallapop).
import { Router } from 'express';
import { visibleEnWeb } from '../estados.js';

export function rutasPublicacion(db) {
  const r = Router();

  // Feed público que lee el plugin de WordPress. Sin datos de dinero internos.
  r.get('/feed/web', (_req, res) => {
    const coches = db
      .prepare(`SELECT id, referencia, estado, marca, modelo, version, anio, fecha_matriculacion, kilometros,
                       combustible, cambio, potencia_cv, cilindrada, traccion, emisiones_co2, etiqueta_dgt,
                       carroceria, puertas, plazas, color_exterior, tapiceria, llantas, garantia_meses,
                       pvp, precio_financiado, video_url
                FROM vehiculos`)
      .all()
      .filter((v) => visibleEnWeb(v.estado));
    res.json(coches);
  });

  // TODO(David): estado de publicación por canal (tabla publicaciones)
  // TODO(David): exportación por portal. Sin API/XML (6.5), empezar por ficha lista para copiar o CSV

  return r;
}
