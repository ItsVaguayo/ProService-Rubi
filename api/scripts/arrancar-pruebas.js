// Arranca la API contra la base de pruebas de `npm run seed` y sirve el panel en el mismo puerto:
//   npm run dev:pruebas   → http://localhost:3001/panel/login.html (jaume@pruebas.local / pruebas-local-123)
// No lee el .env a propósito: así nunca apunta a la base real.
process.env.DB_PATH = './data/pruebas.db';
process.env.UPLOADS_PATH = './data/uploads-pruebas';
process.env.SERVIR_FRONTEND = '../frontend';
await import('../src/server.js');
