// Dueño: Victor. Cita previa de pruebas de conducción (ampliación del 7-oct, bloque 10).
//   GET  /api/citas/huecos   → público: las horas libres dentro del horario (las usa la web y el panel)
//   POST /api/citas/pedir    → público: la web pide una prueba. Entra como «pedida» y apunta un contacto
//   GET, POST, PATCH /api/citas → con sesión, los dos roles: la agenda del panel (aquí no hay dinero)
// Las horas van en hora de Rubí ('AAAA-MM-DD HH:MM'), como las actividades del CRM. Una prueba dura 30
// minutos y empieza en punto o y media; dos citas vivas no pueden empezar a la vez (lo impide la base).
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { ZONA, DIA, hoyLocal, diaValido } from '../../fechas.js';
import { configCorreo } from '../correo/envio.js';
import { correoDeContacto } from '../correo/mensajes.js';

export const DURACION_MIN = 30;
export const ESTADOS_CITA = ['pedida', 'confirmada', 'hecha', 'no_vino', 'cancelada'];
export const VIVAS = ['pedida', 'confirmada'];
const ANTELACION_WEB_MIN = 120;   // la web no ofrece horas que empiezan en menos de dos horas
const DIAS_WEB = 14;              // ni más allá de dos semanas
const INICIO = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/;
const TELEFONO = /^[+\d][\d\s().-]{5,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIA_MS = 86400000;
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diaSemana = (dia) => ((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lunes
const aMinutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** 'AAAA-MM-DD HH:MM' de ahora (o de dentro de `mas` minutos) en Rubí */
export function ahoraLocal(mas = 0, ahora = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(ahora.getTime() + mas * 60000));
}
const texto = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);

export function agenda(db) {
  const horario = db.prepare('SELECT desde, hasta FROM horario_pruebas WHERE dia_semana = ? ORDER BY desde');
  const ocupadas = db.prepare(`SELECT inicio FROM citas WHERE estado IN ('pedida', 'confirmada') AND inicio >= ? AND inicio < ?`);

  /** Las horas en las que empieza una prueba ese día, según el horario (sin mirar si están cogidas) */
  const horasDelDia = (dia) => horario.all(diaSemana(dia)).flatMap(({ desde, hasta }) => {
    const horas = [];
    for (let m = aMinutos(desde); m + DURACION_MIN <= aMinutos(hasta); m += DURACION_MIN) horas.push(aHora(m));
    return horas;
  });

  /** Huecos libres de `dias` días desde `desde`: [{ dia, horas: ['10:00', …] }], sin días vacíos */
  const huecos = (desde, dias, { despuesDe = ahoraLocal() } = {}) => {
    const hasta = sumarDias(desde, dias);
    const cogidas = new Set(ocupadas.all(`${desde} 00:00`, `${hasta} 00:00`).map((c) => c.inicio));
    const lista = [];
    for (let i = 0; i < dias; i++) {
      const dia = sumarDias(desde, i);
      const horas = horasDelDia(dia).filter((h) => `${dia} ${h}` > despuesDe && !cogidas.has(`${dia} ${h}`));
      if (horas.length) lista.push({ dia, horas });
    }
    return lista;
  };

  /** null si la hora vale para una cita nueva o movida; si no, el motivo. No mira si está cogida (eso, la base). */
  const motivoHoraNoValida = (inicio, { despuesDe = ahoraLocal() } = {}) => {
    const m = typeof inicio === 'string' && INICIO.exec(inicio);
    if (!m || !diaValido(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59) return 'La hora va como AAAA-MM-DD HH:MM, por ejemplo 2026-10-14 10:30';
    if (inicio <= despuesDe) return 'Esa hora ya ha pasado';
    if (!horasDelDia(m[1]).includes(`${m[2]}:${m[3]}`)) return 'Esa hora está fuera del horario de pruebas';
    return null;
  };

  return { huecos, motivoHoraNoValida, horasDelDia };
}

// Una cita que choca con otra viva: el índice único citas_sin_solape
const esSolape = (e) => e?.code === 'SQLITE_CONSTRAINT_UNIQUE' && /citas/.test(e.message);

export function rutasCitasPublicas(db) {
  const r = Router();
  const { huecos, motivoHoraNoValida } = agenda(db);
  // Solo los que están a la venta: la web también enseña reservados y vendidos, pero esos no se prueban
  const cocheWeb = db.prepare("SELECT id, marca, modelo, version, referencia FROM vehiculos WHERE (id = ? OR referencia = ?) AND estado = 'publicado'");
  const envios = new Map(); // ip → { n, desde }: como en contactos, 5 cada 10 minutos

  // ?desde=AAAA-MM-DD (por defecto hoy) · ?dias= (1 a 14, por defecto 14)
  r.get('/huecos', (req, res) => {
    const desde = req.query.desde ?? hoyLocal();
    const dias = req.query.dias === undefined ? DIAS_WEB : Number(req.query.dias);
    if (typeof desde !== 'string' || !DIA.test(desde) || !diaValido(desde)) return res.status(400).json({ error: 'desde tiene que ser una fecha AAAA-MM-DD' });
    if (!Number.isInteger(dias) || dias < 1 || dias > 42) return res.status(400).json({ error: 'dias tiene que ser un número de 1 a 42' });
    // La web, con dos horas de margen (el panel tiene su ruta, /libres, sin margen)
    res.json({ duracion_min: DURACION_MIN, dias: huecos(desde, dias, { despuesDe: ahoraLocal(ANTELACION_WEB_MIN) }) });
  });

  r.post('/pedir', (req, res) => {
    const ahora = Date.now();
    const e = envios.get(req.ip);
    if (e && ahora - e.desde < 600000 && e.n >= 5) return res.status(429).json({ error: 'Has enviado varias peticiones seguidas. Prueba en unos minutos o llámanos.' });
    if (!e || ahora - e.desde >= 600000) envios.set(req.ip, { n: 1, desde: ahora }); else e.n += 1;

    const b = req.body ?? {};
    if (typeof b.web === 'string' && b.web.trim()) return res.status(201).json({ ok: true }); // campo trampa: como en contactos
    const errores = [];
    const nombre = texto(b.nombre, 100);
    const telefono = typeof b.telefono === 'string' && TELEFONO.test(b.telefono.trim()) ? b.telefono.trim() : null;
    const email = b.email == null || b.email === '' ? null : typeof b.email === 'string' && EMAIL.test(b.email.trim()) ? b.email.trim() : false;
    const mensaje = b.mensaje == null || b.mensaje === '' ? null : texto(b.mensaje, 2000) ?? false;
    if (!nombre) errores.push('Falta el nombre');
    if (!telefono) errores.push('El teléfono no es válido');
    if (email === false) errores.push('El correo no es válido');
    if (mensaje === false) errores.push('El mensaje es demasiado largo');
    if (b.privacidad !== true) errores.push('Hay que aceptar la política de privacidad');
    const coche = cocheWeb.get(Number.isInteger(b.coche) ? b.coche : -1, typeof b.coche === 'string' ? b.coche.trim().toUpperCase() : '');
    if (!coche) errores.push('Ese coche ya no está a la venta');
    const malaHora = motivoHoraNoValida(b.inicio, { despuesDe: ahoraLocal(ANTELACION_WEB_MIN) });
    if (malaHora) errores.push(malaHora);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    try {
      db.transaction(() => {
        // También como contacto: así sale en Contactos, en los avisos y en el correo al comercial
        const [dia, hora] = b.inicio.split(' ');
        const nota = `Pide prueba el ${dia.split('-').reverse().join('/')} a las ${hora}.${mensaje ? `\n${mensaje}` : ''}`;
        const contactoId = Number(db.prepare("INSERT INTO contactos (nombre, telefono, email, tipo, vehiculo_id, mensaje) VALUES (?, ?, ?, 'prueba', ?, ?)")
          .run(nombre, telefono, email, coche.id, nota).lastInsertRowid);
        db.prepare("INSERT INTO citas (vehiculo_id, inicio, nombre, telefono, email, contacto_id, origen) VALUES (?, ?, ?, ?, ?, ?, 'web')")
          .run(coche.id, b.inicio, nombre, telefono, email, contactoId);
        correoDeContacto(db, configCorreo(), { id: contactoId, nombre, telefono, email, tipo: 'prueba', mensaje: nota }, coche);
      })();
    } catch (err) {
      if (esSolape(err)) return res.status(409).json({ error: 'Esa hora se acaba de coger. Elige otra.' });
      throw err;
    }
    res.status(201).json({ ok: true });
  });

  return r;
}

export function rutasCitas(db) {
  const r = Router();
  const { motivoHoraNoValida, huecos } = agenda(db);
  const SELECT = `SELECT c.*, v.marca, v.modelo, v.version, v.matricula, v.referencia, v.estado AS vehiculo_estado,
                         k.nombre AS cliente_nombre, u.nombre AS creado_por_nombre
                    FROM citas c
                    JOIN vehiculos v ON v.id = c.vehiculo_id
                    LEFT JOIN clientes k ON k.id = c.cliente_id
                    LEFT JOIN usuarios u ON u.id = c.creado_por`;
  const leer = db.prepare(`${SELECT} WHERE c.id = ?`);

  // El horario de pruebas, para dibujar la agenda: [{ dia_semana (1 = lunes), desde, hasta }]
  r.get('/horario', (_req, res) => {
    res.json({ duracion_min: DURACION_MIN, franjas: db.prepare('SELECT dia_semana, desde, hasta FROM horario_pruebas ORDER BY dia_semana, desde').all() });
  });

  // Huecos para el panel: los de hoy desde ya mismo (la web los da con dos horas de margen). ?desde= ?dias=
  r.get('/libres', (req, res) => {
    const desde = req.query.desde ?? hoyLocal();
    const dias = req.query.dias === undefined ? DIAS_WEB : Number(req.query.dias);
    if (typeof desde !== 'string' || !DIA.test(desde) || !diaValido(desde)) return res.status(400).json({ error: 'desde tiene que ser una fecha AAAA-MM-DD' });
    if (!Number.isInteger(dias) || dias < 1 || dias > 42) return res.status(400).json({ error: 'dias tiene que ser un número de 1 a 42' });
    res.json({ duracion_min: DURACION_MIN, dias: huecos(desde, dias) });
  });

  // ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (los dos días incluidos; por defecto, de hoy a dentro de 7 días).
  // Sin las canceladas, salvo ?canceladas=1.
  r.get('/', (req, res) => {
    const desde = req.query.desde ?? hoyLocal();
    const hasta = req.query.hasta ?? sumarDias(desde, 6);
    if (![desde, hasta].every((d) => typeof d === 'string' && DIA.test(d) && diaValido(d))) return res.status(400).json({ error: 'desde y hasta van como AAAA-MM-DD' });
    if (hasta < desde || hasta > sumarDias(desde, 62)) return res.status(400).json({ error: 'El periodo va de desde a hasta, de dos meses como mucho' });
    const canceladas = req.query.canceladas === '1' ? '' : "AND c.estado <> 'cancelada'";
    res.json(db.prepare(`${SELECT} WHERE c.inicio >= ? AND c.inicio < ? ${canceladas} ORDER BY c.inicio, c.id`).all(`${desde} 00:00`, `${sumarDias(hasta, 1)} 00:00`));
  });

  // { vehiculo_id, inicio, nombre?, telefono?, email?, cliente_id?, contacto_id?, notas?, estado? }. Desde el panel
  // entra «confirmada» (se ha hablado con el cliente), salvo que se diga «pedida». Con cliente_id o contacto_id,
  // el nombre y el teléfono salen de ahí si no llegan; un contacto de la web queda atendido.
  r.post('/', (req, res) => {
    const b = req.body ?? {};
    const errores = [];
    const coche = Number.isInteger(b.vehiculo_id) ? db.prepare('SELECT id FROM vehiculos WHERE id = ?').get(b.vehiculo_id) : null;
    if (!coche) errores.push('Falta el coche, o no existe');
    const cliente = b.cliente_id == null ? null : Number.isInteger(b.cliente_id) ? db.prepare('SELECT id, nombre, telefono, email FROM clientes WHERE id = ?').get(b.cliente_id) : undefined;
    const contacto = b.contacto_id == null ? null : Number.isInteger(b.contacto_id) ? db.prepare('SELECT id, nombre, telefono, email FROM contactos WHERE id = ?').get(b.contacto_id) : undefined;
    if (cliente === undefined) errores.push('cliente_id no existe');
    if (contacto === undefined) errores.push('contacto_id no existe');
    const nombre = texto(b.nombre, 100) ?? cliente?.nombre ?? contacto?.nombre ?? null;
    const telefono = (typeof b.telefono === 'string' && b.telefono.trim()) || cliente?.telefono || contacto?.telefono || null;
    const email = (typeof b.email === 'string' && b.email.trim()) || cliente?.email || contacto?.email || null;
    if (!nombre) errores.push('Falta el nombre de quien la hace');
    if (!telefono || !TELEFONO.test(telefono)) errores.push('Falta un teléfono válido');
    if (email && !EMAIL.test(email)) errores.push('El correo no es válido');
    const estado = b.estado ?? 'confirmada';
    if (!VIVAS.includes(estado)) errores.push('Una cita nueva entra pedida o confirmada');
    const notas = b.notas == null || b.notas === '' ? null : texto(b.notas, 2000);
    if (b.notas && !notas) errores.push('Las notas son demasiado largas');
    const malaHora = motivoHoraNoValida(b.inicio);
    if (malaHora) errores.push(malaHora);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    let id;
    try {
      id = db.transaction(() => {
        const nueva = Number(db.prepare(`INSERT INTO citas (vehiculo_id, inicio, estado, nombre, telefono, email, cliente_id, contacto_id, notas, creado_por)
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(coche.id, b.inicio, estado, nombre, telefono.trim(), email, cliente?.id ?? null, contacto?.id ?? null, notas, req.usuario.id).lastInsertRowid);
        if (contacto) db.prepare("UPDATE contactos SET atendido_en = COALESCE(atendido_en, datetime('now')), atendido_por = COALESCE(atendido_por, ?) WHERE id = ?").run(req.usuario.id, contacto.id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'cita', entidadId: nueva, accion: 'alta', despues: { vehiculo_id: coche.id, inicio: b.inicio, estado } });
        return nueva;
      })();
    } catch (err) {
      if (esSolape(err)) return res.status(409).json({ error: 'A esa hora ya hay otra prueba. Elige otra.' });
      throw err;
    }
    res.status(201).json(leer.get(id));
  });

  // { estado?, inicio?, notas? }. Cambiar la hora solo en una cita viva; una que ya pasó se marca hecha o no_vino.
  r.patch('/:id', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const b = req.body ?? {};
    const desconocidos = Object.keys(b).filter((k) => !['estado', 'inicio', 'notas'].includes(k));
    if (desconocidos.length) return res.status(400).json({ error: `Campo desconocido: ${desconocidos.join(', ')}` });
    const cambios = {};
    if (b.estado !== undefined) {
      if (!ESTADOS_CITA.includes(b.estado)) return res.status(400).json({ error: `estado tiene que ser ${ESTADOS_CITA.join(', ')}` });
      if (b.estado === 'pedida' && antes.estado !== 'pedida') return res.status(409).json({ error: 'Una cita no vuelve a «pedida»' });
      if (antes.estado === 'cancelada' && b.estado !== 'cancelada') return res.status(409).json({ error: 'Está cancelada: si vuelve, apunta una nueva' });
      cambios.estado = b.estado;
    }
    if (b.inicio !== undefined && b.inicio !== antes.inicio) {
      if (!VIVAS.includes(b.estado ?? antes.estado)) return res.status(409).json({ error: 'Solo se cambia la hora de una cita pedida o confirmada' });
      const malaHora = motivoHoraNoValida(b.inicio);
      if (malaHora) return res.status(400).json({ error: malaHora });
      cambios.inicio = b.inicio;
    }
    if (b.notas !== undefined) {
      const notas = b.notas == null || b.notas === '' ? null : texto(b.notas, 2000);
      if (b.notas && !notas) return res.status(400).json({ error: 'Las notas son demasiado largas' });
      cambios.notas = notas;
    }
    const columnas = Object.keys(cambios);
    if (!columnas.length) return res.json(antes);
    try {
      db.transaction(() => {
        db.prepare(`UPDATE citas SET ${columnas.map((c) => `${c} = ?`).join(', ')}, actualizado_en = datetime('now') WHERE id = ?`).run(...columnas.map((c) => cambios[c]), antes.id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'cita', entidadId: antes.id, accion: 'edicion',
          antes: Object.fromEntries(columnas.map((c) => [c, antes[c]])), despues: cambios });
      })();
    } catch (err) {
      if (esSolape(err)) return res.status(409).json({ error: 'A esa hora ya hay otra prueba. Elige otra.' });
      throw err;
    }
    res.json(leer.get(antes.id));
  });

  return r;
}
