// En desarrollo, Vite hace de proxy de /api hacia la API (puerto 3001).
export async function api(ruta, opciones = {}) {
  const res = await fetch(`/api${ruta}`, {
    headers: { 'content-type': 'application/json' },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}
