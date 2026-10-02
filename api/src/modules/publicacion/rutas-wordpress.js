// Dueño: David. Publicación en WordPress desde el panel (solo gerencia).
import { Router } from 'express';
import { configDesdeEntorno, diagnosticar, sincronizar, vincular } from './wordpress.js';
// Engancha la retirada al vender en alCambiarEstado. Va aquí porque app.js ya carga este módulo.
import './retirada.js';

export function rutasWordPress(db) {
  const r = Router();
  const config = (res) => {
    const cfg = configDesdeEntorno();
    if (!cfg) res.status(503).json({ error: 'WordPress sin configurar: faltan WP_URL, WP_USUARIO y WP_CLAVE_APLICACION' });
    return cfg;
  };

  r.get('/diagnostico', async (_req, res, next) => {
    const cfg = config(res);
    if (cfg) diagnosticar(cfg).then((d) => res.json(d), next);
  });

  r.post('/sincronizar', async (req, res) => {
    const cfg = config(res);
    if (!cfg) return;
    try {
      res.json(await sincronizar(db, cfg, { forzar: req.body?.forzar === true }));
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  r.get('/estado', (_req, res) => {
    res.json(db.prepare(`SELECT v.id, v.referencia, v.marca, v.modelo, v.estado, w.wp_post_id, w.estado AS estado_wp, w.ultimo_error, w.actualizado_en
                           FROM vehiculos v LEFT JOIN wp_posts w ON w.vehiculo_id = v.id ORDER BY v.id`).all());
  });

  r.post('/vincular', (req, res) => {
    const { vehiculo_id, wp_post_id } = req.body ?? {};
    if (!Number.isInteger(vehiculo_id) || !Number.isInteger(wp_post_id)) return res.status(400).json({ error: 'vehiculo_id y wp_post_id tienen que ser números' });
    try {
      vincular(db, vehiculo_id, wp_post_id);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return r;
}
