// Va justo después del menú, sin defer: se ejecuta antes de que el navegador pinte la página. Pone el menú como
// toca para quien entró por última vez en este navegador (lo guarda panel.js, ver fijarUsuario): el usuario del pie
// y, con data-rol, los enlaces de gerencia (panel.css, «Menú según el rol»). Y marca .cargando para que no se vea
// la maqueta mientras llegan los datos. panel.js (un módulo) llega después y confirma todo con /auth/yo.
// No puede ir dentro de la página: la CSP del panel no deja scripts en línea.
(function () {
  var html = document.documentElement;
  html.classList.add('cargando');
  var u = null;
  try { u = JSON.parse(localStorage.getItem('usuario') || 'null'); } catch (e) { /* sin almacenamiento */ }
  if (!u || !u.nombre || !u.rol) return;
  html.setAttribute('data-rol', u.rol);
  html.classList.add('usuario-conocido');
  var caja = document.querySelector('.menu__usuario');
  if (!caja) return;
  var nombre = document.createElement('strong');
  nombre.textContent = u.nombre;
  var salir = document.createElement('a');
  salir.href = '#';
  salir.setAttribute('data-salir', '');
  salir.textContent = 'Salir';
  caja.replaceChildren(nombre, ' ' + (u.rol === 'gerencia' ? 'Gerencia' : 'Comercial') + ' · ', salir);
})();
