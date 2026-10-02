// Usuarios de la base de pruebas. Los usa la siembra para crearlos y el sistema de pruebas para
// enseñarlos en el login (nota de desarrollo). Solo existen en api/data/pruebas.db, nunca en la real.
export const CONTRASENA_PRUEBAS = 'pruebas-local-123';

export const USUARIOS_PRUEBAS = [
  { email: 'jaume@pruebas.local', nombre: 'Jaume', rol: 'gerencia' },
  { email: 'comercial@pruebas.local', nombre: 'Comercial', rol: 'comercial' },
];
