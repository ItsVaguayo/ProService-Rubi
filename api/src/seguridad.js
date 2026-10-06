// Cabeceras de seguridad y control de origen. Sin dependencias: son pocas reglas y así se leen aquí.

// El panel solo carga lo suyo y las fuentes de Google. 'unsafe-inline' en estilos porque el panel
// pinta algunos style="" (barras, colores de fase); los scripts, en cambio, solo de ficheros propios.
const CSP_PANEL = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
// La API solo devuelve datos: no carga nada ni se puede meter en un marco
const CSP_API = "default-src 'none'; frame-ancestors 'none'";

export function cabecerasDeSeguridad(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  });
  // Con HTTPS, que el navegador no vuelva a entrar por HTTP en un año
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  if (req.path.startsWith('/api/')) res.set('Content-Security-Policy', CSP_API);
  else if (req.path.startsWith('/panel/') || req.path === '/panel') res.set('Content-Security-Policy', CSP_PANEL);
  next();
}

// Lo que cambia datos (POST, PATCH, PUT, DELETE) tiene que venir del propio dominio o de uno de
// CORS_ORIGENES. Si otra web intenta mandar el navegador de Jaume contra la API, el navegador pone
// su Origin y aquí se corta. Sin Origin (curl, el conector de WordPress, los tests) no hay navegador
// que engañar y se deja pasar: ahí manda la sesión.
export function mismoOrigen(permitidos) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origen = req.get('origin');
    if (!origen || origen === `${req.protocol}://${req.get('host')}` || permitidos.includes(origen)) return next();
    res.status(403).json({ error: 'Origen no permitido' });
  };
}
