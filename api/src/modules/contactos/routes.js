// Dueño: Victor. Contactos de la web (5.6, 8.1).
//   POST /api/contactos  → público: lo manda el formulario de la web, sin sesión
//   GET, PATCH           → con sesión: el panel los lista y los marca como atendidos
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { reducirImagen } from '../fotos/routes.js';
import { registrar } from '../auditoria.js';
import { ESTADOS_WEB } from '../estados.js';
import { configCorreo } from '../correo/envio.js';
import { correoDeContacto } from '../correo/mensajes.js';

export const TIPOS = ['informacion', 'prueba', 'financiacion', 'tasacion'];
const TELEFONO = /^[+\d][\d\s().-]{5,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Como mucho 5 envíos por IP cada 10 minutos: suficiente para una persona, corta los robots
const VENTANA_MS = 10 * 60 * 1000;
const MAXIMO_POR_VENTANA = Number(process.env.CONTACTOS_POR_IP) || 5;

const texto = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

// Tasación (duda E4): el coche del cliente, con marca, modelo, año, km y hasta 5 fotos. Las fotos llegan en un
// formulario multipart (campo «fotos»); lo demás, igual que en JSON. Se guardan en UPLOADS_PATH/contactos/.
export const FOTOS_TASACION = 5;
const MB_TASACION = 10;
const CAMPOS_TASACION = ['tasacion_marca', 'tasacion_modelo', 'tasacion_anio', 'tasacion_km'];
const carpetaSubidas = () => resolve(process.env.UPLOADS_PATH || './data/uploads');
const esHeic = (f) => /^image\/hei[cf]/.test(f.mimetype) || /\.hei[cf]$/i.test(f.originalname);
const numero = (v) => (Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,3}(\.?\d{3})*$/.test(v.trim()) ? Number(v.trim().replace(/\./g, '')) : null);
// En un formulario multipart todo llega como texto: «true» o «on» en la casilla, el id del coche como «12»
const SI = ['true', 'on', '1'];

const subidaTasacion = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MB_TASACION * 1024 * 1024, files: FOTOS_TASACION, fields: 20, fieldSize: 4000, parts: 30 },
}).array('fotos', FOTOS_TASACION);

/** Lee el multipart (si lo es) y traduce sus errores al formato { error } de la API. */
function recibirFotos(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  subidaTasacion(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Cada foto puede ocupar ${MB_TASACION} MB como mucho` });
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: `Como mucho ${FOTOS_TASACION} fotos` });
    if (String(err.code).startsWith('LIMIT_')) return res.status(400).json({ error: 'El formulario es demasiado grande' });
    next(err);
  });
}

export function rutasContactosPublicas(db) {
  const r = Router();
  const envios = new Map(); // ip → { n, desde }
  // Solo coches que salen en la web: así el formulario no sirve para averiguar qué otros coches hay
  const enLaWeb = `estado IN (${ESTADOS_WEB.map(() => '?').join(',')})`;
  const cocheDeId = db.prepare(`SELECT id FROM vehiculos WHERE id = ? AND ${enLaWeb}`);
  const cocheDeReferencia = db.prepare(`SELECT id FROM vehiculos WHERE referencia = ? AND ${enLaWeb}`);

  // El límite va antes de leer las fotos: un robot no consigue que el servidor reciba y procese ficheros
  const limitar = (req, res, next) => {
    const ahora = Date.now();
    const e = envios.get(req.ip);
    if (e && ahora - e.desde < VENTANA_MS && e.n >= MAXIMO_POR_VENTANA) {
      return res.status(429).json({ error: 'Has enviado varios mensajes seguidos. Prueba en unos minutos o llámanos.' });
    }
    if (!e || ahora - e.desde >= VENTANA_MS) envios.set(req.ip, { n: 1, desde: ahora });
    else e.n += 1;
    if (envios.size > 5000) for (const [ip, v] of envios) if (ahora - v.desde >= VENTANA_MS) envios.delete(ip);
    next();
  };

  r.post('/', limitar, recibirFotos, async (req, res, next) => {
    const multipart = req.is('multipart/form-data');
    const b = { ...(req.body ?? {}) };
    if (multipart) {
      b.privacidad = SI.includes(b.privacidad);
      if (typeof b.coche === 'string' && /^\d+$/.test(b.coche)) b.coche = Number(b.coche);
    }
    const ficheros = req.files ?? [];
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

    // El coche que quiere tasar: solo en una tasación, y todo opcional (la web lo pide, la API no lo exige)
    const tasacion = {};
    const conTasacion = CAMPOS_TASACION.some((c) => b[c] != null && b[c] !== '') || ficheros.length;
    if (conTasacion && b.tipo !== 'tasacion') errores.push('Los datos y las fotos de tu coche solo van al pedir una tasación');
    else if (conTasacion) {
      for (const [campo, max] of [['tasacion_marca', 60], ['tasacion_modelo', 80]]) {
        if (b[campo] == null || b[campo] === '') continue;
        const t = texto(b[campo], max);
        if (!t) errores.push(`${campo === 'tasacion_marca' ? 'La marca' : 'El modelo'} de tu coche es demasiado largo`);
        else tasacion[campo] = t;
      }
      if (b.tasacion_anio != null && b.tasacion_anio !== '') {
        const anio = numero(b.tasacion_anio);
        if (anio === null || anio < 1950 || anio > new Date().getFullYear() + 1) errores.push('El año de tu coche no es válido');
        else tasacion.tasacion_anio = anio;
      }
      if (b.tasacion_km != null && b.tasacion_km !== '') {
        const km = numero(b.tasacion_km);
        if (km === null || km > 2000000) errores.push('Los kilómetros de tu coche no son válidos');
        else tasacion.tasacion_km = km;
      }
      if (ficheros.some(esHeic)) errores.push('Las fotos HEIC del iPhone no se pueden subir: mándalas en JPG');
    }

    // El coche es opcional: el id (número) o la referencia (texto, «PS-00031»). Si no está en la web
    // (por ejemplo, se vendió mientras la persona escribía), el contacto se guarda igual, sin coche.
    let vehiculoId = null;
    if (Number.isInteger(b.coche)) vehiculoId = cocheDeId.get(b.coche, ...ESTADOS_WEB)?.id ?? null;
    else if (typeof b.coche === 'string' && b.coche.trim()) vehiculoId = cocheDeReferencia.get(b.coche.trim().toUpperCase(), ...ESTADOS_WEB)?.id ?? null;
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    // Las fotos se reducen antes de guardar nada: si una no es una imagen, no entra el contacto y se dice
    const reducidas = [];
    try {
      for (const f of ficheros) { reducidas.push(await reducirImagen(f.buffer)); f.buffer = null; }
    } catch {
      return res.status(400).json({ error: 'Alguna de las fotos no es una imagen que se pueda abrir' });
    }

    const carpeta = `contactos/${randomUUID()}`; // una por envío: así no hace falta el id antes de guardar
    const rutas = reducidas.map((_, i) => `${carpeta}/${i + 1}.jpg`);
    try {
      if (rutas.length) {
        await mkdir(join(carpetaSubidas(), carpeta), { recursive: true });
        for (const [i, ruta] of rutas.entries()) await writeFile(join(carpetaSubidas(), ruta), reducidas[i]);
      }
      // El contacto, sus fotos y su correo al comercial, juntos: o entra todo o nada. El correo sale después (correo/envio.js).
      db.transaction(() => {
        const columnas = ['nombre', 'telefono', 'email', 'tipo', 'vehiculo_id', 'mensaje', ...Object.keys(tasacion)];
        const valores = [nombre, telefono, email, b.tipo, vehiculoId, mensaje, ...Object.values(tasacion)];
        const id = Number(db.prepare(`INSERT INTO contactos (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`)
          .run(...valores).lastInsertRowid);
        const foto = db.prepare('INSERT INTO contacto_fotos (contacto_id, orden, ruta) VALUES (?, ?, ?)');
        rutas.forEach((ruta, i) => foto.run(id, i + 1, ruta));
        const coche = vehiculoId ? db.prepare('SELECT marca, modelo, version, referencia FROM vehiculos WHERE id = ?').get(vehiculoId) : null;
        correoDeContacto(db, configCorreo(), { id, nombre, telefono, email, tipo: b.tipo, mensaje, ...tasacion, fotos: rutas.length }, coche);
      })();
    } catch (err) {
      if (rutas.length) await rm(join(carpetaSubidas(), carpeta), { recursive: true, force: true });
      return next(err);
    }
    res.status(201).json({ ok: true });
  });

  return r;
}

export function rutasContactos(db) {
  const r = Router();
  // cita_inicio: la prueba de conducción que salió de este contacto (bloque 10), si la hay y no se canceló
  const SELECT = `SELECT c.*, v.matricula, v.marca, v.modelo, u.nombre AS atendido_por_nombre,
                         (SELECT k.inicio FROM citas k WHERE k.contacto_id = c.id AND k.estado <> 'cancelada' ORDER BY k.id DESC LIMIT 1) AS cita_inicio,
                         (SELECT json_group_array(f.id) FROM (SELECT id FROM contacto_fotos WHERE contacto_id = c.id ORDER BY orden) f) AS fotos_ids
                    FROM contactos c
                    LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
                    LEFT JOIN usuarios u ON u.id = c.atendido_por`;
  const leerFila = db.prepare(`${SELECT} WHERE c.id = ?`);
  // Las fotos de una tasación, con la dirección que pone el panel en <img src> (con sesión)
  const conFotos = ({ fotos_ids, ...c }) => ({ ...c, fotos: JSON.parse(fotos_ids ?? '[]').map((id) => ({ id, url: `/api/contactos/${c.id}/fotos/${id}` })) });
  const leer = { get: (id) => { const c = leerFila.get(id); return c && conFotos(c); } };

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
    res.json(db.prepare(`${SELECT} ${donde} ORDER BY ${orden}, c.id`).all(...valores).map(conFotos));
  });

  // Una foto de una tasación. Privada: lleva la matrícula del coche de un particular.
  r.get('/:id/fotos/:fotoId', (req, res) => {
    const f = db.prepare('SELECT ruta FROM contacto_fotos WHERE id = ? AND contacto_id = ?').get(req.params.fotoId, req.params.id);
    const base = carpetaSubidas();
    const ruta = f && resolve(base, f.ruta);
    if (!ruta || !ruta.startsWith(base + sep)) return res.status(404).json({ error: 'No existe' });
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(ruta, { cacheControl: false }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'No existe' });
    });
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

  // Pasar a cliente: crea la ficha con lo que dejó en el formulario, o la une a la de un cliente
  // que ya tenga ese teléfono o ese correo, para no duplicarlo.
  r.post('/:id/cliente', (req, res) => {
    const c = leer.get(req.params.id);
    if (!c) return res.status(404).json({ error: 'No existe' });
    if (c.cliente_id) return res.json({ cliente_id: c.cliente_id, creado: false });
    const telefono = c.telefono.replace(/[\s().-]/g, '');
    const resultado = db.transaction(() => {
      const existente = db.prepare(`SELECT id FROM clientes
                                     WHERE replace(replace(replace(replace(replace(telefono, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '') = ?
                                        OR (? IS NOT NULL AND email = ? COLLATE NOCASE)
                                     ORDER BY id LIMIT 1`).get(telefono, c.email, c.email);
      let clienteId = existente?.id;
      if (!clienteId) {
        clienteId = Number(db.prepare("INSERT INTO clientes (nombre, telefono, email, origen) VALUES (?, ?, ?, 'web')")
          .run(c.nombre, c.telefono, c.email).lastInsertRowid);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'cliente', entidadId: clienteId, accion: 'alta', despues: { desde_contacto: c.id } });
      }
      db.prepare('UPDATE contactos SET cliente_id = ? WHERE id = ?').run(clienteId, c.id);
      return { cliente_id: clienteId, creado: !existente };
    })();
    res.status(resultado.creado ? 201 : 200).json(resultado);
  });

  return r;
}
