// Dueño: David. Web WordPress y portales (Coches.net, Milanuncios, Wallapop).
import { Router } from 'express';
import { ESTADOS_WEB } from '../estados.js';

export function rutasPublicacion(db) {
  const r = Router();

  // Feed público que lee el plugin de WordPress. Sin datos de dinero internos.
  // Las columnas van escritas a mano a propósito: un campo nuevo no sale en la web hasta que alguien lo añade aquí.
  const visibles = ESTADOS_WEB.map(() => '?').join(',');
  const feed = db.prepare(`SELECT id, referencia, estado, marca, modelo, version, anio, fecha_matriculacion, kilometros,
                                  combustible, cambio, potencia_cv, cilindrada, traccion, emisiones_co2, etiqueta_dgt,
                                  carroceria, puertas, plazas, color_exterior, tapiceria, llantas, garantia_meses,
                                  pvp_cent, precio_financiado_cent, video_url
                             FROM vehiculos
                            WHERE estado IN (${visibles})
                            ORDER BY id DESC`);

  r.get('/feed/web', (_req, res) => {
    res.json(feed.all(...ESTADOS_WEB));
  });

  // TODO(David): estado de publicación por canal (tabla publicaciones)
  // TODO(David): exportación por portal. Sin API/XML (6.5), empezar por ficha lista para copiar o CSV

  return r;
}
