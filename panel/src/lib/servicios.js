// Solo endpoints que ya existen en la API. Lo que falta está listado en ENDPOINTS_PENDIENTES.
import { api } from '../api.js';

export const getEstados = () => api('/vehiculos/estados');
export const getVehiculos = (estado) => api(estado ? `/vehiculos?estado=${estado}` : '/vehiculos');
export const getVehiculo = (id) => api(`/vehiculos/${id}`);
export const crearVehiculo = (datos) => api('/vehiculos', { method: 'POST', body: datos });
export const cambiarEstado = (id, estado) => api(`/vehiculos/${id}/estado`, { method: 'PATCH', body: { estado } });
export const getFotos = (vehiculoId) => api(`/fotos/${vehiculoId}`);
export const getFeedWeb = () => api('/publicacion/feed/web');

export const ENDPOINTS_PENDIENTES = {
  subirFotos: 'POST /api/fotos/:vehiculoId (subir, reducir y guardar)',
  ordenFotos: 'Reordenar, borrar y marcar fotos (daño / se ve en la web)',
  photocall: 'Photocall con IA (4.4), pendiente del fondo y del OK del gasto',
  editar: 'PUT /api/vehiculos/:id',
  extras: 'Lista cerrada de extras (tabla extras) y los extras de cada coche',
  contactos: 'POST /api/contactos (formularios de la web, módulo de David)',
  login: 'Login y roles: hoy la API devuelve el dinero a cualquiera',
  historial: 'Historial de estados de cada coche',
};

// Las rutas de fotos aún no se sirven desde la API; si ya son URL completas, se usan tal cual.
export function urlFoto(f, usarPhotocall = true) {
  const ruta = (usarPhotocall && f.ruta_photocall) || f.ruta_original;
  if (!ruta) return null;
  return /^(https?:|blob:|data:|\/)/.test(ruta) ? ruta : `/${ruta}`;
}
