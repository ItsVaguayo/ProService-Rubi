-- Ampliación del 7-oct, bloque 9 (T11): lo que se hace con cada cliente. Llamadas, visitas, WhatsApp,
-- correos, pruebas, tareas y notas, con su fecha, su responsable y su resultado.
-- Los avisos y el correo diario los monta Victor encima de esta tabla.
-- Dueño: David.

CREATE TABLE actividades (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('llamada','visita','whatsapp','email','prueba','tarea','nota')),
  cliente_id      INTEGER REFERENCES clientes(id),
  contacto_id     INTEGER REFERENCES contactos(id),
  vehiculo_id     INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  programada_para TEXT,             -- 'AAAA-MM-DD HH:MM', hora de Rubí; vacía en una nota
  hecha_en        TEXT,             -- vacía = pendiente (UTC, como el resto de fechas de la base)
  resultado       TEXT,
  responsable_id  INTEGER NOT NULL REFERENCES usuarios(id),
  creado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX actividades_pendientes ON actividades (responsable_id, hecha_en, programada_para);
CREATE INDEX actividades_cliente ON actividades (cliente_id);
