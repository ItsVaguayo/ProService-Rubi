// Dueña: Hafsa. Subida de fotos (15-25, orden fijo) y photocall con IA (4.4).
//
// El orden es el hueco de la foto: del 1 al 15 son los huecos fijos (frontal, 3/4 delantero…)
// y del 16 al 25, fotos de más (daños y detalles). Puede haber huecos vacíos: una foto nueva
// entra en el primero libre y borrar una deja su hueco libre, sin mover las demás.
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { registrar } from '../auditoria.js';

export const FOTOS_MAXIMAS = 25; // 4.1: como mucho 25
const ANCHO_MAXIMO = 1600; // px: de sobra para la web y los portales
const CALIDAD_JPEG = 82;
const MB = 1024 * 1024;

// Lo que devuelve la API de cada foto. `url` es lo que el panel pone en <img src>.
const conUrl = (f) => ({ ...f, url: `/api/fotos/${f.vehiculo_id}/${f.id}/archivo` });

const esEntero = (v) => Number.isInteger(v) && v > 0;

export function rutasFotos(db) {
  const r = Router();
  const carpeta = resolve(process.env.UPLOADS_DIR || './data/uploads');

  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * MB, files: FOTOS_MAXIMAS },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  }).array('fotos', FOTOS_MAXIMAS);

  const existeCoche = db.prepare('SELECT 1 FROM vehiculos WHERE id = ?');
  const listar = db.prepare('SELECT * FROM fotos WHERE vehiculo_id = ? ORDER BY orden');
  const leer = db.prepare('SELECT * FROM fotos WHERE id = ? AND vehiculo_id = ?');

  // Ruta guardada en la base (relativa a la carpeta de subidas) → ruta en disco.
  // Nunca sale de la carpeta, aunque la base tuviera una ruta rara.
  const enDisco = (ruta) => {
    const completa = resolve(carpeta, ruta);
    return completa.startsWith(carpeta + sep) ? completa : null;
  };

  r.get('/:vehiculoId', (req, res) => {
    res.json(listar.all(req.params.vehiculoId).map(conUrl));
  });

  // El fichero de una foto, para el <img> del panel. Usa la del photocall si ya existe.
  r.get('/:vehiculoId/:fotoId/archivo', (req, res) => {
    const f = leer.get(req.params.fotoId, req.params.vehiculoId);
    const ruta = f && enDisco(f.ruta_photocall || f.ruta_original);
    if (!ruta) return res.status(404).json({ error: 'No existe' });
    res.sendFile(ruta, { maxAge: '1d' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'No existe' });
    });
  });

  // Subir una o varias fotos (campo «fotos» del formulario). Se reducen a JPG y cada una
  // entra en el primer hueco libre, en el orden en que llegan.
  r.post('/:vehiculoId', recibir(subida), async (req, res, next) => {
    const vehiculoId = Number(req.params.vehiculoId);
    if (!esEntero(vehiculoId) || !existeCoche.get(vehiculoId)) return res.status(404).json({ error: 'No existe' });
    const ficheros = req.files ?? [];
    if (!ficheros.length) return res.status(400).json({ error: 'No ha llegado ninguna imagen' });

    const noCaben = (libres) => `Caben ${libres} fotos más y has mandado ${ficheros.length}. El máximo es ${FOTOS_MAXIMAS}`;
    // Primer aviso rápido, antes de reducir nada. Los huecos de verdad se eligen dentro de la transacción.
    const libresAhora = huecosLibres(listar.all(vehiculoId)).length;
    if (ficheros.length > libresAhora) return res.status(409).json({ error: noCaben(libresAhora) });

    // Primero se reducen todas: si una no es una imagen de verdad, no se guarda ninguna.
    let reducidas;
    try {
      reducidas = await Promise.all(
        ficheros.map((f) =>
          sharp(f.buffer)
            .rotate() // endereza según el EXIF del móvil
            .resize({ width: ANCHO_MAXIMO, height: ANCHO_MAXIMO, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: CALIDAD_JPEG, mozjpeg: true })
            .toBuffer(),
        ),
      );
    } catch {
      return res.status(400).json({ error: 'Alguno de los ficheros no es una imagen que se pueda abrir' });
    }

    const rutas = reducidas.map(() => `${vehiculoId}/${randomUUID()}.jpg`);
    try {
      await mkdir(join(carpeta, String(vehiculoId)), { recursive: true });
      await Promise.all(rutas.map((ruta, i) => writeFile(join(carpeta, ruta), reducidas[i])));

      // Los huecos se eligen aquí dentro y no antes: mientras se reducían las fotos ha podido
      // entrar otra subida del mismo coche, y dos fotos no pueden quedarse con el mismo hueco.
      const insertar = db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)');
      const ids = db.transaction(() => {
        const libres = huecosLibres(listar.all(vehiculoId));
        if (ficheros.length > libres.length) throw Object.assign(new Error(noCaben(libres.length)), { status: 409 });
        const nuevos = rutas.map((ruta, i) => Number(insertar.run(vehiculoId, libres[i], ruta).lastInsertRowid));
        registrar(db, {
          usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: vehiculoId, accion: 'fotos_subida',
          despues: nuevos.map((id, i) => ({ id, orden: libres[i] })),
        });
        return nuevos;
      })();

      const todas = listar.all(vehiculoId).map(conUrl);
      res.status(201).json({ subidas: todas.filter((f) => ids.includes(f.id)), fotos: todas });
    } catch (err) {
      await Promise.all(rutas.map((ruta) => rm(join(carpeta, ruta), { force: true })));
      if (err.status === 409) return res.status(409).json({ error: err.message });
      next(err);
    }
  });

  // Cambiar el orden. Se manda la lista entera: [{ id, orden }, …] con todas las fotos del coche,
  // cada una en un hueco distinto del 1 al 25. Así un cambio a medias no puede dejar dos en el mismo.
  r.put('/:vehiculoId/orden', (req, res) => {
    const vehiculoId = Number(req.params.vehiculoId);
    if (!esEntero(vehiculoId) || !existeCoche.get(vehiculoId)) return res.status(404).json({ error: 'No existe' });
    const pedido = req.body?.fotos;
    const actuales = listar.all(vehiculoId);

    const error = errorDeOrden(pedido, actuales);
    if (error) return res.status(400).json({ error });

    db.transaction(() => {
      // Dos pasos para no chocar con el orden de otra foto a mitad del cambio
      const mover = db.prepare('UPDATE fotos SET orden = ? WHERE id = ? AND vehiculo_id = ?');
      for (const { id } of pedido) mover.run(-id, id, vehiculoId);
      for (const { id, orden } of pedido) mover.run(orden, id, vehiculoId);
      registrar(db, {
        usuarioId: req.usuario.id, entidad: 'vehiculo', entidadId: vehiculoId, accion: 'fotos_orden',
        antes: actuales.map(({ id, orden }) => ({ id, orden })), despues: pedido.map(({ id, orden }) => ({ id, orden })),
      });
    })();
    res.json(listar.all(vehiculoId).map(conUrl));
  });

  // Marcar una foto como daño o decidir si sale en la web.
  r.patch('/:vehiculoId/:fotoId', (req, res) => {
    const f = leer.get(req.params.fotoId, req.params.vehiculoId);
    if (!f) return res.status(404).json({ error: 'No existe' });

    const cambios = {};
    for (const campo of ['es_dano', 'publica']) {
      const v = req.body?.[campo];
      if (v === undefined) continue;
      if (typeof v !== 'boolean') return res.status(400).json({ error: `${campo} tiene que ser true o false` });
      cambios[campo] = v ? 1 : 0;
    }
    const columnas = Object.keys(cambios);
    if (!columnas.length) return res.status(400).json({ error: 'Sin cambios' });

    db.transaction(() => {
      db.prepare(`UPDATE fotos SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...columnas.map((c) => cambios[c]), f.id);
      registrar(db, {
        usuarioId: req.usuario.id, entidad: 'foto', entidadId: f.id, accion: 'edicion',
        antes: Object.fromEntries(columnas.map((c) => [c, f[c]])), despues: cambios,
      });
    })();
    res.json(conUrl(leer.get(f.id, f.vehiculo_id)));
  });

  // Borrar una foto: la fila y sus ficheros. Su hueco queda libre.
  r.delete('/:vehiculoId/:fotoId', async (req, res) => {
    const f = leer.get(req.params.fotoId, req.params.vehiculoId);
    if (!f) return res.status(404).json({ error: 'No existe' });

    db.transaction(() => {
      db.prepare('DELETE FROM fotos WHERE id = ?').run(f.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'foto', entidadId: f.id, accion: 'borrado', antes: f });
    })();
    // Si el fichero ya no estaba o no se puede borrar, la foto ya no existe para la API: se avisa en el log y sigue
    const ficheros = [f.ruta_original, f.ruta_photocall].filter(Boolean).map(enDisco).filter(Boolean);
    await Promise.all(ficheros.map((ruta) => rm(ruta, { force: true }).catch((err) => console.error(err))));
    res.json(listar.all(f.vehiculo_id).map(conUrl));
  });

  // TODO(Hafsa): lanzar el photocall con IA en segundo plano y rellenar ruta_photocall

  return r;
}

// Huecos del 1 al 25 que no tienen foto, de menor a mayor.
function huecosLibres(fotos) {
  const ocupados = new Set(fotos.map((f) => f.orden));
  const libres = [];
  for (let i = 1; i <= FOTOS_MAXIMAS; i++) if (!ocupados.has(i)) libres.push(i);
  return libres;
}

function errorDeOrden(pedido, actuales) {
  if (!Array.isArray(pedido)) return 'Hay que mandar la lista de fotos con su orden: { fotos: [{ id, orden }] }';
  const ids = new Set(actuales.map((f) => f.id));
  if (pedido.length !== ids.size || !pedido.every((p) => ids.has(p?.id))) {
    return 'La lista tiene que llevar todas las fotos del coche, una vez cada una';
  }
  if (new Set(pedido.map((p) => p.id)).size !== pedido.length) return 'Hay una foto repetida en la lista';
  if (!pedido.every((p) => esEntero(p.orden) && p.orden <= FOTOS_MAXIMAS)) return `El orden va del 1 al ${FOTOS_MAXIMAS}`;
  if (new Set(pedido.map((p) => p.orden)).size !== pedido.length) return 'Dos fotos no pueden ir en el mismo hueco';
  return null;
}

// Los errores de multer, en el mismo formato { error } que el resto de la API.
function recibir(subida) {
  return (req, res, next) =>
    subida(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Una de las fotos pasa de 20 MB' });
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: `Como mucho ${FOTOS_MAXIMAS} fotos, en el campo «fotos»` });
      }
      next(err);
    });
}
