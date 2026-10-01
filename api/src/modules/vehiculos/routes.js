// Dueño: Victor. Alta, ficha, estados y reservas.
import { Router } from 'express';
import { ESTADOS, ESTADOS_WEB, esEstadoValido } from '../estados.js';
import { costeTotal, margenBruto } from '../margen.js';
import { registrar } from '../auditoria.js';
import { limpiarDatos, quitarDinero } from './campos.js';
import { motivosParaNoEntrar, faltanParaPublicar } from './reglas.js';
import { emitirCambioEstado } from './eventos.js';
import { liberarReserva } from './reservas.js';

const esGerencia = (usuario) => usuario?.rol === 'gerencia';

// Toda respuesta con un coche pasa por aquí: gerencia ve coste y margen, el resto no ve dinero.
export function serializar(v, usuario) {
  if (!esGerencia(usuario)) return quitarDinero(v);
  return { ...v, coste_total_cent: costeTotal(v), margen_cent: margenBruto(v) };
}

export function rutasVehiculos(db) {
  const r = Router();
  // Lo que el panel necesita además de la ficha: desde cuándo está en su estado, la foto de portada
  // y cuántas fotos tiene. Se calcula, no se guarda.
  const SELECT = `SELECT v.*,
      (SELECT MAX(h.fecha) FROM historial_estados h WHERE h.vehiculo_id = v.id AND h.a = v.estado) AS en_estado_desde,
      (SELECT f.ruta_original FROM fotos f WHERE f.vehiculo_id = v.id AND f.es_dano = 0 ORDER BY f.orden LIMIT 1) AS foto_portada,
      (SELECT f.id FROM fotos f WHERE f.vehiculo_id = v.id AND f.es_dano = 0 ORDER BY f.orden LIMIT 1) AS foto_portada_id,
      (SELECT COUNT(*) FROM fotos f WHERE f.vehiculo_id = v.id) AS n_fotos
    FROM vehiculos v`;
  const leer = db.prepare(`${SELECT} WHERE v.id = ?`);

  r.get('/estados', (_req, res) => res.json(ESTADOS));

  r.get('/', (req, res) => {
    const { estado } = req.query;
    const filas = estado
      ? db.prepare(`${SELECT} WHERE v.estado = ? ORDER BY v.id DESC`).all(estado)
      : db.prepare(`${SELECT} ORDER BY v.id DESC`).all();
    res.json(filas.map((v) => serializar(v, req.usuario)));
  });

  r.get('/:id/historial', (req, res) => {
    if (!leer.get(req.params.id)) return res.status(404).json({ error: 'No existe' });
    res.json(db.prepare(`SELECT h.de, h.a, h.fecha, u.nombre AS usuario FROM historial_estados h
                           LEFT JOIN usuarios u ON u.id = h.usuario_id WHERE h.vehiculo_id = ? ORDER BY h.fecha DESC, h.id DESC`)
      .all(req.params.id));
  });

  // 3.7 Equipamiento: lista cerrada. PUT sustituye la lista entera por la que llega (por nombre).
  // Solo vale lo que hay en la tabla extras (catálogo por migración): un nombre desconocido es un 400.
  r.get('/:id/extras', (req, res) => {
    if (!leer.get(req.params.id)) return res.status(404).json({ error: 'No existe' });
    res.json(db.prepare('SELECT e.nombre FROM vehiculo_extras ve JOIN extras e ON e.id = ve.extra_id WHERE ve.vehiculo_id = ? ORDER BY e.nombre')
      .all(req.params.id).map((e) => e.nombre));
  });

  r.put('/:id/extras', (req, res) => {
    const v = leer.get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    const nombres = req.body?.extras;
    if (!Array.isArray(nombres) || nombres.some((n) => typeof n !== 'string' || !n.trim() || n.length > 80)) {
      return res.status(400).json({ error: 'extras tiene que ser una lista de nombres' });
    }
    const idDeExtra = db.prepare('SELECT id FROM extras WHERE nombre = ?');
    const desconocidos = db.transaction(() => {
      const ids = [];
      const fuera = [];
      for (const nombre of new Set(nombres.map((n) => n.trim()))) {
        const extra = idDeExtra.get(nombre);
        extra ? ids.push(extra.id) : fuera.push(nombre);
      }
      if (fuera.length) return fuera; // no se toca nada
      db.prepare('DELETE FROM vehiculo_extras WHERE vehiculo_id = ?').run(v.id);
      const insertar = db.prepare('INSERT INTO vehiculo_extras (vehiculo_id, extra_id) VALUES (?, ?)');
      for (const id of ids) insertar.run(v.id, id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: v.id, accion: 'extras', despues: { extras: nombres } });
      return [];
    })();
    if (desconocidos.length) {
      return res.status(400).json({ error: `Extras que no están en el catálogo: ${desconocidos.join(', ')}`, desconocidos });
    }
    res.json({ ok: true });
  });

  // 2.4 Reservas. Reservar pasa el coche a «Reservado»; cancelar lo devuelve a «Publicado».
  const reservaActiva = db.prepare(`SELECT r.*, u.nombre AS usuario FROM reservas r
                                      LEFT JOIN auditoria a ON a.entidad = 'reserva' AND a.entidad_id = r.id AND a.accion = 'alta'
                                      LEFT JOIN usuarios u ON u.id = a.usuario_id
                                     WHERE r.vehiculo_id = ? AND r.activa = 1`);

  r.get('/:id/reserva', (req, res) => {
    if (!leer.get(req.params.id)) return res.status(404).json({ error: 'No existe' });
    res.json(reservaActiva.get(req.params.id) ?? null);
  });

  r.post('/:id/reserva', (req, res) => {
    const v = leer.get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    const { cliente, senal_cent, dias = 7 } = req.body ?? {};
    const errores = [];
    if (typeof cliente !== 'string' || !cliente.trim()) errores.push('Falta el cliente');
    if (!Number.isInteger(senal_cent) || senal_cent < 30000) errores.push('La señal es de 300 € como mínimo');
    if (!Number.isInteger(dias) || dias < 1 || dias > 60) errores.push('Los días de reserva van de 1 a 60');
    if (v.estado !== 'publicado') errores.push('Solo se reserva un coche publicado');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    db.transaction(() => {
      const idReserva = Number(db.prepare(`INSERT INTO reservas (vehiculo_id, cliente, senal_cent, caduca_en)
                                           VALUES (?, ?, ?, datetime('now', ?))`).run(v.id, cliente.trim(), senal_cent, `+${dias} days`).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'reserva', entidadId: idReserva, accion: 'alta', despues: { vehiculo: v.id, cliente, senal_cent, dias } });
      db.prepare("UPDATE vehiculos SET estado = 'reservado', actualizado_en = datetime('now') WHERE id = ?").run(v.id);
      db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id) VALUES (?,?,?,?)').run(v.id, v.estado, 'reservado', req.usuario.id);
      emitirCambioEstado(db, { vehiculo: v, de: v.estado, a: 'reservado', usuario: req.usuario });
    })();
    res.status(201).json(reservaActiva.get(v.id));
  });

  r.delete('/:id/reserva', (req, res) => {
    const v = leer.get(req.params.id);
    if (!v) return res.status(404).json({ error: 'No existe' });
    const reserva = reservaActiva.get(v.id);
    if (!reserva) return res.status(404).json({ error: 'Este coche no tiene reserva activa' });
    db.transaction(() => liberarReserva(db, { reserva, vehiculo: v, usuario: req.usuario, accion: 'cancelacion' }))();
    res.json({ ok: true });
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

    // Un coche que sale en la web (publicado, reservado o vendido) no puede quedarse sin los datos
    // que se exigieron para publicarlo: por ejemplo, sin precio.
    if (ESTADOS_WEB.includes(antes.estado)) {
      const faltan = faltanParaPublicar({ ...antes, ...datos });
      if (faltan.length) {
        const motivo = `El coche sale en la web y no puede quedarse sin: ${faltan.join(', ')}`;
        return res.status(409).json({ error: motivo, motivos: [motivo] });
      }
    }

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
