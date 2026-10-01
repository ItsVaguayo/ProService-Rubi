// Entrar, salir y quién soy. El panel usa la cookie; nunca ve el token.
import { Router } from 'express';
import { verificarContrasena } from './contrasenas.js';
import { COOKIE, abrirSesion, cerrarSesion, leerCookie, requiereSesion } from './sesiones.js';

// Límite de intentos fallidos por IP, en memoria. Con un solo proceso basta.
const MAX_FALLOS = 10;
const VENTANA_MS = 15 * 60 * 1000;

export function rutasAuth(db) {
  const r = Router();
  const fallos = new Map();

  const bloqueada = (ip) => {
    const f = fallos.get(ip);
    if (!f || Date.now() - f.desde > VENTANA_MS) return false;
    return f.n >= MAX_FALLOS;
  };
  const apuntarFallo = (ip) => {
    const f = fallos.get(ip);
    if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(ip, { n: 1, desde: Date.now() });
    else f.n += 1;
  };

  r.post('/entrar', (req, res) => {
    const ip = req.ip;
    if (bloqueada(ip)) return res.status(429).json({ error: 'Demasiados intentos. Prueba en 15 minutos' });

    const { email, contrasena } = req.body ?? {};
    if (typeof email !== 'string' || typeof contrasena !== 'string') {
      return res.status(400).json({ error: 'Faltan email o contraseña' });
    }
    const usuario = db
      .prepare('SELECT id, nombre, rol, hash, activo FROM usuarios WHERE email = ?')
      .get(email.trim().toLowerCase());
    if (!usuario || !usuario.activo || !verificarContrasena(contrasena, usuario.hash)) {
      apuntarFallo(ip);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    fallos.delete(ip);
    db.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(usuario.id);

    const { token, maxAge } = abrirSesion(db, usuario.id);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
      path: '/',
    });
    res.json({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
  });

  r.post('/salir', (req, res) => {
    cerrarSesion(db, leerCookie(req, COOKIE));
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/yo', requiereSesion(db), (req, res) => res.json(req.usuario));

  return r;
}
