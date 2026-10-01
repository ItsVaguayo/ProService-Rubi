import { abrirDb } from './db.js';
import { crearApp } from './app.js';
import { configDesdeEntorno, sincronizar } from './modules/publicacion/wordpress.js';
import { caducarReservas } from './modules/vehiculos/reservas.js';

const port = process.env.PORT || 3001;
const db = abrirDb();
crearApp(db).listen(port, () => console.log(`API en http://localhost:${port}`));

// Reservas que caducan solas: al arrancar y cada 10 minutos. Un fallo no tumba la API.
const revisarReservas = () => {
  try {
    const n = caducarReservas(db);
    if (n) console.log(`[reservas] ${n} caducada${n === 1 ? '' : 's'}: el coche vuelve a «Publicado»`);
  } catch (e) {
    console.error(`[reservas] ${e.message}`);
  }
};
revisarReservas();
setInterval(revisarReservas, 10 * 60 * 1000).unref();

// Publicación en WordPress cada WP_SINCRONIZAR_MINUTOS (si hay credenciales). Un fallo no tumba la API.
const wp = configDesdeEntorno();
const minutos = Number(process.env.WP_SINCRONIZAR_MINUTOS || 0);
if (wp && minutos > 0) {
  const pasada = () => sincronizar(db, wp).then(
    (r) => console.log(`[wordpress] creados ${r.creados} · actualizados ${r.actualizados} · retirados ${r.retirados} · errores ${r.errores.length}`),
    (e) => console.error(`[wordpress] ${e.message}`),
  );
  setTimeout(pasada, 5000);
  setInterval(pasada, minutos * 60 * 1000).unref();
  console.log(`Publicación en ${wp.url} cada ${minutos} min`);
}
