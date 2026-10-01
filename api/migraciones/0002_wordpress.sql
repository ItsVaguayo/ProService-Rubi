-- Publicación en WordPress por su API REST (5.2: se conecta a la web que ya hay).
-- Dueño: David (módulo publicacion).

-- Qué post de WordPress es cada coche, y qué se le mandó la última vez.
CREATE TABLE wp_posts (
  vehiculo_id    INTEGER PRIMARY KEY REFERENCES vehiculos(id) ON DELETE CASCADE,
  wp_post_id     INTEGER NOT NULL UNIQUE,
  huella         TEXT,                    -- resumen de lo enviado: si no cambia, no se vuelve a mandar
  estado         TEXT NOT NULL CHECK (estado IN ('publicado', 'retirado', 'vinculado')),
  ultimo_error   TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cada foto se sube una sola vez a la biblioteca de medios de WordPress.
CREATE TABLE wp_medios (
  foto_id     INTEGER PRIMARY KEY REFERENCES fotos(id) ON DELETE CASCADE,
  wp_media_id INTEGER NOT NULL,
  subida_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
