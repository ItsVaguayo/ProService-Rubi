// Sesión con cookie httpOnly. Dos roles: gerencia (ve todo) y comercial (no ve dinero).
import { randomBytes, createHash } from 'node:crypto';
import { hashContrasena } from './contrasenas.js';

export const COOKIE = 'ps_sesion';
export const ROLES = ['gerencia', 'comercial'];
const DIAS = Number(process.env.SESION_DIAS || 30);

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex');

// 8 caracteres y ninguna regla más (ni mayúsculas ni símbolos): con el límite de intentos del login
// y scrypt, una frase de 8 o más no se saca probando.
export const MINIMO_CONTRASENA = 8;
const comprobarContrasena = (contrasena) => {
  if (typeof contrasena !== 'string' || contrasena.length < MINIMO_CONTRASENA) {
    throw new Error(`La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres`);
  }
};

export function crearUsuario(db, { email, nombre, rol, contrasena }) {
  if (!ROLES.includes(rol)) throw new Error(`Rol no válido: ${rol}`);
  comprobarContrasena(contrasena);
  const info = db
    .prepare('INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, ?, ?)')
    .run(email.trim().toLowerCase(), nombre.trim(), rol, hashContrasena(contrasena));
  return Number(info.lastInsertRowid);
}

export function cambiarContrasena(db, usuarioId, contrasena) {
  comprobarContrasena(contrasena);
  db.prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(hashContrasena(contrasena), usuarioId);
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

// Cierra todas las sesiones de un usuario, salvo (si se pasa) la del token `menos`.
export function cerrarSesionesDe(db, usuarioId, { menos = null } = {}) {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?').run(usuarioId, menos ? sha256(menos) : '');
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

// El token de la sesión con la que llega la petición.
export const tokenDe = (req) => leerCookie(req, COOKIE);

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
