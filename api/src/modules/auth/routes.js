// Entrar, salir y quién soy. El panel usa la cookie; nunca ve el token.
import { Router } from 'express';
import { hashContrasena, verificarContrasena } from './contrasenas.js';
import { COOKIE, abrirSesion, cerrarSesion, leerCookie, requiereSesion } from './sesiones.js';

// Límite de intentos fallidos en memoria (con un solo proceso basta), cada 15 minutos: 10 por cuenta,
// que frena a quien prueba contraseñas de Jaume aunque cambie de IP, y 30 por IP, holgado porque en
// la oficina todos salen por la misma y un despiste de uno no debe dejar fuera a los demás.
const MAX_FALLOS = { cuenta: 10, ip: 30 };
const VENTANA_MS = 15 * 60 * 1000;

export function rutasAuth(db) {
  const r = Router();
  const fallos = new Map();

  const bloqueada = (clave) => {
    const f = fallos.get(clave);
    if (!f || Date.now() - f.desde > VENTANA_MS) return false;
    return f.n >= MAX_FALLOS[clave.split(':')[0]];
  };
  const apuntarFallo = (clave) => {
    // Con correos inventados el mapa crecería sin fin: de vez en cuando se tiran los caducados
    if (fallos.size > 5000) for (const [k, v] of fallos) if (Date.now() - v.desde > VENTANA_MS) fallos.delete(k);
    const f = fallos.get(clave);
    if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(clave, { n: 1, desde: Date.now() });
    else f.n += 1;
  };

  // Para un correo que no existe se comprueba igual contra este hash: así tarda lo mismo y no se
  // puede averiguar qué correos tienen cuenta midiendo el tiempo de respuesta.
  const hashFalso = hashContrasena('no-es-ninguna-contrasena');

  r.post('/entrar', (req, res) => {
    const { email, contrasena } = req.body ?? {};
    if (typeof email !== 'string' || typeof contrasena !== 'string') {
      return res.status(400).json({ error: 'Faltan email o contraseña' });
    }
    const correo = email.trim().toLowerCase();
    const claves = [`ip:${req.ip}`, `cuenta:${correo}`];
    if (claves.some(bloqueada)) return res.status(429).json({ error: 'Demasiados intentos. Prueba en 15 minutos' });

    const usuario = db.prepare('SELECT id, nombre, rol, hash, activo FROM usuarios WHERE email = ?').get(correo);
    const correcta = verificarContrasena(contrasena, usuario?.hash ?? hashFalso);
    if (!usuario || !usuario.activo || !correcta) {
      claves.forEach(apuntarFallo);
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    claves.forEach((clave) => fallos.delete(clave));
    db.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(usuario.id);

    const { token, maxAge } = abrirSesion(db, usuario.id);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      // Solo viaja por HTTPS. Detrás de nginx con HTTPS, req.secure ya es true sin tocar nada
      secure: req.secure || process.env.NODE_ENV === 'production',
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
