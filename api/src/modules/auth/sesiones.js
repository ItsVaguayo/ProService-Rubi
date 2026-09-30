// Sesión con cookie httpOnly. Dos roles: gerencia (ve todo) y comercial (no ve dinero).
import { randomBytes, createHash } from 'node:crypto';
import { hashContrasena } from './contrasenas.js';

export const COOKIE = 'ps_sesion';
export const ROLES = ['gerencia', 'comercial'];
const DIAS = Number(process.env.SESION_DIAS || 30);

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');

export function crearUsuario(db, { email, nombre, rol, contrasena }) {
  if (!ROLES.includes(rol)) throw new Error(`Rol no válido: ${rol}`);
  if (!contrasena || contrasena.length < 10) throw new Error('La contraseña necesita al menos 10 caracteres');
  const info = db
    .prepare('INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, ?, ?)')
    .run(email.trim().toLowerCase(), nombre.trim(), rol, hashContrasena(contrasena));
  return Number(info.lastInsertRowid);
}

export function abrirSesion(db, usuarioId) {
  const token = randomBytes(32).toString('base64url');
  db.prepare(`INSERT INTO sesiones (token_hash, usuario_id, caduca_en) VALUES (?, ?, datetime('now', ?))`).run(
    sha256(token),
    usuarioId,
    `+${DIAS} days`,
  );
  return { token, maxAge: DIAS * 24 * 3600 * 1000 };
}

export function cerrarSesion(db, token) {
  if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token));
}

export function usuarioDeSesion(db, token) {
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT u.id, u.email, u.nombre, u.rol
           FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.token_hash = ? AND s.caduca_en > datetime('now') AND u.activo = 1`,
      )
      .get(sha256(token)) ?? null
  );
}

export function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const trozo of cabecera.split(';')) {
    const i = trozo.indexOf('=');
    if (i > 0 && trozo.slice(0, i).trim() === nombre) return decodeURIComponent(trozo.slice(i + 1).trim());
  }
  return null;
}

// Middleware: sin sesión válida, 401. Deja el usuario en req.usuario.
export function requiereSesion(db) {
  return (req, res, next) => {
    const usuario = usuarioDeSesion(db, leerCookie(req, COOKIE));
    if (!usuario) return res.status(401).json({ error: 'Hay que iniciar sesión' });
    req.usuario = usuario;
    next();
  };
}

export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) return res.status(403).json({ error: 'No tienes permiso' });
    next();
  };
}
