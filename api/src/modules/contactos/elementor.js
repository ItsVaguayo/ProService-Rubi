// Dueño: David. Los formularios de Elementor Pro de proservicerubi.com (contacto y tasación) por su acción
// «Webhook», y cualquier otro formulario de su web que mande lo mismo (la prueba de conducción de la ficha).
//   POST /api/contactos/elementor?token=…  → 200 { ok: true }
//
// Lo manda el servidor de WordPress, no el navegador de la persona: no hay CORS ni límite por IP (todos los envíos
// llegarían desde la misma), y en su lugar va el token de FORMULARIOS_WEB_TOKEN. Sin esa variable, la ruta no existe.
// Elementor espera un 200 y, si no lo recibe, le enseña un error a la persona,
// así que aquí se guarda lo que llegue y no se rechaza por un dato mal escrito: lo que no encaja va al mensaje.
// Las fotos de la tasación llegan como enlaces a su WordPress: se contesta antes de bajarlas, porque WordPress
// solo espera unos segundos, y se descargan después.
import express, { Router } from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sinAcentos } from '../../buscar.js';
import { ESTADOS_WEB } from '../estados.js';
import { reducirImagen } from '../fotos/routes.js';
import { EMAIL, TELEFONO, TIPOS, carpetaSubidas, guardarContacto, numero } from './routes.js';

export const FOTOS_WEBHOOK = 6; // las que deja subir su formulario de tasación
const MB_FOTO = 10;
const MENSAJE_MAX = 2000;

// Metadatos que Elementor añade al envío sencillo (sin «Datos avanzados»), en inglés y en castellano
const METADATOS = new Set(['date', 'time', 'page url', 'user agent', 'remote ip', 'powered by', 'credit', 'form_id', 'form_name',
  'url de la pagina', 'agente de usuario', 'ip remota', 'desarrollado por']);

// Etiqueta del campo (sin tildes ni mayúsculas) → dato nuestro. Por la etiqueta y no por el id: los ids
// (field_fe2491f) cambian si se rehace el formulario, y en el de tasación el id «message» es la marca.
const POR_ETIQUETA = [
  [/^tipo$/, 'tipo'],
  [/^(referencia|coche)$/, 'referencia'],
  [/^wp_post_id$/, 'wp_post_id'],
  [/^(pagina|page_url)$/, 'pagina'],
  [/correo|e-?mail/, 'email'],
  [/telefono|movil|phone/, 'telefono'],
  [/^(nombre|name)/, 'nombre'],
  [/^marca/, 'tasacion_marca'],
  [/^modelo/, 'tasacion_modelo'],
  [/^ano\b|matriculacion/, 'tasacion_anio'],
  [/kilometr|^km\b/, 'tasacion_km'],
  [/^(mensaje|message|consulta|comentario)/, 'mensaje'],
  [/privacidad|acepto|acceptance/, 'privacidad'],
];

const valorDe = (v) => (Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v)).trim();
const esFoto = (v) => /^https?:\/\/\S+\/wp-content\/uploads\/\S+$/i.test(v.split(/,\s*/)[0] ?? '');

/** Los campos del envío, con «Datos avanzados» activado o sin él: [{ titulo, tipo, valor }] y la página. */
export function leerEnvio(b) {
  if (b.fields && typeof b.fields === 'object') {
    return {
      formulario: valorDe(b.form?.name),
      pagina: valorDe(b.meta?.page_url?.value),
      campos: Object.entries(b.fields).map(([id, f]) => ({ titulo: valorDe(f?.title) || id, tipo: valorDe(f?.type), valor: valorDe(f?.value) })),
    };
  }
  const campos = Object.entries(b)
    .filter(([k]) => !METADATOS.has(sinAcentos(k).trim()))
    .map(([titulo, v]) => ({ titulo, tipo: '', valor: valorDe(v) }));
  return { formulario: valorDe(b.form_name), pagina: valorDe(b['Page URL'] ?? b['URL de la página']), campos };
}

/** Lo traduce a un contacto. Lo que no tiene sitio propio va al mensaje como «Etiqueta: valor». */
export function aContacto({ formulario, pagina, campos }, hostsFotos) {
  const d = {};
  const extras = [];
  const fotos = [];
  for (const { titulo, tipo, valor } of campos) {
    if (!valor) continue;
    if (tipo === 'honeypot') return { trampa: true };
    if (tipo === 'upload' || esFoto(valor)) {
      for (const url of valor.split(/,\s*/)) {
        if (fotoPermitida(url, hostsFotos)) fotos.push(url);
        else extras.push(`Foto no descargada: ${url}`);
      }
      continue;
    }
    const clave = tipo === 'acceptance' ? 'privacidad' : POR_ETIQUETA.find(([re]) => re.test(sinAcentos(titulo).trim()))?.[1];
    if (clave && !(clave in d)) d[clave] = valor;
    else if (clave !== 'privacidad') extras.push(`${titulo.trim()}: ${valor}`);
  }

  // Lo mal escrito no se pierde: va al mensaje, y el comercial lo ve
  const telefono = d.telefono && TELEFONO.test(d.telefono) ? d.telefono : '';
  if (d.telefono && !telefono) extras.push(`Teléfono escrito: ${d.telefono}`);
  const email = d.email && EMAIL.test(d.email) ? d.email : null;
  if (d.email && !email) extras.push(`Correo escrito: ${d.email}`);
  const tasacion = {};
  for (const campo of ['tasacion_marca', 'tasacion_modelo']) if (d[campo]) tasacion[campo] = d[campo].slice(0, campo === 'tasacion_marca' ? 60 : 80);
  const anio = d.tasacion_anio && numero(d.tasacion_anio);
  if (anio && anio >= 1950 && anio <= new Date().getFullYear() + 1) tasacion.tasacion_anio = anio;
  else if (d.tasacion_anio) extras.push(`Año: ${d.tasacion_anio}`);
  const km = d.tasacion_km ? numero(d.tasacion_km.replace(/\s|km/gi, '')) : null;
  if (km !== null && km <= 2000000) tasacion.tasacion_km = km;
  else if (d.tasacion_km) extras.push(`Kilómetros: ${d.tasacion_km}`);

  const nombreForm = sinAcentos(formulario);
  const tipo = TIPOS.includes(d.tipo) ? d.tipo
    : Object.keys(tasacion).length || fotos.length || /tasaci|compramos/.test(nombreForm) ? 'tasacion'
      : /prueba/.test(nombreForm) ? 'prueba' : /financ/.test(nombreForm) ? 'financiacion' : 'informacion';
  const mensaje = [d.mensaje, ...extras, pagina || d.pagina ? `Enviado desde: ${pagina || d.pagina}` : null].filter(Boolean).join('\n');

  return {
    contacto: {
      nombre: (d.nombre || email?.split('@')[0] || 'Sin nombre').slice(0, 100),
      telefono, email, tipo,
      mensaje: mensaje ? mensaje.slice(0, MENSAJE_MAX) : null,
      ...(tipo === 'tasacion' ? tasacion : {}),
    },
    referencia: d.referencia ?? null,
    wpPostId: /^\d+$/.test(d.wp_post_id ?? '') ? Number(d.wp_post_id) : null,
    fotos: tipo === 'tasacion' ? fotos.slice(0, FOTOS_WEBHOOK) : [],
  };
}

/** Solo fotos de su propia web: el servidor no baja lo que alguien ponga en un enlace (SSRF). */
function fotoPermitida(url, hosts) {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol) && hosts.includes(u.host) && u.pathname.includes('/wp-content/uploads/');
  } catch {
    return false;
  }
}

/** Los dominios de los que se bajan fotos: FORMULARIOS_WEB_HOSTS (separados por comas) o el de WP_URL. */
export function hostsDeFotos(env = process.env) {
  if (env.FORMULARIOS_WEB_HOSTS) return env.FORMULARIOS_WEB_HOSTS.split(',').map((h) => h.trim()).filter(Boolean);
  try { return env.WP_URL ? [new URL(env.WP_URL).host] : []; } catch { return []; }
}

const huella = (t) => createHash('sha256').update(String(t)).digest();
const tokenValido = (dado, esperado) => typeof dado === 'string' && timingSafeEqual(huella(dado), huella(esperado));

// Las descargas que siguen después de contestar. Los tests las esperan.
export const descargasEnCurso = new Set();

async function bajarFoto(url) {
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`respondió ${res.status}`);
  if (Number(res.headers.get('content-length')) > MB_FOTO * 1024 * 1024) throw new Error('pasa de 10 MB');
  const datos = Buffer.from(await res.arrayBuffer());
  if (datos.length > MB_FOTO * 1024 * 1024) throw new Error('pasa de 10 MB');
  return reducirImagen(datos);
}

/** Baja las fotos de una tasación ya guardada. Las que fallan se apuntan en el mensaje del contacto. */
async function descargarFotos(db, contactoId, urls) {
  const carpeta = `contactos/${randomUUID()}`;
  const foto = db.prepare('INSERT INTO contacto_fotos (contacto_id, orden, ruta) VALUES (?, ?, ?)');
  const fallos = [];
  let orden = 0;
  for (const url of urls) {
    try {
      const jpg = await bajarFoto(url);
      const ruta = `${carpeta}/${orden + 1}.jpg`;
      await mkdir(join(carpetaSubidas(), carpeta), { recursive: true });
      await writeFile(join(carpetaSubidas(), ruta), jpg);
      foto.run(contactoId, ++orden, ruta);
    } catch (e) {
      fallos.push(`No se pudo bajar una foto (${e.message}): ${url}`);
    }
  }
  if (fallos.length) {
    db.prepare("UPDATE contactos SET mensaje = substr(trim(coalesce(mensaje, '') || char(10) || ?, char(10)), 1, ?) WHERE id = ?")
      .run(fallos.join('\n'), MENSAJE_MAX, contactoId);
    console.error(`[contactos/elementor] contacto ${contactoId}: ${fallos.join(' · ')}`);
  }
}

export function rutaElementor(db) {
  const r = Router();
  const enLaWeb = `v.estado IN (${ESTADOS_WEB.map(() => '?').join(',')})`;
  const porReferencia = db.prepare(`SELECT v.id FROM vehiculos v WHERE v.referencia = ? AND ${enLaWeb}`);
  const porPost = db.prepare(`SELECT v.id FROM wp_posts w JOIN vehiculos v ON v.id = w.vehiculo_id WHERE w.wp_post_id = ? AND ${enLaWeb}`);

  r.post('/', express.urlencoded({ extended: true, limit: '200kb' }), (req, res, next) => {
    const esperado = process.env.FORMULARIOS_WEB_TOKEN;
    if (!esperado) return res.status(404).json({ error: 'No existe' });
    if (!tokenValido(req.query.token, esperado)) return res.status(401).json({ error: 'Token incorrecto' });

    const leido = aContacto(leerEnvio(req.body ?? {}), hostsDeFotos());
    if (leido.trampa) return res.json({ ok: true });
    const { contacto, referencia, wpPostId, fotos } = leido;
    // Sin teléfono ni correo no hay a quién contestar: se dice que bien (Elementor no lo enseñaría como error) y se avisa en el log
    if (!contacto.telefono && !contacto.email) {
      console.error('[contactos/elementor] envío sin teléfono ni correo: no se guarda');
      return res.json({ ok: true });
    }
    const vehiculoId = (referencia && porReferencia.get(referencia.trim().toUpperCase(), ...ESTADOS_WEB)?.id)
      || (wpPostId && porPost.get(wpPostId, ...ESTADOS_WEB)?.id) || null;

    let id;
    try {
      id = guardarContacto(db, { ...contacto, vehiculo_id: vehiculoId }, [], { fotosEnCamino: fotos.length });
    } catch (err) {
      return next(err);
    }
    res.json({ ok: true });
    if (fotos.length) {
      const p = descargarFotos(db, id, fotos).catch((e) => console.error(`[contactos/elementor] fotos del contacto ${id}:`, e))
        .finally(() => descargasEnCurso.delete(p));
      descargasEnCurso.add(p);
    }
  });

  return r;
}
