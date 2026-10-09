// Dueño: Victor. Correos de la plataforma. Quien quiere mandar uno lo apunta con encolar() (síncrono, dentro de
// su transacción si quiere) y enviarPendientes() los manda después, desde server.js. Así un SMTP caído o lento
// no tumba ni frena el formulario de la web, y un correo que falla se reintenta.
//
// Configuración (.env):
//   SMTP_URL          smtps://usuario:clave@smtp.ejemplo.com:465. Vacío = modo simulado: los correos quedan
//                     como «simulado» y se ven en GET /api/correos, pero no salen (duda H13).
//   CORREO_DE         remitente, por ejemplo «Pro Service Rubí <avisos@proservicerubi.com>»
//   CORREO_CONTACTOS  a quién le llega cada contacto de la web (varios, separados por comas)
//   CORREO_AVISOS     a quién le llega el resumen diario de avisos (lleva importes: solo gerencia)
//   AVISOS_HORA       a partir de qué hora de Rubí sale el resumen (por defecto, 8)
//   PANEL_URL         dirección del panel para los enlaces, por ejemplo https://stock.proservicerubi.com/panel/
import nodemailer from 'nodemailer';

// Reintentos cada vez más espaciados (2, 8, 18, 32… minutos desde que se apuntó): unas 9 horas en total.
export const MAX_INTENTOS = 10;

const lista = (texto) => (texto || '').split(',').map((s) => s.trim()).filter(Boolean).join(', ') || null;

export function configCorreo(env = process.env) {
  const hora = Number.parseInt(env.AVISOS_HORA ?? '', 10);
  return {
    smtp: env.SMTP_URL || null,
    de: env.CORREO_DE || 'Pro Service Rubí <no-responder@proservicerubi.com>',
    contactos: lista(env.CORREO_CONTACTOS),
    avisos: lista(env.CORREO_AVISOS),
    horaAvisos: hora >= 0 && hora <= 23 ? hora : 8,
    panel: env.PANEL_URL ? env.PANEL_URL.replace(/\/*$/, '/') : null,
  };
}

/** El transporte de nodemailer, o null en modo simulado. */
export const crearTransporte = (cfg) => (cfg.smtp ? nodemailer.createTransport(cfg.smtp) : null);

// El asunto lleva datos que escribe cualquiera en la web (el nombre): sin saltos de línea, que en una cabecera
// de correo servirían para colar otras cabeceras.
const unaLinea = (texto, max = 200) => String(texto).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

/** Apunta un correo. Con `clave`, si ya hay uno con esa clave no apunta otro y devuelve null. */
export function encolar(db, { tipo, clave = null, para, asunto, cuerpo }) {
  const info = db.prepare(`INSERT INTO correos (tipo, clave, para, asunto, cuerpo) VALUES (?, ?, ?, ?, ?)
                           ON CONFLICT (clave) DO NOTHING`).run(tipo, clave, para || null, unaLinea(asunto), cuerpo);
  return info.changes ? Number(info.lastInsertRowid) : null;
}

let enMarcha = false;

/** Manda los pendientes, de más viejo a más nuevo. Devuelve { enviados, simulados, fallidos }. */
export async function enviarPendientes(db, { transporte, de, max = 20 } = {}) {
  const resumen = { enviados: 0, simulados: 0, fallidos: 0 };
  if (enMarcha) return resumen; // la pasada anterior aún no ha acabado
  enMarcha = true;
  try {
    const pendientes = db.prepare(`SELECT * FROM correos WHERE estado = 'pendiente'
                                     AND (intentos = 0 OR creado_en <= datetime('now', '-' || (intentos * intentos * 2) || ' minutes'))
                                   ORDER BY id LIMIT ?`).all(max);
    const marcar = db.prepare('UPDATE correos SET estado = ?, intentos = ?, ultimo_error = ?, enviado_en = ? WHERE id = ?');
    for (const c of pendientes) {
      if (!c.para || !transporte) {
        const motivo = !c.para ? `Sin destinatario: falta ${c.tipo === 'contacto' ? 'CORREO_CONTACTOS' : 'CORREO_AVISOS'}` : 'Modo simulado: falta SMTP_URL';
        marcar.run('simulado', c.intentos, motivo, null, c.id);
        resumen.simulados++;
        continue;
      }
      try {
        await transporte.sendMail({ from: de, to: c.para, subject: c.asunto, text: c.cuerpo });
        marcar.run('enviado', c.intentos + 1, null, new Date().toISOString().slice(0, 19).replace('T', ' '), c.id);
        resumen.enviados++;
      } catch (e) {
        const intentos = c.intentos + 1;
        marcar.run(intentos >= MAX_INTENTOS ? 'error' : 'pendiente', intentos, unaLinea(e.message, 500), null, c.id);
        resumen.fallidos++;
      }
    }
    return resumen;
  } finally {
    enMarcha = false;
  }
}
