// Dueño: Victor. Alta, ficha, estados y reservas.
import { Router } from 'express';
import { ESTADOS, esEstadoValido } from '../estados.js';
import { costeTotal, margenBruto } from '../margen.js';

export function rutasVehiculos(db) {
  const r = Router();

  r.get('/estados', (_req, res) => res.json(ESTADOS));

  r.get('/', (req, res) => {
    const { estado } = req.query;
    const filas = estado
      ? db.prepare('SELECT * FROM vehiculos WHERE estado = ? ORDER BY id DESC').all(estado)
      : db.prepare('SELECT * FROM vehiculos ORDER BY id DESC').all();
    res.json(filas);
  });

  r.get('/:id', (req, res) => {
    const v = db.prepare('SELECT * FROM vehiculos WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    // TODO(Victor): ocultar el bloque de dinero a quien no sea gerencia (11.2)
    res.json({ ...v, coste_total: costeTotal(v), margen: margenBruto(v) });
  });

  r.post('/', (req, res) => {
    const datos = req.body;
    const columnas = Object.keys(datos);
    if (!columnas.length) return res.status(400).json({ error: 'Sin datos' });
    try {
      const info = db
        .prepare(`INSERT INTO vehiculos (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => datos[c]));
      const id = info.lastInsertRowid;
      db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);
      res.status(201).json({ id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.patch('/:id/estado', (req, res) => {
    const { estado, usuario } = req.body;
    if (!esEstadoValido(estado)) return res.status(400).json({ error: 'Estado no válido' });
    const v = db.prepare('SELECT estado FROM vehiculos WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    db.transaction(() => {
      db.prepare("UPDATE vehiculos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(estado, req.params.id);
      db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario) VALUES (?,?,?,?)').run(req.params.id, v.estado, estado, usuario ?? null);
    })();
    // TODO(David): al pasar a vendido/entregado, marcar publicaciones como 'retirar' (6.6)
    res.json({ ok: true });
  });

  return r;
}
