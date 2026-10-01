// Pantalla de entrar: manda correo y contraseña a la API y vuelve a la página de antes.
import { pide } from './api.js';

const form = document.querySelector('.login__form');
const error = form.querySelector('.error');
const boton = form.querySelector('button[type="submit"]');

// Solo se vuelve a páginas del propio panel, nunca a otra web
function destino() {
  const volver = new URLSearchParams(location.search).get('volver');
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : 'index.html';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  boton.disabled = true;
  try {
    await pide('/auth/entrar', {
      method: 'POST',
      body: { email: form.email.value, contrasena: form.contrasena.value },
    });
    location.href = destino();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
  }
});
