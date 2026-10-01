// Llamadas a la API desde el panel. La sesión va en una cookie que pone la API al entrar.

// Sin sesión, a la pantalla de entrar. Al entrar se vuelve a la página en la que estaba.
export function irAEntrar() {
  const volver = encodeURIComponent(location.pathname + location.search);
  location.href = `login.html?volver=${volver}`;
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
