// Dueño: Victor. Usuarios del panel (11.3, 11.4). Solo gerencia (se monta con requiereRol en app.js).
// No se borra a nadie: se desactiva, y su nombre sigue en el historial de lo que movió.
import { Router } from 'express';
import { crearUsuario, cambiarContrasena, cerrarSesionesDe, tokenDe, ROLES } from '../auth/sesiones.js';
import { registrar } from '../auditoria.js';

const CAMPOS = 'id, email, nombre, rol, activo, creado_en, ultimo_acceso';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMO_CONTRASENA = 10;

export function rutasUsuarios(db) {
  const r = Router();
  const leer = db.prepare(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`);
  const otrasGerenciasActivas = db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'gerencia' AND activo = 1 AND id != ?");

  r.get('/', (_req, res) => {
    res.json(db.prepare(`SELECT ${CAMPOS} FROM usuarios ORDER BY activo DESC, nombre COLLATE NOCASE`).all());
  });

  r.post('/', (req, res) => {
    const { email, nombre, rol, contrasena } = req.body ?? {};
    const errores = [];
    if (typeof nombre !== 'string' || !nombre.trim()) errores.push('Falta el nombre');
    if (typeof email !== 'string' || !EMAIL.test(email.trim())) errores.push('El correo no es válido');
    if (!ROLES.includes(rol)) errores.push(`El rol tiene que ser ${ROLES.join(' o ')}`);
    if (typeof contrasena !== 'string' || contrasena.length < MINIMO_CONTRASENA) {
      errores.push(`La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres`);
    }
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    try {
      const id = db.transaction(() => {
        const nuevo = crearUsuario(db, { email, nombre, rol, contrasena });
        registrar(db, { usuarioId: req.usuario.id, entidad: 'usuario', entidadId: nuevo, accion: 'alta', despues: { email: email.trim().toLowerCase(), nombre: nombre.trim(), rol } });
        return nuevo;
      })();
      res.status(201).json(leer.get(id));
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ya hay un usuario con ese correo' });
      throw e;
    }
  });

  // Cambia nombre, rol, si está activo o la contraseña. Solo lo que llega.
  r.patch('/:id', (req, res) => {
    const antes = leer.get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const { nombre, rol, activo, contrasena } = req.body ?? {};
    const yoMismo = antes.id === req.usuario.id;

    const errores = [];
    if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim())) errores.push('El nombre no puede quedar vacío');
    if (rol !== undefined && !ROLES.includes(rol)) errores.push(`El rol tiene que ser ${ROLES.join(' o ')}`);
    if (activo !== undefined && typeof activo !== 'boolean') errores.push('activo tiene que ser true o false');
    if (contrasena !== undefined && (typeof contrasena !== 'string' || contrasena.length < MINIMO_CONTRASENA)) {
      errores.push(`La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres`);
    }
    if ([nombre, rol, activo, contrasena].every((v) => v === undefined)) errores.push('Sin cambios');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    // Nadie se deja fuera a sí mismo, y el stock nunca se queda sin nadie de gerencia
    if (yoMismo && activo === false) return res.status(409).json({ error: 'No puedes desactivarte a ti mismo' });
    if (yoMismo && rol && rol !== antes.rol) return res.status(409).json({ error: 'No puedes cambiarte el rol a ti mismo' });
    const dejaDeSerGerencia = antes.rol === 'gerencia' && antes.activo && (activo === false || (rol && rol !== 'gerencia'));
    if (dejaDeSerGerencia && otrasGerenciasActivas.get(antes.id).n === 0) {
      return res.status(409).json({ error: 'Tiene que quedar al menos una persona de gerencia activa' });
    }

    const cambios = {};
    if (nombre !== undefined) cambios.nombre = nombre.trim();
    if (rol !== undefined) cambios.rol = rol;
    if (activo !== undefined) cambios.activo = activo ? 1 : 0;

    db.transaction(() => {
      const columnas = Object.keys(cambios);
      if (columnas.length) {
        db.prepare(`UPDATE usuarios SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...columnas.map((c) => cambios[c]), antes.id);
      }
      if (contrasena !== undefined) cambiarContrasena(db, antes.id, contrasena);
      // Desactivar o cambiar la contraseña echa a quien tenga la sesión abierta (menos a uno mismo, en esta sesión)
      if (activo === false || contrasena !== undefined) {
        cerrarSesionesDe(db, antes.id, { menos: yoMismo ? tokenDe(req) : null });
      }
      registrar(db, {
        usuarioId: req.usuario.id, entidad: 'usuario', entidadId: antes.id, accion: 'edicion',
        antes: Object.fromEntries(Object.keys(cambios).map((c) => [c, antes[c]])),
        despues: { ...cambios, ...(contrasena !== undefined && { contrasena: 'cambiada' }) },
      });
    })();
    res.json(leer.get(antes.id));
  });

  return r;
}
