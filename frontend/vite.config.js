// En desarrollo, las peticiones a /api van a la API (puerto 3001) como si fueran del mismo
// dominio. Así la cookie de sesión funciona sin abrir CORS, igual que en producción.
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
};
