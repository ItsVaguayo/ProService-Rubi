// Dueño: David. Publicación en WordPress desde el panel (solo gerencia).
import { Router } from 'express';
import { configDesdeEntorno, diagnosticar, sincronizar, vincular } from './wordpress.js';
// Engancha la retirada al vender en alCambiarEstado. Va aquí porque app.js ya carga este módulo.
import './retirada.js';
import { traerFotosDeLaWeb, ErrorFotosWeb } from './fotos-web.js';
import { ENTERO } from '../../fechas.js';

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

  // Fotos desde la ficha de la web, para los coches del stock que llegan de Pymecar sin fotos (fotos-web.js).
  // Uno: POST /fotos/:vehiculoId. Todos los vinculados que aún no tienen ninguna: POST /fotos.
  r.post('/fotos/:vehiculoId', async (req, res, next) => {
    if (!ENTERO.test(req.params.vehiculoId)) return res.status(404).json({ error: 'No existe' });
    const cfg = config(res);
    if (!cfg) return;
    try {
      res.json(await traerFotosDeLaWeb(db, cfg, Number(req.params.vehiculoId), { usuarioId: req.usuario.id }));
    } catch (e) {
      if (e instanceof ErrorFotosWeb) return res.status(e.status).json({ error: e.message });
      if (e.status !== undefined) return res.status(502).json({ error: `WordPress: ${e.message}` }); // ErrorWordPress
      next(e);
    }
  });

  r.post('/fotos', async (req, res, next) => {
    const cfg = config(res);
    if (!cfg) return;
    const pendientes = db.prepare(`SELECT w.vehiculo_id, v.referencia FROM wp_posts w JOIN vehiculos v ON v.id = w.vehiculo_id
                                    WHERE NOT EXISTS (SELECT 1 FROM fotos f WHERE f.vehiculo_id = w.vehiculo_id) ORDER BY w.vehiculo_id`).all();
    const resultado = { coches: 0, fotos: 0, errores: [] };
    try {
      for (const p of pendientes) {
        try {
          const { traidas, saltadas } = await traerFotosDeLaWeb(db, cfg, p.vehiculo_id, { usuarioId: req.usuario.id });
          resultado.coches++;
          resultado.fotos += traidas;
          if (saltadas.length) resultado.errores.push(`${p.referencia}: ${saltadas.length} sin bajar (${saltadas.join('; ')})`);
        } catch (e) {
          if (!(e instanceof ErrorFotosWeb) && e.status === undefined) throw e;
          resultado.errores.push(`${p.referencia}: ${e.message}`);
        }
      }
      res.json(resultado);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
