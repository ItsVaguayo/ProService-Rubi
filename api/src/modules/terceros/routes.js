// Dueño: Victor. Clientes y proveedores (ampliación del 7-oct, bloque 1).
//   /api/clientes     → los dos roles: el comercial los necesita para el CRM
//   /api/proveedores  → solo gerencia: a quién se compra es dato interno, como el precio de compra
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { CAMPOS_CLIENTE, CAMPOS_PROVEEDOR, limpiarTercero } from './campos.js';

// Rutas comunes de lista, ficha, alta y edición. `extra(fila)` añade lo propio de cada ficha y
// `resumen` (SQL) las columnas calculadas de cada fila de la lista.
function rutasTercero(db, { tabla, entidad, campos, extra, resumen = '' }) {
  const r = Router();
  const leer = db.prepare(`SELECT * FROM ${tabla} WHERE id = ?`);

  // ?q= busca en nombre, NIF, teléfono y correo · ?activos=0 incluye los desactivados
  // ?estado_comercial= (solo clientes) para las columnas del embudo del CRM
  r.get('/', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filtros = req.query.activos === '0' ? [] : ['activo = 1'];
    const valores = [];
    if (req.query.estado_comercial !== undefined) {
      const estados = campos.estado_comercial?.opciones;
      if (!estados?.includes(req.query.estado_comercial)) return res.status(400).json({ error: 'estado_comercial no válido' });
      filtros.push('estado_comercial = ?');
      valores.push(req.query.estado_comercial);
    }
    if (q) {
      const comoNif = q.toUpperCase().replace(/[\s.-]/g, '');
      const comoTelefono = q.replace(/[\s().-]/g, '');
      filtros.push("(nombre LIKE ? OR nif LIKE ? OR replace(replace(telefono, ' ', ''), '-', '') LIKE ? OR email LIKE ?)");
      valores.push(`%${q}%`, `%${comoNif}%`, `%${comoTelefono}%`, `%${q}%`);
    }
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    res.json(db.prepare(`SELECT ${tabla}.*${resumen} FROM ${tabla} ${donde} ORDER BY nombre COLLATE NOCASE, id LIMIT 500`).all(...valores));
  });

  r.get('/:id', (req, res) => {
    const fila = leer.get(req.params.id);
    if (!fila) return res.status(404).json({ error: 'No existe' });
    res.json({ ...fila, ...extra(fila) });
  });

  r.post('/', (req, res) => {
    const { datos, errores } = limpiarTercero(req.body, campos);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    const columnas = Object.keys(datos);
    const id = db.transaction(() => {
      const nuevo = Number(db.prepare(`INSERT INTO ${tabla} (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => datos[c])).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad, entidadId: nuevo, accion: 'alta', despues: datos });
      return nuevo;
    })();
    res.status(201).json(leer.get(id));
  });

  // Sin DELETE: un cliente o un proveedor con facturas no se puede borrar. Se desactiva (activo: false).
  r.put('/:id', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const { datos, errores } = limpiarTercero(req.body, campos, { parcial: true });
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    const columnas = Object.keys(datos);
    if (!columnas.length) return res.status(400).json({ error: 'Sin cambios' });
    db.transaction(() => {
      db.prepare(`UPDATE ${tabla} SET ${columnas.map((c) => `${c} = ?`).join(', ')}, actualizado_en = datetime('now') WHERE id = ?`)
        .run(...columnas.map((c) => datos[c]), antes.id);
      registrar(db, { usuarioId: req.usuario.id, entidad, entidadId: antes.id, accion: 'edicion',
        antes: Object.fromEntries(columnas.map((c) => [c, antes[c]])), despues: datos });
    })();
    res.json(leer.get(antes.id));
  });

  return r;
}

export function rutasClientes(db) {
  const coches = db.prepare('SELECT id, referencia, matricula, marca, modelo, version, estado, pvp_cent FROM vehiculos WHERE comprador_id = ? ORDER BY id DESC');
  const contactos = db.prepare('SELECT id, tipo, mensaje, recibido_en, atendido_en, vehiculo_id FROM contactos WHERE cliente_id = ? ORDER BY recibido_en DESC');
  return rutasTercero(db, {
    tabla: 'clientes', entidad: 'cliente', campos: CAMPOS_CLIENTE,
    extra: (c) => ({ coches: coches.all(c.id), contactos: contactos.all(c.id) }),
    // Para la lista: cuántos coches ha comprado y cuándo se habló con él por última vez (CRM)
    resumen: `, (SELECT COUNT(*) FROM vehiculos v WHERE v.comprador_id = clientes.id) AS n_coches,
               (SELECT MAX(COALESCE(a.hecha_en, a.creado_en)) FROM actividades a WHERE a.cliente_id = clientes.id) AS ultima_actividad`,
  });
}

export function rutasProveedores(db) {
  const coches = db.prepare('SELECT id, referencia, matricula, marca, modelo, estado, precio_compra_cent FROM vehiculos WHERE proveedor_id = ? ORDER BY id DESC');
  return rutasTercero(db, {
    tabla: 'proveedores', entidad: 'proveedor', campos: CAMPOS_PROVEEDOR,
    extra: (p) => ({ coches: coches.all(p.id) }),
    resumen: ', (SELECT COUNT(*) FROM vehiculos v WHERE v.proveedor_id = proveedores.id) AS n_coches',
  });
}
