// Panel conectado a la API (sistema de pruebas).
// Un solo módulo para todas las páginas: mira qué página es y la rellena con datos reales,
// usando las mismas clases que la maqueta. Las páginas sin endpoint todavía se quedan como
// maqueta y lo dicen arriba.

// --- Utilidades --------------------------------------------------------------------------------

const PAGINA = location.pathname.split('/').pop() || 'index.html';
const params = new URLSearchParams(location.search);

async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${ruta}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && PAGINA !== 'login.html') {
    // Al entrar se vuelve a esta misma página (ver destinoTrasEntrar)
    location.href = `login.html?volver=${encodeURIComponent(PAGINA + location.search)}`;
    throw new Error('Sin sesión');
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(datos?.error || res.statusText);
    error.status = res.status;
    error.lista = datos?.motivos || datos?.errores || [datos?.error || res.statusText];
    throw error;
  }
  return datos;
}

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cifra = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }));
const euros = (cent) => (cent == null ? '—' : `${cifra(cent / 100)} €`);
const fechaSql = (s) => (s ? new Date(`${s.replace(' ', 'T')}Z`) : null);
const diasDesde = (s) => (s ? Math.max(0, Math.floor((Date.now() - fechaSql(s)) / 86400000)) : null);
const fechaCorta = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('es-ES') : '—');
const fechaHora = (s) => fechaSql(s).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
// Las fotos se piden a la API con sesión (las de daños y las de coches sin publicar no son públicas)
const portada = (v) => (v.foto_portada_id ? `/api/fotos/${v.id}/${v.foto_portada_id}/archivo` : '../img/coche.svg');
const $ = (sel, raiz = document) => raiz.querySelector(sel);

// Nombres cortos y fase (color) de cada estado, como en la maqueta
const ESTADOS = [
  ['pendiente_recoger', 'Pendiente de recoger', 'llegada'],
  ['en_transporte', 'En transporte', 'llegada'],
  ['recibido', 'Recibido, sin revisar', 'llegada'],
  ['en_taller', 'En taller', 'preparacion'],
  ['en_preparacion', 'Preparación y limpieza', 'preparacion'],
  ['pendiente_fotos', 'Pendiente de fotos', 'preparacion'],
  ['publicado', 'Publicado', 'venta'],
  ['reservado', 'Reservado', 'reservado'],
  ['vendido', 'Vendido, sin entregar', 'vendido'],
  ['entregado', 'Entregado', 'vendido'],
].map(([id, nombre, fase]) => ({ id, nombre, fase }));
const estado = (id) => ESTADOS.find((e) => e.id === id) ?? { id, nombre: id, fase: 'llegada' };
const etiquetaEstado = (id) => `<span class="estado estado--${estado(id).fase}">${esc(estado(id).nombre)}</span>`;

const NOMBRES = {
  gasolina: 'Gasolina', diesel: 'Diésel', hibrido: 'Híbrido', hibrido_enchufable: 'Híbrido enchufable', electrico: 'Eléctrico', glp: 'GLP',
  manual: 'Manual', automatico: 'Automático', delantera: 'Delantera', trasera: 'Trasera', total: 'Total',
  patio_taller: 'Patio del taller', parking: 'Parking', propio: 'Propio', deposito: 'En depósito', suv: 'SUV',
};
const nombre = (v) => (v == null || v === '' ? '—' : NOMBRES[v] ?? String(v).charAt(0).toUpperCase() + String(v).slice(1));
const tituloCoche = (v) => [v.marca, v.modelo, v.version].filter(Boolean).join(' ');
const matricula = (m) => esc(String(m ?? '').replace(/^(\d{4})([A-Z]{3})$/, '$1 $2'));
const urlCoche = (v) => `coche.html?id=${v.id}`;

// Días con el mismo aviso que la maqueta: ámbar > 5, rojo > 14 (a la venta, > 60)
function claseDias(v, dias) {
  const aVenta = ['publicado', 'reservado'].includes(v.estado);
  if (dias > (aVenta ? 60 : 14)) return 'dias dias--peligro';
  if (!aVenta && dias > 5) return 'dias dias--aviso';
  return 'dias';
}

/** Pone un valor en un campo, sea caja de texto, desplegable o grupo de botones de opción. */
function fijarValor(form, nombre, valor) {
  const campo = form.elements[nombre];
  if (!campo) return;
  if (campo instanceof RadioNodeList || campo.type === 'radio') {
    form.querySelectorAll(`input[name="${nombre}"]`).forEach((r) => { r.checked = String(r.value) === String(valor ?? ''); });
  } else {
    campo.value = valor ?? '';
  }
}

function mostrarErrores(caja, error, titulo) {
  if (!caja) return alert(error.message);
  caja.innerHTML = `<strong>${esc(titulo)}</strong><ul>${error.lista.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
  caja.hidden = false;
  caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function avisoMaqueta() {
  const main = $('main.contenido') || $('main');
  const aviso = document.createElement('p');
  aviso.setAttribute('role', 'note');
  aviso.style.cssText = 'padding:10px 14px;border-radius:6px;background:var(--aviso-fondo);color:var(--aviso);font-size:.875rem;margin:0 0 16px';
  aviso.innerHTML = '<strong>Maqueta.</strong> Esta pantalla aún no está conectada a la API: los datos son de ejemplo.';
  // Debajo de la banda negra: encima, la banda (que sube con margen negativo) lo taparía
  const banda = main.querySelector(':scope > .cabecera--portada, :scope > .portada, :scope > .ficha-cabecera');
  banda ? banda.after(aviso) : main.prepend(aviso);
}

// --- Menú común --------------------------------------------------------------------------------

function prepararMenu(usuario) {
  const caja = $('.menu__usuario');
  if (caja) {
    caja.innerHTML = `<strong>${esc(usuario.nombre)}</strong> ${usuario.rol === 'gerencia' ? 'Gerencia' : 'Comercial'} · <a href="#" data-salir>Salir</a>`;
    $('[data-salir]', caja).addEventListener('click', async (ev) => {
      ev.preventDefault();
      await api('/auth/salir', { method: 'POST' }).catch(() => {});
      location.href = 'login.html';
    });
  }
  // Contactos aún no tiene endpoint: el contador de la maqueta es inventado
  document.querySelectorAll('.menu__enlaces .contador').forEach((c) => c.remove());
  if (usuario.rol !== 'gerencia') {
    document.querySelectorAll('a[href="informes.html"], a[href="usuarios.html"]').forEach((a) => a.remove());
  }
}

// --- Entrar ------------------------------------------------------------------------------------

// Tras entrar se vuelve a la página que pidió la sesión (?volver=fotos.html?id=3). Solo vale una página
// del panel: un nombre .html, sin barras ni protocolo, para que nadie pueda mandar a otra web.
function destinoTrasEntrar() {
  const volver = params.get('volver') ?? '';
  return /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(volver) && !volver.startsWith('login.html') ? volver : 'index.html';
}

async function paginaLogin() {
  try {
    await api('/auth/yo');
    location.href = destinoTrasEntrar();
    return;
  } catch { /* sin sesión: se queda aquí */ }
  const form = $('.login__form');
  const error = $('.error', form);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;
    const datos = Object.fromEntries(new FormData(form));
    try {
      await api('/auth/entrar', { method: 'POST', body: { email: datos.email, contrasena: datos.contrasena } });
      location.href = destinoTrasEntrar();
    } catch (e) {
      error.textContent = e.status === 429 ? e.message : 'El correo o la contraseña no son correctos. Revisa las mayúsculas.';
      error.hidden = false;
    }
  });
}

// --- Tablero -----------------------------------------------------------------------------------

async function paginaTablero() {
  const todos = await api('/vehiculos');
  const ubicacion = params.get('ubicacion');
  const enStock = todos.filter((v) => v.estado !== 'entregado' && (!ubicacion || v.ubicacion === ubicacion));

  // Portada: total, publicados, sin publicar todavía (de «Pendiente de recoger» a «Pendiente de fotos»)
  // y con más de 60 días a la venta, que lleva el aviso solo si hay alguno.
  const ANTES_DE_PUBLICAR = ESTADOS.slice(0, ESTADOS.findIndex((e) => e.id === 'publicado')).map((e) => e.id);
  const portada = {
    total: enStock.length,
    publicados: enStock.filter((v) => v.estado === 'publicado').length,
    sinPublicar: enStock.filter((v) => ANTES_DE_PUBLICAR.includes(v.estado)).length,
    parados: enStock.filter((v) => v.estado === 'publicado' && diasDesde(v.en_estado_desde) > 60).length,
  };
  const titular = $('.portada__titular .cifra');
  if (titular) titular.textContent = portada.total;
  const datos = document.querySelectorAll('.portada__datos li');
  [portada.publicados, portada.sinPublicar, portada.parados].forEach((n, i) => {
    if (datos[i]) datos[i].querySelector('strong').textContent = n;
  });
  datos[2]?.classList.toggle('portada__alerta', portada.parados > 0);

  // Barra de estados: cuántos hay en cada uno y qué parte del stock son (--p)
  document.querySelectorAll('.estados__paso').forEach((paso) => {
    const id = new URL(paso.href, location.href).searchParams.get('estado');
    const n = todos.filter((v) => v.estado === id && (!ubicacion || v.ubicacion === ubicacion)).length;
    paso.querySelector('.estados__n').textContent = n;
    paso.style.setProperty('--p', todos.length ? (n / todos.length).toFixed(2) : 0);
    paso.classList.toggle('estados__paso--vacio', n === 0);
  });

  // Para hoy: lo que se puede deducir de los datos que ya hay
  const tareas = [];
  const hoy = (texto, v, ir, urgente) => tareas.push({ texto, url: urlCoche(v), ir, urgente });
  for (const v of enStock) {
    const dias = diasDesde(v.en_estado_desde);
    const coche = `${v.marca} ${v.modelo}`;
    if (v.estado === 'vendido') hoy(`El ${coche} está vendido y falta entregarlo`, v, 'Entregar', true);
    if (v.estado === 'publicado' && dias > 60) hoy(`El ${coche} lleva ${dias} días a la venta`, v, 'Revisar precio', false);
    if (v.estado === 'en_taller' && dias > 14) hoy(`El ${coche} lleva ${dias} días en el taller`, v, 'Ver', false);
    if (v.estado === 'pendiente_fotos') hoy(`El ${coche} tiene ${v.n_fotos} de 15 fotos`, v, 'Subir fotos', false);
    if (v.itv_caducidad && (new Date(v.itv_caducidad) - Date.now()) / 86400000 < 30) {
      hoy(`La ITV del ${coche} caduca el ${fechaCorta(v.itv_caducidad)}`, v, 'Ver', true);
    }
  }
  $('.para-hoy ul').innerHTML = tareas.length
    ? tareas.sort((a, b) => b.urgente - a.urgente).map((t) => `<li><a href="${t.url}"><span class="para-hoy__cifra${t.urgente ? ' para-hoy__cifra--hoy' : ''}">1</span><span>${esc(t.texto)}</span><span class="para-hoy__ir">${esc(t.ir)}</span></a></li>`).join('')
    : '<li><span class="nota">Nada urgente hoy.</span></li>';

  // Pestañas de ubicación
  const pestanas = document.querySelectorAll('.pestanas a');
  const destinos = ['index.html', 'index.html?ubicacion=patio_taller', 'index.html?ubicacion=parking'];
  pestanas.forEach((a, i) => {
    a.href = destinos[i];
    const actual = (i === 0 && !ubicacion) || destinos[i].endsWith(`=${ubicacion}`);
    actual ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });

  // Columnas: una por estado, sin «Entregado»
  $('.tablero').innerHTML = ESTADOS.filter((e) => e.id !== 'entregado').map((e) => {
    const coches = enStock.filter((v) => v.estado === e.id);
    const fichas = coches.map((v) => {
      const dias = diasDesde(v.en_estado_desde);
      return `<a class="ficha-mini" href="${urlCoche(v)}">
          <span class="matricula">${matricula(v.matricula)}</span>
          <span class="ficha-mini__coche">${esc(tituloCoche(v))}</span>
          <span class="ficha-mini__datos"><span class="cifra">${v.kilometros != null ? `${cifra(v.kilometros)} km` : 'Sin km'}</span><span class="${claseDias(v, dias)} cifra">${dias} ${dias === 1 ? 'día' : 'días'}</span></span>
        </a>`;
    }).join('');
    return `<div class="columna columna--${e.fase}">
        <h2 class="columna__titulo">${esc(e.nombre)} <span class="cifra">${coches.length}</span></h2>
        ${fichas || '<p class="columna__vacia">Ningún coche</p>'}
      </div>`;
  }).join('');
}

// --- Listado -----------------------------------------------------------------------------------

async function paginaListado() {
  const todos = await api('/vehiculos');
  const form = $('form.filtros');

  // La maqueta pone el texto visible como valor: se le da el que entiende la API.
  // Sirve igual con desplegables que con botones de opción (el rediseño usa botones).
  const VALORES = {
    estado: Object.fromEntries(ESTADOS.map((e) => [e.nombre, e.id])),
    propiedad: { Propios: 'propio', 'En depósito': 'deposito' },
    ubicacion: { 'Patio del taller': 'patio_taller', Parking: 'parking' },
  };
  for (const [nombre, valores] of Object.entries(VALORES)) {
    form.querySelectorAll(`[name="${nombre}"] option, input[name="${nombre}"]`).forEach((op) => {
      if (valores[op.value]) op.value = valores[op.value];
      else if (op.tagName === 'OPTION' && !op.getAttribute('value') && valores[op.textContent.trim()]) op.value = valores[op.textContent.trim()];
    });
  }
  const valor = (nombre) => form.elements[nombre]?.value ?? '';
  for (const campo of ['q', 'estado', 'propiedad', 'ubicacion']) {
    if (params.get(campo)) fijarValor(form, campo, params.get(campo));
  }

  const enStock = todos.filter((v) => v.estado !== 'entregado');
  $('.cabecera .nota').textContent = `${enStock.length} en stock · ${enStock.filter((v) => v.propiedad === 'deposito').length} de terceros en depósito`;

  const pintar = () => {
    const q = form.elements.q.value.trim().toLowerCase().replace(/\s/g, '');
    const f = { estado: valor('estado'), propiedad: valor('propiedad'), ubicacion: valor('ubicacion') };
    const lista = todos.filter((v) =>
      (!q || `${v.matricula}${v.marca}${v.modelo}${v.version ?? ''}`.toLowerCase().replace(/\s/g, '').includes(q)) &&
      (!f.estado || v.estado === f.estado) && (!f.propiedad || v.propiedad === f.propiedad) && (!f.ubicacion || v.ubicacion === f.ubicacion));

    $('.tabla tbody').innerHTML = lista.map((v) => {
      const dias = diasDesde(v.creado_en);
      return `<tr>
        <td><img class="miniatura" src="${portada(v)}" alt=""></td>
        <td><a href="${urlCoche(v)}"><span class="matricula">${matricula(v.matricula)}</span></a></td>
        <td><span class="coche-celda"><a href="${urlCoche(v)}">${esc(tituloCoche(v))}</a><span class="nota">${esc([v.anio, v.combustible && nombre(v.combustible).toLowerCase(), v.cambio && nombre(v.cambio).toLowerCase(), v.propiedad === 'deposito' ? 'depósito' : 'propio'].filter(Boolean).join(' · '))}</span></span></td>
        <td>${etiquetaEstado(v.estado)}</td>
        <td class="derecha cifra">${cifra(v.kilometros)}</td>
        <td class="derecha cifra">${euros(v.pvp_cent)}</td>
        <td class="derecha cifra"><span class="${claseDias({ estado: 'publicado' }, dias)}">${dias}</span></td>
        <td>${v.ubicacion ? esc(nombre(v.ubicacion)) : '—'}</td>
      </tr>`;
    }).join('');
    $('.tabla-caja').hidden = !lista.length;
    $('.vacio').hidden = !!lista.length;
  };

  form.addEventListener('input', pintar);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); pintar(); });
  pintar();
}

// --- Ficha -------------------------------------------------------------------------------------

// Los mismos que exige la API (api/src/modules/vehiculos/campos.js), para la barra de progreso del alta
const OBLIGATORIOS_ALTA = ['matricula', 'marca', 'modelo'];
const OBLIGATORIOS_PUBLICAR = [
  'matricula', 'bastidor', 'marca', 'modelo', 'version', 'anio', 'fecha_matriculacion', 'kilometros',
  'combustible', 'cambio', 'potencia_cv', 'cilindrada', 'traccion', 'emisiones_co2', 'etiqueta_dgt',
  'carroceria', 'puertas', 'plazas', 'color_exterior', 'tapiceria', 'llantas', 'ubicacion', 'pvp_cent', 'regimen_iva',
];
const NOMBRES_CAMPO = { matricula: 'matrícula', marca: 'marca', modelo: 'modelo' };

const HUECOS = ['Frontal', '3/4 delantero izq.', 'Lateral izq.', '3/4 trasero izq.', 'Trasera', '3/4 trasero der.', 'Lateral der.', '3/4 delantero der.',
  'Interior delantero', 'Interior trasero', 'Cuadro con km', 'Consola', 'Maletero', 'Motor', 'Llanta'];

async function paginaFicha(usuario) {
  const id = Number(params.get('id'));
  if (!id) return (location.href = 'coches.html');
  if (PAGINA === 'coche-reservado.html') return (location.href = `coche.html?id=${id}`);

  const [v, fotos, extras, historial, reserva] = await Promise.all([
    api(`/vehiculos/${id}`), api(`/fotos/${id}`), api(`/vehiculos/${id}/extras`), api(`/vehiculos/${id}/historial`), api(`/vehiculos/${id}/reserva`),
  ]);
  const gerencia = usuario.rol === 'gerencia';
  document.title = `${tituloCoche(v)} · ProService`;

  // Cabecera
  $('.ficha-cabecera__foto').src = portada(v);
  $('.ficha-cabecera__foto').alt = `${v.marca} ${v.modelo}, foto frontal`;
  $('.ficha-cabecera__linea').innerHTML = `<span class="matricula matricula--grande">${matricula(v.matricula)}</span>${etiquetaEstado(v.estado)}`;
  $('.ficha-cabecera__info h1').textContent = tituloCoche(v);
  $('.ficha-cabecera__info > .nota').textContent = [v.anio, v.kilometros != null && `${cifra(v.kilometros)} km`, v.combustible && nombre(v.combustible),
    v.cambio && nombre(v.cambio), v.propiedad === 'deposito' ? 'En depósito' : 'Propio', v.ubicacion && nombre(v.ubicacion), `Ref. ${v.referencia}`].filter(Boolean).join(' · ');
  const lineaPrecio = document.querySelectorAll('.ficha-cabecera__linea')[1];
  lineaPrecio.innerHTML = `<span class="ficha-cabecera__precio cifra">${euros(v.pvp_cent)}</span><span class="nota">${diasDesde(v.creado_en)} días en stock</span>`;

  // Cambiar estado
  const formEstado = $('.cambiar-estado');
  const selEstado = formEstado.elements.estado;
  selEstado.innerHTML = ESTADOS.filter((e) => e.id !== v.estado).map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('');
  formEstado.querySelector('a[href="coche-nuevo.html"]').href = `coche-nuevo.html?id=${id}`;
  const cajaError = $('.error--lista');
  formEstado.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (selEstado.value === 'reservado') {
      $('#reserva').scrollIntoView({ behavior: 'smooth' });
      return mostrarErrores(cajaError, { lista: ['Para reservar, rellena el cliente y la señal en el bloque «Reserva».'] }, 'Falta la reserva:');
    }
    try {
      await api(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado: selEstado.value } });
      location.reload();
    } catch (e) {
      mostrarErrores(cajaError, e, `No se puede pasar a «${estado(selEstado.value).nombre}» todavía:`);
    }
  });

  // Recorrido
  const indice = ESTADOS.findIndex((e) => e.id === v.estado);
  document.querySelectorAll('.recorrido li').forEach((li, i) => {
    li.className = i < indice ? 'hecho' : i === indice ? 'actual' : '';
    i === indice ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
  });

  // Datos
  const fila = (dt, dd, esCifra) => `<div><dt>${dt}</dt><dd${esCifra ? ' class="cifra"' : ''}>${esc(dd ?? '—')}</dd></div>`;
  $('dl.datos').innerHTML = [
    fila('Bastidor', v.bastidor, true), fila('Año', v.anio, true), fila('1.ª matriculación', v.fecha_matriculacion && fechaCorta(v.fecha_matriculacion), true),
    fila('Kilómetros', v.kilometros != null ? cifra(v.kilometros) : null, true), fila('Combustible', nombre(v.combustible)), fila('Cambio', nombre(v.cambio)),
    fila('Potencia', v.potencia_cv != null ? `${v.potencia_cv} CV` : null, true), fila('Cilindrada', v.cilindrada != null ? `${cifra(v.cilindrada)} cc` : null, true),
    fila('Tracción', nombre(v.traccion)), fila('Emisiones', v.emisiones_co2 != null ? `${v.emisiones_co2} g/km` : null, true),
    fila('Etiqueta DGT', v.etiqueta_dgt), fila('Carrocería', nombre(v.carroceria)),
    fila('Puertas / plazas', v.puertas || v.plazas ? `${v.puertas ?? '—'} / ${v.plazas ?? '—'}` : null, true), fila('Color', nombre(v.color_exterior)),
    fila('Tapicería', nombre(v.tapiceria)), fila('Llantas', v.llantas), fila('ITV hasta', v.itv_caducidad && fechaCorta(v.itv_caducidad), true),
    fila('Última revisión', v.ultima_revision && fechaCorta(v.ultima_revision), true), fila('Garantía', v.garantia_meses != null ? `${v.garantia_meses} meses` : null, true),
    fila('Llaves', v.num_llaves, true),
  ].join('');

  // Fotos
  const enWeb = fotos.filter((f) => f.publica && !f.es_dano).length;
  $('#fotos .caja__titulo .nota').innerHTML = `<strong class="cifra">${fotos.length}</strong> fotos · ${enWeb} en la web · mínimo 15`;
  $('#fotos .fotos').innerHTML = fotos.map((f) => `<li class="foto"><img src="${esc(f.url)}" alt="" loading="lazy"><span class="foto__nombre">${f.es_dano
    ? `Daño <span class="foto__marca">Daño</span>` : `${esc(f.orden)} · ${esc(HUECOS[f.orden - 1] ?? 'Extra')}`}</span></li>`).join('')
    + `<li class="foto"><a class="foto__hueco" href="fotos.html?id=${id}">+ Añadir</a></li>`;
  $('#fotos .caja__titulo a[href="fotos.html"]')?.setAttribute('href', `fotos.html?id=${id}`);

  // Equipamiento
  $('#equipamiento .extras').innerHTML = extras.length ? extras.map((e) => `<li>${esc(e)}</li>`).join('') : '<li class="nota">Sin equipamiento apuntado</li>';

  // Dinero: solo gerencia. La API ya no se lo manda al comercial; aquí se quita el bloque.
  if (!gerencia) {
    $('#dinero')?.remove();
    $('.saltos a[href="#dinero"]')?.remove();
  } else {
    const deposito = v.propiedad === 'deposito';
    const cuentas = document.querySelectorAll('#dinero .cuentas');
    const linea = (dt, cent, total) => `<div${total ? ' class="total"' : ''}><dt>${dt}</dt><dd>${euros(cent)}</dd></div>`;
    const persona = (dt, nombre, tel) => `<div><dt>${dt}</dt><dd>${esc(nombre)}${tel ? ` · <a href="tel:${esc(tel)}">${esc(tel)}</a>` : ''}</dd></div>`;
    cuentas[0].innerHTML = [deposito ? linea('Pactado con el dueño', v.pago_propietario_cent) : linea('Precio de compra', v.precio_compra_cent),
      linea('Transporte', v.coste_transporte_cent), linea('Taller', v.coste_taller_cent), linea('Preparación y limpieza', v.coste_preparacion_cent),
      linea('Impuestos y gestoría', v.coste_impuestos_cent), linea('Coste total', v.coste_total_cent, true)].join('');
    cuentas[1].innerHTML = [linea('Precio de venta', v.pvp_cent), linea('Precio si financia', v.precio_financiado_cent), linea('Mínimo aceptable', v.precio_minimo_cent),
      `<div><dt>Régimen de IVA</dt><dd>${esc(v.regimen_iva ?? (deposito ? 'Depósito' : '—'))}</dd></div>`].join('')
      + (deposito && v.propietario_nombre ? persona('Dueño', v.propietario_nombre, v.propietario_telefono) : '')
      + (!deposito && v.proveedor_nombre ? persona('Proveedor', v.proveedor_nombre, v.proveedor_telefono) : '');
    $('#dinero .margen strong').textContent = v.margen_cent == null ? 'Falta un dato' : euros(v.margen_cent);
  }

  pintarReserva(v, reserva);

  // Dónde está publicado: la web se deduce del estado; los portales aún no tienen datos
  const enLaWeb = ['publicado', 'reservado', 'vendido'].includes(v.estado);
  $('#publicacion .canales').innerHTML = `<li>Web proservicerubi.com ${enLaWeb ? '<span class="estado estado--venta">Publicado</span>' : '<span class="nota">No sale</span>'}</li>`
    + ['Coches.net', 'Milanuncios', 'Wallapop'].map((p) => `<li>${p} <a class="boton boton--secundario boton--pequeno" href="anuncio.html">Preparar anuncio</a></li>`).join('');

  // Historial
  const historialCaja = [...document.querySelectorAll('.caja')].find((c) => $('h2', c)?.textContent === 'Historial');
  $('.historial', historialCaja).innerHTML = historial.map((h) => `<li><time datetime="${esc(h.fecha)}">${esc(fechaHora(h.fecha))}</time>${esc(h.de ? estado(h.a).nombre : 'Alta del coche')} · ${esc(h.usuario ?? '—')}</li>`).join('');
}

function pintarReserva(v, reserva) {
  const caja = $('#reserva');
  const titulo = $('.caja__titulo', caja).outerHTML;
  if (reserva) {
    const quedan = Math.ceil((fechaSql(reserva.caduca_en) - Date.now()) / 86400000);
    caja.innerHTML = `${titulo}
      <dl class="reserva-activa">
        <div><dt>Cliente</dt><dd>${esc(reserva.cliente)}</dd></div>
        <div><dt>Señal</dt><dd class="cifra">${euros(reserva.senal_cent)}</dd></div>
        <div><dt>Reservado el</dt><dd class="cifra">${esc(fechaHora(reserva.fecha))}${reserva.usuario ? ` · ${esc(reserva.usuario)}` : ''}</dd></div>
        <div><dt>Caduca</dt><dd class="cifra">${reserva.caduca_en ? `${esc(fechaSql(reserva.caduca_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))} <span class="dias ${quedan <= 2 ? 'dias--peligro' : 'dias--aviso'}">${quedan > 0 ? `quedan ${quedan} días` : 'caducada'}</span>` : '—'}</dd></div>
      </dl>
      <div class="pila">
        <button class="boton boton--oscuro" type="button" data-vender>Marcar como vendido</button>
        <button class="boton boton--secundario" type="button" data-cancelar>Cancelar la reserva</button>
        <p class="nota">Si se cancela, el coche vuelve a «Publicado».</p>
      </div>`;
    $('[data-vender]', caja).addEventListener('click', () =>
      api(`/vehiculos/${v.id}/estado`, { method: 'PATCH', body: { estado: 'vendido' } }).then(() => location.reload(), (e) => mostrarErrores($('.error--lista'), e, 'No se puede vender:')));
    $('[data-cancelar]', caja).addEventListener('click', async () => {
      if (!confirm('¿Cancelar la reserva? El coche vuelve a «Publicado».')) return;
      await api(`/vehiculos/${v.id}/reserva`, { method: 'DELETE' }).then(() => location.reload(), (e) => mostrarErrores($('.error--lista'), e, 'No se pudo cancelar:'));
    });
    return;
  }
  const form = $('form', caja);
  if (!form) return;
  if (v.estado !== 'publicado') {
    form.innerHTML = '<p class="nota">Solo se puede reservar un coche publicado.</p>';
    return;
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    try {
      await api(`/vehiculos/${v.id}/reserva`, { method: 'POST', body: { cliente: d.cliente, senal_cent: Math.round(Number(d.senal_cent) * 100), dias: Number(d.dias || 7) } });
      location.reload();
    } catch (e) {
      mostrarErrores($('.error--lista'), e, 'No se ha podido reservar:');
    }
  });
}

// --- Alta y edición ----------------------------------------------------------------------------

async function paginaAlta(usuario) {
  const form = $('form.formulario');
  const cajaError = $('.error--lista');
  const id = Number(params.get('id')) || null;
  const gerencia = usuario.rol === 'gerencia';
  if (!gerencia) form.querySelector('.bloque--dinero')?.remove();

  const casillas = [...form.querySelectorAll('input[name="extras"]')];
  const textoCasilla = (c) => c.parentElement.textContent.trim();

  if (id) {
    const [v, extras] = await Promise.all([api(`/vehiculos/${id}`), api(`/vehiculos/${id}/extras`)]);
    document.title = `Editar ${tituloCoche(v)} · ProService`;
    const titulo = $('.portada__titular') || $('.cabecera h1');
    if (titulo) titulo.textContent = `Editar ${tituloCoche(v)}`;
    const nombres = new Set([...form.elements].map((c) => c.name).filter((n) => n && n !== 'extras' && n in v));
    for (const nombre of nombres) {
      const valor = v[nombre];
      fijarValor(form, nombre, valor == null ? '' : nombre.endsWith('_cent') ? valor / 100 : valor);
    }
    casillas.forEach((c) => { c.checked = extras.includes(textoCasilla(c)); });
    form.querySelector('.barra-guardar a').href = urlCoche(v);
  }

  // Barra de progreso del rediseño: qué falta para guardar y cuántos datos hay para publicar
  const progreso = () => {
    const lleno = (n) => { const c = form.elements[n]; return !!c && String(c.value ?? '').trim() !== ''; };
    const faltan = OBLIGATORIOS_ALTA.filter((n) => !lleno(n));
    const linea = form.querySelector('.barra-guardar__linea');
    if (linea) {
      linea.innerHTML = faltan.length
        ? `<strong>Para guardar:</strong> faltan ${esc(faltan.map((n) => NOMBRES_CAMPO[n]).join(', ').replace(/, ([^,]*)$/, ' y $1'))}`
        : '<strong>Listo para guardar.</strong>';
    }
    const hechos = OBLIGATORIOS_PUBLICAR.filter(lleno).length;
    const cifraPublicar = form.querySelector('.barra-guardar__linea--suave .cifra');
    if (cifraPublicar) cifraPublicar.textContent = `${hechos} de ${OBLIGATORIOS_PUBLICAR.length}`;
    form.querySelector('.barra-guardar__barra')?.style.setProperty('--p', (hechos / OBLIGATORIOS_PUBLICAR.length).toFixed(2));

    // Índice lateral: cuántos datos para publicar faltan en cada bloque, o el check si no falta ninguno
    for (const enlace of document.querySelectorAll('.indice-alta a')) {
      const bloque = form.querySelector(enlace.getAttribute('href'));
      if (!bloque) continue;
      const deBloque = [...new Set([...bloque.querySelectorAll('[name]')].map((c) => c.name))].filter((n) => OBLIGATORIOS_PUBLICAR.includes(n));
      const pendientes = deBloque.filter((n) => !lleno(n)).length;
      let cuenta = enlace.querySelector('small');
      if (pendientes) {
        if (!cuenta) enlace.append(cuenta = document.createElement('small'));
        cuenta.textContent = pendientes;
      } else cuenta?.remove();
      enlace.classList.toggle('indice-alta__hecho', deBloque.length > 0 && !pendientes);
    }
  };
  form.addEventListener('input', progreso);
  form.addEventListener('change', progreso);
  progreso();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    cajaError.hidden = true;
    const datos = {};
    for (const campo of form.elements) {
      if (!campo.name || campo.name === 'extras' || campo.disabled) continue;
      if (campo.type === 'radio') {
        if (!campo.checked) {
          // grupo sin nada marcado: al editar, se borra el dato
          if (id && !form.querySelector(`input[name="${campo.name}"]:checked`)) datos[campo.name] = null;
          continue;
        }
      }
      const bruto = campo.value.trim();
      if (bruto === '') {
        if (id) datos[campo.name] = null; // al editar, vaciar es borrar el dato
        continue;
      }
      if (campo.name.endsWith('_cent')) datos[campo.name] = Math.round(Number(bruto) * 100);
      else if (campo.type === 'number') datos[campo.name] = Number(bruto);
      else datos[campo.name] = bruto;
    }
    try {
      const guardado = await api(id ? `/vehiculos/${id}` : '/vehiculos', { method: id ? 'PUT' : 'POST', body: datos });
      await api(`/vehiculos/${guardado.id}/extras`, { method: 'PUT', body: { extras: casillas.filter((c) => c.checked).map(textoCasilla) } });
      location.href = urlCoche(guardado);
    } catch (e) {
      mostrarErrores(cajaError, e, 'No se ha podido guardar:');
    }
  });
}

// --- Arranque ----------------------------------------------------------------------------------

const PAGINAS = {
  'index.html': paginaTablero,
  'coches.html': paginaListado,
  'coche.html': paginaFicha,
  'coche-reservado.html': paginaFicha,
  'coche-nuevo.html': paginaAlta,
  'fotos.html': async () => {}, // la rellena fotos.js; aquí solo el menú
};

(async () => {
  if (PAGINA === 'login.html') return paginaLogin();
  try {
    const usuario = await api('/auth/yo');
    if (usuario.rol !== 'gerencia' && ['informes.html', 'usuarios.html'].includes(PAGINA)) return (location.href = 'index.html');
    prepararMenu(usuario);
    const pagina = PAGINAS[PAGINA];
    if (pagina) await pagina(usuario);
    else avisoMaqueta();
  } catch (e) {
    if (e.message !== 'Sin sesión') {
      console.error(e);
      mostrarErrores($('.error--lista'), e, 'No se han podido cargar los datos:');
    }
  }
})();
