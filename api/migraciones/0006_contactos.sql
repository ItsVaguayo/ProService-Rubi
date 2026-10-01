-- 5.6 y 8.1: lo que entra por los formularios de la web (información, prueba, financiación, tasación).
-- Lo escribe la web por POST /api/contactos, sin sesión. El panel lo lista y lo marca como atendido.
-- Dueño: Victor (tabla y API). David conecta los formularios de la web.

CREATE TABLE contactos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  email        TEXT,
  tipo         TEXT NOT NULL CHECK (tipo IN ('informacion','prueba','financiacion','tasacion')),
  vehiculo_id  INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL, -- vacío si no es de un coche concreto
  mensaje      TEXT,
  origen       TEXT NOT NULL DEFAULT 'web',
  recibido_en  TEXT NOT NULL DEFAULT (datetime('now')),
  atendido_en  TEXT,                                   -- vacío = sin atender
  atendido_por INTEGER REFERENCES usuarios(id)
);
CREATE INDEX contactos_recibido ON contactos (atendido_en, recibido_en);
