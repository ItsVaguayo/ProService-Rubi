-- Tasación desde la web (briefing 5.6 y 8.7, duda E4): el coche que el cliente quiere dar como parte del pago,
-- con marca, modelo, año, kilómetros y hasta 5 fotos. Entra como un contacto más, de tipo «tasacion».
-- Número 0020: la 0019 está en otra rama (PR #22). Se aplican por su nombre, así que no se pisan.
-- Dueño: Victor.

ALTER TABLE contactos ADD COLUMN tasacion_marca TEXT;
ALTER TABLE contactos ADD COLUMN tasacion_modelo TEXT;
ALTER TABLE contactos ADD COLUMN tasacion_anio INTEGER CHECK (tasacion_anio BETWEEN 1950 AND 2100);
ALTER TABLE contactos ADD COLUMN tasacion_km INTEGER CHECK (tasacion_km >= 0);

-- Las fotos, reducidas a JPG como las del panel. Se guardan en UPLOADS_PATH/contactos/<id>/ y solo se ven con sesión.
CREATE TABLE contacto_fotos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contacto_id INTEGER NOT NULL REFERENCES contactos(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL,
  ruta        TEXT NOT NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX contacto_fotos_contacto ON contacto_fotos (contacto_id, orden);
