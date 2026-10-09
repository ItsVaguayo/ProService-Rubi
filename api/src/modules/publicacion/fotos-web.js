// Dueño: Victor. Traer las fotos de un coche desde su ficha de la web (briefing 4.5: las fotos viven hoy en el
// hosting de WordPress). Para el arranque: los coches del stock entran por la migración sin fotos y, en vez de
// rehacerlas, se bajan de la ficha que ya tienen en proservicerubi.com. Antes hay que vincular el coche con su
// ficha (POST /api/wordpress/vincular).
//
// El orden: la foto destacada, después la galería de ACF (si la web la expone) y si no, las adjuntas a la
// ficha por orden de subida. Jaume la ordena luego en el panel. Cada foto traída se apunta en wp_medios con su
// id de WordPress: la sincronización no la vuelve a subir.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cliente } from './wordpress.js';
import { reducirImagen, FOTOS_MAXIMAS, MB_POR_FOTO } from '../fotos/routes.js';
import { registrar } from '../auditoria.js';

export class ErrorFotosWeb extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

const BYTES_POR_FOTO = MB_POR_FOTO * 1024 * 1024;
const SALTOS_MAXIMOS = 3;
const deLaWeb = (url, origen) => url.host === origen && ['http:', 'https:'].includes(url.protocol);

/**
 * Baja una foto de la web. Las redirecciones se siguen a mano y solo dentro del mismo dominio: una dirección de
 * la web no puede llevar al servidor a pedir otra máquina (una interna, por ejemplo). Y se corta en cuanto pasa
 * de MB_POR_FOTO, aunque la web no diga el tamaño por adelantado.
 */
async function bajarFoto(fetchImpl, url, origen) {
  for (let saltos = 0; ; saltos++) {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30000), redirect: 'manual' });
    const destino = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (destino) {
      await res.body?.cancel();
      if (saltos >= SALTOS_MAXIMOS) throw new Error('demasiadas redirecciones');
      url = new URL(destino, url);
      if (!deLaWeb(url, origen)) throw new Error(`redirige fuera de ${origen}`);
      continue;
    }
    if (!res.ok) throw new Error(`la web respondió ${res.status}`);
    if (Number(res.headers.get('content-length')) > BYTES_POR_FOTO) throw new Error(`pasa de ${MB_POR_FOTO} MB`);
    const trozos = [];
    let total = 0;
    for await (const trozo of res.body ?? []) {
      total += trozo.length;
      if (total > BYTES_POR_FOTO) throw new Error(`pasa de ${MB_POR_FOTO} MB`); // salir del bucle cierra la descarga
      trozos.push(trozo);
    }
    return Buffer.concat(trozos);
  }
}

const idsDe = (valor) => [].concat(valor ?? []).map((x) => (typeof x === 'object' && x ? x.id ?? x.ID : x)).map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** Baja las fotos de la ficha de la web de un coche que aún no tiene ninguna. Devuelve { traidas, saltadas }. */
export async function traerFotosDeLaWeb(db, cfg, vehiculoId, { fetchImpl = fetch, usuarioId = null } = {}) {
  const v = db.prepare('SELECT id, referencia FROM vehiculos WHERE id = ?').get(vehiculoId);
  if (!v) throw new ErrorFotosWeb(404, 'No existe');
  const vinculo = db.prepare('SELECT wp_post_id FROM wp_posts WHERE vehiculo_id = ?').get(v.id);
  if (!vinculo) throw new ErrorFotosWeb(409, `${v.referencia} no está vinculado con ninguna ficha de la web: vincúlalo antes`);
  if (db.prepare('SELECT 1 FROM fotos WHERE vehiculo_id = ? LIMIT 1').get(v.id)) {
    throw new ErrorFotosWeb(409, `${v.referencia} ya tiene fotos: solo se traen de la web a un coche sin ninguna`);
  }

  const pedir = cliente(cfg, fetchImpl);
  const tipo = await pedir('GET', `/wp/v2/types/${encodeURIComponent(cfg.tipo)}?context=edit`);
  const post = await pedir('GET', `/wp/v2/${tipo.rest_base || cfg.tipo}/${vinculo.wp_post_id}?context=edit`);
  const campoGaleria = Object.values(cfg.mapa ?? {}).find((m) => m.formato === 'galeria')?.acf;

  // Qué fotos y en qué orden
  let medios = [];
  const galeria = idsDe(campoGaleria ? post.acf?.[campoGaleria] : null);
  const ids = [...new Set([...idsDe(post.featured_media), ...galeria])];
  for (const id of ids) {
    try { medios.push(await pedir('GET', `/wp/v2/media/${id}?context=edit`)); } catch { /* una que ya no existe: se salta */ }
  }
  if (!galeria.length) {
    const adjuntas = await pedir('GET', `/wp/v2/media?parent=${vinculo.wp_post_id}&media_type=image&per_page=100&orderby=id&order=asc&context=edit`);
    medios.push(...(adjuntas ?? []).filter((m) => !ids.includes(m.id)));
  }
  medios = medios.filter((m) => String(m.mime_type ?? '').startsWith('image/')).slice(0, FOTOS_MAXIMAS);
  if (!medios.length) throw new ErrorFotosWeb(409, `La ficha ${vinculo.wp_post_id} de la web no tiene fotos`);

  // Bajar y reducir. Solo del propio dominio de la web: la dirección la da WordPress y no se va a buscar fuera.
  const origen = new URL(cfg.url).host;
  const saltadas = [];
  const fotos = [];
  for (const m of medios) {
    let url;
    try { url = new URL(m.source_url); } catch { saltadas.push(`${m.id}: sin dirección`); continue; }
    if (!deLaWeb(url, origen)) { saltadas.push(`${m.id}: está fuera de ${origen}`); continue; }
    try {
      fotos.push({ wpId: m.id, jpg: await reducirImagen(await bajarFoto(fetchImpl, url, origen)) });
    } catch (e) {
      saltadas.push(`${m.id}: ${e.message}`);
    }
  }
  if (!fotos.length) throw new ErrorFotosWeb(502, `No se ha podido bajar ninguna foto: ${saltadas.join('; ')}`);

  const carpeta = cfg.uploads;
  const rutas = fotos.map(() => `${v.id}/${randomUUID()}.jpg`);
  try {
    await mkdir(join(carpeta, String(v.id)), { recursive: true });
    for (const [i, ruta] of rutas.entries()) await writeFile(join(carpeta, ruta), fotos[i].jpg);
    db.transaction(() => {
      if (db.prepare('SELECT 1 FROM fotos WHERE vehiculo_id = ? LIMIT 1').get(v.id)) {
        throw new ErrorFotosWeb(409, `${v.referencia} ya tiene fotos: alguien las ha subido mientras se bajaban estas`);
      }
      const foto = db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)');
      const medio = db.prepare('INSERT OR REPLACE INTO wp_medios (foto_id, wp_media_id) VALUES (?, ?)');
      const nuevas = rutas.map((ruta, i) => {
        const id = Number(foto.run(v.id, i + 1, ruta).lastInsertRowid);
        medio.run(id, fotos[i].wpId);
        return { id, orden: i + 1, wp_media_id: fotos[i].wpId };
      });
      registrar(db, { usuarioId, entidad: 'vehiculo', entidadId: v.id, accion: 'fotos_desde_web', despues: { wp_post_id: vinculo.wp_post_id, fotos: nuevas } });
    })();
  } catch (e) {
    await Promise.all(rutas.map((ruta) => rm(join(carpeta, ruta), { force: true })));
    throw e;
  }
  return { traidas: fotos.length, saltadas };
}
