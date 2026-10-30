// Dueño: David. Publicación de los coches en el WordPress de la web por su API REST.
//
// Entra con un usuario Editor y una contraseña de aplicación: no hace falta ser administrador ni
// instalar nada en la web. Antes de escribir mira qué deja la web (diagnosticar) y solo manda eso:
//   - Siempre: título, estado y marca (es lo único que expone hoy proservicerubi.com en «coches»).
//   - Si el grupo de campos de ACF está expuesto en REST (lo está desde el 30-oct): precio, datos y fotos.
// Reglas: nunca borra un post (un coche retirado pasa a borrador), cada foto se sube una vez,
// un coche sin cambios no se reenvía y una caída de WordPress no toca nada.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve, sep } from 'node:path';
import { ESTADOS_WEB } from '../estados.js';
import { caducarReservas } from '../vehiculos/reservas.js';
import { condicionesCuota, cuotaDe, textoCondiciones } from './cuota.js';
import { sinAcentos } from '../../buscar.js';
import { diaValido } from '../../fechas.js';

// Dato nuestro → campo ACF de la web, con los nombres reales de proservicerubi.com (leídos de su API REST el
// 30-oct-2026). «valores» traduce lo nuestro al texto de su web; en los campos de opciones cerradas (combustible,
// cambio, colores, extras, estado_coche) lo que no esté entre sus opciones no se manda (ver opcionDe).
// Se puede cambiar entero con WP_MAPA (JSON con la misma forma).
export const MAPA_POR_DEFECTO = {
  // Para el formulario de la ficha: dice a POST /api/contactos de qué coche se pregunta (B16: el campo ya existe)
  referencia: { acf: 'referencia', formato: 'texto' },
  pvp_cent: { acf: 'precio', formato: 'euros' },
  // «Desde X €/mes» (cuota.js), en su campo «financiado». Calculada aquí: no es una columna del coche.
  // cuota_condiciones solo se manda si la web tiene ese campo (hoy no: aviso propio en el diagnóstico); lleva el
  // ejemplo representativo con la TAE y el total adeudado, que la ley pide junto a la cuota.
  // vaciar: con la cuota apagada (CUOTA_MESES=0) se vacía a propósito, aunque un dato vacío no se mande nunca
  cuota: { acf: 'financiado', formato: 'numero', vaciar: true },
  cuota_condiciones: { acf: 'cuota_condiciones', formato: 'texto', opcional: true, vaciar: true },
  // Su «ano» es un selector de fecha (Ymd): la de matriculación o, sin ella, el 1 de enero del año
  fecha_ymd: { acf: 'ano', formato: 'texto' },
  kilometros: { acf: 'kilometros', formato: 'numero' },
  combustible: {
    acf: 'combustible', formato: 'texto',
    valores: { gasolina: 'Gasolina', diesel: 'Diésel', hibrido: 'Híbrido', hibrido_enchufable: 'Híbrido', electrico: 'Eléctrico', glp: 'GLP' },
  },
  cambio: { acf: 'cambio', formato: 'texto', valores: { manual: 'Manual', automatico: 'Automático' } },
  uso_anterior: { acf: 'uso_anterior', formato: 'texto', valores: { particular: 'Particular', profesional: 'Empresa' } },
  potencia_cv: { acf: 'potencia_cv', formato: 'numero' },
  cilindrada: { acf: 'cilindrada', formato: 'numero' },
  color_exterior: { acf: 'colores', formato: 'lista' },
  // Nuestro catálogo (migración 0003) con el nombre de su lista cuando dicen lo mismo con otras palabras
  extras: { acf: 'extras', formato: 'lista', valores: { 'Cámara de marcha atrás': 'Cámara trasera', Navegador: 'GPS', 'Llantas de aleación': 'Llantas aleación' } },
  estado: { acf: 'estado_coche', formato: 'texto', valores: { publicado: 'En venta', reservado: 'Reservado', vendido: 'Vendido' } },
  video_url: { acf: 'video', formato: 'texto' },
  // Su galería son las fotos adjuntas al post; «imagen_principal» es la primera
  fotos: { acf: 'imagen_principal', formato: 'fotos' },
};

/** La entrada del mapa de las fotos (formato «fotos»), o undefined. */
export const mapaDeFotos = (mapa) => Object.values(mapa ?? {}).find((m) => m.formato === 'fotos');

// Los formatos que entiende el conector (ver convertir); sin formato, texto.
export const FORMATOS = ['texto', 'numero', 'euros', 'capitalizar', 'lista', 'fotos'];

// Datos del mapa que no son columnas del coche: se calculan, y solo si el mapa los usa.
//   cuota y cuota_condiciones: cuota.js · fecha_ymd: su «ano» es un selector de fecha (Ymd), con la fecha de
//   matriculación o, sin ella, el 1 de enero del año · extras: los nombres de nuestro catálogo
const CALCULADOS = {
  cuota: (v, ctx) => cuotaDe(v, ctx.condiciones),
  cuota_condiciones: (v, ctx) => textoCondiciones(v, ctx.condiciones),
  fecha_ymd: (v) => (diaValido(v.fecha_matriculacion ?? '') ? v.fecha_matriculacion.replaceAll('-', '') : v.anio ? `${v.anio}0101` : null),
  extras: (v, ctx) => ctx.extrasDe.all(v.id).map((e) => e.nombre),
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
    cuota: condicionesCuota(env),
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

  const desconocidos = Object.entries(cfg.mapa).filter(([, m]) => !FORMATOS.includes(m.formato ?? 'texto')).map(([c, m]) => `${c} (${m.formato})`);
  if (desconocidos.length) d.avisos.push(`Formatos de WP_MAPA que el conector no entiende y no se mandan: ${desconocidos.join(', ')}. Las fotos van con formato «fotos».`);
  if (!d.puede.publicar) d.avisos.push('El usuario no puede publicar: hace falta rol Editor (o Autor como mínimo).');
  if (!d.acf.expuesto) {
    d.avisos.push('Los campos de ACF no están expuestos en la API REST: solo se puede enviar título, estado y marca. '
      + 'Para mandar precio, datos y fotos, un administrador tiene que activar «Mostrar en la API REST» en el grupo de campos de ACF del tipo «coches».');
  } else {
    const obligatorios = Object.entries(d.acf.campos).filter(([k, e]) => e.required && !Object.values(cfg.mapa).some((m) => m.acf === k)).map(([k]) => k);
    const campoFotos = mapaDeFotos(cfg.mapa)?.acf;
    if (d.acf.campos[campoFotos]?.required) d.avisos.push(`«${campoFotos}» es obligatorio en la web: el alta crea el post antes de subir sus fotos, así que no se publicará ningún coche nuevo.`);
    if (obligatorios.length) d.avisos.push(`Campos obligatorios de la web que el mapa no rellena: ${obligatorios.join(', ')}. Sin ellos no se publica ningún coche.`);
    const faltan = d.mapa.filter((m) => m.estado !== 'ok' && !cfg.mapa[m.campo].opcional).map((m) => m.acf);
    if (faltan.length) d.avisos.push(`Campos del mapa que la web no tiene: ${faltan.join(', ')}. Ajustar WP_MAPA a los nombres reales.`);
    // La cuota sin su ejemplo representativo (TAE y total adeudado) no cumple la Ley 16/2011 (cuota.js, duda E9)
    const estadoDe = (campo) => d.mapa.find((m) => m.campo === campo)?.estado;
    if (estadoDe('cuota') === 'ok' && estadoDe('cuota_condiciones') !== 'ok') {
      d.avisos.push('La web enseña la cuota «Desde X €/mes» pero no tiene el campo cuota_condiciones: el ejemplo con la TAE y el total '
        + 'adeudado no saldrá junto a la cuota. Crear ese campo de texto en ACF y enseñarlo en la ficha, o apagar la cuota (CUOTA_MESES=0).');
    }
  }
  if (d.acf.expuesto && !d.puede.subir_fotos) d.avisos.push('El usuario no puede subir fotos: las fotos no se enviarán.');
  return d;
}

// --- Sincronización ------------------------------------------------------------------------------

// El usuario de WordPress es Editor, y un Editor puede guardar HTML sin filtrar: un «<script>» escrito en el
// modelo saldría tal cual en la web pública. Ningún dato de un coche lleva < ni >, así que se quitan.
export const sinEtiquetas = (texto) => String(texto).replace(/[<>]/g, '');

const capitalizar = (valor) => {
  const texto = sinEtiquetas(valor);
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
};

export function convertir(valor, { formato, valores } = {}) {
  if (valor === null || valor === undefined || valor === '') return null;
  // Una lista (colores, extras): cada elemento traducido o con mayúscula; un valor suelto, lista de uno
  if (formato === 'lista') return [].concat(valor).map((v) => convertir(v, { formato: 'capitalizar', valores }));
  if (valores && Object.hasOwn(valores, valor)) return valores[valor];
  if (formato === 'euros') return Math.round(valor / 100);
  if (formato === 'numero') return Number(valor);
  if (formato === 'capitalizar') return capitalizar(valor);
  return sinEtiquetas(valor);
}

const normalizar = (texto) => sinAcentos(texto).trim().replace(/\s+/g, ' ');

/**
 * La opción de su lista cerrada que corresponde al valor, sin mirar mayúsculas ni tildes: «gris» → «Gris»,
 * y si no está tal cual, la más larga que empieza igual («Gris oscuro» → «Gris»; «Azul marino claro» → «Azul marino»
 * antes que «Azul»), o la única que empieza por el valor («marrón» → «Marrón Turmalina»). null si ninguna.
 */
function opcionDe(valor, opciones) {
  const v = normalizar(valor);
  const lista = normalizadas(opciones);
  const exacta = lista.find(([n]) => n === v) ?? lista.find(([n]) => v.startsWith(`${n} `));
  if (exacta) return exacta[1];
  // «marrón» frente a «Marrón Turmalina»: vale si es la única opción que empieza así
  const largas = lista.filter(([n]) => n.startsWith(`${v} `));
  return largas.length === 1 ? largas[0][1] : null;
}

// Cada lista de opciones se normaliza una vez (el esquema es el mismo en toda la pasada), de la más larga a la
// más corta para que gane la que más encaja
const cacheOpciones = new WeakMap();
function normalizadas(opciones) {
  if (!cacheOpciones.has(opciones)) {
    cacheOpciones.set(opciones, opciones.map((o) => [normalizar(o), o]).sort((a, b) => b[0].length - a[0].length));
  }
  return cacheOpciones.get(opciones);
}

/**
 * Ajusta un valor al tipo que anuncia el esquema REST del campo (la web manda). En un campo de opciones cerradas,
 * lo que no está entre ellas no se manda (WordPress rechazaría el post entero) y se apunta en `descartados`.
 */
export function adaptar(valor, esquema, descartados = []) {
  const tipos = [].concat(esquema?.type ?? []);
  if (valor === null || valor === undefined) return null;
  const opciones = esquema?.enum ?? esquema?.items?.enum;
  if (opciones) {
    const elegidas = [];
    for (const v of [].concat(valor)) {
      const o = opcionDe(v, opciones);
      if (o === null) descartados.push(v);
      else if (!elegidas.includes(o)) elegidas.push(o);
    }
    if (!Array.isArray(valor) && !elegidas.length) return null;
    valor = Array.isArray(valor) ? elegidas : elegidas[0];
  }
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

  const ctx = {
    db, cfg, d, pedir, resumen, marcas: new Map(), presupuesto: cfg.fotosPorPasada,
    // Sin cfg.cuota (pruebas antiguas, config a mano) va la de por defecto
    condiciones: cfg.cuota === undefined ? condicionesCuota({}) : cfg.cuota,
    extrasDe: db.prepare('SELECT e.nombre FROM vehiculo_extras ve JOIN extras e ON e.id = ve.extra_id WHERE ve.vehiculo_id = ? ORDER BY e.id'),
    fotosPublicas: db.prepare(`SELECT f.*, m.wp_media_id FROM fotos f LEFT JOIN wp_medios m ON m.foto_id = f.id
                               WHERE f.vehiculo_id = ? AND f.publica = 1 AND f.es_dano = 0 ORDER BY f.orden`),
    mediosDe: db.prepare('SELECT m.wp_media_id FROM wp_medios m JOIN fotos f ON f.id = m.foto_id WHERE f.vehiculo_id = ?'),
    // Las escrituras de la pasada llevan el post: si alguien vincula el coche a otro mientras tanto, no se pisa
    ponerPropias: db.prepare('UPDATE wp_posts SET fotos_propias = ? WHERE vehiculo_id = ? AND wp_post_id = ?'),
    ponerHuellaFotos: db.prepare('UPDATE wp_posts SET fotos_huella = ? WHERE vehiculo_id = ? AND wp_post_id = ?'),
    olvidarMedio: db.prepare('DELETE FROM wp_medios WHERE wp_media_id = ?'),
    apuntarMedio: db.prepare('INSERT INTO wp_medios (foto_id, wp_media_id) VALUES (?, ?)'),
    ponerHuella: db.prepare("UPDATE wp_posts SET huella = ?, estado = 'publicado', actualizado_en = datetime('now') WHERE vehiculo_id = ? AND wp_post_id = ?"),
    // Las fotos (adjuntas al post) van aunque la web no tenga el campo de la principal; la principal, solo si lo tiene
    mapaFotos: d.acf.expuesto && d.puede.subir_fotos ? mapaDeFotos(cfg.mapa) ?? null : null,
  };
  ctx.campoFotos = ctx.mapaFotos && d.acf.campos[ctx.mapaFotos.acf] ? ctx.mapaFotos.acf : null;
  // Con el post que se usó en la pasada: si alguien vincula el coche a otro mientras tanto, no se pisa su estado
  const estadoBien = db.prepare('UPDATE wp_posts SET ultimo_error = NULL, avisos = ? WHERE vehiculo_id = ? AND wp_post_id = ?');
  const estadoMal = db.prepare("UPDATE wp_posts SET ultimo_error = ?, avisos = NULL, actualizado_en = datetime('now') WHERE vehiculo_id = ?");
  for (const v of visibles) {
    try {
      const { accion, avisos, postId } = await publicarCoche(ctx, v, vinculos.get(v.id));
      resumen[accion]++;
      // Los avisos del coche (valores fuera de sus opciones, fotos bloqueadas) quedan en su estado (GET /wordpress/estado),
      // aparte de los errores; en el resumen, solo cuando se mandó algo
      const nota = avisos.join('\n') || null;
      const antes = vinculos.get(v.id);
      if (!antes || antes.wp_post_id !== postId || antes.ultimo_error || antes.avisos !== nota) estadoBien.run(nota, v.id, postId);
      if (accion !== 'sin_cambios') resumen.avisos.push(...avisos);
    } catch (e) {
      resumen.errores.push(`${v.referencia}: ${e.message}`);
      if (vinculos.get(v.id)?.ultimo_error !== e.message) estadoMal.run(e.message, v.id);
    }
  }

  const aLaVenta = new Set(visibles.map((v) => v.id));
  // El post que creamos para un coche que luego se vinculó a otra ficha: a borrador, o saldría dos veces en la web
  const enUso = new Set([...vinculos.values()].map((p) => p.wp_post_id));
  const olvidarAnterior = db.prepare('UPDATE wp_posts SET anterior_propio = 0 WHERE vehiculo_id = ?');
  const retirado = db.prepare("UPDATE wp_posts SET estado = 'retirado', huella = NULL, ultimo_error = NULL, actualizado_en = datetime('now') WHERE vehiculo_id = ?");
  // A borrador (nunca se borra). true si quedó retirado; un 404 (lo borraron a mano) también: ya no sale en la web
  const aBorrador = async (postId, que) => {
    try {
      await pedir('POST', `/wp/v2/${d.rutaTipo}/${postId}`, { json: { status: 'draft' } });
      resumen.retirados++;
      return true;
    } catch (e) {
      if (e.status === 404) return true;
      resumen.errores.push(`Retirar ${que} ${postId}: ${e.message}`);
      return false;
    }
  };
  for (const p of vinculos.values()) {
    if (!p.anterior_propio) continue;
    // Si ese post lo tiene ahora otro coche, es suyo: no se toca
    if (enUso.has(p.wp_post_anterior) || await aBorrador(p.wp_post_anterior, 'el post anterior')) olvidarAnterior.run(p.vehiculo_id);
  }

  for (const p of publicados) {
    if (!aLaVenta.has(p.vehiculo_id) && await aBorrador(p.wp_post_id, 'el post')) retirado.run(p.vehiculo_id);
  }
  return resumen;
}

/** Publica o actualiza el post de un coche. Devuelve { accion, avisos, postId }. */
async function publicarCoche(ctx, v, vinculo) {
  const { cfg, d, pedir, campoFotos } = ctx;
  const titulo = sinEtiquetas([v.marca, v.modelo, v.version].filter(Boolean).join(' '));
  const cuerpo = { title: titulo, status: 'publish' };

  const avisos = [];
  if (d.acf.expuesto) {
    const acf = {};
    const propio = !vinculo || vinculo.propio === 1;
    for (const [campo, destino] of Object.entries(cfg.mapa)) {
      const esquema = d.acf.campos[destino.acf];
      // Las fotos van aparte; un formato desconocido lo avisa el diagnóstico
      if (!esquema || destino.formato === 'fotos' || !FORMATOS.includes(destino.formato ?? 'texto')) continue;
      const valor = Object.hasOwn(CALCULADOS, campo) ? CALCULADOS[campo](v, ctx) : v[campo];
      const descartados = [];
      const adaptado = adaptar(convertir(valor, destino), esquema, descartados);
      if (descartados.length) avisos.push(`${v.referencia}: ${descartados.map((f) => `«${f}»`).join(', ')} no está entre las opciones de «${destino.acf}» de la web: no se manda`);
      // Un dato que no tenemos (o que no encaja en sus opciones) no se manda en una ficha hecha a mano: borraría lo que
      // pusieron (los coches de Pymecar llegan sin extras, color ni vídeo). En un post nuestro, o en los campos
      // marcados «vaciar», sí: se vacía (su ACF acepta null en sus listas, comprobado el 30-oct)
      const vacio = adaptado === null || adaptado === '' || (Array.isArray(adaptado) && !adaptado.length);
      if (vacio && !propio && !destino.vaciar) continue;
      acf[destino.acf] = adaptado;
    }
    // Su ACF rechaza el post entero si falta un obligatorio (precio, estado_coche). Un coche nuevo no se publica; en
    // una ficha que ya existe se actualiza lo demás (título, marca, fotos) sin tocar sus campos, y queda aviso.
    // La foto principal se añade después (y si la hacen obligatoria lo avisa el diagnóstico)
    const faltan = Object.entries(d.acf.campos).filter(([k, e]) => e.required && k !== campoFotos && acf[k] == null).map(([k]) => `«${k}»`);
    if (faltan.length && !vinculo) throw new Error(`falta ${faltan.join(', ')}, obligatorio en la web: no se publica`);
    if (faltan.length) avisos.push(`${v.referencia}: falta ${faltan.join(', ')}, obligatorio en la web: sus campos no se tocan`);
    else cuerpo.acf = acf;
  }

  if (d.rutaMarca && v.marca) cuerpo[d.rutaMarca] = [await idMarca(ctx, sinEtiquetas(v.marca))];

  // Un coche nuevo necesita su post antes que las fotos (van adjuntas a él)
  const fila = vinculo ?? await crearPost(ctx, v, cuerpo);
  try {
    // Con fotos pendientes (null) la próxima pasada termina de subirlas (fotos_huella sin poner); el post no se
    // reenvía por eso: su huella solo cambia con lo que se manda. La foto principal solo se toca en un post con fotos
    // nuestras: sin ninguna pública se vacía; en una ficha hecha a mano, se deja la suya.
    const fotos = ctx.mapaFotos ? await fotosDelPost(ctx, v, fila, avisos) : null;
    if (fotos?.bloqueo) avisos.push(fotos.bloqueo);
    // Sin los obligatorios no va ningún campo de ACF (cuerpo.acf), tampoco la principal: lo rechazaría entero
    const principal = cuerpo.acf && campoFotos && fotos?.propias ? { [campoFotos]: fotos.ids[0] ?? null } : null;
    const envio = principal ? { ...cuerpo, acf: { ...cuerpo.acf, ...principal } } : cuerpo;
    // La huella es de lo que manda el post sin la principal: la principal se compara con la primera foto cuadrada
    // la última vez (fotos_huella), y con fotos pendientes (sin principal) el post no cambia por eso
    const huella = huellaDe(cuerpo);
    const principalAntes = Number(String(vinculo?.fotos_huella ?? '').split(',')[0]) || null;
    const principalCambia = Boolean(principal) && principal[campoFotos] !== principalAntes;
    if (vinculo?.estado === 'publicado' && vinculo.huella === huella && !principalCambia) {
      return { accion: fotos?.cambio || (ctx.mapaFotos && fotos === null) ? 'actualizados' : 'sin_cambios', avisos, postId: fila.wp_post_id };
    }

    // El post recién creado ya lleva todo salvo la foto principal. Se reenvía entero: su ACF rechaza un «acf» sin
    // los campos obligatorios (precio, estado_coche), comprobado contra ACF el 30-oct
    if (vinculo || principal?.[campoFotos]) await pedir('POST', `/wp/v2/${d.rutaTipo}/${fila.wp_post_id}`, { json: envio });
    ctx.ponerHuella.run(huella, v.id, fila.wp_post_id);
    return { accion: vinculo ? 'actualizados' : 'creados', avisos, postId: fila.wp_post_id };
  } catch (e) {
    // Si lo borraron a mano en WordPress (subir una foto, adjuntarla o actualizarlo da 403 o 404), se vuelve a crear
    // y la pasada siguiente le vuelve a adjuntar nuestras fotos
    if (!vinculo || ![403, 404].includes(e.status) || await existe(ctx, `/wp/v2/${d.rutaTipo}/${fila.wp_post_id}`).catch(() => true)) throw e;
    // Sin los obligatorios no se crea un post nuevo, como en el alta
    if (d.acf.expuesto && !cuerpo.acf) throw new Error(`el post ${fila.wp_post_id} se borró en WordPress y faltan obligatorios para crearlo de nuevo`);
    const nuevo = await crearPost(ctx, v, cuerpo);
    return { accion: 'creados', avisos, postId: nuevo.wp_post_id };
  }
}

/** ¿Existe en WordPress? false si da 404; otro error, tal cual. */
async function existe(ctx, ruta) {
  try {
    await ctx.pedir('GET', `${ruta}?context=edit&_fields=id`);
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

/**
 * Crea el post (sin la foto principal) y lo apunta enseguida: si algo falla después, la pasada siguiente sigue
 * con ese post en vez de crear otro. Sus fotos adjuntas serán solo las nuestras.
 */
async function crearPost(ctx, v, cuerpo) {
  const post = await ctx.pedir('POST', `/wp/v2/${ctx.d.rutaTipo}`, { json: cuerpo });
  return ctx.db.prepare(`INSERT INTO wp_posts (vehiculo_id, wp_post_id, huella, estado, fotos_propias, fotos_huella, propio) VALUES (?, ?, NULL, 'publicado', ${FOTOS_PROPIAS}, NULL, 1)
                  ON CONFLICT (vehiculo_id) DO UPDATE SET wp_post_id = excluded.wp_post_id, huella = NULL, estado = 'publicado',
                    fotos_propias = ${FOTOS_PROPIAS}, fotos_huella = NULL, propio = 1, ultimo_error = NULL, actualizado_en = datetime('now')
                  RETURNING *`).get(v.id, post.id);
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

// wp_posts.fotos_propias (migración 0021): sin mirar, solo nuestras, o bloqueada por fotos subidas a mano
const FOTOS_SIN_MIRAR = 0;
const FOTOS_PROPIAS = 1;
const FOTOS_AJENAS = -1;

/** Las imágenes adjuntas a un post: su galería. Todas, de 100 en 100. */
export async function adjuntasDe(pedir, postId, extra = '') {
  const todas = [];
  for (let pagina = 1; ; pagina++) {
    let lote;
    try {
      lote = await pedir('GET', `/wp/v2/media?parent=${postId}&media_type=image&per_page=100&page=${pagina}${extra}`);
    } catch (e) {
      if (e.codigo === 'rest_post_invalid_page_number') return todas; // justo 100: la página siguiente no existe
      throw e;
    }
    todas.push(...lote);
    if (lote.length < 100) return todas;
  }
}

const avisoAjenas = (v, postId, n = null) => `${v.referencia}: el post ${postId} ya tiene ${n ?? 'otras'} fotos subidas a mano. Las nuestras no se suben `
  + 'hasta que se quiten de ese post en WordPress (Medios, «Desadjuntar») y se vuelva a vincular el coche.';

/**
 * Las fotos del coche en su post: sube las que falten (adjuntas a él) y, si el juego cambió, cuadra lo adjunto:
 * desadjunta lo que fue nuestro y ya no va (ocultas o borradas en el panel) y adjunta lo que está suelto. Lo que
 * suban a mano a un post nuestro se respeta, y nunca se borra nada de su biblioteca.
 * Devuelve { ids, propias, bloqueo? }, o null si quedan por subir.
 */
async function fotosDelPost(ctx, v, fila, avisos) {
  const { pedir } = ctx;
  if (fila.fotos_propias === FOTOS_AJENAS) return { ids: [], propias: false, bloqueo: avisoAjenas(v, fila.wp_post_id) };
  const idsAdjuntas = async () => (await adjuntasDe(pedir, fila.wp_post_id, '&_fields=id')).map((m) => m.id);
  // Nuestro es lo apuntado en wp_medios y lo que se cuadró la última vez (una foto borrada en el panel ya no está en
  // wp_medios). Solo hace falta si hay que decidir o cuadrar: no en la pasada de un coche sin cambios
  const nuestrasDe = () => new Set([...ctx.mediosDe.all(v.id).map((m) => m.wp_media_id),
    ...String(fila.fotos_huella ?? '').split(',').filter(Boolean).map(Number)]);
  const fotos = ctx.fotosPublicas.all(v.id);

  // Una ficha hecha a mano (recién vinculada): se decide una vez, en cuanto tengamos fotos públicas. Si habría que
  // añadirle alguna que no tiene y lleva otras que no son nuestras, saldrían mezcladas: se bloquea hasta que se
  // quiten y se revincule. Si todas las nuestras ya están en ella (las trajo «Traer fotos de la web»), no hay mezcla
  // aunque se dejara alguna suya sin traer.
  if (fila.fotos_propias === FOTOS_SIN_MIRAR) {
    if (!fotos.length) return { ids: [], propias: false };
    const adjuntas = await idsAdjuntas();
    const nuestras = nuestrasDe();
    const ajenas = adjuntas.filter((id) => !nuestras.has(id)).length;
    // Lo que habría que añadirle: fotos por subir, o nuestras ya subidas que no están en ella y se moverían (sueltas,
    // o del post anterior si se revinculó desde otro)
    let anadir = fotos.some((f) => !f.wp_media_id);
    const fuera = fotos.map((f) => f.wp_media_id).filter((id) => id && !adjuntas.includes(id));
    if (!anadir && ajenas && fuera.length) {
      const medios = await pedir('GET', `/wp/v2/media?include=${fuera.join(',')}&per_page=100&_fields=id,post`);
      anadir = medios.some((m) => !m.post || m.post === fila.wp_post_anterior);
    }
    const bloquear = ajenas && anadir;
    ctx.ponerPropias.run(bloquear ? FOTOS_AJENAS : FOTOS_PROPIAS, v.id, fila.wp_post_id);
    if (bloquear) return { ids: [], propias: false, bloqueo: avisoAjenas(v, fila.wp_post_id, ajenas) };
  }

  const ids = await subirFotos(ctx, v, fila.wp_post_id, fotos, avisos);
  if (ids === null) return null;
  const clave = ids.join(',');
  // Si nuestras fotos no cambiaron no se repasa (ni una petición): lo que toquen a mano en Medios se repara la próxima
  // vez que cambien en el panel o al revincular
  if (fila.fotos_huella === clave) return { ids, propias: true };
  const adjuntas = await idsAdjuntas();
  const nuestras = nuestrasDe();
  for (const id of adjuntas.filter((i) => !ids.includes(i) && nuestras.has(i))) await pedir('POST', `/wp/v2/media/${id}`, { json: { post: 0 } });
  // Se adjunta lo que falta (una sola petición para saber dónde está cada una): lo suelto y lo que quedó en el post
  // anterior de este coche (revinculado a otra ficha). Una foto adjunta a cualquier otro post se deja donde está.
  const faltan = ids.filter((i) => !adjuntas.includes(i));
  if (faltan.length) {
    const medios = await pedir('GET', `/wp/v2/media?include=${faltan.join(',')}&per_page=100&_fields=id,post`);
    for (const { id } of medios.filter((m) => !m.post || m.post === fila.wp_post_anterior)) {
      await pedir('POST', `/wp/v2/media/${id}`, { json: { post: fila.wp_post_id } });
    }
    // Una que no aparece se confirma una a una: si ya no está en su biblioteca (la borraron a mano), se olvida y la
    // pasada siguiente la vuelve a subir
    let perdidas = 0;
    for (const id of faltan.filter((i) => !medios.some((m) => m.id === i))) {
      if (await existe(ctx, `/wp/v2/media/${id}`)) continue;
      ctx.olvidarMedio.run(id);
      perdidas++;
    }
    if (perdidas) return null;
  }
  ctx.ponerHuellaFotos.run(clave, v.id, fila.wp_post_id);
  return { ids, propias: true, cambio: true };
}

/** Ids de WordPress de las fotos públicas del coche, en orden, subiendo adjuntas al post las que falten. null si quedan por subir. */
async function subirFotos(ctx, v, postId, fotos, avisos) {
  const { cfg, pedir, resumen } = ctx;
  const ids = [];
  let pendientes = 0;
  for (const f of fotos) {
    if (f.wp_media_id) { ids.push(f.wp_media_id); continue; }
    if (ctx.presupuesto <= 0) { pendientes++; continue; }
    const ruta = resolve(cfg.uploads, f.ruta_photocall || f.ruta_original);
    if (!ruta.startsWith(cfg.uploads + sep)) throw new Error(`Ruta de foto fuera de la carpeta de subidas: ${f.ruta_original}`);
    const tipo = TIPOS_IMAGEN[extname(ruta).toLowerCase()];
    if (!tipo) { avisos.push(`${v.referencia}: formato de foto no admitido (${extname(ruta)}): no se sube`); continue; }
    ctx.presupuesto--;
    const nombre = `${v.referencia}-${String(f.orden).padStart(2, '0')}${extname(ruta).toLowerCase()}`;
    const medio = await pedir('POST', `/wp/v2/media?post=${postId}`, {
      cuerpo: await readFile(ruta),
      cabeceras: { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename="${nombre}"` },
    });
    ctx.apuntarMedio.run(f.id, medio.id);
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
  // Revincular vuelve a mirar sus fotos: así se desbloquea una ficha a la que le han quitado las suyas
  db.prepare(`INSERT INTO wp_posts (vehiculo_id, wp_post_id, huella, estado) VALUES (?, ?, NULL, 'vinculado')
              ON CONFLICT (vehiculo_id) DO UPDATE SET wp_post_id = excluded.wp_post_id, huella = NULL, estado = 'vinculado',
                -- Revincular el mismo post nuestro no vuelve a mirar sus fotos (lo que suban a mano a un post nuestro se respeta)
                fotos_propias = CASE WHEN wp_posts.wp_post_id = excluded.wp_post_id AND wp_posts.propio = 1 THEN wp_posts.fotos_propias ELSE ${FOTOS_SIN_MIRAR} END,
                avisos = NULL, ultimo_error = NULL,
                -- A otro post: lo nuevo es una ficha hecha a mano, y el anterior, si era nuestro, se retira en la pasada. Si
                -- ya había uno nuestro pendiente de retirar, se conserva ese (no se pierde con dos revinculaciones seguidas)
                wp_post_anterior = CASE WHEN wp_posts.wp_post_id = excluded.wp_post_id OR wp_posts.anterior_propio = 1
                  THEN wp_posts.wp_post_anterior ELSE wp_posts.wp_post_id END,
                anterior_propio = CASE WHEN wp_posts.wp_post_id = excluded.wp_post_id OR wp_posts.anterior_propio = 1
                  THEN wp_posts.anterior_propio ELSE wp_posts.propio END,
                propio = CASE WHEN wp_posts.wp_post_id = excluded.wp_post_id THEN wp_posts.propio ELSE 0 END,
                fotos_huella = CASE WHEN wp_posts.wp_post_id = excluded.wp_post_id THEN wp_posts.fotos_huella END`).run(vehiculoId, wpPostId);
}
