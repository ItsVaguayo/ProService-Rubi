// Dueño: Victor. Lo que ha mandado la plataforma, o habría mandado en modo simulado. Solo gerencia (app.js).
//   GET /api/correos?estado=pendiente|enviado|simulado|error → los 200 últimos, del más nuevo al más viejo
import { Router } from 'express';

const ESTADOS = ['pendiente', 'enviado', 'simulado', 'error'];

export function rutasCorreos(db) {
  const r = Router();
  r.get('/', (req, res) => {
    const { estado } = req.query;
    if (estado !== undefined && !ESTADOS.includes(estado)) return res.status(400).json({ error: `estado tiene que ser ${ESTADOS.join(', ')}` });
    res.json(db.prepare(`SELECT * FROM correos ${estado ? 'WHERE estado = ?' : ''} ORDER BY id DESC LIMIT 200`).all(...(estado ? [estado] : [])));
  });
  return r;
}
