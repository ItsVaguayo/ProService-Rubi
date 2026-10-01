import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { rutasAuth } from './modules/auth/routes.js';
import { requiereSesion, requiereRol } from './modules/auth/sesiones.js';
import { rutasVehiculos } from './modules/vehiculos/routes.js';
import { rutasFotos } from './modules/fotos/routes.js';
import { rutasPublicacion } from './modules/publicacion/routes.js';
import { rutasWordPress } from './modules/publicacion/rutas-wordpress.js';

export function crearApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // detrás de nginx, req.ip es la IP real

  // En desarrollo el panel pasa por el proxy de Vite y en producción va en el mismo dominio,
  // así que CORS solo se abre a los orígenes que se pongan en CORS_ORIGENES (separados por comas).
  const origenes = (process.env.CORS_ORIGENES || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origenes.length) app.use(cors({ origin: origenes, credentials: true }));

  app.use(express.json({ limit: '100kb' }));

  // Fotos subidas. Solo lectura, sin listar carpetas.
  app.use('/media', express.static(resolve(process.env.UPLOADS_PATH || './data/uploads'), { index: false, dotfiles: 'deny' }));

  // Solo para el sistema de pruebas: servir las maquetas de frontend/ en el mismo origen que la API,
  // así el panel usa la cookie de sesión sin CORS. En producción el panel se sirve aparte.
  if (process.env.SERVIR_FRONTEND) {
    app.use(express.static(resolve(process.env.SERVIR_FRONTEND), { index: 'index.html' }));
  }

  // Público
  app.get('/api/salud', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', rutasAuth(db));
  app.use('/api/publicacion', rutasPublicacion(db)); // el feed de la web; lo interno de David irá con sesión

  // Con sesión
  const conSesion = requiereSesion(db);
  app.use('/api/vehiculos', conSesion, rutasVehiculos(db));
  app.use('/api/fotos', conSesion, rutasFotos(db));
  app.use('/api/wordpress', conSesion, requiereRol('gerencia'), rutasWordPress(db));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'No existe' }));
  app.use(manejarErrores);
  return app;
}

// Errores de la base de datos traducidos a respuestas entendibles. Lo demás, 500 sin detalles.
function manejarErrores(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande' });

  switch (err.code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
      return res.status(409).json({ error: 'Ya existe un registro con ese dato', detalle: err.message });
    case 'SQLITE_CONSTRAINT_CHECK':
      return res.status(400).json({ error: 'Valor no permitido', detalle: err.message });
    case 'SQLITE_CONSTRAINT_NOTNULL':
      return res.status(400).json({ error: 'Falta un dato obligatorio', detalle: err.message });
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return res.status(400).json({ error: 'Hace referencia a algo que no existe' });
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno' });
}
