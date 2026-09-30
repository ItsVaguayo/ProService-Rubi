// Dueña: Hafsa. Subida de fotos (15-25, orden fijo) y photocall con IA (4.4).
import { Router } from 'express';

export function rutasFotos(db) {
  const r = Router();

  r.get('/:vehiculoId', (req, res) => {
    res.json(db.prepare('SELECT * FROM fotos WHERE vehiculo_id = ? ORDER BY orden').all(req.params.vehiculoId));
  });

  // TODO(Hafsa): POST /:vehiculoId con multer, guardar en data/uploads, respetar el orden fijo
  // TODO(Hafsa): lanzar el photocall con IA en segundo plano y rellenar ruta_photocall

  return r;
}
