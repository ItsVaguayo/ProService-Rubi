// Página de fotos de un coche (panel/fotos.html?id=3): subir, marcar, ordenar y quitar.
// Todo pasa por la API de fotos; después de cada cambio se vuelve a pintar con lo que devuelve.
import { pide } from './api.js';

const MINIMO = 15;
const MAXIMO = 25;

// Los 15 huecos fijos, en el orden en que Jaume hace las fotos (duda D1: orden por defecto)
const HUECOS = [
  ['Frontal', 'De frente, con el coche centrado'],
  ['3/4 delantero izq.', 'Desde la esquina delantera izquierda'],
  ['Lateral izq.', 'El lado izquierdo entero'],
  ['3/4 trasero izq.', 'Desde la esquina trasera izquierda'],
  ['Trasera', 'De frente a la trasera'],
  ['3/4 trasero der.', 'Desde la esquina trasera derecha'],
  ['Lateral der.', 'El lado derecho entero'],
  ['3/4 delantero der.', 'Desde la esquina delantera derecha'],
  ['Interior delantero', 'Asientos delanteros y salpicadero'],
  ['Interior trasero', 'Asientos traseros'],
  ['Cuadro con km', 'Con el contacto puesto, que se lean los kilómetros'],
  ['Consola', 'Pantalla y mandos del centro'],
  ['Maletero', 'Abierto y vacío'],
  ['Motor', 'Con el capó abierto'],
  ['Llanta', 'La delantera, de cerca'],
];

// Fase de cada estado, para el color de la etiqueta (base.css: llegada, preparacion, venta, reservado, vendido)
const FASE = {
  pendiente_recoger: 'llegada', en_transporte: 'llegada', recibido: 'llegada',
  en_taller: 'preparacion', en_preparacion: 'preparacion', pendiente_fotos: 'preparacion',
  publicado: 'venta', reservado: 'reservado', vendido: 'vendido', entregado: 'vendido',
};

const $ = (sel) => document.querySelector(sel);
const vehiculoId = new URLSearchParams(location.search).get('id');
let fotos = [];
let ocupado = false; // mientras hay una petición en marcha no se aceptan más clics

const nombreHueco = (orden) => (orden <= HUECOS.length ? `${orden} · ${HUECOS[orden - 1][0]}` : `${orden} · Extra`);

// 2156MHB → 2156 MHB, como en la placa
const matricula = (m) => (m ?? '').replace(/^(\d{4})([A-Z]{3})$/, '$1 $2');

function avisar(mensaje) {
  const caja = $('[data-error]');
  caja.textContent = mensaje ?? '';
  caja.hidden = !mensaje;
}

// Envuelve cada acción: bloquea la página, enseña el error de la API si lo hay y vuelve a pintar
async function accion(fn) {
  if (ocupado) return;
  ocupado = true;
  document.body.classList.add('ocupado');
  avisar(null);
  try {
    const lista = await fn();
    if (Array.isArray(lista)) fotos = lista;
  } catch (err) {
    avisar(err.message);
  } finally {
    ocupado = false;
    document.body.classList.remove('ocupado');
    pintar();
  }
}

// --- Pintar ---------------------------------------------------------------

function pintar() {
  const porHueco = new Map(fotos.map((f) => [f.orden, f]));
  const lista = $('[data-lista]');
  lista.replaceChildren();

  for (let orden = 1; orden <= MAXIMO; orden++) {
    const foto = porHueco.get(orden);
    if (foto) lista.append(filaFoto(foto));
    else if (orden <= HUECOS.length) lista.append(filaHueco(orden));
  }
  pintarProgreso(porHueco);

  const caben = MAXIMO - fotos.length;
  $('[data-subida]').hidden = caben === 0;
  $('[data-subida-nota]').textContent =
    `Puedes subir varias a la vez, tal cual salen del móvil. Se colocan solas en el primer hueco libre. Caben ${caben} más.`;
}

function filaFoto(foto) {
  const fila = $('#plantilla-foto').content.firstElementChild.cloneNode(true);
  if (foto.es_dano) fila.classList.add('foto-fila--dano');

  const img = fila.querySelector('img');
  img.src = foto.url;
  img.alt = `Foto ${nombreHueco(foto.orden)}`;
  fila.querySelector('[data-nombre]').textContent = nombreHueco(foto.orden);
  fila.querySelector('[data-detalle]').textContent = foto.es_dano ? 'Daño' : foto.publica ? 'Sale en la web' : 'Solo interna';

  for (const casilla of fila.querySelectorAll('[data-campo]')) {
    const campo = casilla.dataset.campo;
    casilla.checked = Boolean(foto[campo]);
    casilla.name = `${campo}-${foto.id}`;
    casilla.addEventListener('change', () => marcar(foto, campo, casilla.checked));
  }

  for (const boton of fila.querySelectorAll('[data-mover]')) {
    const destino = foto.orden + Number(boton.dataset.mover);
    boton.disabled = destino < 1 || destino > MAXIMO;
    boton.addEventListener('click', () => mover(foto, destino));
  }

  fila.querySelector('[data-quitar]').addEventListener('click', () => quitar(foto));
  return fila;
}

function filaHueco(orden) {
  const fila = $('#plantilla-hueco').content.firstElementChild.cloneNode(true);
  fila.querySelector('[data-nombre]').textContent = nombreHueco(orden);
  fila.querySelector('[data-detalle]').textContent = HUECOS[orden - 1][1];
  return fila;
}

function pintarProgreso(porHueco) {
  // Mismo criterio que la API al publicar: públicas y que no sean daños
  const validas = fotos.filter((f) => f.publica && !f.es_dano).length;
  const faltanHuecos = HUECOS.map((h, i) => (porHueco.has(i + 1) ? null : h[0].toLowerCase())).filter(Boolean);

  $('[data-progreso="cifra"]').textContent = `${Math.min(validas, MINIMO)} de ${MINIMO}`;
  $('[data-progreso="barra"]').style.width = `${Math.min(100, Math.round((validas / MINIMO) * 100))}%`;

  let texto;
  if (validas >= MINIMO) texto = 'Ya se puede publicar';
  else {
    const faltan = MINIMO - validas;
    texto = `Faltan ${faltan} para poder publicar`;
    // Los nombres solo cuando quedan pocos; con muchos, la lista de abajo ya los enseña
    if (faltanHuecos.length && faltanHuecos.length <= 4) texto += `: ${unir(faltanHuecos)}`;
  }
  $('[data-progreso="texto"]').textContent = texto;
}

// ['a', 'b', 'c'] → 'a, b y c'
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

// --- Acciones ---------------------------------------------------------------

function subir(ficheros) {
  const imagenes = [...ficheros].filter((f) => f.type.startsWith('image/'));
  if (!imagenes.length) return avisar('Elige fotos en JPG o PNG.');
  const form = new FormData();
  for (const f of imagenes) form.append('fotos', f);
  $('[data-subida-nota]').textContent = `Subiendo ${imagenes.length} ${imagenes.length === 1 ? 'foto' : 'fotos'}…`;
  accion(async () => (await pide(`/fotos/${vehiculoId}`, { method: 'POST', body: form })).fotos);
}

function marcar(foto, campo, valor) {
  const cambios = { [campo]: valor };
  // Una foto de daño, por defecto, no sale en la web (se puede volver a marcar después)
  if (campo === 'es_dano' && valor) cambios.publica = false;
  accion(async () => {
    const nueva = await pide(`/fotos/${vehiculoId}/${foto.id}`, { method: 'PATCH', body: cambios });
    return fotos.map((f) => (f.id === nueva.id ? nueva : f));
  });
}

// Mover al hueco de al lado: si tiene foto, se intercambian; si está libre, se pasa a él
function mover(foto, destino) {
  const otra = fotos.find((f) => f.orden === destino);
  const orden = fotos.map((f) => ({
    id: f.id,
    orden: f.id === foto.id ? destino : f.id === otra?.id ? foto.orden : f.orden,
  }));
  accion(() => pide(`/fotos/${vehiculoId}/orden`, { method: 'PUT', body: { fotos: orden } }));
}

function quitar(foto) {
  if (!confirm(`¿Quitar la foto ${nombreHueco(foto.orden)}? No se puede deshacer.`)) return;
  accion(() => pide(`/fotos/${vehiculoId}/${foto.id}`, { method: 'DELETE' }));
}

// --- Arranque ---------------------------------------------------------------

async function cargarCoche() {
  const [coche, estados] = await Promise.all([pide(`/vehiculos/${vehiculoId}`), pide('/vehiculos/estados')]);
  const titulo = `${coche.marca} ${coche.modelo}`;
  document.title = `Fotos · ${titulo} ${matricula(coche.matricula)} · ProService`;
  $('[data-coche="titulo"]').textContent = `Fotos del ${titulo}`;
  $('[data-coche="matricula"]').textContent = matricula(coche.matricula);
  const estado = $('[data-coche="estado"]');
  estado.textContent = estados.find((e) => e.id === coche.estado)?.nombre ?? coche.estado;
  estado.className = `estado estado--${FASE[coche.estado] ?? 'llegada'}`;
  for (const a of document.querySelectorAll('[data-enlace-ficha]')) a.href = `coche.html?id=${vehiculoId}`;
}

function preparar() {
  const zona = $('[data-subida]');
  const input = zona.querySelector('input[type="file"]');
  input.addEventListener('change', () => {
    subir(input.files);
    input.value = ''; // para poder elegir otra vez las mismas
  });
  zona.addEventListener('dragover', (e) => {
    e.preventDefault();
    zona.classList.add('subida--encima');
  });
  zona.addEventListener('dragleave', () => zona.classList.remove('subida--encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    zona.classList.remove('subida--encima');
    subir(e.dataTransfer.files);
  });
  // Si una foto se suelta fuera de la zona, el navegador la abriría y se saldría de la página
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

if (!vehiculoId) {
  avisar('Falta el coche. Abre esta página desde la ficha de un coche (fotos.html?id=…).');
  $('[data-lista]').replaceChildren();
  $('[data-subida]').hidden = true;
} else {
  preparar();
  accion(async () => {
    await cargarCoche();
    return pide(`/fotos/${vehiculoId}`);
  });
}
