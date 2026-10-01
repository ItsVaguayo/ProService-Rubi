import { abrirDb } from './db.js';
import { crearApp } from './app.js';
import { configDesdeEntorno, sincronizar } from './modules/publicacion/wordpress.js';
import { caducarReservas } from './modules/vehiculos/reservas.js';

const port = process.env.PORT || 3001;
const db = abrirDb();
crearApp(db).listen(port, () => console.log(`API en http://localhost:${port}`));

// Reservas vencidas: también se cierran al leer coches, pero así caducan aunque nadie abra el panel.
const caducar = () => {
  const n = caducarReservas(db);
  if (n) console.log(`[reservas] ${n} caducada(s): sus coches vuelven a «Publicado»`);
};
caducar();
setInterval(caducar, 60 * 60 * 1000).unref();

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
