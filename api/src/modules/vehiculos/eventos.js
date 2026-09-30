// alCambiarEstado: otros módulos se enganchan aquí sin tocar el módulo de vehículos.
// Ejemplo (David): al pasar a vendido, marcar las publicaciones como 'retirar'.
//
// Los oyentes se ejecutan DENTRO de la transacción del cambio de estado: si uno lanza
// un error, el cambio entero se deshace. Por eso tienen que ser síncronos y solo tocar
// la base de datos. Nada de llamadas a WordPress ni correos aquí: eso va a una cola.
const oyentes = [];

export function registrarAlCambiarEstado(fn) {
  oyentes.push(fn);
}

export function emitirCambioEstado(db, cambio) {
  for (const fn of oyentes) fn(db, cambio);
}
