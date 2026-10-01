// Llamadas a la API desde fotos.js. La sesión va en una cookie que pone la API al entrar.
// Hace lo mismo que api() de panel.js (misma ruta /api y mismo 401); panel.js no exporta nada
// y por eso está aparte. Si algún día panel.js exporta su api(), esto sobra.

// Sin sesión, a la pantalla de entrar. Al entrar, panel.js vuelve a esta página.
export function irAEntrar() {
  const pagina = location.pathname.split('/').pop() || 'index.html';
  location.href = `login.html?volver=${encodeURIComponent(pagina + location.search)}`;
}

// pide('/fotos/3') o pide('/fotos/3', { method: 'PUT', body: {...} }).
// body puede ser un objeto (se manda como JSON) o un FormData (para subir ficheros).
// Si la API contesta con error, lanza un Error con el mensaje que manda la API.
export async function pide(ruta, { method = 'GET', body } = {}) {
  const esForm = body instanceof FormData;
  const res = await fetch(`/api${ruta}`, {
    method,
    headers: body && !esForm ? { 'content-type': 'application/json' } : undefined,
    body: body && !esForm ? JSON.stringify(body) : body,
  });

  if (res.status === 401 && !ruta.startsWith('/auth/')) {
    irAEntrar();
    throw new Error('Hay que iniciar sesión');
  }

  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new Error(datos?.error || `La API ha contestado ${res.status}`);
  return datos;
}
