// Publicación en WordPress desde la consola.
//   npm run wordpress --workspace api -- diagnostico
//   npm run wordpress --workspace api -- sincronizar [--forzar]
//   npm run wordpress --workspace api -- vincular <id del coche> <id del post>
//   npm run wordpress --workspace api -- estado
// Lee WP_URL, WP_USUARIO, WP_CLAVE_APLICACION (y WP_MAPA, WP_TIPO, WP_TAXONOMIA) del entorno o del .env.
import { abrirDb } from '../src/db.js';
import { configDesdeEntorno, diagnosticar, sincronizar, vincular } from '../src/modules/publicacion/wordpress.js';

const [orden, ...resto] = process.argv.slice(2);
const cfg = configDesdeEntorno();
if (!cfg && orden !== 'estado') {
  console.error('Falta WP_URL (y WP_USUARIO y WP_CLAVE_APLICACION) en el entorno o en el .env');
  process.exit(1);
}

if (orden === 'diagnostico') {
  const d = await diagnosticar(cfg);
  console.log(`Web: ${d.url}${d.sitio ? ` («${d.sitio}»)` : ''}`);
  console.log(`Conexión: ${d.conectado ? 'sí' : 'no'} · Sesión: ${d.autenticado ? `${d.usuario} (${d.roles.join(', ')})` : 'no'}`);
  if (d.autenticado) {
    console.log(`Puede: ${Object.entries(d.puede).map(([k, v]) => `${k} ${v ? 'sí' : 'no'}`).join(' · ')}`);
    console.log(`Tipo «${d.tipo ?? '—'}»: se puede escribir ${d.camposEscribibles.join(', ') || '—'}`);
    console.log(`ACF en REST: ${d.acf.expuesto ? `sí (${Object.keys(d.acf.campos).join(', ')})` : 'no'}`);
    for (const m of d.mapa) console.log(`  ${m.campo.padEnd(24)} → ${m.acf.padEnd(18)} ${m.estado}`);
  }
  for (const a of d.avisos) console.log(`AVISO: ${a}`);
  process.exit(d.autenticado && d.tipo ? 0 : 1);
}

const db = abrirDb();
if (orden === 'sincronizar') {
  const r = await sincronizar(db, cfg, { forzar: resto.includes('--forzar') });
  console.log(`Creados ${r.creados} · actualizados ${r.actualizados} · sin cambios ${r.sin_cambios} · retirados ${r.retirados} · fotos subidas ${r.fotos_subidas} · pendientes ${r.fotos_pendientes}`);
  for (const a of r.avisos) console.log(`AVISO: ${a}`);
  for (const e of r.errores) console.error(`ERROR: ${e}`);
  process.exitCode = r.errores.length ? 1 : 0;
} else if (orden === 'vincular') {
  vincular(db, Number(resto[0]), Number(resto[1]));
  console.log(`Coche ${resto[0]} vinculado al post ${resto[1]}. La próxima sincronización lo actualiza y conserva su URL.`);
} else if (orden === 'estado') {
  console.table(db.prepare(`SELECT v.referencia, v.marca || ' ' || v.modelo AS coche, v.estado, w.wp_post_id, w.estado AS en_wordpress, w.ultimo_error
                              FROM vehiculos v LEFT JOIN wp_posts w ON w.vehiculo_id = v.id ORDER BY v.id`).all());
} else {
  console.error('Órdenes: diagnostico | sincronizar [--forzar] | vincular <coche> <post> | estado');
  process.exitCode = 1;
}
db.close();
