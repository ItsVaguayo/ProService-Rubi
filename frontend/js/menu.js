// En el <head>, sin defer: el navegador no pinta nada hasta ejecutarlo. Prepara el menú para quien entró por última
// vez en este navegador (lo guarda panel.js, ver fijarUsuario), antes del primer pintado y sin esperar a la API:
//   · data-rol: los enlaces de gerencia solo salen con gerencia (panel.css, «Menú según el rol»);
//   · --usuario-nombre y --usuario-rol: el CSS dibuja con ellas el pie del menú mientras está vacío;
//   · .cargando: la maqueta no se ve mientras llegan los datos.
// panel.js (un módulo, llega después) lo confirma todo con /auth/yo. No puede ir en la página: la CSP no deja
// scripts en línea. Y no puede tocar el menú: en <head> todavía no existe.
(function () {
  var html = document.documentElement;
  html.classList.add('cargando');
  var u = null;
  try { u = JSON.parse(localStorage.getItem('usuario') || 'null'); } catch (e) { /* sin almacenamiento */ }
  if (!u || !u.nombre || !u.rol) return;
  var cadena = function (t) { return '"' + String(t).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ') + '"'; };
  html.setAttribute('data-rol', u.rol);
  html.classList.add('usuario-conocido');
  html.style.setProperty('--usuario-nombre', cadena(u.nombre));
  html.style.setProperty('--usuario-rol', cadena(u.rol === 'gerencia' ? 'Gerencia' : 'Comercial'));
})();
