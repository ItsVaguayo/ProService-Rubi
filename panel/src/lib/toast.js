// Avisos cortos abajo a la derecha. toast('Coche guardado') o toast('No se pudo…', 'error').
const oyentes = new Set();

export function toast(texto, tipo = 'ok') {
  const aviso = { id: Date.now() + Math.random(), texto, tipo };
  oyentes.forEach((fn) => fn(aviso));
}

export function escucharToasts(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
