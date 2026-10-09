// Dueño: Victor. El texto de cada correo. Texto plano: se lee igual en el móvil y no hay HTML que escapar.
import { calculadorDeAvisos } from '../avisos/routes.js';
import { hoyLocal, ZONA } from '../../fechas.js';
import { encolar } from './envio.js';

const TIPO_CONTACTO = { informacion: 'información', prueba: 'prueba de conducción', financiacion: 'financiación', tasacion: 'tasación de su coche' };
const enlace = (panel, ruta) => (panel ? `${panel}${ruta}` : null);
const diaEsp = (dia) => dia.split('-').reverse().join('/');

/** Apunta el correo de un contacto que acaba de llegar por la web. Va dentro de la transacción del alta. */
export function correoDeContacto(db, cfg, contacto, coche) {
  const tipo = TIPO_CONTACTO[contacto.tipo] ?? contacto.tipo;
  const lineas = [
    `${contacto.nombre} ha escrito por la web: pide ${tipo}.`,
    '',
    `Teléfono: ${contacto.telefono}`,
    contacto.email ? `Correo: ${contacto.email}` : null,
    coche ? `Coche: ${coche.marca} ${coche.modelo}${coche.version ? ` ${coche.version}` : ''} (${coche.referencia})` : null,
    contacto.mensaje ? `\nMensaje:\n${contacto.mensaje}` : null,
    '',
    enlace(cfg.panel, `contactos.html?id=${contacto.id}`) ?? 'Está en el panel, en Contactos.',
  ].filter((l) => l !== null);
  return encolar(db, {
    tipo: 'contacto', clave: `contacto:${contacto.id}`, para: cfg.contactos,
    asunto: `Contacto de la web: ${tipo} · ${contacto.nombre}`, cuerpo: lineas.join('\n'),
  });
}

/** Hora (0-23) de ahora en Rubí. */
const horaLocal = (ahora) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(ahora));

/**
 * El resumen de avisos del día, una vez al día a partir de cfg.horaAvisos. Con lo que ve gerencia (cobros
 * incluidos). Sin avisos no se manda nada: se vuelve a mirar en la pasada siguiente. Devuelve el id o null.
 */
export function encolarAvisosDelDia(db, cfg, { ahora = new Date(), calcular = calculadorDeAvisos(db) } = {}) {
  if (horaLocal(ahora) < cfg.horaAvisos) return null;
  const hoy = hoyLocal(ahora);
  const clave = `avisos:${hoy}`;
  if (db.prepare('SELECT 1 FROM correos WHERE clave = ?').get(clave)) return null;
  const avisos = calcular({ rol: 'gerencia' });
  if (!avisos.length) return null;

  const bloque = (titulo, lista) => (lista.length
    ? [`${titulo} (${lista.length})`, ...lista.map((a) => `- ${a.texto}${cfg.panel ? `\n  ${enlace(cfg.panel, a.enlace)}` : ''}`), '']
    : []);
  const urgentes = avisos.filter((a) => a.gravedad === 'alta');
  const resto = avisos.filter((a) => a.gravedad !== 'alta');
  const cuerpo = [
    ...bloque('Urgente', urgentes),
    ...bloque('Para esta semana', resto),
    enlace(cfg.panel, 'avisos.html') ?? 'Todos los avisos están en el panel.',
  ].join('\n');
  return encolar(db, {
    tipo: 'avisos_diario', clave, para: cfg.avisos,
    asunto: `Avisos del ${diaEsp(hoy)}: ${urgentes.length} urgente${urgentes.length === 1 ? '' : 's'}, ${avisos.length} en total`, cuerpo,
  });
}
