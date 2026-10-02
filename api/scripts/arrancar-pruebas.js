// Arranca la API contra la base de pruebas de `npm run seed` y sirve el panel en el mismo puerto:
//   npm run dev:pruebas   → http://localhost:3001/panel/login.html (jaume@pruebas.local / pruebas-local-123)
// No lee el .env a propósito: así nunca apunta a la base real.
process.env.DB_PATH = './data/pruebas.db';
process.env.UPLOADS_PATH = './data/uploads-pruebas';
process.env.SERVIR_FRONTEND = '../frontend';
// El login enseña una nota de desarrollo con estos usuarios (GET /api/pruebas/acceso). Sin esta
// variable, como en producción, esa ruta no existe.
const { CONTRASENA_PRUEBAS, USUARIOS_PRUEBAS } = await import('./usuarios-pruebas.js');
process.env.ACCESO_PRUEBAS = JSON.stringify(USUARIOS_PRUEBAS.map(({ email, rol }) => ({ email, rol, contrasena: CONTRASENA_PRUEBAS })));
await import('../src/server.js');
