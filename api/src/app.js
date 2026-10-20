import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rutasAuth } from './modules/auth/routes.js';
import { requiereSesion, requiereRol } from './modules/auth/sesiones.js';
import { rutasVehiculos } from './modules/vehiculos/routes.js';
import { rutasFotos } from './modules/fotos/routes.js';
import { rutasWordPress } from './modules/publicacion/rutas-wordpress.js';
import { rutasUsuarios } from './modules/usuarios/routes.js';
import { rutasContactos, rutasContactosPublicas } from './modules/contactos/routes.js';
import { rutasInformes } from './modules/informes/routes.js';
import { rutasActividades } from './modules/crm/routes.js';
import { rutasIncentivos } from './modules/incentivos/routes.js';
import { rutasGastos } from './modules/gastos/routes.js';
import { rutasFacturas } from './modules/facturacion/routes.js';
import { rutasContratos } from './modules/contratos/routes.js';
import { rutasAvisos } from './modules/avisos/routes.js';
import { rutasPortales } from './modules/publicacion/rutas-portales.js';
import { rutasCorreos } from './modules/correo/routes.js';
import { rutasCitas, rutasCitasPublicas } from './modules/citas/routes.js';
import { rutasClientes, rutasProveedores } from './modules/terceros/routes.js';
import { cabecerasDeSeguridad, mismoOrigen } from './seguridad.js';

// La versión desplegada: deploy/desplegar.sh deja el commit en VERSION, en la raíz de cada versión.
// En los ordenadores del equipo no hay fichero: «desarrollo».
export function versionDesplegada(ruta = new URL('../../VERSION', import.meta.url)) {
  try {
    return readFileSync(ruta, 'utf8').trim() || 'desarrollo';
  } catch {
    return 'desarrollo';
  }
}

export function crearApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback'); // detrás de nginx, req.ip es la IP real

  // En desarrollo el panel pasa por el proxy de Vite y en producción va en el mismo dominio,
  // así que CORS solo se abre a los orígenes que se pongan en CORS_ORIGENES (separados por comas).
  const origenes = (process.env.CORS_ORIGENES || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origenes.length) app.use(cors({ origin: origenes, credentials: true }));
  app.use(cabecerasDeSeguridad);
  app.use('/api', mismoOrigen(origenes));

  app.use(express.json({ limit: '100kb' }));

  // Las fotos subidas no se sirven sueltas: el panel las pide con sesión en /api/fotos/:id/:fotoId/archivo
  // (incluidas las de daños y las de coches sin publicar). WordPress las recibe del conector, que lee del disco.

  // Solo para el sistema de pruebas: servir las maquetas de frontend/ en el mismo origen que la API,
  // así el panel usa la cookie de sesión sin CORS. En producción el panel se sirve aparte.
  if (process.env.SERVIR_FRONTEND) {
    app.use(express.static(resolve(process.env.SERVIR_FRONTEND), { index: 'index.html' }));
  }

  // Público
  // Lo mira el despliegue para saber si la versión nueva arrancó (y es la nueva, no un resto de la anterior),
  // y lo puede mirar un monitor de fuera. Si la base no contesta, 503.
  const version = versionDesplegada();
  const comprobarBase = db.prepare('SELECT 1 AS ok');
  app.get('/api/salud', (_req, res) => {
    try {
      comprobarBase.get();
      res.json({ ok: true, version });
    } catch {
      res.status(503).json({ ok: false, version, error: 'La base no contesta' });
    }
  });
  app.use('/api/auth', rutasAuth(db));
  app.use('/api/contactos', rutasContactosPublicas(db)); // solo POST: el formulario de la web
  app.use('/api/citas', rutasCitasPublicas(db)); // solo GET /huecos y POST /pedir: la cita previa de la web
  // Solo en el sistema de pruebas (npm run dev:pruebas): los usuarios de prueba para la nota del login
  // (y nunca con NODE_ENV=production, aunque alguien deje ACCESO_PRUEBAS puesto por error)
  if (process.env.ACCESO_PRUEBAS && process.env.NODE_ENV !== 'production') {
    app.get('/api/pruebas/acceso', (_req, res) => res.json(JSON.parse(process.env.ACCESO_PRUEBAS)));
  }

  // Con sesión
  const conSesion = requiereSesion(db);
  app.use('/api/vehiculos', conSesion, rutasVehiculos(db));
  app.use('/api/fotos', conSesion, rutasFotos(db));
  app.use('/api/wordpress', conSesion, requiereRol('gerencia'), rutasWordPress(db));
  app.use('/api/usuarios', conSesion, requiereRol('gerencia'), rutasUsuarios(db));
  app.use('/api/contactos', conSesion, rutasContactos(db));
  app.use('/api/informes', conSesion, requiereRol('gerencia'), rutasInformes(db));
  app.use('/api/clientes', conSesion, rutasClientes(db));
  app.use('/api/proveedores', conSesion, requiereRol('gerencia'), rutasProveedores(db));
  app.use('/api/actividades', conSesion, rutasActividades(db));
  app.use('/api/incentivos', conSesion, rutasIncentivos(db)); // los dos roles; reglas y liquidar, solo gerencia
  app.use('/api/gastos', conSesion, requiereRol('gerencia'), rutasGastos(db));
  app.use('/api/facturas', conSesion, requiereRol('gerencia'), rutasFacturas(db));
  app.use('/api/contratos', conSesion, rutasContratos(db)); // compra y cesión, solo gerencia (dentro)
  app.use('/api/avisos', conSesion, rutasAvisos(db)); // los dos roles; cobros e importes, solo gerencia (dentro)
  app.use('/api/portales', conSesion, rutasPortales(db)); // los dos roles: el anuncio no lleva dinero interno
  app.use('/api/correos', conSesion, requiereRol('gerencia'), rutasCorreos(db));
  app.use('/api/citas', conSesion, rutasCitas(db)); // los dos roles: la agenda de pruebas no lleva dinero

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
