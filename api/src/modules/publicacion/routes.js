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

  // Fotos públicas y que no sean de daños, en su orden. Los daños que no se reparan se quedan dentro (4.8).
  const fotos = db.prepare(`SELECT orden, ruta_original, ruta_photocall FROM fotos
                             WHERE vehiculo_id = ? AND publica = 1 AND es_dano = 0 ORDER BY orden`);
  const extras = db.prepare(`SELECT e.nombre FROM vehiculo_extras ve JOIN extras e ON e.id = ve.extra_id
                              WHERE ve.vehiculo_id = ? ORDER BY e.nombre`);

  r.get('/feed/web', (req, res) => {
    // URL absoluta de las fotos: la de PUBLIC_URL o, si no está, la de esta misma petición.
    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const coches = feed.all(...ESTADOS_WEB).map((v) => ({
      ...v,
      fotos: fotos.all(v.id).map((f) => ({ orden: f.orden, url: `${base}/media/${f.ruta_photocall || f.ruta_original}` })),
      extras: extras.all(v.id).map((e) => e.nombre),
    }));
    res.json(coches);
  });

  // TODO(David): estado de publicación por canal (tabla publicaciones)
  // TODO(David): exportación por portal. Sin API/XML (6.5), empezar por ficha lista para copiar o CSV

  return r;
}
