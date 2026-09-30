// En desarrollo, Vite hace de proxy de /api hacia la API (puerto 3001).
// La sesión va en una cookie httpOnly: el panel no guarda ningún token.
export async function api(ruta, opciones = {}) {
  const res = await fetch(`/api${ruta}`, {
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(datos.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return datos;
}
