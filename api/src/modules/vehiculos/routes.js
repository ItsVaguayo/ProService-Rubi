// Dueño: Victor. Alta, ficha, estados y reservas.
import { Router } from 'express';
import { ESTADOS, esEstadoValido } from '../estados.js';
import { costeTotal, margenBruto } from '../margen.js';
import { registrar } from '../auditoria.js';
import { limpiarDatos, quitarDinero } from './campos.js';
import { motivosParaNoEntrar } from './reglas.js';
import { emitirCambioEstado } from './eventos.js';

const esGerencia = (usuario) => usuario?.rol === 'gerencia';

// Toda respuesta con un coche pasa por aquí: gerencia ve coste y margen, el resto no ve dinero.
export function serializar(v, usuario) {
  if (!esGerencia(usuario)) return quitarDinero(v);
  return { ...v, coste_total_cent: costeTotal(v), margen_cent: margenBruto(v) };
}

export function rutasVehiculos(db) {
  const r = Router();
  const leer = db.prepare('SELECT * FROM vehiculos WHERE id = ?');

  r.get('/estados', (_req, res) => res.json(ESTADOS));

  r.get('/', (req, res) => {
    const { estado } = req.query;
    const filas = estado
      ? db.prepare('SELECT * FROM vehiculos WHERE estado = ? ORDER BY id DESC').all(estado)
      : db.prepare('SELECT * FROM vehiculos ORDER BY id DESC').all();
    res.json(filas.map((v) => serializar(v, req.usuario)));
  });

  r.get('/:id', (req, res) => {
    const v = leer.get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    res.json(serializar(v, req.usuario));
  });

  r.post('/', (req, res) => {
    const { datos, errores } = limpiarDatos(req.body, { puedeDinero: esGerencia(req.usuario) });
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    // Las columnas salen de la lista blanca de campos.js, nunca del cuerpo de la petición.
    const columnas = Object.keys(datos);
    const id = db.transaction(() => {
      const info = db
        .prepare(`INSERT INTO vehiculos (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => datos[c]));
      const nuevoId = Number(info.lastInsertRowid);
      db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(nuevoId);
      db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id) SELECT id, NULL, estado, ? FROM vehiculos WHERE id = ?')
        .run(req.usuario.id, nuevoId);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: nuevoId, accion: 'alta', despues: datos });
      return nuevoId;
    })();
    res.status(201).json(serializar(leer.get(id), req.usuario));
  });

  r.put('/:id', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const { datos, errores } = limpiarDatos(req.body, { parcial: true, puedeDinero: esGerencia(req.usuario) });
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    const columnas = Object.keys(datos);
    if (!columnas.length) return res.status(400).json({ error: 'Sin cambios' });

    db.transaction(() => {
      db.prepare(
        `UPDATE vehiculos SET ${columnas.map((c) => `${c} = ?`).join(', ')}, actualizado_en = datetime('now') WHERE id = ?`,
      ).run(...columnas.map((c) => datos[c]), antes.id);
      const cambiados = Object.fromEntries(columnas.map((c) => [c, antes[c]]));
      registrar(db, { usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: antes.id, accion: 'edicion', antes: cambiados, despues: datos });
    })();
    res.json(serializar(leer.get(antes.id), req.usuario));
  });

  r.patch('/:id/estado', (req, res) => {
    const { estado } = req.body ?? {};
    if (!esEstadoValido(estado)) return res.status(400).json({ error: 'Estado no válido' });
    const v = leer.get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    if (v.estado === estado) return res.json(serializar(v, req.usuario));

    const motivos = motivosParaNoEntrar(db, v, estado);
    if (motivos.length) return res.status(409).json({ error: motivos.join('. '), motivos });

    db.transaction(() => {
      db.prepare("UPDATE vehiculos SET estado = ?, actualizado_en = datetime('now') WHERE id = ?").run(estado, v.id);
      db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id) VALUES (?,?,?,?)').run(v.id, v.estado, estado, req.usuario.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: v.id, accion: 'estado', antes: { estado: v.estado }, despues: { estado } });
      emitirCambioEstado(db, { vehiculo: v, de: v.estado, a: estado, usuario: req.usuario });
    })();
    res.json(serializar(leer.get(v.id), req.usuario));
  });

  return r;
}
