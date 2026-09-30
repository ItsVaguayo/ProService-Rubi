import express from 'express';
import cors from 'cors';
import { rutasVehiculos } from './modules/vehiculos/routes.js';
import { rutasFotos } from './modules/fotos/routes.js';
import { rutasPublicacion } from './modules/publicacion/routes.js';

export function crearApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/salud', (_req, res) => res.json({ ok: true }));
  app.use('/api/vehiculos', rutasVehiculos(db));
  app.use('/api/fotos', rutasFotos(db));
  app.use('/api/publicacion', rutasPublicacion(db));

  return app;
}
