// 11.2: el dinero solo lo ve gerencia. La API de develop ya lo quita según el usuario de la sesión;
// este selector solo cambia lo que enseña el panel hasta que haya pantalla de login.
import { createContext, useContext } from 'react';

export const ROLES = [
  { id: 'gerencia', nombre: 'Gerencia' },
  { id: 'comercial', nombre: 'Comercial' },
];

export const RolContext = createContext({ rol: 'gerencia', setRol: () => {} });
export const useRol = () => useContext(RolContext);

export function rolGuardado() {
  try {
    return localStorage.getItem('ps-rol') || 'gerencia';
  } catch {
    return 'gerencia';
  }
}

export function guardarRol(rol) {
  try {
    localStorage.setItem('ps-rol', rol);
  } catch {
    /* sin almacenamiento: se queda solo en memoria */
  }
}
