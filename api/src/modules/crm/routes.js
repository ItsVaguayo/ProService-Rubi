// Dueño: David. Actividades del CRM (ampliación del 7-oct, bloque 9, T11).
//   /api/actividades → los dos roles: aquí no hay dinero, el comercial ve y apunta todo.
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { limpiarActividad, fechaValida, DIA } from './campos.js';

const SELECT = `SELECT a.*, c.nombre AS cliente_nombre, k.nombre AS contacto_nombre,
                       u.nombre AS responsable_nombre, v.referencia AS vehiculo_referencia,
                       v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo
                  FROM actividades a
                  LEFT JOIN clientes c ON c.id = a.cliente_id
                  LEFT JOIN contactos k ON k.id = a.contacto_id
                  LEFT JOIN usuarios u ON u.id = a.responsable_id
                  LEFT JOIN vehiculos v ON v.id = a.vehiculo_id`;

const ENTERO = /^[1-9]\d*$/;

export function rutasActividades(db) {
  const r = Router();
  const leer = db.prepare(`${SELECT} WHERE a.id = ?`);

  // ?cliente= · ?vehiculo= · ?responsable=yo|id · ?pendientes=1 · ?dia=AAAA-MM-DD
  r.get('/', (req, res) => {
    const { cliente, vehiculo, responsable, pendientes, dia } = req.query;
    const filtros = [];
    const valores = [];
    const errores = [];
    for (const [param, columna] of [[cliente, 'a.cliente_id'], [vehiculo, 'a.vehiculo_id']]) {
      if (param === undefined) continue;
      if (typeof param !== 'string' || !ENTERO.test(param)) { errores.push(`${columna.slice(2)} tiene que ser un número`); continue; }
      filtros.push(`${columna} = ?`);
      valores.push(Number(param));
    }
    if (responsable !== undefined) {
      const id = responsable === 'yo' ? req.usuario.id : typeof responsable === 'string' && ENTERO.test(responsable) ? Number(responsable) : null;
      if (id === null) errores.push('responsable tiene que ser «yo» o un número');
      else { filtros.push('a.responsable_id = ?'); valores.push(id); }
    }
    if (pendientes !== undefined) {
      if (pendientes === '1') filtros.push('a.hecha_en IS NULL');
      else if (pendientes !== '0') errores.push('pendientes tiene que ser 1 o 0');
    }
    if (dia !== undefined) {
      if (typeof dia !== 'string' || !fechaValida(dia, DIA)) errores.push('dia tiene que ser una fecha AAAA-MM-DD');
      else { filtros.push('substr(a.programada_para, 1, 10) = ?'); valores.push(dia); }
    }
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    // Las programadas por orden de fecha; las que no tienen fecha (notas), al final y de la más nueva a la más vieja
    res.json(db.prepare(`${SELECT} ${donde}
                         ORDER BY a.programada_para IS NULL, a.programada_para, a.creado_en DESC, a.id LIMIT 500`).all(...valores));
  });

  r.get('/:id', (req, res) => {
    const a = leer.get(req.params.id);
    if (!a) return res.status(404).json({ error: 'No existe' });
    res.json(a);
  });

  r.post('/', (req, res) => {
    const { datos, errores } = limpiarActividad(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    datos.responsable_id ??= req.usuario.id;
    datos.creado_por = req.usuario.id; // siempre de la sesión, nunca del cuerpo
    const columnas = Object.keys(datos);
    const id = db.transaction(() => {
      const nueva = Number(db.prepare(`INSERT INTO actividades (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => datos[c])).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'actividad', entidadId: nueva, accion: 'alta', despues: datos });
      return nueva;
    })();
    res.status(201).json(leer.get(id));
  });

  r.put('/:id', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    if (antes.hecha_en) return res.status(409).json({ error: 'Ya está hecha: no se edita. Devuélvela a pendiente o crea otra' });
    const { datos, errores } = limpiarActividad(req.body, { edicion: true });
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    const columnas = Object.keys(datos);
    if (!columnas.length) return res.status(400).json({ error: 'Sin cambios' });
    db.transaction(() => {
      db.prepare(`UPDATE actividades SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
        .run(...columnas.map((c) => datos[c]), antes.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'actividad', entidadId: antes.id, accion: 'edicion',
        antes: Object.fromEntries(columnas.map((c) => [c, antes[c]])), despues: datos });
    })();
    res.json(leer.get(antes.id));
  });

  // { resultado? } la marca hecha ahora · { hecha: false } la devuelve a pendiente (y borra el resultado)
  r.patch('/:id/hecha', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const b = req.body ?? {};
    const desconocidos = Object.keys(b).filter((k) => k !== 'resultado' && k !== 'hecha');
    if (desconocidos.length) return res.status(400).json({ error: `Campo desconocido: ${desconocidos.join(', ')}` });
    if (b.hecha !== undefined && typeof b.hecha !== 'boolean') return res.status(400).json({ error: 'hecha tiene que ser true o false' });
    const hecha = b.hecha ?? true;

    if (hecha) {
      if (antes.hecha_en) return res.status(409).json({ error: 'Ya está hecha' });
      let resultado = null;
      if (b.resultado != null && b.resultado !== '') {
        if (typeof b.resultado !== 'string' || b.resultado.trim().length > 2000) return res.status(400).json({ error: 'resultado tiene que ser texto de hasta 2.000 caracteres' });
        resultado = b.resultado.trim();
      }
      db.transaction(() => {
        db.prepare("UPDATE actividades SET hecha_en = datetime('now'), resultado = ? WHERE id = ?").run(resultado, antes.id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'actividad', entidadId: antes.id, accion: 'hecha', despues: { resultado } });
      })();
    } else {
      if (b.resultado !== undefined) return res.status(400).json({ error: 'Para devolverla a pendiente no hace falta resultado' });
      if (!antes.hecha_en) return res.status(409).json({ error: 'Ya está pendiente' });
      db.transaction(() => {
        db.prepare('UPDATE actividades SET hecha_en = NULL, resultado = NULL WHERE id = ?').run(antes.id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'actividad', entidadId: antes.id, accion: 'pendiente',
          antes: { hecha_en: antes.hecha_en, resultado: antes.resultado } });
      })();
    }
    res.json(leer.get(antes.id));
  });

  return r;
}
