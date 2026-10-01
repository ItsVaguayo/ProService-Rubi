// Dueño: Victor. Contactos de la web (5.6, 8.1).
//   POST /api/contactos  → público: lo manda el formulario de la web, sin sesión
//   GET, PATCH           → con sesión: el panel los lista y los marca como atendidos
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { ESTADOS_WEB } from '../estados.js';

export const TIPOS = ['informacion', 'prueba', 'financiacion', 'tasacion'];
const TELEFONO = /^[+\d][\d\s().-]{5,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Como mucho 5 envíos por IP cada 10 minutos: suficiente para una persona, corta los robots
const VENTANA_MS = 10 * 60 * 1000;
const MAXIMO_POR_VENTANA = Number(process.env.CONTACTOS_POR_IP) || 5;

const texto = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

export function rutasContactosPublicas(db) {
  const r = Router();
  const envios = new Map(); // ip → { n, desde }
  // Solo coches que salen en la web: así el formulario no sirve para averiguar qué otros coches hay
  const enLaWeb = `estado IN (${ESTADOS_WEB.map(() => '?').join(',')})`;
  const cocheDeId = db.prepare(`SELECT id FROM vehiculos WHERE id = ? AND ${enLaWeb}`);
  const cocheDeReferencia = db.prepare(`SELECT id FROM vehiculos WHERE referencia = ? AND ${enLaWeb}`);

  r.post('/', (req, res) => {
    const ahora = Date.now();
    const e = envios.get(req.ip);
    if (e && ahora - e.desde < VENTANA_MS && e.n >= MAXIMO_POR_VENTANA) {
      return res.status(429).json({ error: 'Has enviado varios mensajes seguidos. Prueba en unos minutos o llámanos.' });
    }
    if (!e || ahora - e.desde >= VENTANA_MS) envios.set(req.ip, { n: 1, desde: ahora });
    else e.n += 1;
    if (envios.size > 5000) for (const [ip, v] of envios) if (ahora - v.desde >= VENTANA_MS) envios.delete(ip);

    const b = req.body ?? {};
    // Campo trampa: la persona no lo ve y lo deja vacío; un robot lo rellena. Se contesta como si
    // hubiera ido bien para que no aprenda a saltárselo, y no se guarda nada.
    if (typeof b.web === 'string' && b.web.trim()) return res.status(201).json({ ok: true });

    const errores = [];
    const nombre = texto(b.nombre, 100);
    const telefono = typeof b.telefono === 'string' && TELEFONO.test(b.telefono.trim()) ? b.telefono.trim() : null;
    const email = b.email == null || b.email === '' ? null : typeof b.email === 'string' && EMAIL.test(b.email.trim()) ? b.email.trim() : false;
    const mensaje = b.mensaje == null || b.mensaje === '' ? null : texto(b.mensaje, 2000) ?? false;
    if (!nombre) errores.push('Falta el nombre');
    if (!telefono) errores.push('El teléfono no es válido');
    if (email === false) errores.push('El correo no es válido');
    if (!TIPOS.includes(b.tipo)) errores.push(`El tipo tiene que ser ${TIPOS.join(', ')}`);
    if (mensaje === false) errores.push('El mensaje es demasiado largo');
    if (b.privacidad !== true) errores.push('Hay que aceptar la política de privacidad');

    // El coche es opcional: el id (número) o la referencia (texto, «PS-00031»). Si no está en la web
    // (por ejemplo, se vendió mientras la persona escribía), el contacto se guarda igual, sin coche.
    let vehiculoId = null;
    if (Number.isInteger(b.coche)) vehiculoId = cocheDeId.get(b.coche, ...ESTADOS_WEB)?.id ?? null;
    else if (typeof b.coche === 'string' && b.coche.trim()) vehiculoId = cocheDeReferencia.get(b.coche.trim().toUpperCase(), ...ESTADOS_WEB)?.id ?? null;
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    db.prepare('INSERT INTO contactos (nombre, telefono, email, tipo, vehiculo_id, mensaje) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nombre, telefono, email, b.tipo, vehiculoId, mensaje);
    res.status(201).json({ ok: true });
  });

  return r;
}

export function rutasContactos(db) {
  const r = Router();
  const SELECT = `SELECT c.*, v.matricula, v.marca, v.modelo, u.nombre AS atendido_por_nombre
                    FROM contactos c
                    LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
                    LEFT JOIN usuarios u ON u.id = c.atendido_por`;
  const leer = db.prepare(`${SELECT} WHERE c.id = ?`);

  // ?estado=sin_atender (por defecto) | atendidos | todos  ·  ?tipo=informacion|prueba|financiacion|tasacion
  r.get('/', (req, res) => {
    const { estado = 'sin_atender', tipo } = req.query;
    const filtros = [];
    const valores = [];
    if (estado === 'sin_atender') filtros.push('c.atendido_en IS NULL');
    else if (estado === 'atendidos') filtros.push('c.atendido_en IS NOT NULL');
    else if (estado !== 'todos') return res.status(400).json({ error: 'estado tiene que ser sin_atender, atendidos o todos' });
    if (tipo) {
      if (!TIPOS.includes(tipo)) return res.status(400).json({ error: `tipo tiene que ser ${TIPOS.join(', ')}` });
      filtros.push('c.tipo = ?');
      valores.push(tipo);
    }
    // Los que llevan más tiempo esperando, primero; los atendidos, del más reciente al más antiguo
    const orden = estado === 'sin_atender' ? 'c.recibido_en ASC' : 'c.recibido_en DESC';
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    res.json(db.prepare(`${SELECT} ${donde} ORDER BY ${orden}, c.id`).all(...valores));
  });

  // Para el contador del menú
  r.get('/sin-atender', (_req, res) => {
    res.json({ total: db.prepare('SELECT COUNT(*) AS n FROM contactos WHERE atendido_en IS NULL').get().n });
  });

  r.patch('/:id', (req, res) => {
    const c = leer.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'No existe' });
    const { atendido } = req.body ?? {};
    if (typeof atendido !== 'boolean') return res.status(400).json({ error: 'atendido tiene que ser true o false' });
    db.transaction(() => {
      if (atendido) db.prepare("UPDATE contactos SET atendido_en = datetime('now'), atendido_por = ? WHERE id = ?").run(req.usuario.id, c.id);
      else db.prepare('UPDATE contactos SET atendido_en = NULL, atendido_por = NULL WHERE id = ?').run(c.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'contacto', entidadId: c.id, accion: atendido ? 'atendido' : 'pendiente' });
    })();
    res.json(leer.get(c.id));
  });

  return r;
}
