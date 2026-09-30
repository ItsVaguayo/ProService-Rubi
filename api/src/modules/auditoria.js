// Rastro de cambios. Se llama dentro de la misma transacción que el cambio.
export function registrar(db, { usuarioId, entidad, entidadId, accion, antes = null, despues = null }) {
  db.prepare(
    'INSERT INTO auditoria (usuario_id, entidad, entidad_id, accion, antes, despues) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    usuarioId ?? null,
    entidad,
    entidadId ?? null,
    accion,
    antes == null ? null : JSON.stringify(antes),
    despues == null ? null : JSON.stringify(despues),
  );
}
