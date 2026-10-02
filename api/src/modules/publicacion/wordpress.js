// Dueño: David. Publicación de los coches en el WordPress de la web por su API REST.
//
// Entra con un usuario Editor y una contraseña de aplicación: no hace falta ser administrador ni
// instalar nada en la web. Antes de escribir mira qué deja la web (diagnosticar) y solo manda eso:
//   - Siempre: título, estado y marca (es lo único que expone hoy proservicerubi.com en «coches»).
//   - Si el grupo de campos de ACF está expuesto en REST: precio, datos y galería de fotos.
// Reglas: nunca borra un post (un coche retirado pasa a borrador), cada foto se sube una vez,
// un coche sin cambios no se reenvía y una caída de WordPress no toca nada.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { ESTADOS_WEB } from '../estados.js';
import { caducarReservas } from '../vehiculos/reservas.js';

// Dato nuestro → campo ACF de la web, con los nombres que sugieren sus plantillas (1-oct-2026: etiquetas
// de su ficha y parámetros de su filtro). Los reales se confirman con el diagnóstico. «valores» traduce
// lo nuestro al texto que guarda su web. Se puede cambiar entero con WP_MAPA (JSON con la misma forma).
export const MAPA_POR_DEFECTO = {
  modelo: { acf: 'modelo', formato: 'texto' },
  pvp_cent: { acf: 'precio', formato: 'euros' },
  anio: { acf: 'anio', formato: 'numero' },
  kilometros: { acf: 'kilometros', formato: 'numero' },
  combustible: {
    acf: 'combustible', formato: 'texto',
    valores: { gasolina: 'Gasolina', diesel: 'Diésel', hibrido: 'Híbrido', hibrido_enchufable: 'Híbrido enchufable', electrico: 'Eléctrico', glp: 'GLP' },
  },
  potencia_cv: { acf: 'potencia', formato: 'numero' },
  cilindrada: { acf: 'cilindrada', formato: 'numero' },
  color_exterior: { acf: 'color', formato: 'capitalizar' },
  estado: { acf: 'estado', formato: 'texto', valores: { publicado: 'En venta', reservado: 'Reservado', vendido: 'Vendido' } },
  video_url: { acf: 'video', formato: 'texto' },
  fotos: { acf: 'galeria', formato: 'galeria' },
};

const TIPOS_IMAGEN = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export function configDesdeEntorno(env = process.env) {
  if (!env.WP_URL) return null;
  return {
    url: env.WP_URL.replace(/\/+$/, ''),
    usuario: env.WP_USUARIO || '',
    clave: env.WP_CLAVE_APLICACION || '',
    tipo: env.WP_TIPO || 'coches',
    taxonomia: env.WP_TAXONOMIA || 'marca',
    mapa: env.WP_MAPA ? JSON.parse(env.WP_MAPA) : MAPA_POR_DEFECTO,
    uploads: resolve(env.UPLOADS_PATH || './data/uploads'),
    fotosPorPasada: Number(env.WP_FOTOS_POR_PASADA || 40),
  };
}

export class ErrorWordPress extends Error {
  constructor(mensaje, status, codigo, datos) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.datos = datos;
  }
}

export function cliente(cfg, fetchImpl = fetch) {
  const auth = `Basic ${Buffer.from(`${cfg.usuario}:${cfg.clave}`).toString('base64')}`;
  return async function pedir(metodo, ruta, { json, cuerpo, cabeceras = {} } = {}) {
    let res;
    try {
      res = await fetchImpl(`${cfg.url}/wp-json${ruta}`, {
        method: metodo,
        headers: { Authorization: auth, Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
        body: json !== undefined ? JSON.stringify(json) : cuerpo,
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      throw new ErrorWordPress(`No se pudo conectar con ${cfg.url}: ${e.message}`, 0, 'sin_conexion');
    }
    const texto = await res.text();
    let datos = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { /* no es JSON */ }
    if (!res.ok) throw new ErrorWordPress(datos?.message || `WordPress respondió ${res.status}`, res.status, datos?.code, datos?.data);
    return datos;
  };
}

// --- Diagnóstico ---------------------------------------------------------------------------------

/** Qué deja hacer la web con estas credenciales. No escribe nada. */
export async function diagnosticar(cfg, fetchImpl = fetch) {
  const pedir = cliente(cfg, fetchImpl);
  const d = {
    url: cfg.url, sitio: null, conectado: false, autenticado: false, usuario: null, roles: [],
    puede: {}, tipo: null, rutaTipo: null, rutaMarca: null, camposEscribibles: [],
    acf: { expuesto: false, campos: {} }, mapa: [], avisos: [],
  };

  try {
    d.sitio = (await pedir('GET', '/'))?.name ?? null;
    d.conectado = true;
  } catch (e) {
    d.conectado = e.status > 0;
    d.avisos.push(e.status === 401 ? 'Usuario o contraseña de aplicación incorrectos.' : e.message);
    return d;
  }

  try {
    const yo = await pedir('GET', '/wp/v2/users/me?context=edit');
    d.autenticado = true;
    d.usuario = yo.slug;
    d.roles = yo.roles ?? [];
    const c = yo.capabilities ?? {};
    d.puede = { publicar: !!c.publish_posts, editar_otros: !!c.edit_others_posts, subir_fotos: !!c.upload_files, crear_marcas: !!c.manage_categories };
  } catch (e) {
    d.avisos.push(`Sin sesión en WordPress: ${e.message}`);
    return d;
  }

  try {
    const tipo = await pedir('GET', `/wp/v2/types/${encodeURIComponent(cfg.tipo)}?context=edit`);
    d.tipo = cfg.tipo;
    d.rutaTipo = tipo.rest_base || cfg.tipo;
    const esquema = await pedir('OPTIONS', `/wp/v2/${d.rutaTipo}`);
    const props = esquema?.schema?.properties ?? {};
    d.camposEscribibles = Object.keys(props).filter((k) => !props[k].readonly && !['id', 'guid', 'link', 'type', 'class_list', 'generated_slug', 'permalink_template', 'modified', 'modified_gmt'].includes(k));
    const acf = props.acf?.properties;
    d.acf.campos = acf && !Array.isArray(acf) ? acf : {};
    d.acf.expuesto = Object.keys(d.acf.campos).length > 0;
  } catch (e) {
    d.avisos.push(`El tipo de contenido «${cfg.tipo}» no existe o no está en la API REST: ${e.message}`);
    return d;
  }

  try {
    const tax = await pedir('GET', `/wp/v2/taxonomies/${encodeURIComponent(cfg.taxonomia)}?context=edit`);
    d.rutaMarca = tax.rest_base || cfg.taxonomia;
    if (!d.camposEscribibles.includes(d.rutaMarca)) d.rutaMarca = null;
  } catch {
    d.avisos.push(`La taxonomía «${cfg.taxonomia}» no está en la API REST: los coches irán sin marca.`);
  }

  d.mapa = Object.entries(cfg.mapa).map(([campo, destino]) => ({
    campo, acf: destino.acf, estado: d.acf.campos[destino.acf] ? 'ok' : d.acf.expuesto ? 'no existe en la web' : 'ACF no expuesto',
  }));

  if (!d.puede.publicar) d.avisos.push('El usuario no puede publicar: hace falta rol Editor (o Autor como mínimo).');
  if (!d.acf.expuesto) {
    d.avisos.push('Los campos de ACF no están expuestos en la API REST: solo se puede enviar título, estado y marca. '
      + 'Para mandar precio, datos y fotos, un administrador tiene que activar «Mostrar en la API REST» en el grupo de campos de ACF del tipo «coches».');
  } else {
    const faltan = d.mapa.filter((m) => m.estado !== 'ok').map((m) => m.acf);
    if (faltan.length) d.avisos.push(`Campos del mapa que la web no tiene: ${faltan.join(', ')}. Ajustar WP_MAPA a los nombres reales.`);
  }
  if (d.acf.expuesto && !d.puede.subir_fotos) d.avisos.push('El usuario no puede subir fotos: la galería no se enviará.');
  return d;
}

// --- Sincronización ------------------------------------------------------------------------------

export function convertir(valor, { formato, valores } = {}) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valores && Object.hasOwn(valores, valor)) return valores[valor];
  if (formato === 'euros') return Math.round(valor / 100);
  if (formato === 'numero') return Number(valor);
  if (formato === 'capitalizar') return String(valor).charAt(0).toLocaleUpperCase('es') + String(valor).slice(1);
  return String(valor);
}

/** Ajusta un valor al tipo que anuncia el esquema REST del campo (la web manda). */
export function adaptar(valor, esquema) {
  const tipos = [].concat(esquema?.type ?? []);
  if (valor === null || valor === undefined) return null;
  if (Array.isArray(valor)) return tipos.includes('array') ? valor : valor.join(',');
  if (tipos.includes('number') || tipos.includes('integer')) return Number(valor);
  if (tipos.includes('string')) return String(valor);
  return valor;
}

const huellaDe = (objeto) => createHash('sha1').update(JSON.stringify(objeto)).digest('hex');
let enMarcha = false;

export async function sincronizar(db, cfg, { forzar = false, fetchImpl = fetch } = {}) {
  if (enMarcha) throw new Error('Ya hay una sincronización con WordPress en marcha');
  enMarcha = true;
  try {
    caducarReservas(db); // que no se publique «Reservado» un coche cuya reserva ya venció
    return await sincronizarSinBloqueo(db, cfg, { forzar, fetchImpl });
  } finally {
    enMarcha = false;
  }
}

async function sincronizarSinBloqueo(db, cfg, { forzar, fetchImpl }) {
  const d = await diagnosticar(cfg, fetchImpl);
  if (!d.autenticado || !d.rutaTipo) throw new Error(`No se puede publicar en WordPress: ${d.avisos.join(' ')}`);

  const pedir = cliente(cfg, fetchImpl);
  const resumen = { creados: 0, actualizados: 0, sin_cambios: 0, retirados: 0, fotos_subidas: 0, fotos_pendientes: 0, errores: [], avisos: d.avisos };
  const visibles = db.prepare(`SELECT * FROM vehiculos WHERE estado IN (${ESTADOS_WEB.map(() => '?').join(',')}) ORDER BY id`).all(...ESTADOS_WEB);
  const vinculos = new Map(db.prepare('SELECT * FROM wp_posts').all().map((p) => [p.vehiculo_id, p]));
  const publicados = [...vinculos.values()].filter((p) => p.estado === 'publicado');

  if (!visibles.length && publicados.length && !forzar) {
    resumen.errores.push(`No hay coches a la venta y en WordPress hay ${publicados.length} publicados. No se retira nada sin forzar.`);
    return resumen;
  }

  const ctx = { db, cfg, d, pedir, resumen, marcas: new Map(), presupuesto: cfg.fotosPorPasada };
  for (const v of visibles) {
    try {
      resumen[await publicarCoche(ctx, v, vinculos.get(v.id))]++;
    } catch (e) {
      resumen.errores.push(`${v.referencia}: ${e.message}`);
      db.prepare("UPDATE wp_posts SET ultimo_error = ?, actualizado_en = datetime('now') WHERE vehiculo_id = ?").run(e.message, v.id);
    }
  }

  const aLaVenta = new Set(visibles.map((v) => v.id));
  for (const p of publicados) {
    if (aLaVenta.has(p.vehiculo_id)) continue;
    try {
      await pedir('POST', `/wp/v2/${d.rutaTipo}/${p.wp_post_id}`, { json: { status: 'draft' } });
      db.prepare("UPDATE wp_posts SET estado = 'retirado', huella = NULL, ultimo_error = NULL, actualizado_en = datetime('now') WHERE vehiculo_id = ?").run(p.vehiculo_id);
      resumen.retirados++;
    } catch (e) {
      resumen.errores.push(`Retirar el post ${p.wp_post_id}: ${e.message}`);
    }
  }
  return resumen;
}

async function publicarCoche(ctx, v, vinculo) {
  const { db, cfg, d, pedir } = ctx;
  const titulo = [v.marca, v.modelo, v.version].filter(Boolean).join(' ');
  const cuerpo = { title: titulo, status: 'publish' };

  if (d.rutaMarca && v.marca) cuerpo[d.rutaMarca] = [await idMarca(ctx, v.marca)];

  let fotosCompletas = true;
  if (d.acf.expuesto) {
    const acf = {};
    for (const [campo, destino] of Object.entries(cfg.mapa)) {
      const esquema = d.acf.campos[destino.acf];
      if (!esquema) continue;
      if (destino.formato === 'galeria') {
        if (!d.puede.subir_fotos) continue;
        const ids = await subirFotos(ctx, v);
        if (ids === null) { fotosCompletas = false; continue; }
        acf[destino.acf] = adaptar(ids, esquema);
      } else {
        acf[destino.acf] = adaptar(convertir(v[campo], destino), esquema);
      }
    }
    if (Object.keys(acf).length) cuerpo.acf = acf;
  }

  // Con fotos pendientes no se guarda la huella: la próxima pasada termina de subirlas.
  const huella = fotosCompletas ? huellaDe(cuerpo) : null;
  if (vinculo?.estado === 'publicado' && huella && vinculo.huella === huella) return 'sin_cambios';

  let post;
  let accion = vinculo ? 'actualizados' : 'creados';
  if (vinculo) {
    try {
      post = await pedir('POST', `/wp/v2/${d.rutaTipo}/${vinculo.wp_post_id}`, { json: cuerpo });
    } catch (e) {
      if (e.status !== 404) throw e;
      accion = 'creados'; // lo borraron a mano en WordPress: se vuelve a crear
    }
  }
  if (!post) post = await pedir('POST', `/wp/v2/${d.rutaTipo}`, { json: cuerpo });

  db.prepare(`INSERT INTO wp_posts (vehiculo_id, wp_post_id, huella, estado) VALUES (?, ?, ?, 'publicado')
              ON CONFLICT (vehiculo_id) DO UPDATE SET wp_post_id = excluded.wp_post_id, huella = excluded.huella,
                estado = 'publicado', ultimo_error = NULL, actualizado_en = datetime('now')`).run(v.id, post.id, huella);
  return accion;
}

async function idMarca(ctx, nombre) {
  const { pedir, d, marcas } = ctx;
  const clave = nombre.trim().toLowerCase();
  if (marcas.has(clave)) return marcas.get(clave);
  const encontradas = await pedir('GET', `/wp/v2/${d.rutaMarca}?search=${encodeURIComponent(nombre.trim())}&per_page=100`);
  let termino = encontradas.find((t) => t.name.trim().toLowerCase() === clave);
  if (!termino) {
    try {
      termino = await pedir('POST', `/wp/v2/${d.rutaMarca}`, { json: { name: nombre.trim() } });
    } catch (e) {
      if (e.codigo !== 'term_exists' || !e.datos?.term_id) throw e;
      termino = { id: e.datos.term_id };
    }
  }
  marcas.set(clave, termino.id);
  return termino.id;
}

/** Ids de WordPress de las fotos públicas del coche, en orden. null si quedan por subir. */
async function subirFotos(ctx, v) {
  const { db, cfg, pedir, resumen } = ctx;
  const fotos = db.prepare(`SELECT f.*, m.wp_media_id FROM fotos f LEFT JOIN wp_medios m ON m.foto_id = f.id
                             WHERE f.vehiculo_id = ? AND f.publica = 1 AND f.es_dano = 0 ORDER BY f.orden`).all(v.id);
  const ids = [];
  let pendientes = 0;
  for (const f of fotos) {
    if (f.wp_media_id) { ids.push(f.wp_media_id); continue; }
    if (ctx.presupuesto <= 0) { pendientes++; continue; }
    const ruta = resolve(cfg.uploads, f.ruta_photocall || f.ruta_original);
    if (!ruta.startsWith(cfg.uploads + sep)) throw new Error(`Ruta de foto fuera de la carpeta de subidas: ${f.ruta_original}`);
    const tipo = TIPOS_IMAGEN[extname(ruta).toLowerCase()];
    if (!tipo) { resumen.errores.push(`${v.referencia}: formato de foto no admitido (${extname(ruta)})`); continue; }
    ctx.presupuesto--;
    const nombre = `${v.referencia}-${String(f.orden).padStart(2, '0')}${extname(ruta).toLowerCase()}`;
    const medio = await pedir('POST', '/wp/v2/media', {
      cuerpo: await readFile(ruta),
      cabeceras: { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename="${nombre}"` },
    });
    db.prepare('INSERT INTO wp_medios (foto_id, wp_media_id) VALUES (?, ?)').run(f.id, medio.id);
    resumen.fotos_subidas++;
    ids.push(medio.id);
  }
  resumen.fotos_pendientes += pendientes;
  return pendientes ? null : ids;
}

/** Une un coche nuestro con un post que ya existía en la web (las 30 fichas hechas a mano). */
export function vincular(db, vehiculoId, wpPostId) {
  if (!db.prepare('SELECT 1 FROM vehiculos WHERE id = ?').get(vehiculoId)) throw new Error(`No existe el coche ${vehiculoId}`);
  const otro = db.prepare('SELECT vehiculo_id FROM wp_posts WHERE wp_post_id = ? AND vehiculo_id <> ?').get(wpPostId, vehiculoId);
  if (otro) throw new Error(`El post ${wpPostId} ya es del coche ${otro.vehiculo_id}`);
  db.prepare(`INSERT INTO wp_posts (vehiculo_id, wp_post_id, huella, estado) VALUES (?, ?, NULL, 'vinculado')
              ON CONFLICT (vehiculo_id) DO UPDATE SET wp_post_id = excluded.wp_post_id, huella = NULL, estado = 'vinculado'`).run(vehiculoId, wpPostId);
}
