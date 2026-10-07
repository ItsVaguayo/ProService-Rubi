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
const portada = (v) => (v.foto_portada_id ? `/api/fotos/${v.id}/${v.foto_portada_id}/archivo?v=${encodeURIComponent(v.foto_portada_v ?? '')}` : '../img/coche.svg');
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
  const contador = actualizarContadorContactos();
  if (usuario.rol !== 'gerencia') {
    // Lo de dinero y administración solo es de gerencia (la API también se lo niega). Incentivos sí: cada uno ve lo suyo.
    document.querySelectorAll(['informes', 'usuarios', 'proveedores', 'gastos', 'facturas'].map((p) => `a[href="${p}.html"]`).join(', '))
      .forEach((a) => a.remove());
  }
  resalteDelMenu();
  return contador;
}

// Menú lateral: un fondo que se desliza hasta el enlace que tiene el ratón encima y, al salir,
// vuelve a la página en la que estás. Solo con ratón; en el móvil el menú es un desplegable.
function resalteDelMenu() {
  const enlaces = $('.menu__enlaces');
  if (!enlaces || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const resalte = Object.assign(document.createElement('span'), { className: 'menu__resalte' });
  resalte.setAttribute('aria-hidden', 'true');
  enlaces.prepend(resalte);
  enlaces.classList.add('menu__enlaces--resalte');

  const ir = (a, { sinAnimar = false } = {}) => {
    if (!a || !enlaces.offsetParent) return (resalte.style.opacity = '0'); // sin enlace o con el menú plegado
    if (sinAnimar) resalte.style.transition = 'none';
    resalte.style.transform = `translateY(${a.offsetTop}px)`;
    resalte.style.height = `${a.offsetHeight}px`;
    resalte.style.opacity = '1';
    if (sinAnimar) requestAnimationFrame(() => (resalte.style.transition = ''));
  };
  const actual = () => $('a[aria-current="page"]', enlaces);

  // Al salir no vuelve de golpe: espera un poco (por si el ratón solo se ha pasado y regresa)
  // y después vuelve despacio a la página actual.
  let volver = null;
  ir(actual(), { sinAnimar: true });
  enlaces.addEventListener('mouseover', (ev) => {
    const a = ev.target.closest('a');
    if (!a || !enlaces.contains(a)) return;
    clearTimeout(volver);
    resalte.classList.remove('menu__resalte--volviendo');
    ir(a);
  });
  enlaces.addEventListener('mouseleave', () => {
    clearTimeout(volver);
    volver = setTimeout(() => {
      resalte.classList.add('menu__resalte--volviendo');
      ir(actual());
    }, 350);
  });
  addEventListener('resize', () => ir(actual(), { sinAnimar: true }));
  // En ventana estrecha los enlaces están dentro del desplegable «Menú»: al abrirlo, se coloca
  $('.menu__movil')?.addEventListener('toggle', () => ir(actual(), { sinAnimar: true }));
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
  const clave = form.elements.contrasena;
  const boton = $('button[type="submit"]', form);

  // «Ver» / «Ocultar» la contraseña
  const ver = $('.login__ver', form);
  ver?.addEventListener('click', () => {
    const visible = clave.type === 'password';
    clave.type = visible ? 'text' : 'password';
    ver.textContent = visible ? 'Ocultar' : 'Ver';
    ver.setAttribute('aria-pressed', visible);
    clave.focus();
  });

  // Aviso de mayúsculas activadas mientras se escribe la contraseña
  const mayus = $('.login__mayus', form);
  const mirarMayus = (ev) => { if (mayus && ev.getModifierState) mayus.hidden = !ev.getModifierState('CapsLock'); };
  clave.addEventListener('keydown', mirarMayus);
  clave.addEventListener('keyup', mirarMayus);
  clave.addEventListener('blur', () => { if (mayus) mayus.hidden = true; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.hidden = true;
    form.classList.remove('login__form--fallo');
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    boton.textContent = 'Entrando…';
    const datos = Object.fromEntries(new FormData(form));
    try {
      await api('/auth/entrar', { method: 'POST', body: { email: datos.email, contrasena: datos.contrasena } });
      location.href = destinoTrasEntrar();
    } catch (e) {
      error.textContent = e.status === 429 ? e.message : 'El correo o la contraseña no son correctos. Revisa las mayúsculas.';
      error.hidden = false;
      void form.offsetWidth; // para que la sacudida se repita en cada fallo
      form.classList.add('login__form--fallo');
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      boton.textContent = 'Entrar';
      clave.select();
    }
  });
  notaDePruebas(form);
}

// Solo en el sistema de pruebas (npm run dev:pruebas) la API devuelve los usuarios de prueba: el login
// los enseña en una nota de desarrollo, con un botón que rellena el formulario. En producción no sale.
async function notaDePruebas(form) {
  const usuarios = await api('/pruebas/acceso').catch(() => null);
  if (!Array.isArray(usuarios) || !usuarios.length) return;
  const nota = document.createElement('aside');
  nota.className = 'nota-pruebas';
  nota.innerHTML = `<strong>Desarrollo · usuarios de prueba</strong>
    <ul>${usuarios.map((u, i) => `<li>
      <span><b>${esc(u.rol === 'gerencia' ? 'Gerencia' : 'Comercial')}</b> ${esc(u.email)}<br><code>${esc(u.contrasena)}</code></span>
      <button class="boton boton--secundario boton--pequeno" type="button" data-usuario="${i}">Rellenar</button>
    </li>`).join('')}</ul>
    <small>Solo sale con npm run dev:pruebas. En el servidor real no existe.</small>`;
  nota.addEventListener('click', (ev) => {
    const u = usuarios[ev.target.closest('[data-usuario]')?.dataset.usuario];
    if (!u) return;
    form.elements.email.value = u.email;
    form.elements.contrasena.value = u.contrasena;
    form.querySelector('button[type="submit"]').focus();
  });
  form.closest('.login__caja').append(nota);
}

// --- Tablero -----------------------------------------------------------------------------------

// Columnas que el usuario ha desplegado con «Ver N más»: siguen abiertas al repintar tras un cambio de estado
const columnasAbiertas = new Set();
const VISIBLES_POR_COLUMNA = 4;
let usuarioTablero = null; // al repintar tras soltar una tarjeta no llega el usuario: se reutiliza

async function paginaTablero(usuario = usuarioTablero) {
  usuarioTablero = usuario;
  const todos = await api('/vehiculos');
  const ubicacion = params.get('ubicacion');
  // En el tablero salen también los vendidos sin entregar (columna y «Para hoy»), pero no cuentan
  // como stock: ya no están a la venta. Igual que el stock de Informes.
  const enTablero = todos.filter((v) => v.estado !== 'entregado' && (!ubicacion || v.ubicacion === ubicacion));
  const enStock = enTablero.filter((v) => v.estado !== 'vendido');

  // Portada: total, publicados, sin publicar todavía (de «Pendiente de recoger» a «Pendiente de fotos»)
  // y con más de 60 días a la venta, que lleva el aviso solo si hay alguno.
  const ANTES_DE_PUBLICAR = ESTADOS.slice(0, ESTADOS.findIndex((e) => e.id === 'publicado')).map((e) => e.id);
  const resumen = {
    total: enStock.length,
    publicados: enStock.filter((v) => v.estado === 'publicado').length,
    sinPublicar: enStock.filter((v) => ANTES_DE_PUBLICAR.includes(v.estado)).length,
    parados: enStock.filter((v) => v.estado === 'publicado' && diasDesde(v.en_estado_desde) > 60).length,
  };
  const titular = $('.portada__titular .cifra');
  if (titular) titular.textContent = resumen.total;
  const datos = document.querySelectorAll('.portada__datos li');
  [resumen.publicados, resumen.sinPublicar, resumen.parados].forEach((n, i) => {
    if (datos[i]) datos[i].querySelector('strong').textContent = n;
  });
  datos[2]?.classList.toggle('portada__alerta', resumen.parados > 0);
  const fecha = $('.portada__fecha');
  if (fecha) fecha.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  await cifrasDelMes(todos, enStock, usuario);

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
  for (const v of enTablero) {
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
  // Contactos de la web sin atender: en rojo si alguno lleva más de un día esperando
  const pendientes = await api('/contactos').catch(() => []);
  if (pendientes.length) {
    const viejos = pendientes.filter((c) => Date.now() - fechaSql(c.recibido_en) > 86400000).length;
    tareas.push({
      texto: viejos ? `Contactos de la web sin atender, ${viejos} desde hace más de un día` : 'Contactos de la web sin atender',
      url: 'contactos.html', ir: 'Llamar', urgente: viejos > 0, n: pendientes.length,
    });
  }
  $('.para-hoy ul').innerHTML = tareas.length
    ? tareas.sort((a, b) => b.urgente - a.urgente).map((t) => `<li><a href="${t.url}"><span class="para-hoy__cifra${t.urgente ? ' para-hoy__cifra--hoy' : ''}">${t.n ?? 1}</span><span>${esc(t.texto)}</span><span class="para-hoy__ir">${esc(t.ir)}</span></a></li>`).join('')
    : '<li><span class="nota">Nada urgente hoy.</span></li>';

  // Pestañas de ubicación
  const pestanas = document.querySelectorAll('.pestanas a');
  const destinos = ['index.html', 'index.html?ubicacion=patio_taller', 'index.html?ubicacion=parking'];
  pestanas.forEach((a, i) => {
    a.href = destinos[i];
    const actual = (i === 0 && !ubicacion) || destinos[i].endsWith(`=${ubicacion}`);
    actual ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });

  // Columnas: una por estado, sin «Entregado». Dentro, primero los que más días llevan en ese estado:
  // son los que hay que mover. Con más de VISIBLES_POR_COLUMNA, el resto queda tras «Ver N más».
  $('.tablero').innerHTML = ESTADOS.filter((e) => e.id !== 'entregado').map((e) => {
    const coches = enTablero.filter((v) => v.estado === e.id)
      .map((v) => ({ v, dias: diasDesde(v.en_estado_desde) }))
      .sort((a, b) => b.dias - a.dias);
    const fichas = coches.map(({ v, dias }, i) => {
      const km = v.kilometros != null ? `${cifra(v.kilometros)} km` : 'Sin km';
      const oculta = i >= VISIBLES_POR_COLUMNA ? ' ficha-mini--oculta' : '';
      return `<a class="ficha-mini${oculta}" href="${urlCoche(v)}" draggable="true" data-id="${v.id}">
          <img class="ficha-mini__foto" src="${portada(v)}" alt="" loading="lazy" draggable="false">
          <span class="ficha-mini__cuerpo">
            <span class="matricula">${matricula(v.matricula)}</span>
            <span class="ficha-mini__coche" title="${esc(tituloCoche(v))}">${esc(tituloCoche(v))}</span>
          </span>
          <span class="ficha-mini__datos">
            <span class="cifra">${km}${v.pvp_cent != null ? ` · <span class="ficha-mini__precio">${euros(v.pvp_cent)}</span>` : ''}</span>
            <span class="${claseDias(v, dias)} cifra" title="Días en «${esc(e.nombre)}»">${dias} ${dias === 1 ? 'día' : 'días'}</span>
          </span>
        </a>`;
    }).join('');
    const sobran = coches.length - VISIBLES_POR_COLUMNA;
    const abierta = columnasAbiertas.has(e.id);
    const mas = sobran > 0
      ? `<button class="columna__mas" type="button" aria-expanded="${abierta}" data-mas="${sobran}">${abierta ? 'Ver menos' : `Ver ${sobran} más`}</button>`
      : '';
    return `<div class="columna columna--${e.fase}${abierta ? ' columna--abierta' : ''}" data-estado="${e.id}">
        <h2 class="columna__titulo">${esc(e.nombre)} <span class="cifra">${coches.length}</span></h2>
        ${fichas || '<p class="columna__vacia">Ningún coche</p>'}
        ${mas}
      </div>`;
  }).join('');
  arrastrarEnTablero(todos);
  moverTablero();
}

// Cifras del mes en la cabecera. Gerencia: ventas, margen bruto y días para vender (de /informes).
// Todos: coches que han entrado este mes y días medios que lleva el stock. Meses en UTC, como la base.
async function cifrasDelMes(todos, enStock, usuario) {
  const caja = $('.portada__mes');
  if (!caja) return;
  const mes = new Date().toISOString().slice(0, 7);
  const entradas = todos.filter((v) => v.creado_en?.startsWith(mes)).length;
  const conDias = enStock.map((v) => diasDesde(v.creado_en)).filter((d) => d != null);
  const diasMedios = conDias.length ? Math.round(conDias.reduce((a, b) => a + b, 0) / conDias.length) : null;
  const cifras = [];
  if (usuario?.rol === 'gerencia') {
    const informe = await api('/informes').catch(() => null);
    const r = informe?.resumen;
    if (r) {
      const antes = r.vendidos_mes_anterior;
      const tendencia = r.vendidos > antes ? 'sube' : r.vendidos < antes ? 'baja' : '';
      const mesPasado = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5) - 2, 1)).toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
      cifras.push([`Vendidos <small class="${tendencia}">${cifra(antes)} en ${mesPasado}</small>`, cifra(r.vendidos)]);
      cifras.push(['Margen neto', esc(euros(r.margen_cent))]);
      cifras.push(['Días medios para vender', r.dias_medios_venta != null ? cifra(r.dias_medios_venta) : '—']);
    }
  }
  cifras.push(['Coches que han entrado', cifra(entradas)]);
  if (usuario?.rol !== 'gerencia') cifras.push(['Días medios en stock', diasMedios != null ? cifra(diasMedios) : '—']);
  $('.portada__cifras', caja).innerHTML = cifras.map(([dt, dd]) => `<div><dt>${dt}</dt><dd class="cifra">${dd}</dd></div>`).join('');
  caja.hidden = false;
}

// El tablero se mueve de lado sin la barra de abajo: arrastrando el fondo con el ratón (con un poco
// de inercia al soltar), con las flechas de la cabecera o con las teclas si tiene el foco. Mientras
// se arrastra una tarjeta, acercarla al borde mueve el tablero solo, para llegar a cualquier columna.
function moverTablero() {
  const tablero = $('.tablero');
  if (!tablero || tablero.dataset.mover) return; // al repintar, los oyentes ya están puestos
  tablero.dataset.mover = '1';
  const marco = tablero.closest('.tablero-marco');
  const flechas = [...document.querySelectorAll('[data-columnas]')];

  // Degradado y flechas según haya más columnas a cada lado
  const bordes = () => {
    const max = tablero.scrollWidth - tablero.clientWidth;
    const izq = tablero.scrollLeft > 2;
    const der = tablero.scrollLeft < max - 2;
    marco?.classList.toggle('tablero-marco--hay-izq', izq);
    marco?.classList.toggle('tablero-marco--hay-der', der);
    flechas.forEach((b) => { b.disabled = Number(b.dataset.columnas) < 0 ? !izq : !der; });
  };
  tablero.addEventListener('scroll', bordes, { passive: true });
  addEventListener('resize', bordes);
  new MutationObserver(bordes).observe(tablero, { childList: true });
  bordes();

  // «Ver N más» / «Ver menos» en las columnas largas
  tablero.addEventListener('click', (ev) => {
    const boton = ev.target.closest('.columna__mas');
    if (!boton) return;
    const columna = boton.closest('.columna');
    const abierta = columna.classList.toggle('columna--abierta');
    abierta ? columnasAbiertas.add(columna.dataset.estado) : columnasAbiertas.delete(columna.dataset.estado);
    boton.setAttribute('aria-expanded', abierta);
    boton.textContent = abierta ? 'Ver menos' : `Ver ${boton.dataset.mas} más`;
    if (!abierta) columna.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // Flechas: dos columnas por pulsación
  const paso = () => (tablero.querySelector('.columna')?.offsetWidth ?? 272) + 14;
  flechas.forEach((b) => b.addEventListener('click', () => {
    tablero.scrollBy({ left: Number(b.dataset.columnas) * paso() * 2, behavior: 'smooth' });
  }));

  // Arrastrar el fondo con el ratón. Desde una tarjeta no: eso es cambiarla de estado.
  let mano = null;
  let inercia = 0;
  tablero.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || ev.target.closest('.ficha-mini, a, button')) return;
    if (tablero.scrollWidth <= tablero.clientWidth) return;
    ev.preventDefault(); // que no empiece a seleccionar texto
    cancelAnimationFrame(inercia);
    mano = { x: ev.clientX, scroll: tablero.scrollLeft, movido: false, ultimaX: ev.clientX, ultimoT: ev.timeStamp, v: 0 };
    tablero.setPointerCapture(ev.pointerId);
  });
  tablero.addEventListener('pointermove', (ev) => {
    if (!mano) return;
    const dx = ev.clientX - mano.x;
    if (!mano.movido && Math.abs(dx) < 4) return;
    if (!mano.movido) tablero.classList.add('tablero--moviendo');
    mano.movido = true;
    tablero.scrollLeft = mano.scroll - dx;
    const dt = ev.timeStamp - mano.ultimoT;
    if (dt > 0) mano.v = (ev.clientX - mano.ultimaX) / dt; // px por ms
    mano.ultimaX = ev.clientX;
    mano.ultimoT = ev.timeStamp;
  });
  const soltar = (ev) => {
    if (!mano) return;
    tablero.classList.remove('tablero--moviendo');
    if (tablero.hasPointerCapture(ev.pointerId)) tablero.releasePointerCapture(ev.pointerId);
    // Inercia: sigue un poco en la dirección del gesto, salvo si el ratón ya estaba parado
    let v = ev.timeStamp - mano.ultimoT < 80 ? Math.max(-30, Math.min(30, mano.v * 16)) : 0;
    mano = null;
    const frenar = () => {
      if (Math.abs(v) < 0.5) return;
      tablero.scrollLeft -= v;
      v *= 0.88;
      inercia = requestAnimationFrame(frenar);
    };
    frenar();
  };
  tablero.addEventListener('pointerup', soltar);
  tablero.addEventListener('pointercancel', soltar);

  // Con una tarjeta cogida, cerca del borde el tablero avanza solo (más rápido cuanto más cerca)
  let ratonX = null;
  let auto = 0;
  const avanzar = () => {
    const caja = tablero.getBoundingClientRect();
    const zona = 90;
    if (ratonX != null) {
      if (ratonX < caja.left + zona) tablero.scrollLeft -= Math.ceil((caja.left + zona - ratonX) / 6);
      else if (ratonX > caja.right - zona) tablero.scrollLeft += Math.ceil((ratonX - (caja.right - zona)) / 6);
    }
    auto = requestAnimationFrame(avanzar);
  };
  const seguir = (ev) => { ratonX = ev.clientX; };
  tablero.addEventListener('dragstart', () => {
    cancelAnimationFrame(inercia);
    document.addEventListener('dragover', seguir);
    auto = requestAnimationFrame(avanzar);
  });
  const parar = () => {
    cancelAnimationFrame(auto);
    document.removeEventListener('dragover', seguir);
    ratonX = null;
  };
  tablero.addEventListener('dragend', parar);
  tablero.addEventListener('drop', parar);
}

// Arrastrar una tarjeta a otra columna le cambia el estado. Las reglas son las de la API: si no se
// puede (faltan fotos, tiene reserva…), la tarjeta vuelve a su sitio y se enseña el motivo.
// Solo con ratón: en el móvil el estado se cambia desde la ficha del coche.
function arrastrarEnTablero(todos) {
  const tablero = $('.tablero');
  const cajaError = $('.error--tablero');
  const coches = new Map(todos.map((v) => [String(v.id), v]));
  if (tablero.dataset.arrastrar) {
    tablero.coches = coches; // al repintar solo cambian los datos, los oyentes ya están puestos
    return;
  }
  tablero.dataset.arrastrar = '1';
  tablero.coches = coches;
  let arrastrado = null;

  const columnaDe = (ev) => ev.target.closest?.('.columna');
  const limpiar = () => tablero.querySelectorAll('.columna--encima').forEach((c) => c.classList.remove('columna--encima'));

  tablero.addEventListener('dragstart', (ev) => {
    const ficha = ev.target.closest?.('.ficha-mini');
    if (!ficha) return;
    arrastrado = tablero.coches.get(ficha.dataset.id);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', ficha.dataset.id);
    ficha.classList.add('ficha-mini--arrastrando');
  });
  tablero.addEventListener('dragend', (ev) => {
    ev.target.closest?.('.ficha-mini')?.classList.remove('ficha-mini--arrastrando');
    limpiar();
    arrastrado = null;
  });
  tablero.addEventListener('dragover', (ev) => {
    const columna = columnaDe(ev);
    if (!columna || !arrastrado || columna.dataset.estado === arrastrado.estado) return;
    ev.preventDefault(); // sin esto el navegador no deja soltar
    ev.dataTransfer.dropEffect = 'move';
    if (!columna.classList.contains('columna--encima')) {
      limpiar();
      columna.classList.add('columna--encima');
    }
  });
  tablero.addEventListener('dragleave', (ev) => {
    const columna = columnaDe(ev);
    if (columna && !columna.contains(ev.relatedTarget)) columna.classList.remove('columna--encima');
  });
  tablero.addEventListener('drop', async (ev) => {
    const columna = columnaDe(ev);
    const v = arrastrado;
    if (!columna || !v) return;
    ev.preventDefault();
    limpiar();
    const destino = columna.dataset.estado;
    if (destino === v.estado) return;
    const nombre = estado(destino).nombre;
    // Reservar pide cliente y señal: eso se rellena en la ficha
    if (destino === 'reservado') {
      return mostrarErrores(cajaError, { lista: [`Para reservar el ${tituloCoche(v)}, ábrelo y rellena la reserva con el cliente y la señal.`] }, 'No se puede reservar desde el tablero:');
    }
    try {
      await api(`/vehiculos/${v.id}/estado`, { method: 'PATCH', body: { estado: destino } });
      cajaError.hidden = true;
      await paginaTablero();
    } catch (e) {
      mostrarErrores(cajaError, e, `El ${tituloCoche(v)} no puede pasar a «${nombre}» todavía:`);
    }
  });
}

// --- Listado -----------------------------------------------------------------------------------

async function paginaListado(usuario) {
  const todos = await api('/vehiculos');
  const form = $('form.filtros');
  const valor = (nombre) => form.elements[nombre]?.value ?? '';
  for (const campo of ['q', 'estado', 'propiedad', 'ubicacion']) {
    if (params.get(campo)) fijarValor(form, campo, params.get(campo));
  }

  // Resumen de la cabecera. El valor a la venta (suma de PVP del stock) solo lo ve gerencia.
  const enStock = todos.filter((v) => !['vendido', 'entregado'].includes(v.estado)); // vendido sin entregar no es stock
  const resumen = [
    [cifra(enStock.length), 'en stock'],
    [cifra(enStock.filter((v) => v.estado === 'publicado').length), 'publicados'],
    [cifra(enStock.filter((v) => v.propiedad === 'deposito').length), 'en depósito'],
  ];
  if (usuario?.rol === 'gerencia') {
    resumen.push([euros(enStock.reduce((suma, v) => suma + (v.pvp_cent ?? 0), 0)), 'a la venta']);
  }
  $('.coches-resumen').innerHTML = resumen.map(([n, texto]) => `<li><strong>${esc(n)}</strong>${esc(texto)}</li>`).join('');

  // Orden: por defecto, los que más días llevan primero. Los vacíos (sin precio, sin km) al final.
  const dias = (v) => (v.estado === 'entregado' ? null : diasDesde(v.creado_en));
  const CLAVES = { coche: (v) => tituloCoche(v).toLowerCase(), km: (v) => v.kilometros, precio: (v) => v.pvp_cent, dias };
  const orden = { campo: 'dias', sentido: -1 };
  const ordenar = (a, b) => {
    const x = CLAVES[orden.campo](a);
    const y = CLAVES[orden.campo](b);
    if (x == null || y == null) return (x == null) - (y == null);
    return (x < y ? -1 : x > y ? 1 : 0) * orden.sentido;
  };

  // Sin estado: los que están en stock. «todos»: también los entregados.
  const filtrar = () => {
    const q = valor('q').trim().toLowerCase().replace(/\s/g, '');
    const f = { estado: valor('estado'), propiedad: valor('propiedad'), ubicacion: valor('ubicacion') };
    return todos.filter((v) =>
      (!q || `${v.matricula}${v.marca}${v.modelo}${v.version ?? ''}${v.referencia ?? ''}`.toLowerCase().replace(/\s/g, '').includes(q)) &&
      (f.estado === 'todos' || (f.estado ? v.estado === f.estado : v.estado !== 'entregado')) &&
      (!f.propiedad || v.propiedad === f.propiedad) && (!f.ubicacion || v.ubicacion === f.ubicacion));
  };
  const hayFiltros = () => ['q', 'estado', 'propiedad', 'ubicacion'].some((c) => valor(c));

  let lista = [];
  const pintar = () => {
    lista = filtrar().sort(ordenar);
    $('.tabla tbody').innerHTML = lista.map((v) => {
      const d = dias(v);
      const meta = [v.anio, v.combustible && nombre(v.combustible).toLowerCase(), v.cambio && nombre(v.cambio).toLowerCase(), v.propiedad === 'deposito' ? 'depósito' : 'propio'];
      return `<tr class="fila-coche${v.estado === 'entregado' ? ' fila-coche--entregado' : ''}" data-url="${esc(urlCoche(v))}">
        <td class="c-foto"><img class="miniatura" src="${portada(v)}" alt="" loading="lazy"></td>
        <td class="c-coche"><a class="fila-coche__titulo" href="${esc(urlCoche(v))}">${esc(tituloCoche(v))}</a>
          <span class="fila-coche__meta"><span class="matricula">${matricula(v.matricula)}</span><span class="nota">${esc(meta.filter(Boolean).join(' · '))}</span></span></td>
        <td class="c-estado">${etiquetaEstado(v.estado)}</td>
        <td class="c-km derecha cifra">${v.kilometros != null ? cifra(v.kilometros) : '—'}</td>
        <td class="c-precio derecha cifra">${euros(v.pvp_cent)}</td>
        <td class="c-dias derecha cifra">${d == null ? '<span class="nota">—</span>' : `<span class="${claseDias(v, d)}">${d}</span>`}</td>
        <td class="c-donde nota">${v.ubicacion ? esc(nombre(v.ubicacion)) : '—'}</td>
      </tr>`;
    }).join('');
    $('.tabla-caja').hidden = !lista.length;
    $('.vacio').hidden = !!lista.length;
    $('.lista-pie__cuantos').textContent = `${lista.length} ${lista.length === 1 ? 'coche' : 'coches'}${hayFiltros() ? ` de ${todos.length}` : ''}`;
    $('[data-limpiar]').hidden = !hayFiltros();
    document.querySelectorAll('.ordenar').forEach((b) => {
      if (b.dataset.orden === orden.campo) b.setAttribute('aria-sort', orden.sentido > 0 ? 'ascending' : 'descending');
      else b.removeAttribute('aria-sort');
    });
  };

  form.addEventListener('input', pintar);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); pintar(); });
  $('[data-limpiar]').addEventListener('click', () => {
    form.reset();
    history.replaceState(null, '', 'coches.html');
    pintar();
  });
  // Ordenar: la misma columna invierte; otra empieza por lo más útil (más días, más caro, más km; el nombre de la A a la Z)
  $('.tabla thead').addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-orden]');
    if (!boton) return;
    const campo = boton.dataset.orden;
    orden.sentido = orden.campo === campo ? -orden.sentido : (campo === 'coche' ? 1 : -1);
    orden.campo = campo;
    pintar();
  });
  // Toda la fila abre la ficha (los enlaces de dentro siguen funcionando solos)
  $('.tabla tbody').addEventListener('click', (ev) => {
    if (ev.target.closest('a')) return;
    const fila = ev.target.closest('tr[data-url]');
    if (fila) location.href = fila.dataset.url;
  });
  // Exportar lo que se está viendo, en CSV para Excel. Sin datos internos de dinero: eso va en Informes.
  $('[data-exportar]').addEventListener('click', () => {
    const columnas = [
      ['Referencia', (v) => v.referencia], ['Matrícula', (v) => v.matricula], ['Marca', (v) => v.marca], ['Modelo', (v) => v.modelo],
      ['Versión', (v) => v.version], ['Año', (v) => v.anio], ['Km', (v) => v.kilometros], ['Estado', (v) => estado(v.estado).nombre],
      ['Precio (€)', (v) => (v.pvp_cent == null ? '' : (v.pvp_cent / 100).toFixed(2).replace('.', ','))],
      ['Días en stock', (v) => dias(v) ?? ''], ['Propiedad', (v) => (v.propiedad === 'deposito' ? 'Depósito' : 'Propio')],
      ['Dónde', (v) => (v.ubicacion ? nombre(v.ubicacion) : '')],
    ];
    const celda = (x) => {
      let t = x == null ? '' : String(x);
      if (/^[=+\-@]/.test(t)) t = `'${t}`;
      return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const csv = [columnas.map(([n]) => celda(n)), ...lista.map((v) => columnas.map(([, f]) => celda(f(v))))].map((l) => l.join(';')).join('\r\n');
    const enlace = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([`\uFEFF${csv}\r\n`], { type: 'text/csv;charset=utf-8' })),
      download: `coches-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  });

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
      linea('Impuestos y gestoría', v.coste_impuestos_cent),
      ...(v.coste_otros_cent ? [`<div><dt>Otros gastos <a class="enlace-pequeno" href="gastos.html?vehiculo=${v.id}">del libro</a></dt><dd>${euros(v.coste_otros_cent)}</dd></div>`] : []),
      linea('Coste total', v.coste_total_cent, true)].join('');
    cuentas[1].innerHTML = [linea('Precio de venta', v.pvp_cent), linea('Precio si financia', v.precio_financiado_cent), linea('Mínimo aceptable', v.precio_minimo_cent),
      `<div><dt>Régimen de IVA</dt><dd>${esc(v.regimen_iva ?? (deposito ? 'Depósito' : '—'))}</dd></div>`].join('')
      + (deposito && v.propietario_nombre ? persona('Dueño', v.propietario_nombre, v.propietario_telefono) : '')
      + (!deposito && v.proveedor_nombre ? persona('Proveedor', v.proveedor_nombre, v.proveedor_telefono) : '');
    // El neto: después del IVA de la venta (REBU sobre venta − compra; general, el 21 % del precio)
    const margen = $('#dinero .margen');
    $('span', margen).textContent = 'Margen neto';
    $('strong', margen).textContent = v.margen_cent == null ? 'Falta un dato' : euros(v.margen_cent);
    let detalle = $('.margen__detalle', margen);
    if (!detalle) margen.append(detalle = Object.assign(document.createElement('small'), { className: 'margen__detalle nota' }));
    detalle.textContent = v.margen_cent == null ? 'Hace falta el precio de compra (o lo pactado con el dueño) y el de venta.'
      : `${euros(v.margen_bruto_cent)} antes de IVA − ${euros(v.iva_venta_cent)} de IVA ${deposito || (v.regimen_iva ?? 'REBU') === 'REBU' ? 'en REBU' : 'general'}`;
    // Facturar la venta (abre el alta de facturas con este coche elegido)
    if (['reservado', 'vendido', 'entregado'].includes(v.estado) && !$('[data-facturar]', margen.parentElement)) {
      margen.insertAdjacentHTML('afterend', `<p class="facturar-coche"><a class="boton boton--pequeno" data-facturar href="facturas.html?coche=${v.id}">Facturar la venta</a></p>`);
    }
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
    const vender = () =>
      api(`/vehiculos/${v.id}/estado`, { method: 'PATCH', body: { estado: 'vendido' } }).then(() => location.reload(), (e) => mostrarErrores($('.error--lista'), e, 'No se puede vender:'));
    $('[data-vender]', caja).addEventListener('click', vender);
    // Duda C6: al cancelar se apunta si se devuelve la señal. Se pregunta aquí, con botones que dicen
    // lo que hacen, para que «echarse atrás» no se confunda con «no se devuelve».
    const pila = $('.pila', caja);
    const botones = pila.innerHTML;
    const cancelar = (senal_devuelta) =>
      api(`/vehiculos/${v.id}/reserva`, { method: 'DELETE', body: { senal_devuelta } }).then(() => location.reload(), (e) => mostrarErrores($('.error--lista'), e, 'No se pudo cancelar:'));
    const preguntar = () => {
      pila.innerHTML = `
        <p class="nota">¿Se le devuelve la señal de ${euros(reserva.senal_cent)} a ${esc(reserva.cliente)}? El coche vuelve a «Publicado».</p>
        <button class="boton boton--oscuro" type="button" data-devuelta="si">Cancelar y devolver la señal</button>
        <button class="boton boton--oscuro" type="button" data-devuelta="no">Cancelar sin devolverla</button>
        <button class="boton boton--secundario" type="button" data-volver>No cancelar</button>`;
      $('[data-devuelta="si"]', pila).addEventListener('click', () => cancelar(true));
      $('[data-devuelta="no"]', pila).addEventListener('click', () => cancelar(false));
      $('[data-volver]', pila).addEventListener('click', () => {
        pila.innerHTML = botones;
        $('[data-vender]', pila).addEventListener('click', vender);
        $('[data-cancelar]', pila).addEventListener('click', preguntar);
      });
    };
    $('[data-cancelar]', caja).addEventListener('click', preguntar);
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

// --- Usuarios (solo gerencia) ------------------------------------------------------------------

// Una caja de error dentro de cada formulario, para no usar alert()
function cajaErrorEn(form) {
  let caja = $('.error--lista', form);
  if (!caja) {
    caja = document.createElement('div');
    caja.className = 'error error--lista';
    caja.setAttribute('role', 'alert');
    caja.hidden = true;
    form.prepend(caja);
  }
  return caja;
}

async function paginaUsuarios(yo) {
  const lista = $('.usuarios');
  const vacio = $('.vacio');
  const filtro = $('form.filtros');
  const formNuevo = $('#nuevo form');
  const errorLista = $('.error--lista');
  const ROLES = { gerencia: 'Gerencia', comercial: 'Comercial' };
  let usuarios = [];

  const pintar = () => {
    // Resumen de la cabecera y números de las pestañas
    const activos = usuarios.filter((u) => u.activo);
    const gerencia = activos.filter((u) => u.rol === 'gerencia').length;
    const comerciales = activos.length - gerencia;
    $('.usuarios-resumen').innerHTML = `<strong class="cifra">${activos.length}</strong> con acceso
      <span>· ${gerencia} de gerencia y ${comerciales} ${comerciales === 1 ? 'comercial' : 'comerciales'}</span>`;
    const numeros = { activos: activos.length, desactivados: usuarios.length - activos.length };
    filtro.querySelectorAll('input[name="estado"]').forEach((input) => {
      const n = $('.segmentos__n', input.nextElementSibling);
      if (n) n.textContent = numeros[input.value];
    });

    // Lista: primero tú, luego gerencia y después por nombre
    const estado = new FormData(filtro).get('estado');
    const visibles = usuarios
      .filter((u) => estado === 'todos' || (estado === 'activos') === Boolean(u.activo))
      .sort((a, b) => (b.id === yo.id) - (a.id === yo.id) || (a.rol !== 'gerencia') - (b.rol !== 'gerencia') || a.nombre.localeCompare(b.nombre, 'es'));
    lista.innerHTML = visibles.map((u) => {
      const tu = u.id === yo.id;
      const acceso = u.ultimo_acceso
        ? `<span title="${esc(fechaHora(u.ultimo_acceso))}">Último acceso ${esc(haceCuanto(fechaSql(u.ultimo_acceso)))}</span>`
        : '<span>Aún no ha entrado</span>';
      const acciones = [
        u.activo ? '<button class="boton boton--secundario boton--pequeno" type="button" data-clave>Cambiar contraseña</button>' : '',
        tu ? '' : `<button class="boton ${u.activo ? 'boton--secundario' : 'boton--oscuro'} boton--pequeno" type="button" data-activar="${u.activo ? 'false' : 'true'}">${u.activo ? 'Desactivar' : 'Reactivar'}</button>`,
      ].join('');
      return `<li class="contacto usuario${u.activo ? '' : ' usuario--apagado'}" data-id="${u.id}">
        <span class="contacto__inicial usuario__inicial--${u.rol}" aria-hidden="true">${esc(iniciales(u.nombre))}</span>
        <div class="contacto__cuerpo">
          <p class="contacto__linea"><strong>${esc(u.nombre)}</strong> <span class="estado rol--${u.rol}">${ROLES[u.rol] ?? esc(u.rol)}</span>${tu ? ' <span class="usuario__tu">Tú</span>' : ''}${u.activo ? '' : ' <span class="estado estado--llegada">Desactivado</span>'}</p>
          <p class="contacto__datos"><a href="mailto:${esc(u.email)}">${esc(u.email)}</a>${acceso}</p>
        </div>
        <div class="usuario__acciones">${acciones}</div>
        <form class="usuario__clave" hidden>
          <label class="campo">
            <span class="campo__nombre">Contraseña nueva para ${esc(u.nombre)}</span>
            <input type="password" name="contrasena" minlength="8" autocomplete="new-password" required placeholder="Al menos 8 caracteres">
          </label>
          <button class="boton boton--oscuro boton--pequeno" type="submit">Guardar</button>
          <button class="boton boton--secundario boton--pequeno" type="button" data-cancelar>Cancelar</button>
        </form>
      </li>`;
    }).join('');
    vacio.hidden = visibles.length > 0;
  };
  const cargar = async () => { usuarios = await api('/usuarios'); pintar(); };

  filtro.addEventListener('change', pintar);

  lista.addEventListener('click', async (ev) => {
    const tarjeta = ev.target.closest('.usuario');
    if (!tarjeta) return;
    const form = $('.usuario__clave', tarjeta);

    // Abrir y cerrar el formulario de contraseña (solo uno abierto a la vez)
    if (ev.target.closest('[data-clave]')) {
      lista.querySelectorAll('.usuario__clave').forEach((otro) => { if (otro !== form) otro.hidden = true; });
      form.hidden = !form.hidden;
      if (!form.hidden) form.elements.contrasena.focus();
      return;
    }
    if (ev.target.closest('[data-cancelar]')) {
      form.reset();
      form.hidden = true;
      return;
    }

    const boton = ev.target.closest('[data-activar]');
    if (!boton) return;
    errorLista.hidden = true;
    boton.disabled = true;
    try {
      await api(`/usuarios/${tarjeta.dataset.id}`, { method: 'PATCH', body: { activo: boton.dataset.activar === 'true' } });
      await cargar();
    } catch (e) {
      mostrarErrores(errorLista, e, 'No se ha podido cambiar:');
      boton.disabled = false;
    }
  });

  lista.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const tarjeta = form.closest('.usuario');
    const caja = cajaErrorEn(form);
    caja.hidden = true;
    try {
      await api(`/usuarios/${tarjeta.dataset.id}`, { method: 'PATCH', body: { contrasena: form.elements.contrasena.value } });
      await cargar();
      const hecho = document.createElement('p');
      hecho.className = 'usuario__hecho';
      hecho.textContent = 'Contraseña cambiada. Si tenía la sesión abierta en otro sitio, tendrá que volver a entrar.';
      $(`.usuario[data-id="${tarjeta.dataset.id}"]`, lista)?.append(hecho);
      setTimeout(() => hecho.remove(), 6000);
    } catch (e) {
      mostrarErrores(caja, e, 'No se ha podido cambiar:');
    }
  });

  formNuevo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const caja = cajaErrorEn(formNuevo);
    caja.hidden = true;
    const datos = Object.fromEntries(new FormData(formNuevo));
    try {
      await api('/usuarios', { method: 'POST', body: datos });
      formNuevo.reset();
      // Que se vea el nuevo: vuelve a «Activos»
      filtro.elements.estado.value = 'activos';
      await cargar();
    } catch (e) {
      mostrarErrores(caja, e, 'No se ha podido añadir:');
    }
  });

  await cargar();
}

// --- Contactos de la web ----------------------------------------------------------------------

const TIPOS_CONTACTO = { informacion: 'Información', prueba: 'Prueba de conducción', financiacion: 'Financiación', tasacion: 'Tasación de su coche' };

// El número rojo del menú: contactos sin atender. Sin ninguno, no sale.
async function actualizarContadorContactos() {
  const enlace = $('.menu__enlaces a[href="contactos.html"]');
  if (!enlace) return;
  const { total } = await api('/contactos/sin-atender').catch(() => ({ total: 0 }));
  let contador = $('.contador', enlace);
  if (!total) return contador?.remove();
  if (!contador) enlace.append(' ', contador = Object.assign(document.createElement('span'), { className: 'contador' }));
  contador.textContent = total;
}

// «hace 5 min», «hace 3 h», «hace 2 días»
function haceCuanto(fecha) {
  const min = Math.max(0, Math.round((Date.now() - fecha) / 60000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

const iniciales = (nombre) => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

async function paginaContactos() {
  const form = $('form.filtros');
  const lista = $('.contactos');
  const vacio = $('.vacio');
  // Los coches, para enseñar la foto y el modelo del que pregunta cada uno
  const coches = new Map((await api('/vehiculos').catch(() => [])).map((v) => [v.id, v]));

  // Resumen de la cabecera: siempre de los que esperan, se filtre lo que se filtre
  const resumen = async () => {
    const esperando = await api('/contactos?estado=sin_atender');
    const viejos = esperando.filter((c) => Date.now() - fechaSql(c.recibido_en) > 86400000).length;
    $('.contactos-resumen').innerHTML = esperando.length
      ? `<strong class="cifra">${esperando.length}</strong> esperando respuesta${viejos ? ` <span class="portada__alerta">· ${viejos} desde hace más de un día</span>` : ''}`
      : '<strong class="cifra">0</strong> esperando: todo atendido';
  };

  const tarjeta = (c) => {
    const recibido = fechaSql(c.recibido_en);
    const urgente = !c.atendido_en && Date.now() - recibido > 86400000;
    const tel = c.telefono.replace(/[^\d+]/g, '');
    const v = c.vehiculo_id ? coches.get(c.vehiculo_id) : null;
    const coche = c.vehiculo_id
      ? `<a class="contacto__coche" href="coche.html?id=${c.vehiculo_id}">
          <img src="${v ? portada(v) : '../img/coche.svg'}" alt="" loading="lazy">
          <span><b>${esc([c.marca, c.modelo].filter(Boolean).join(' '))}</b><span class="matricula">${matricula(c.matricula)}</span></span>
        </a>`
      : '<span class="contacto__coche contacto__coche--sin">Sin coche concreto</span>';
    const acciones = c.atendido_en
      ? `<span class="nota">Atendido${c.atendido_por_nombre ? ` por ${esc(c.atendido_por_nombre)}` : ''} · ${esc(fechaHora(c.atendido_en))}</span>
         <button class="boton boton--secundario boton--pequeno" type="button" data-atendido="${c.id}" data-valor="false">Volver a pendiente</button>`
      : `<a class="boton boton--secundario boton--pequeno" href="tel:${esc(tel)}">Llamar</a>
         <button class="boton boton--oscuro boton--pequeno" type="button" data-atendido="${c.id}" data-valor="true">Marcar atendido</button>`;
    return `<li class="contacto${urgente ? ' contacto--urgente' : ''}${c.atendido_en ? ' contacto--atendido' : ''}">
        <span class="contacto__inicial contacto__inicial--${esc(c.tipo)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
        <div class="contacto__cuerpo">
          <p class="contacto__linea"><strong>${esc(c.nombre)}</strong>
            <span class="estado tipo--${esc(c.tipo)}">${esc(TIPOS_CONTACTO[c.tipo] ?? c.tipo)}</span>
            <span class="${urgente ? 'dias dias--peligro' : 'nota'}" title="${esc(fechaHora(c.recibido_en))}">${esc(haceCuanto(recibido))}</span></p>
          <p class="contacto__mensaje${c.mensaje ? '' : ' contacto__mensaje--vacio'}">${esc(c.mensaje || 'Sin mensaje')}</p>
          <p class="contacto__datos"><a href="tel:${esc(tel)}">${esc(c.telefono)}</a>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</p>
        </div>
        ${coche}
        <div class="contacto__acciones">${acciones}</div>
      </li>`;
  };

  let peticion = 0; // si se cambia de filtro deprisa, solo se pinta la respuesta del último
  const pintar = async () => {
    const { estado, tipo } = Object.fromEntries(new FormData(form));
    const esta = ++peticion;
    const contactos = await api(`/contactos?estado=${encodeURIComponent(estado)}${tipo ? `&tipo=${encodeURIComponent(tipo)}` : ''}`);
    if (esta !== peticion) return;
    lista.innerHTML = contactos.map(tarjeta).join('');
    lista.hidden = !contactos.length;
    vacio.hidden = !!contactos.length;
    $('strong', vacio).textContent = estado === 'sin_atender' && !tipo ? 'Todo atendido' : 'No hay contactos con estos filtros';
  };

  lista.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('[data-atendido]');
    if (!boton) return;
    boton.disabled = true;
    try {
      await api(`/contactos/${boton.dataset.atendido}`, { method: 'PATCH', body: { atendido: boton.dataset.valor === 'true' } });
      await Promise.all([pintar(), resumen(), actualizarContadorContactos()]);
    } catch (e) {
      boton.disabled = false;
      mostrarErrores($('.error--lista') ?? cajaErrorEn(form), e, 'No se ha podido cambiar:');
    }
  });
  form.addEventListener('change', pintar);
  await Promise.all([pintar(), resumen()]);
}

// --- Clientes ----------------------------------------------------------------------------------

const ESTADOS_COMERCIALES = { nuevo: 'Nuevo', interesado: 'Interesado', me_lo_pienso: 'Me lo pienso', negociando: 'Negociando', ganado: 'Ganado', perdido: 'Perdido' };
const TIPOS_ACTIVIDAD = { llamada: 'Llamada', visita: 'Visita', whatsapp: 'WhatsApp', email: 'Correo', prueba: 'Prueba', tarea: 'Tarea', nota: 'Nota' };
const enlaceTel = (t) => `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ''))}">${esc(t)}</a>`;

// Lista con buscador a la izquierda, ficha del cliente abierto a la derecha y, debajo, el formulario
// que sirve para dar de alta y para editar. El cliente abierto va en la dirección (?id=).
async function paginaClientes() {
  const filtros = $('form.filtros');
  const lista = $('.terceros');
  const vacio = $('.ficha__principal .vacio');
  const ficha = $('#ficha');
  const seccion = $('#nuevo');
  const form = $('form', seccion);
  let abierto = Number(params.get('id')) || null;
  let clientes = [];

  const tarjeta = (c) => {
    const ultima = c.ultima_actividad ? `Hablado ${haceCuanto(fechaSql(c.ultima_actividad))}` : 'Todavía sin hablar';
    // Si ya ha comprado, cuántos coches; si no, en qué punto del embudo está
    const arriba = c.n_coches ? `${c.n_coches} ${c.n_coches === 1 ? 'coche' : 'coches'}` : ESTADOS_COMERCIALES[c.estado_comercial] ?? '';
    const datos = [
      c.nif ? `<span>${esc(c.nif)}</span>` : '<span class="nota">Sin DNI todavía</span>',
      c.telefono ? enlaceTel(c.telefono) : '',
      c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '',
      c.poblacion ? `<span>${esc(c.poblacion)}</span>` : '',
    ].join('');
    const etiqueta = c.activo
      ? `<span class="estado tipo-tercero--${esc(c.tipo)}">${esc(mayuscula(c.tipo))}</span>`
      : '<span class="estado tipo-tercero--apagado">Desactivado</span>';
    return `<li class="contacto tercero${c.id === abierto ? ' tercero--abierto' : ''}${c.activo ? '' : ' tercero--apagado'}">
        <span class="contacto__inicial tercero__inicial--${esc(c.tipo)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
        <div class="contacto__cuerpo">
          <p class="contacto__linea"><a class="tercero__nombre" href="?id=${c.id}" data-cliente="${c.id}"${c.id === abierto ? ' aria-current="true"' : ''}><strong>${esc(c.nombre)}</strong></a>
            ${etiqueta}${c.origen ? ` <span class="nota">${esc(mayuscula(c.origen))}</span>` : ''}</p>
          <p class="contacto__datos">${datos}</p>
        </div>
        <p class="tercero__resumen"><b${c.n_coches ? ' class="cifra"' : ''}>${esc(arriba)}</b>${esc(mayuscula(ultima))}</p>
      </li>`;
  };

  let peticion = 0; // al escribir deprisa, solo se pinta la respuesta de la última búsqueda
  const pintarLista = async () => {
    const { q = '', tipo = '', activos = '1' } = Object.fromEntries(new FormData(filtros));
    const esta = ++peticion;
    const todos = await api(`/clientes?activos=${activos === '0' ? 0 : 1}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
    if (esta !== peticion) return;
    clientes = tipo ? todos.filter((c) => c.tipo === tipo) : todos;
    lista.innerHTML = clientes.map(tarjeta).join('');
    lista.hidden = !clientes.length;
    vacio.hidden = !!clientes.length;
    const activosN = clientes.filter((c) => c.activo).length;
    const uno = clientes.length === 1;
    $('.lista-pie__cuantos').textContent = `${clientes.length} ${uno ? 'cliente' : 'clientes'}${activos === '0' ? '' : uno ? ' activo' : ' activos'}${q.trim() ? ' con esa búsqueda' : ''}`;
    if (!q.trim() && !tipo && activos !== '0') {
      const empresas = clientes.filter((c) => c.tipo === 'empresa').length;
      $('.contactos-resumen').innerHTML = `<strong class="cifra">${activosN}</strong> ${activosN === 1 ? 'cliente' : 'clientes'} <span>· ${activosN - empresas} particulares y ${empresas} ${empresas === 1 ? 'empresa' : 'empresas'}</span>`;
    }
  };

  const abrir = async (id, { sinHistorial = false } = {}) => {
    abierto = id;
    lista.querySelectorAll('.tercero').forEach((li) => {
      const suyo = Number($('[data-cliente]', li)?.dataset.cliente) === id;
      li.classList.toggle('tercero--abierto', suyo);
      $('[data-cliente]', li)?.toggleAttribute('aria-current', suyo);
    });
    if (!sinHistorial) history.replaceState(null, '', `?id=${id}`);
    const [c, actividades] = await Promise.all([api(`/clientes/${id}`), api(`/actividades?cliente=${id}`).catch(() => [])]);
    if (abierto !== id) return; // se abrió otro mientras llegaba
    pintarFicha(c, actividades);
  };

  const pintarFicha = (c, actividades) => {
    const direccion = [c.direccion, [c.codigo_postal, c.poblacion].filter(Boolean).join(' ') + (c.provincia ? ` (${c.provincia})` : '')]
      .filter((t) => t && t.trim()).map(esc).join('<br>');
    const fila = (titulo, valor) => (valor ? `<div><dt>${titulo}</dt><dd>${valor}</dd></div>` : '');
    const coches = c.coches.length
      ? c.coches.map((v) => `<li><span class="coche-celda"><a href="${urlCoche(v)}">${esc(tituloCoche(v))}</a><span class="matricula">${matricula(v.matricula)}</span></span><span class="cifra">${euros(v.pvp_cent)}</span></li>`).join('')
      : '<li class="nota">Todavía no nos ha comprado ninguno.</li>';
    // Lo último primero: lo hecho por cuándo se hizo; lo pendiente, por cuándo toca
    const cuando = (a) => a.hecha_en ? fechaSql(a.hecha_en) : a.programada_para ? new Date(a.programada_para.replace(' ', 'T')) : fechaSql(a.creado_en);
    const ultimas = [...actividades].sort((a, b) => cuando(b) - cuando(a)).slice(0, 5);
    const historial = ultimas.length
      ? ultimas.map((a) => `<li><time>${esc(cuando(a).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(TIPOS_ACTIVIDAD[a.tipo] ?? a.tipo)}${a.responsable_nombre ? ` · ${esc(a.responsable_nombre)}` : ''}${a.hecha_en ? '' : ' · <b>pendiente</b>'}</time>${esc(a.descripcion)}${a.resultado ? `<br><span class="nota">${esc(a.resultado)}</span>` : ''}</li>`).join('')
      : '<li class="nota">Nada apuntado todavía.</li>';
    ficha.innerHTML = `
      <section class="caja">
        <div class="ficha-tercero__cabeza">
          <span class="contacto__inicial tercero__inicial--${esc(c.tipo)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
          <div>
            <h2>${esc(c.nombre)}</h2>
            <p class="ficha-tercero__linea"><span class="estado tipo-tercero--${c.activo ? esc(c.tipo) : 'apagado'}">${c.activo ? esc(mayuscula(c.tipo)) : 'Desactivado'}</span>
              <label class="estado-crm crm--${esc(c.estado_comercial)}"><span class="oculto">En qué punto está</span>
                <select data-estado-comercial>${Object.entries(ESTADOS_COMERCIALES).map(([id, n]) => `<option value="${id}"${id === c.estado_comercial ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label></p>
          </div>
        </div>
        <dl class="reserva-activa">
          ${fila(c.tipo === 'empresa' ? 'CIF' : 'DNI / NIE', c.nif ? esc(c.nif) : '<span class="nota">Sin DNI todavía</span>')}
          ${fila('Teléfono', c.telefono && enlaceTel(c.telefono))}
          ${fila('Correo', c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`)}
          ${fila(c.direccion ? 'Dirección' : 'Población', direccion)}
          ${fila('Vino por', c.origen && esc(mayuscula(c.origen)))}
        </dl>
        ${c.notas ? `<p class="nota ficha-tercero__notas">${esc(c.notas)}</p>` : ''}
        <div class="ficha-tercero__acciones">
          ${c.telefono ? `<a class="boton boton--secundario boton--pequeno" href="tel:${esc(c.telefono.replace(/[^\d+]/g, ''))}">Llamar</a>` : ''}
          <button class="boton boton--secundario boton--pequeno" type="button" data-editar>Editar datos</button>
          <a class="boton boton--secundario boton--pequeno" href="crm.html?apuntar=${c.id}">Apuntar en el CRM</a>
        </div>
      </section>
      <section class="caja">
        <div class="caja__titulo"><h2>Coches que ha comprado</h2><span class="nota cifra">${c.coches.length}</span></div>
        <ul class="canales">${coches}</ul>
      </section>
      <section class="caja">
        <div class="caja__titulo"><h2>Facturas</h2></div>
        <p class="nota">Saldrán aquí cuando esté la facturación.</p>
      </section>
      <section class="caja">
        <div class="caja__titulo"><h2>Lo último que se habló</h2><a class="enlace-pequeno" href="crm.html">Ver en el CRM</a></div>
        <ol class="historial">${historial}</ol>
      </section>`;
    ficha.hidden = false;
    $('[data-editar]', ficha).addEventListener('click', () => editar(c));
    // El estado comercial se cambia aquí también (en el móvil no se puede arrastrar en el CRM)
    $('[data-estado-comercial]', ficha).addEventListener('change', async (ev) => {
      const select = ev.target;
      select.disabled = true;
      try {
        await api(`/clientes/${c.id}`, { method: 'PUT', body: { estado_comercial: select.value } });
        await pintarLista();
        await abrir(c.id, { sinHistorial: true });
      } catch (e) {
        select.value = c.estado_comercial;
        select.disabled = false;
        mostrarErrores(cajaErrorEn(filtros), e, 'No se ha podido cambiar el estado:');
      }
    });
  };

  // El mismo formulario para alta y edición. editando = null → alta.
  let editando = null;
  const caja = cajaErrorEn(form);
  caja.classList.add('campo--ancho'); // el formulario es una rejilla: el aviso, a todo el ancho
  const titulo = $('#nuevo-titulo');
  const boton = $('button[type="submit"]', form);
  const fijarOrigen = (valor) => {
    const select = form.elements.origen;
    const opcion = [...select.options].find((o) => o.value.toLowerCase() === String(valor ?? '').toLowerCase());
    if (!opcion && valor) select.add(new Option(mayuscula(valor), valor));
    select.value = opcion?.value ?? valor ?? '';
  };
  const limpiar = () => {
    editando = null;
    form.reset();
    caja.hidden = true;
    titulo.textContent = 'Nuevo cliente';
    boton.textContent = 'Guardar cliente';
  };
  const editar = (c) => {
    limpiar();
    editando = c;
    for (const campo of ['tipo', 'nombre', 'nif', 'telefono', 'email', 'direccion', 'codigo_postal', 'poblacion', 'provincia', 'pais', 'notas']) fijarValor(form, campo, c[campo]);
    fijarOrigen(c.origen);
    titulo.textContent = `Editar ${c.nombre}`;
    boton.textContent = 'Guardar cambios';
    seccion.scrollIntoView({ behavior: 'smooth' });
  };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    caja.hidden = true;
    // Solo los campos del formulario. Al editar, un campo vaciado se manda vacío (null) para borrarlo.
    const datos = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    if (!editando) for (const k of Object.keys(datos)) if (datos[k] === '') delete datos[k];
    boton.disabled = true;
    try {
      const guardado = editando
        ? await api(`/clientes/${editando.id}`, { method: 'PUT', body: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v])) })
        : await api('/clientes', { method: 'POST', body: datos });
      limpiar();
      abierto = guardado.id;
      await pintarLista();
      await abrir(guardado.id);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // la lista y su ficha, arriba
    } catch (e) {
      mostrarErrores(caja, e.status === 409 ? Object.assign(e, { lista: ['Ya hay un cliente con ese DNI, NIE o CIF. Búscalo arriba.'] }) : e,
        editando ? 'No se han podido guardar los cambios:' : 'No se ha podido dar de alta:');
    } finally {
      boton.disabled = false;
    }
  });
  $('.form-tercero__pie a', seccion)?.addEventListener('click', (ev) => { ev.preventDefault(); limpiar(); });
  document.querySelectorAll('a[href="#nuevo"]').forEach((a) => a.addEventListener('click', () => limpiar()));

  lista.addEventListener('click', (ev) => {
    const enlace = ev.target.closest('[data-cliente]');
    if (!enlace) return;
    ev.preventDefault();
    abrir(Number(enlace.dataset.cliente)).catch((e) => mostrarErrores(cajaErrorEn(filtros), e, 'No se ha podido abrir la ficha:'));
  });
  let espera;
  filtros.addEventListener('input', (ev) => {
    if (ev.target.name !== 'q') return;
    clearTimeout(espera);
    espera = setTimeout(pintarLista, 250);
  });
  filtros.addEventListener('change', (ev) => { if (ev.target.name !== 'q') pintarLista(); });
  filtros.addEventListener('submit', (ev) => { ev.preventDefault(); pintarLista(); });

  ficha.hidden = true;
  await pintarLista();
  // El de la dirección (?id=) o, si no hay, el primero de la lista
  const primero = abierto ?? clientes[0]?.id;
  if (primero) await abrir(primero, { sinHistorial: true });
}

// --- CRM ---------------------------------------------------------------------------------------

// Columna del embudo de cada estado comercial (las clases de la maqueta)
const COLUMNA_CRM = { nuevo: 'nuevo', interesado: 'interesado', me_lo_pienso: 'pienso', negociando: 'negociando', ganado: 'ganado', perdido: 'perdido' };
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// 'AAAA-MM-DD' en hora de aquí (programada_para va en hora de Rubí, no en UTC)
const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const horaLocal = (d) => d.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' });

// Arriba, lo de hoy (y lo atrasado sin hacer); abajo, el embudo de clientes, que se mueve arrastrando.
async function paginaCrm(usuario) {
  const gerencia = usuario.rol === 'gerencia';
  const deQuien = $('.cabecera__acciones .segmentos');
  const hoyCaja = $('.hoy');
  const tablero = $('.tablero--crm');
  const cajaError = document.createElement('div');
  cajaError.className = 'error error--lista';
  cajaError.setAttribute('role', 'alert');
  cajaError.hidden = true;
  hoyCaja.before(cajaError);

  // --- Hoy ---
  const pintarHoy = async () => {
    const responsable = $('input[name="responsable"]:checked', deQuien)?.value ?? 'yo'; // 'yo' o '' (de todos)
    const filtro = responsable ? `&responsable=${encodeURIComponent(responsable)}` : '';
    const hoy = diaLocal();
    const [deHoy, pendientes] = await Promise.all([api(`/actividades?dia=${hoy}${filtro}`), api(`/actividades?pendientes=1${filtro}`)]);
    // Lo atrasado: sin hacer y programado antes de hoy
    const atrasadas = pendientes.filter((a) => a.programada_para && a.programada_para.slice(0, 10) < hoy);
    const lista = [...atrasadas, ...deHoy];
    const ahora = new Date();
    const tarde = (a) => !a.hecha_en && new Date(a.programada_para.replace(' ', 'T')) < ahora;
    const fila = (a) => {
      const cuando = new Date(a.programada_para.replace(' ', 'T'));
      const quien = a.cliente_id
        ? `<a href="clientes.html?id=${a.cliente_id}"><strong>${esc(a.cliente_nombre)}</strong></a>`
        : `<a href="contactos.html"><strong>${esc(a.contacto_nombre ?? 'Contacto')}</strong></a>`;
      const retraso = tarde(a) ? ` <span class="dias dias--peligro">${esc(mayuscula(haceCuanto(cuando)))}</span>` : '';
      const otraPersona = !responsable && a.responsable_nombre ? ` <span class="nota">· ${esc(a.responsable_nombre)}</span>` : '';
      const fin = a.hecha_en
        ? `<span class="actividad__hecha">Hecha a las ${esc(horaLocal(fechaSql(a.hecha_en)))}</span>`
        : `<button class="boton boton--oscuro boton--pequeno" type="button" data-hecha="${a.id}">Hecho</button>`;
      const hora = a.programada_para.slice(0, 10) < hoy ? cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : a.programada_para.slice(11, 16).replace(/^0/, '');
      return `<li class="actividad${a.hecha_en ? ' actividad--hecha' : ''}${tarde(a) ? ' actividad--tarde' : ''}">
          <time class="actividad__hora cifra">${esc(hora)}</time>
          <span class="estado actividad--${esc(a.tipo)}">${esc(TIPOS_ACTIVIDAD[a.tipo] ?? a.tipo)}</span>
          <p class="actividad__texto">${quien}${esc(a.descripcion)}${otraPersona}${retraso}</p>
          ${fin}
        </li>`;
    };
    const hechas = lista.filter((a) => a.hecha_en).length;
    const conRetraso = lista.filter(tarde).length;
    $('#hoy-titulo').textContent = `Hoy, ${DIAS_SEMANA[ahora.getDay()]} ${ahora.getDate()}`;
    $('.caja__titulo .nota', hoyCaja).textContent = lista.length ? `${hechas} de ${lista.length} ${lista.length === 1 ? 'hecha' : 'hechas'}` : '';
    $('.hoy__lista', hoyCaja).innerHTML = lista.length
      ? lista.map(fila).join('')
      : `<li class="actividad"><span></span><span></span><p class="actividad__texto">Nada programado para hoy${responsable ? '' : ' en todo el equipo'}.</p></li>`;
    const pendientesHoy = lista.length - hechas;
    $('.contactos-resumen').innerHTML = `<strong class="cifra">${pendientesHoy}</strong> por hacer hoy${conRetraso ? ` <span class="portada__alerta">· ${conRetraso} con retraso</span>` : ''}`;
  };

  hoyCaja.addEventListener('click', async (ev) => {
    const boton = ev.target.closest('[data-hecha]');
    if (!boton) return;
    boton.disabled = true;
    try {
      await api(`/actividades/${boton.dataset.hecha}/hecha`, { method: 'PATCH', body: {} });
      cajaError.hidden = true;
      await Promise.all([pintarHoy(), pintarEmbudo()]);
    } catch (e) {
      boton.disabled = false;
      mostrarErrores(cajaError, e, 'No se ha podido marcar como hecha:');
    }
  });
  deQuien.addEventListener('change', () => pintarHoy().catch((e) => mostrarErrores(cajaError, e, 'No se ha podido cargar:')));

  // --- Embudo ---
  let clientes = new Map();
  const pintarEmbudo = async () => {
    const [lista, pendientes] = await Promise.all([api('/clientes'), api('/actividades?pendientes=1')]);
    clientes = new Map(lista.map((c) => [String(c.id), c]));
    // La próxima cosa que hay que hacer con cada cliente: la pendiente más temprana
    const proxima = new Map();
    for (const a of pendientes) {
      if (!a.cliente_id) continue;
      const otra = proxima.get(a.cliente_id);
      if (!otra || (a.programada_para ?? '9999') < (otra.programada_para ?? '9999')) proxima.set(a.cliente_id, a);
    }
    // Los ganados y perdidos solo se quedan 30 días (desde su último cambio)
    const reciente = (c) => !['ganado', 'perdido'].includes(c.estado_comercial) || diasDesde(c.actualizado_en) <= 30;
    const visibles = lista.filter(reciente);
    const tarjeta = (c) => {
      const p = proxima.get(c.id);
      const cerrado = ['ganado', 'perdido'].includes(c.estado_comercial);
      // Lo siguiente que hay que hacer, en rojo si ya va atrasado. En los cerrados, sin nada programado no se dice.
      const atrasada = p?.programada_para && new Date(p.programada_para.replace(' ', 'T')) < new Date();
      const cuandoToca = p?.programada_para
        ? p.programada_para.slice(0, 10) === diaLocal() ? `hoy a las ${p.programada_para.slice(11, 16).replace(/^0/, '')}` : new Date(p.programada_para.replace(' ', 'T')).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
        : '';
      const siguiente = p
        ? `<span${atrasada ? ' class="ficha-mini__tarde"' : ''}>${esc(TIPOS_ACTIVIDAD[p.tipo] ?? p.tipo)}${cuandoToca ? ` ${esc(cuandoToca)}` : ''}</span>`
        : cerrado ? '<span></span>' : '<span class="ficha-mini__nada">Nada programado</span>';
      const dias = c.ultima_actividad ? diasDesde(c.ultima_actividad) : null;
      const textoDias = dias == null ? 'Sin hablar' : dias === 0 ? 'Hablado hoy' : dias === 1 ? 'Hablado ayer' : `Hace ${dias} días`;
      const claseDias = dias == null ? '' : dias > 14 ? ' dias--peligro' : dias > 7 ? ' dias--aviso' : '';
      const nota = p?.descripcion ?? c.notas ?? (c.n_coches ? `${c.n_coches} ${c.n_coches === 1 ? 'coche comprado' : 'coches comprados'}` : '');
      return `<a class="ficha-mini${c.estado_comercial === 'perdido' ? ' ficha-mini--perdido' : ''}" href="clientes.html?id=${c.id}" draggable="true" data-id="${c.id}">
          <span class="ficha-mini__cuerpo">
            <span class="ficha-mini__coche">${esc(c.nombre)}</span>
            ${nota ? `<span class="nota">${esc(nota)}</span>` : ''}
          </span>
          <span class="ficha-mini__datos">${siguiente}<span class="dias${claseDias}" title="Última vez que se habló con él">${esc(textoDias)}</span></span>
        </a>`;
    };
    tablero.innerHTML = Object.entries(ESTADOS_COMERCIALES).map(([id, nombre]) => {
      const suyos = visibles.filter((c) => c.estado_comercial === id);
      return `<div class="columna columna--${COLUMNA_CRM[id]}${id === 'perdido' ? ' columna--fuera' : ' columna--tramo'}" data-estado="${id}" id="columna-${id}"${formaTramo(id)}>
          <h2 class="columna__titulo">${esc(nombre)} <span class="cifra">${suyos.length}</span></h2>
          ${suyos.map(tarjeta).join('')}
        </div>`;
    }).join('');
    const enMarcha = visibles.filter((c) => !['ganado', 'perdido'].includes(c.estado_comercial)).length;
    $('.tablero-cabecera__pista').textContent = `${enMarcha} ${enMarcha === 1 ? 'cliente' : 'clientes'} en marcha. Arrastra un cliente a otro tramo para cambiar su estado.`;
  };

  // El embudo: cada estado es un tramo que se estrecha hacia «Ganado», con sus clientes dentro.
  // Cada tramo se recorta en trapecio hasta el ancho del siguiente; los clientes van con margen a los
  // lados para no salirse del borde inclinado. «Perdido» va aparte, debajo: no es un paso del embudo.
  tablero.className = 'embudo-crm';
  const TRAMOS = ['nuevo', 'interesado', 'me_lo_pienso', 'negociando', 'ganado'];
  const ANCHOS = [100, 88, 76, 64, 52, 42]; // el último es el borde de abajo de «Ganado»
  const formaTramo = (id) => {
    const i = TRAMOS.indexOf(id);
    if (i < 0) return '';
    const lado = ((ANCHOS[i] - ANCHOS[i + 1]) / 2 / ANCHOS[i]) * 100; // lo que entra cada lado, en % del tramo
    return ` style="width:${ANCHOS[i]}%;clip-path:polygon(0 0,100% 0,${(100 - lado).toFixed(2)}% 100%,${lado.toFixed(2)}% 100%);--lado:${lado.toFixed(2)}%"`;
  };

  // Arrastrar una tarjeta a otra columna cambia su estado comercial (PUT /api/clientes/:id)
  let arrastrado = null;
  const limpiar = () => tablero.querySelectorAll('.columna--encima').forEach((c) => c.classList.remove('columna--encima'));
  tablero.addEventListener('dragstart', (ev) => {
    const ficha = ev.target.closest?.('.ficha-mini');
    if (!ficha) return;
    arrastrado = clientes.get(ficha.dataset.id);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', ficha.dataset.id);
    ficha.classList.add('ficha-mini--arrastrando');
  });
  tablero.addEventListener('dragend', (ev) => {
    ev.target.closest?.('.ficha-mini')?.classList.remove('ficha-mini--arrastrando');
    limpiar();
    arrastrado = null;
  });
  tablero.addEventListener('dragover', (ev) => {
    const columna = ev.target.closest?.('.columna');
    if (!columna || !arrastrado || columna.dataset.estado === arrastrado.estado_comercial) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (!columna.classList.contains('columna--encima')) { limpiar(); columna.classList.add('columna--encima'); }
  });
  tablero.addEventListener('dragleave', (ev) => {
    const columna = ev.target.closest?.('.columna');
    if (columna && !columna.contains(ev.relatedTarget)) columna.classList.remove('columna--encima');
  });
  tablero.addEventListener('drop', async (ev) => {
    const columna = ev.target.closest?.('.columna');
    const c = arrastrado;
    if (!columna || !c) return;
    ev.preventDefault();
    limpiar();
    if (columna.dataset.estado === c.estado_comercial) return;
    try {
      await api(`/clientes/${c.id}`, { method: 'PUT', body: { estado_comercial: columna.dataset.estado } });
      cajaError.hidden = true;
      await pintarEmbudo();
    } catch (e) {
      mostrarErrores(cajaError, e, `No se ha podido mover a ${c.nombre}:`);
    }
  });

  // --- Apuntar actividad ---
  const boton = $('.cabecera__acciones a.boton');
  const seccion = document.createElement('section');
  seccion.className = 'caja form-tercero form-actividad';
  seccion.hidden = true;
  const responsables = gerencia ? (await api('/usuarios').catch(() => [])).filter((u) => u.activo) : [];
  const ahoraMas = new Date(Date.now() + 3600000);
  seccion.innerHTML = `
    <div class="caja__titulo"><h2>Apuntar actividad</h2><span class="nota"><em class="obligatorio">*</em> obligatorio</span></div>
    <form class="rejilla">
      <label class="campo">
        <span class="campo__nombre">Tipo <em>*</em></span>
        <select name="tipo" required>${Object.entries(TIPOS_ACTIVIDAD).map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select>
      </label>
      <label class="campo campo--doble">
        <span class="campo__nombre">Cliente <em>*</em></span>
        <select name="cliente_id" required><option value="">Elige el cliente</option></select>
        <span class="campo__ayuda">¿No está? Dalo de alta en <a href="clientes.html#nuevo">Clientes</a>.</span>
      </label>
      <label class="campo">
        <span class="campo__nombre">Cuándo</span>
        <input type="datetime-local" name="programada_para" value="${diaLocal(ahoraMas)}T${String(ahoraMas.getHours()).padStart(2, '0')}:00">
        <span class="campo__ayuda">Vacío en una nota.</span>
      </label>
      ${gerencia ? `<label class="campo">
        <span class="campo__nombre">Quién</span>
        <select name="responsable_id">${responsables.map((u) => `<option value="${u.id}"${u.id === usuario.id ? ' selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select>
      </label>` : ''}
      <label class="campo campo--ancho">
        <span class="campo__nombre">Qué hay que hacer <em>*</em></span>
        <textarea name="descripcion" maxlength="2000" required placeholder="Llamarle para explicarle la financiación del Golf a 48 meses"></textarea>
      </label>
      <div class="form-tercero__pie campo--ancho">
        <button class="boton boton--secundario" type="button" data-cancelar>Cancelar</button>
        <button class="boton" type="submit">Apuntar</button>
      </div>
    </form>`;
  hoyCaja.before(seccion);
  const form = $('form', seccion);
  const errorForm = cajaErrorEn(form);
  errorForm.classList.add('campo--ancho');
  const cerrar = () => { seccion.hidden = true; form.reset(); errorForm.hidden = true; };

  const abrirForm = (clienteId) => {
    const select = form.elements.cliente_id;
    select.length = 1;
    for (const c of [...clientes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) select.add(new Option(c.nombre, c.id));
    if (clienteId) select.value = String(clienteId);
    seccion.hidden = false;
    seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (clienteId ? form.elements.descripcion : form.elements.tipo).focus();
  };
  boton.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!seccion.hidden) return cerrar();
    abrirForm();
  });
  $('[data-cancelar]', form).addEventListener('click', cerrar);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const cuerpo = {
      tipo: d.tipo,
      cliente_id: Number(d.cliente_id),
      descripcion: d.descripcion.trim(),
      programada_para: d.programada_para ? d.programada_para.replace('T', ' ') : null,
      ...(d.responsable_id ? { responsable_id: Number(d.responsable_id) } : {}),
    };
    const enviar = $('button[type="submit"]', form);
    enviar.disabled = true;
    try {
      await api('/actividades', { method: 'POST', body: cuerpo });
      cerrar();
      await Promise.all([pintarHoy(), pintarEmbudo()]);
    } catch (e) {
      mostrarErrores(errorForm, e, 'No se ha podido apuntar:');
    } finally {
      enviar.disabled = false;
    }
  });

  await Promise.all([pintarHoy(), pintarEmbudo()]);
  // Desde la ficha del cliente («Apuntar en el CRM»): el formulario abierto con él ya elegido
  if (params.get('apuntar')) abrirForm(params.get('apuntar'));
}

// --- Facturas (solo gerencia) -----------------------------------------------------------------

const ESTADOS_COBRO = { borrador: 'Borrador', pendiente: 'Pendiente', parcial: 'Parcial', cobrada: 'Cobrada', vencida: 'Vencida', anulada: 'Anulada', rectificativa: 'Rectificativa' };
const FORMAS_PAGO = { transferencia: 'Transferencia', contado: 'Contado', tarjeta: 'Tarjeta', a_la_vista: 'A la vista', pago_30: 'Pago a 30 días', pago_30_60: 'Pago a 30 y 60 días' };
const FORMAS_COBRO = { ...FORMAS_PAGO, financiera: 'Financiera', senal: 'Señal de la reserva' };
// Céntimos con dos decimales: en una factura no se redondea al euro
const euros2 = (cent) => (cent == null ? '—' : `${(cent / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`);
const aCent = (texto) => {
  const n = Number(String(texto).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const fechaLarga = (dia) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

async function paginaFacturas() {
  const filtros = $('form.filtros');
  const tbody = $('.tabla--facturas tbody');
  const vacio = $('.contenido > .vacio');
  const cajaError = cajaErrorEn(filtros);
  let facturas = [];

  // Borradores en el filtro (la maqueta no los traía)
  const segmentos = $('fieldset.segmentos', filtros);
  if (!$('input[value="borrador"]', segmentos)) {
    $('label:nth-child(1)', segmentos).insertAdjacentHTML('afterend', '<label><input type="radio" name="estado" value="borrador"><span>Borradores</span></label>');
  }

  const fila = (f) => {
    const coche = f.vehiculo_id
      ? `<span class="coche-celda"><a href="coche.html?id=${f.vehiculo_id}">${esc([f.marca, f.modelo].filter(Boolean).join(' '))}</a><span class="matricula">${matricula(f.matricula)}</span></span>`
      : '—';
    const parte = f.total_cent > 0 ? Math.min(100, Math.round((f.cobrado_cent / f.total_cent) * 100)) : 0;
    const cobrado = f.tipo === 'venta' && f.estado === 'emitida'
      ? `<span class="cobrado"><span>${euros(f.cobrado_cent)}</span><span class="cobrado__barra${parte === 100 ? ' cobrado__barra--entera' : ''}"><span style="width: ${parte}%"></span></span></span>`
      : '—';
    const vence = f.estado_cobro === 'vencida'
      ? `<span class="dias dias--peligro factura__vence">${esc(mayuscula(haceCuanto(new Date(`${f.vencimiento}T23:59:59`))))}</span>`
      : ['pendiente', 'parcial'].includes(f.estado_cobro) && f.vencimiento ? `<span class="nota factura__vence">Vence el ${esc(new Date(`${f.vencimiento}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</span>`
        : f.rectificada_por ? `<span class="nota factura__vence">Rectificada por la ${esc(f.rectificada_por)}</span>` : '';
    const ver = `<a class="boton boton--secundario boton--pequeno" href="factura.html?id=${f.id}">${f.estado === 'borrador' ? 'Revisar' : 'Ver'}</a>`;
    const acciones = f.estado === 'borrador'
      ? `${ver} <button class="boton boton--pequeno" type="button" data-emitir="${f.id}">Emitir</button>`
      : ['pendiente', 'parcial', 'vencida'].includes(f.estado_cobro)
        ? `${f.estado_cobro === 'vencida' && f.cliente_telefono ? `<a class="boton boton--oscuro boton--pequeno" href="tel:${esc(f.cliente_telefono.replace(/[^\d+]/g, ''))}">Llamar</a> ` : ''}<button class="boton boton--secundario boton--pequeno" type="button" data-cobrar="${f.id}">Apuntar cobro</button> ${ver}`
        : ver;
    return `<tr class="${f.estado_cobro === 'vencida' ? 'fila-vencida' : ''}" data-id="${f.id}">
        <td class="t-titulo"><b class="cifra">${f.codigo ? esc(f.codigo) : '<span class="nota">Sin número</span>'}</b></td>
        <td class="cifra" data-rotulo="Fecha">${esc(new Date(`${f.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</td>
        <td data-rotulo="Cliente"><a href="clientes.html?id=${f.cliente_id}">${esc(f.cliente_nombre)}</a></td>
        <td data-rotulo="Coche">${coche}</td>
        <td class="derecha cifra" data-rotulo="Total">${euros(f.total_cent)}</td>
        <td class="derecha cifra" data-rotulo="Cobrado">${cobrado}</td>
        <td data-rotulo="Estado"><span class="estado cobro--${esc(f.estado_cobro)}">${esc(ESTADOS_COBRO[f.estado_cobro] ?? f.estado_cobro)}</span>${vence}</td>
        <td class="derecha acciones-factura">${acciones}</td>
      </tr>`;
  };

  let peticion = 0;
  const pintar = async () => {
    const { q = '', estado = '' } = Object.fromEntries(new FormData(filtros));
    const esta = ++peticion;
    const { facturas: lista, resumen } = await api(`/facturas?${new URLSearchParams({ ...(q.trim() ? { q: q.trim() } : {}), ...(estado ? { estado } : {}) })}`);
    if (esta !== peticion) return;
    facturas = lista;
    tbody.innerHTML = lista.map(fila).join('');
    $('.tabla-caja').hidden = !lista.length;
    vacio.hidden = !!lista.length;
    $('strong', vacio).textContent = estado === 'vencida' ? 'Ninguna factura vencida' : 'Ninguna factura con estos filtros';
    $('p', vacio).textContent = estado === 'vencida' ? 'Todo lo que ha pasado de fecha está cobrado.' : 'Prueba con otro estado o búsqueda.';
    $('.lista-pie__cuantos').textContent = `${lista.length} ${lista.length === 1 ? 'factura' : 'facturas'}${resumen.borradores ? ` · ${resumen.borradores} sin emitir` : ''}`;
    const [pendiente, vencido] = document.querySelectorAll('.portada__cifras > div');
    pendiente.innerHTML = `<dt>Pendiente de cobro<small>${resumen.pendientes} ${resumen.pendientes === 1 ? 'factura' : 'facturas'}</small></dt><dd class="cifra">${euros(resumen.pendiente_cent)}</dd>`;
    vencido.innerHTML = `<dt>Vencido<small>${resumen.vencidas ? `${resumen.vencidas} ${resumen.vencidas === 1 ? 'factura' : 'facturas'}, desde el ${esc(new Date(`${resumen.vencida_mas_antigua}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }))}` : 'Nada vencido'}</small></dt><dd class="cifra${resumen.vencidas ? ' baja' : ''}">${euros(resumen.vencido_cent)}</dd>`;
  };

  // Apuntar un cobro: una fila debajo de la factura con el importe (lo que queda), la forma y la fecha
  const abrirCobro = (id) => {
    tbody.querySelector('.fila-cobro')?.remove();
    const f = facturas.find((x) => x.id === id);
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    tr.insertAdjacentHTML('afterend', `<tr class="fila-cobro"><td colspan="8">
        <form class="cobro-form">
          <label class="campo"><span class="campo__nombre">Importe</span><span class="con-unidad" data-unidad="€"><input name="importe" inputmode="decimal" value="${(f.saldo_cent / 100).toFixed(2).replace('.', ',')}" required></span></label>
          <label class="campo"><span class="campo__nombre">Cómo</span><select name="forma_pago">${Object.entries(FORMAS_COBRO).filter(([k]) => k !== 'senal').map(([k, n]) => `<option value="${k}"${k === (f.forma_pago ?? 'transferencia') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label class="campo"><span class="campo__nombre">Fecha</span><input type="date" name="fecha" value="${diaLocal()}" required></label>
          <div class="cobro-form__botones">
            <button class="boton boton--pequeno" type="submit">Apuntar ${euros2(f.saldo_cent)}</button>
            <button class="boton boton--secundario boton--pequeno" type="button" data-senal>Aplicar la señal de la reserva</button>
            <button class="boton boton--secundario boton--pequeno" type="button" data-cerrar>Cancelar</button>
          </div>
        </form></td></tr>`);
    const form = $('.fila-cobro form', tbody);
    const enviar = $('button[type="submit"]', form);
    form.elements.importe.addEventListener('input', () => {
      const c = aCent(form.elements.importe.value);
      enviar.textContent = Number.isNaN(c) ? 'Apuntar' : `Apuntar ${euros2(c)}`;
    });
    const guardar = async (cuerpo) => {
      try {
        await api(`/facturas/${id}/cobros`, { method: 'POST', body: cuerpo });
        cajaError.hidden = true;
        await pintar();
      } catch (e) {
        mostrarErrores(cajaError, e, 'No se ha podido apuntar el cobro:');
      }
    };
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const importe = aCent(form.elements.importe.value);
      if (!(importe > 0)) return mostrarErrores(cajaError, { lista: ['El importe tiene que ser un número mayor que 0, por ejemplo 1.500,00'] }, 'No se ha podido apuntar el cobro:');
      guardar({ importe_cent: importe, forma_pago: form.elements.forma_pago.value, fecha: form.elements.fecha.value });
    });
    $('[data-senal]', form).addEventListener('click', () => guardar({ senal: true }));
    $('[data-cerrar]', form).addEventListener('click', () => form.closest('tr').remove());
    form.elements.importe.focus();
  };

  tbody.addEventListener('click', async (ev) => {
    const cobrar = ev.target.closest('[data-cobrar]');
    if (cobrar) return abrirCobro(Number(cobrar.dataset.cobrar));
    const emitir = ev.target.closest('[data-emitir]');
    if (emitir) {
      emitir.disabled = true;
      try {
        await api(`/facturas/${emitir.dataset.emitir}/emitir`, { method: 'POST' });
        cajaError.hidden = true;
        await pintar();
      } catch (e) {
        emitir.disabled = false;
        mostrarErrores(cajaError, e, 'No se ha podido emitir:');
      }
    }
  });

  // Filtros
  let espera;
  filtros.addEventListener('input', (ev) => { if (ev.target.name === 'q') { clearTimeout(espera); espera = setTimeout(pintar, 250); } });
  filtros.addEventListener('change', (ev) => { if (ev.target.name !== 'q') pintar(); });
  filtros.addEventListener('submit', (ev) => { ev.preventDefault(); pintar(); });

  // La lista primero: si se pintara al final, borraría una fila de cobro abierta mientras carga lo demás
  await pintar();
  await Promise.all([prepararAltaFactura(), prepararEmpresaYSeries()]);
}

// «Nueva factura»: coche (de los que aún no tienen factura), cliente y condiciones. Crea un borrador.
async function prepararAltaFactura() {
  const cabecera = $('.cabecera--portada > div');
  cabecera.insertAdjacentHTML('beforeend', '<p class="cabecera__acciones-factura"><a class="boton" href="#nueva-factura" data-nueva>Nueva factura</a></p>');
  const [coches, clientes, { facturas }] = await Promise.all([api('/vehiculos'), api('/clientes'), api('/facturas')]);
  const facturados = new Set(facturas.filter((f) => f.tipo === 'venta' && f.estado === 'emitida' && !f.anulada).map((f) => f.vehiculo_id));
  const posibles = coches.filter((v) => ['publicado', 'reservado', 'vendido', 'entregado'].includes(v.estado) && !facturados.has(v.id));
  const seccion = document.createElement('section');
  seccion.className = 'caja form-tercero';
  seccion.id = 'nueva-factura';
  seccion.hidden = true;
  seccion.innerHTML = `
    <div class="caja__titulo"><h2>Nueva factura</h2><span class="nota">Se guarda como borrador: se revisa y luego se emite</span></div>
    <form class="rejilla">
      <label class="campo campo--doble"><span class="campo__nombre">Coche <em>*</em></span>
        <select name="vehiculo_id" required><option value="">Elige el coche</option>${posibles.map((v) => `<option value="${v.id}">${esc(tituloCoche(v))} · ${esc(v.matricula)} · ${esc(estado(v.estado).nombre)}</option>`).join('')}</select></label>
      <label class="campo campo--doble"><span class="campo__nombre">Cliente <em>*</em></span>
        <select name="cliente_id" required><option value="">Elige el cliente</option>${clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.nif ? ` · ${esc(c.nif)}` : ' · sin DNI'}</option>`).join('')}</select>
        <span class="campo__ayuda">¿No está? Dalo de alta en <a href="clientes.html#nuevo">Clientes</a> con su DNI y dirección.</span></label>
      <label class="campo"><span class="campo__nombre">Precio de venta</span><span class="con-unidad" data-unidad="€"><input name="precio" inputmode="decimal"></span>
        <span class="campo__ayuda">Con impuestos. Vacío: el PVP del coche.</span></label>
      <label class="campo"><span class="campo__nombre">Régimen</span><select name="regimen"><option value="">El del coche</option><option value="REBU">REBU</option><option value="general">IVA general</option></select></label>
      <label class="campo"><span class="campo__nombre">Gestoría (suplidos)</span><span class="con-unidad" data-unidad="€"><input name="suplidos" inputmode="decimal" placeholder="0,00"></span></label>
      <label class="campo"><span class="campo__nombre">Fecha</span><input type="date" name="fecha" value="${diaLocal()}"></label>
      <label class="campo"><span class="campo__nombre">Vence</span><input type="date" name="vencimiento"></label>
      <label class="campo"><span class="campo__nombre">Forma de pago</span><select name="forma_pago">${Object.entries(FORMAS_PAGO).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
      <label class="campo"><span class="campo__nombre">Garantía</span><select name="garantia_tipo"><option value="directa">Directa</option><option value="comprada">Comprada</option><option value="sin">Sin garantía</option></select></label>
      <label class="campo"><span class="campo__nombre">Meses</span><input type="number" name="garantia_meses" min="0" max="36" value="12"></label>
      <label class="campo"><span class="campo__nombre">Km a la entrega</span><input type="number" name="km_entrega" min="0"></label>
      <label class="campo campo--ancho"><span class="campo__nombre">Observaciones</span><textarea name="observaciones" maxlength="2000"></textarea></label>
      <div class="form-tercero__pie campo--ancho">
        <button class="boton boton--secundario" type="button" data-cancelar>Cancelar</button>
        <button class="boton" type="submit">Guardar borrador</button>
      </div>
    </form>`;
  $('.tabla-caja').before(seccion);
  const form = $('form', seccion);
  const error = cajaErrorEn(form);
  error.classList.add('campo--ancho');
  // Al elegir el coche: su PVP y sus km
  form.elements.vehiculo_id.addEventListener('change', () => {
    const v = posibles.find((x) => String(x.id) === form.elements.vehiculo_id.value);
    form.elements.precio.placeholder = v?.pvp_cent != null ? (v.pvp_cent / 100).toFixed(2).replace('.', ',') : '';
    if (v?.kilometros != null && !form.elements.km_entrega.value) form.elements.km_entrega.value = v.kilometros;
    // Si ya tiene comprador (se apuntó al venderlo), se propone
    if (v?.comprador_id && !form.elements.cliente_id.value) form.elements.cliente_id.value = String(v.comprador_id);
  });
  const abrir = (ev) => { ev?.preventDefault(); seccion.hidden = false; seccion.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('[data-nueva]').addEventListener('click', abrir);
  $('[data-cancelar]', form).addEventListener('click', () => { seccion.hidden = true; form.reset(); error.hidden = true; });
  // Desde la ficha de un coche: facturas.html?coche=ID abre el alta con él elegido
  if (params.get('coche')) {
    form.elements.vehiculo_id.value = params.get('coche');
    form.elements.vehiculo_id.dispatchEvent(new Event('change'));
    abrir();
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const cuerpo = { vehiculo_id: Number(d.vehiculo_id), cliente_id: Number(d.cliente_id), fecha: d.fecha, forma_pago: d.forma_pago,
      garantia_tipo: d.garantia_tipo, garantia_meses: d.garantia_meses === '' ? null : Number(d.garantia_meses) };
    if (d.precio.trim()) cuerpo.precio_cent = aCent(d.precio);
    if (d.suplidos.trim()) cuerpo.suplidos_cent = aCent(d.suplidos);
    if (d.regimen) cuerpo.regimen = d.regimen;
    if (d.vencimiento) cuerpo.vencimiento = d.vencimiento;
    if (d.km_entrega !== '') cuerpo.km_entrega = Number(d.km_entrega);
    if (d.observaciones.trim()) cuerpo.observaciones = d.observaciones.trim();
    if ([cuerpo.precio_cent, cuerpo.suplidos_cent].some((c) => c !== undefined && !(c >= 0))) {
      return mostrarErrores(error, { lista: ['Los importes van como 12.900,00'] }, 'No se ha podido guardar:');
    }
    try {
      const f = await api('/facturas', { method: 'POST', body: cuerpo });
      location.href = `factura.html?id=${f.id}`; // a revisarla antes de emitir
    } catch (e) {
      mostrarErrores(error, e, 'No se ha podido guardar:');
    }
  });
}

// Abajo, plegados: los datos fiscales de la empresa (salen en cada factura) y la numeración de las series
async function prepararEmpresaYSeries() {
  const [empresa, series] = await Promise.all([api('/facturas/empresa'), api('/facturas/series')]);
  const anio = diaLocal().slice(2, 4);
  const ventas = series.find((s) => s.serie === `V${anio}`);
  const campo = (nombre, etiqueta, valor, extra = '') => `<label class="campo${extra}"><span class="campo__nombre">${etiqueta}</span><input name="${nombre}" value="${esc(valor ?? '')}"></label>`;
  const sinDireccion = !empresa.direccion || !empresa.codigo_postal || !empresa.poblacion;
  const caja = document.createElement('details');
  caja.className = 'caja ajustes-factura';
  caja.open = sinDireccion;
  caja.innerHTML = `
    <summary><b>Datos de la empresa y numeración</b>${sinDireccion ? ' <span class="estado cobro--vencida">Falta la dirección: no se puede emitir</span>' : ''}</summary>
    <form class="rejilla" data-empresa>
      ${campo('razon_social', 'Razón social', empresa.razon_social, ' campo--doble')}
      ${campo('nif', 'CIF', empresa.nif)}
      ${campo('direccion', 'Dirección fiscal', empresa.direccion, ' campo--doble')}
      ${campo('codigo_postal', 'Código postal', empresa.codigo_postal)}
      ${campo('poblacion', 'Población', empresa.poblacion)}
      ${campo('provincia', 'Provincia', empresa.provincia)}
      ${campo('telefono', 'Teléfono', empresa.telefono)}
      ${campo('email', 'Correo', empresa.email)}
      ${campo('iban', 'IBAN (para transferencias)', empresa.iban, ' campo--doble')}
      ${campo('registro_mercantil', 'Registro Mercantil (pie de la factura)', empresa.registro_mercantil, ' campo--ancho')}
      <div class="form-tercero__pie campo--ancho"><button class="boton" type="submit">Guardar datos</button></div>
    </form>
    <form class="rejilla" data-serie>
      <p class="nota campo--ancho">Serie de ventas de este año: <b>V${anio}</b>. ${ventas?.emitidas
        ? `La siguiente factura será la <b>${esc(ventas.codigo_siguiente)}</b>.`
        : 'Antes de la primera factura, pon el último número que se dio en Pymecar para seguir sin saltos.'}</p>
      ${ventas?.emitidas ? '' : `<label class="campo"><span class="campo__nombre">Último número de Pymecar</span><input type="number" min="0" name="ultimo" value="${ventas?.ultimo ?? 0}"></label>
      <div class="form-tercero__pie"><button class="boton boton--secundario" type="submit">Guardar numeración</button></div>`}
    </form>`;
  $('.contenido').append(caja);
  const formEmpresa = $('[data-empresa]', caja);
  const error = cajaErrorEn(formEmpresa);
  error.classList.add('campo--ancho');
  formEmpresa.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries([...new FormData(formEmpresa)].map(([k, v]) => [k, v.trim() || null]));
    // Razón social y NIF solo si cambian (con facturas emitidas no se pueden tocar)
    for (const k of ['razon_social', 'nif']) if (d[k] === empresa[k]) delete d[k];
    try {
      Object.assign(empresa, await api('/facturas/empresa', { method: 'PUT', body: d }));
      error.hidden = true;
      $('summary .estado', caja)?.remove();
      $('button[type="submit"]', formEmpresa).textContent = 'Guardado';
      setTimeout(() => { $('button[type="submit"]', formEmpresa).textContent = 'Guardar datos'; }, 1500);
    } catch (e) {
      mostrarErrores(error, e, 'No se han podido guardar:');
    }
  });
  $('[data-serie]', caja).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const r = await api(`/facturas/series/V${anio}`, { method: 'PUT', body: { ultimo: Number(ev.target.elements.ultimo.value) } });
      ev.target.querySelector('.nota').innerHTML = `La siguiente factura será la <b>${esc(r.codigo_siguiente)}</b>.`;
    } catch (e) {
      mostrarErrores(error, e, 'No se ha podido guardar la numeración:');
    }
  });
}

// La factura en A4 (factura.html?id=). Emitida: con la copia de los datos de cuando se emitió.
// Borrador: con los datos de ahora y la marca de borrador; se emite desde la barra.
async function paginaFactura() {
  const id = Number(params.get('id'));
  const hoja = $('.documento');
  const barra = $('.documento-barra__acciones');
  const cajaError = $('.documento-error');
  if (!id) { hoja.innerHTML = '<p>Falta el número de la factura.</p>'; return; }

  const pintar = async () => {
    const f = await api(`/facturas/${id}`);
    const [empresa, cliente, coche] = f.estado === 'emitida'
      ? [f.datos_empresa, f.datos_cliente, f.datos_vehiculo]
      : await Promise.all([api('/facturas/empresa'), api(`/clientes/${f.cliente_id}`), f.vehiculo_id ? api(`/vehiculos/${f.vehiculo_id}`) : null]);
    document.title = `${f.codigo ?? 'Borrador'} · ${cliente.nombre} · ProService`;
    const rebu = f.regimen === 'REBU';
    const rectificativa = f.tipo === 'rectificativa';
    const direccion = (x) => [x.direccion, [x.codigo_postal, x.poblacion].filter(Boolean).join(' ') + (x.provincia ? ` (${x.provincia})` : '')].filter((t) => t && t.trim()).map(esc).join('<br>');
    const titulo = f.estado === 'borrador' ? 'Borrador de factura' : rectificativa ? 'Factura rectificativa' : 'Factura';
    const lineaCoche = coche
      ? `<b>${esc([coche.marca, coche.modelo, coche.version].filter(Boolean).join(' '))}</b>
         <small>Matrícula ${esc(coche.matricula ?? '—')}${coche.bastidor ? ` · Bastidor ${esc(coche.bastidor)}` : ''}${coche.fecha_matriculacion ? ` · 1.ª matriculación ${esc(fechaCorta(coche.fecha_matriculacion))}` : ''}${(f.km_entrega ?? coche.kilometros) != null ? ` · ${cifra(f.km_entrega ?? coche.kilometros)} km` : ''}</small>`
      : 'Vehículo';
    const totales = rebu
      ? `<div class="total"><span>Total</span><span>${euros2(f.total_cent)}</span></div>`
      : `<div><span>Base imponible</span><span>${euros2(f.base_cent)}</span></div>
         <div><span>IVA ${f.iva_pct} %</span><span>${euros2(f.iva_cent)}</span></div>
         ${f.suplidos_cent ? `<div><span>Suplidos</span><span>${euros2(f.suplidos_cent)}</span></div>` : ''}
         <div class="total"><span>Total</span><span>${euros2(f.total_cent)}</span></div>`;
    const garantia = f.garantia_tipo === 'sin' ? 'Sin garantía.'
      : f.garantia_tipo ? `Garantía ${f.garantia_tipo === 'comprada' ? 'contratada' : 'directa del vendedor'} de ${f.garantia_meses ?? 12} meses.` : '';
    const rectificada = f.rectifica_id ? await api(`/facturas/${f.rectifica_id}`).catch(() => null) : null;
    hoja.className = `documento factura${f.estado === 'borrador' ? ' documento--borrador' : ''}${f.anulada ? ' documento--anulada' : ''}`;
    hoja.innerHTML = `
      <header class="factura__cabeza">
        <div class="factura__empresa">
          <strong>${esc(empresa.razon_social)}</strong>
          <p>CIF ${esc(empresa.nif)}</p>
          <p>${direccion(empresa) || '<span style="color:var(--peligro)">Falta la dirección fiscal</span>'}</p>
          <p>${[empresa.telefono, empresa.email].filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        <div class="factura__numero">
          <h1>${titulo}</h1>
          <p class="codigo">${f.codigo ? esc(f.codigo) : 'Sin número'}</p>
          <p>Fecha: ${esc(fechaLarga(f.fecha))}</p>
          ${f.vencimiento && !rectificativa ? `<p>Vencimiento: ${esc(fechaLarga(f.vencimiento))}</p>` : ''}
        </div>
      </header>
      <section class="factura__partes">
        <div><h2>Cliente</h2><p><b>${esc(cliente.nombre)}</b></p><p>${cliente.nif ? `${cliente.tipo === 'empresa' ? 'CIF' : 'DNI/NIE'} ${esc(cliente.nif)}` : '<span style="color:var(--peligro)">Falta el DNI, NIE o CIF</span>'}</p><p>${direccion(cliente) || '<span style="color:var(--peligro)">Falta la dirección</span>'}</p></div>
        <div><h2>Forma de pago</h2><p>${esc(FORMAS_PAGO[f.forma_pago] ?? f.forma_pago ?? '—')}</p>${f.forma_pago === 'transferencia' && empresa.iban ? `<p>IBAN ${esc(empresa.iban.replace(/(.{4})/g, '$1 ').trim())}</p>` : ''}${f.uso_destino ? `<p>Uso: ${esc(f.uso_destino)}</p>` : ''}</div>
      </section>
      ${rectificativa ? `<section class="factura__bloque"><h2>Rectifica</h2><p>La factura ${esc(rectificada?.codigo ?? '')}${rectificada ? ` del ${esc(fechaLarga(rectificada.fecha))}` : ''}. Motivo: ${esc(f.motivo ?? '')}</p></section>` : ''}
      <table class="factura__lineas">
        <thead><tr><th>Concepto</th><th class="importe">Importe</th></tr></thead>
        <tbody>
          <tr><td>${lineaCoche}</td><td class="importe">${euros2(rebu ? f.precio_cent : f.base_cent)}</td></tr>
          ${f.suplidos_cent && rebu ? `<tr><td>Gastos de gestoría (suplidos)<small>Pagados por cuenta del cliente</small></td><td class="importe">${euros2(f.suplidos_cent)}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="factura__totales">${totales}</div>
      ${rebu ? '<p class="factura__mencion">Régimen especial de los bienes usados</p>' : ''}
      ${garantia || f.observaciones ? `<section class="factura__bloque"><h2>Condiciones</h2>${garantia ? `<p>${esc(garantia)}</p>` : ''}${f.observaciones ? `<p>${esc(f.observaciones)}</p>` : ''}</section>` : ''}
      ${empresa.registro_mercantil ? `<footer class="factura__pie">${esc(empresa.registro_mercantil)}</footer>` : ''}`;

    // La barra: imprimir siempre; emitir un borrador; rectificar una emitida sin rectificar
    barra.innerHTML = `${f.estado === 'borrador' ? '<button class="boton boton--pequeno" type="button" data-emitir>Emitir factura</button>' : ''}
      ${f.estado === 'emitida' && f.tipo === 'venta' && !f.anulada ? '<input name="motivo" placeholder="Motivo para rectificarla" maxlength="500"><button class="boton boton--secundario boton--pequeno" type="button" data-rectificar>Rectificar</button>' : ''}
      ${f.rectificada_por ? `<span class="nota" style="color:#c5c9ce">Rectificada por la ${esc(f.rectificada_por)}</span>` : ''}
      <button class="boton boton--secundario boton--pequeno" type="button" data-imprimir>Imprimir o guardar en PDF</button>`;
    $('[data-imprimir]', barra).addEventListener('click', () => window.print());
    $('[data-emitir]', barra)?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        await api(`/facturas/${id}/emitir`, { method: 'POST' });
        cajaError.hidden = true;
        await pintar();
      } catch (e) {
        ev.target.disabled = false;
        mostrarErrores(cajaError, e, 'No se ha podido emitir:');
      }
    });
    $('[data-rectificar]', barra)?.addEventListener('click', async (ev) => {
      const motivo = $('input[name="motivo"]', barra).value.trim();
      if (!motivo) return mostrarErrores(cajaError, { lista: ['Escribe el motivo de la rectificación.'] }, 'No se ha podido rectificar:');
      ev.target.disabled = true;
      try {
        const r = await api(`/facturas/${id}/rectificar`, { method: 'POST', body: { motivo } });
        location.href = `factura.html?id=${r.id}`;
      } catch (e) {
        ev.target.disabled = false;
        mostrarErrores(cajaError, e, 'No se ha podido rectificar:');
      }
    });
  };
  await pintar();
}

// --- Informes (solo gerencia) -----------------------------------------------------------------

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (mes) => { const [a, m] = mes.split('-'); return `${MESES[m - 1]} ${a}`; };
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

async function paginaInformes() {
  const form = $('.cabecera__acciones');
  const selector = form.elements.mes;
  const exportar = $('a.boton', form);

  const pintar = async (mes) => {
    const datos = await api(`/informes${mes ? `?mes=${mes}` : ''}`);
    const { resumen: r, ventas, stock } = datos;
    selector.innerHTML = datos.meses.map((m) => `<option value="${m}"${m === datos.mes ? ' selected' : ''}>${esc(mayuscula(nombreMes(m)))}</option>`).join('');
    exportar.href = `/api/informes/ventas.csv?mes=${datos.mes}`;
    exportar.setAttribute('download', `ventas-${datos.mes}.csv`);

    // Las cuatro cifras de arriba
    const comparado = r.vendidos === r.vendidos_mes_anterior ? 'Igual que el mes anterior'
      : `${r.vendidos > r.vendidos_mes_anterior ? 'Más' : 'Menos'} que el mes anterior (${r.vendidos_mes_anterior})`;
    const cifras = [
      ['Coches vendidos', cifra(r.vendidos), comparado],
      ['Margen neto', r.margen_cent == null ? '—' : euros(r.margen_cent),
        r.margen_medio_cent == null ? 'Sin ventas con margen' : `${euros(r.margen_medio_cent)} por coche${r.ventas_sin_margen ? ` · ${r.ventas_sin_margen} sin coste apuntado` : ''}`],
      ['Resultado del mes', r.resultado_cent == null ? '—' : euros(r.resultado_cent),
        `Margen neto − ${euros(r.gastos_estructura_cent)} de gastos de la tienda`],
      ['Días hasta vender', r.dias_medios_venta == null ? '—' : cifra(r.dias_medios_venta), 'Media de los vendidos este mes'],
      ['En stock', cifra(stock.total), `${stock.deposito} en depósito, ${stock.propios} propios`],
    ];
    $('.cifras').classList.add('cifras--5');
    $('.cifras').innerHTML = cifras.map(([rotulo, valor, nota]) => `<div class="cifras__dato">
        <span class="rotulo">${esc(rotulo)}</span><strong class="cifra">${esc(valor)}</strong><span class="nota">${esc(nota)}</span>
      </div>`).join('');

    // Ventas del mes
    $('.ficha__principal .caja__titulo h2').textContent = `Ventas de ${nombreMes(datos.mes).split(' ')[0]}`;
    $('.ficha__principal tbody').innerHTML = ventas.length
      ? ventas.map((v) => `<tr>
          <td class="cifra">${esc(fechaSql(v.fecha_venta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</td>
          <td><span class="coche-celda"><a href="coche.html?id=${v.id}">${esc([v.marca, v.modelo, v.version].filter(Boolean).join(' '))}</a><span class="matricula">${matricula(v.matricula)}</span></span></td>
          <td>${esc(v.vendio ?? '—')}</td>
          <td class="derecha cifra">${euros(v.precio_venta_cent)}</td>
          <td class="derecha cifra">${euros(v.margen_cent)}</td>
          <td class="derecha cifra">${cifra(v.dias_en_stock)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="nota">Ninguna venta este mes.</td></tr>';
    $('.tabla-pie').textContent = ventas.length
      ? `${ventas.length} ${ventas.length === 1 ? 'venta' : 'ventas'}. El margen es neto: después del IVA de la venta y con los gastos de cada coche.`
      : '';

    // Stock por antigüedad: la barra es la parte del stock en cada tramo
    $('.tramos').innerHTML = stock.tramos.map((t) => `<li class="${t.desde >= 90 ? 'tramos--peligro' : t.desde >= 60 ? 'tramos--aviso' : ''}">
        <span>${esc(t.nombre)}</span><span class="tramos__barra"><span style="width: ${stock.total ? Math.round((t.n / stock.total) * 100) : 0}%"></span></span><strong class="cifra">${t.n}</strong>
      </li>`).join('');

    // Los que más llevan
    $('.ficha__lateral .canales').innerHTML = stock.mas_antiguos.length
      ? stock.mas_antiguos.map((v) => `<li><a href="coche.html?id=${v.id}">${esc([v.marca, v.modelo, v.version].filter(Boolean).join(' '))}</a>
          <span class="dias cifra${v.dias > 90 ? ' dias--peligro' : v.dias > 60 ? ' dias--aviso' : ''}">${v.dias} días</span></li>`).join('')
      : '<li class="nota">No hay coches en stock.</li>';
  };

  selector.addEventListener('change', () => pintar(selector.value));
  await pintar(params.get('mes'));
}

// --- Arranque ----------------------------------------------------------------------------------

const PAGINAS = {
  'index.html': paginaTablero,
  'coches.html': paginaListado,
  'coche.html': paginaFicha,
  'coche-reservado.html': paginaFicha,
  'coche-nuevo.html': paginaAlta,
  // La rellena fotos.js; aquí solo el menú y esperar a que avise (como mucho 5 s)
  'fotos.html': () => new Promise((listo) => {
    if (document.documentElement.dataset.fotosListas) return listo();
    document.addEventListener('fotos-listas', listo, { once: true });
    setTimeout(listo, 5000);
  }),
  'usuarios.html': paginaUsuarios,
  'contactos.html': paginaContactos,
  'clientes.html': paginaClientes,
  'facturas.html': paginaFacturas,
  'factura.html': paginaFactura,
  'crm.html': paginaCrm,
  'informes.html': paginaInformes,
};

(async () => {
  if (PAGINA === 'login.html') return paginaLogin();
  try {
    const usuario = await api('/auth/yo');
    if (usuario.rol !== 'gerencia' && ['informes.html', 'usuarios.html', 'proveedores.html', 'gastos.html', 'facturas.html', 'factura.html'].includes(PAGINA)) return (location.href = 'index.html');
    const menu = prepararMenu(usuario);
    const pagina = PAGINAS[PAGINA];
    if (pagina) await pagina(usuario);
    else avisoMaqueta();
    await menu;
  } catch (e) {
    if (e.message !== 'Sin sesión') {
      console.error(e);
      mostrarErrores($('.error--lista'), e, 'No se han podido cargar los datos:');
    }
  } finally {
    // Con los datos reales ya puestos, se enseña el contenido por partes (ver «.listo» en panel.css)
    entrarPorPartes();
    document.documentElement.classList.add('listo');
  }
})();

// Cascada al abrir una página: primero la cabecera y luego cada bloque, uno detrás de otro. Si un
// bloque tiene piezas que también entran (las columnas del tablero, las filas de una tabla), entran
// las piezas y el bloque no, para que no se funda dos veces. Como mucho 0,7 s de espera para la última.
function entrarPorPartes() {
  const PIEZAS = [
    '.contenido > :not(template):not(script)',
    // La cabecera negra no se mueve (dejaría ver una franja clara arriba): entra lo de dentro
    '.contenido > header > *',
    '.tablero > .columna',
    '.ficha > *', '.alta > *',
    '.tabla tbody tr:nth-child(-n+12)',
    '.contactos > li:nth-child(-n+12)',
    '.fotos-orden > li:nth-child(-n+12)',
  ].join(', ');
  const todas = [...document.querySelectorAll(PIEZAS)].filter((el) => !el.hidden && el.getClientRects().length);
  const piezas = todas.filter((el) => el.matches('.tabla-caja') || !todas.some((otra) => otra !== el && el.contains(otra)));
  // Lo que va fijo a la pantalla (la barra de guardar del alta) entra aparte, desde abajo. El bloque
  // que lo contiene solo se funde: si se moviera, lo fijo se movería con él y saltaría al acabar.
  const fijas = [...document.querySelectorAll('.barra-guardar')];
  fijas.forEach((el) => {
    el.style.setProperty('--i', Math.min(piezas.length, 16));
    el.classList.add('entra-abajo');
    el.addEventListener('animationend', function fin(ev) {
      if (ev.target !== el) return;
      el.classList.remove('entra-abajo');
      el.removeEventListener('animationend', fin);
    });
  });
  piezas.forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 16));
    el.classList.add('entra');
    if (fijas.some((f) => el.contains(f))) el.classList.add('entra--sin-mover');
    const fin = (ev) => {
      if (ev.target !== el) return; // las piezas de dentro también avisan al terminar
      el.classList.remove('entra', 'entra--sin-mover');
      el.removeEventListener('animationend', fin);
    };
    el.addEventListener('animationend', fin);
  });
}
