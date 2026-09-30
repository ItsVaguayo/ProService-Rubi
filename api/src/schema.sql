-- Modelo base sacado del briefing (bloques 2, 3, 4 y 6).
-- Dueño: Victor. Cambios de esquema, siempre por PR a develop.

CREATE TABLE IF NOT EXISTS vehiculos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  referencia          TEXT UNIQUE,                 -- 3.1 referencia interna (autogenerada)
  propiedad           TEXT NOT NULL DEFAULT 'propio' CHECK (propiedad IN ('propio','deposito')), -- 1.2: 10 propios / 40 de terceros
  estado              TEXT NOT NULL DEFAULT 'pendiente_recoger',

  -- 3.1 Identificación
  matricula           TEXT NOT NULL UNIQUE,
  bastidor            TEXT NOT NULL UNIQUE,
  marca               TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  version             TEXT NOT NULL,
  anio                INTEGER NOT NULL,
  fecha_matriculacion TEXT NOT NULL,
  kilometros          INTEGER NOT NULL,

  -- 3.2 Mecánica
  combustible         TEXT NOT NULL,
  cambio              TEXT NOT NULL CHECK (cambio IN ('manual','automatico')),
  potencia_cv         INTEGER NOT NULL,
  cilindrada          INTEGER NOT NULL,
  traccion            TEXT NOT NULL,
  emisiones_co2       INTEGER NOT NULL,
  etiqueta_dgt        TEXT NOT NULL CHECK (etiqueta_dgt IN ('0','ECO','C','B','SIN')),

  -- 3.3 Carrocería
  carroceria          TEXT NOT NULL,
  puertas             INTEGER NOT NULL,
  plazas              INTEGER NOT NULL,
  color_exterior      TEXT NOT NULL,
  tapiceria           TEXT NOT NULL,
  llantas             TEXT NOT NULL,

  -- 3.4 Estado y documentación (no sale en la web)
  ultima_revision     TEXT,
  itv_caducidad       TEXT,
  danos               TEXT,
  garantia_meses      INTEGER NOT NULL DEFAULT 12, -- 9.7: 12 mínimo
  ubicacion           TEXT CHECK (ubicacion IN ('patio_taller','parking')), -- 1.5
  num_llaves          INTEGER,

  -- 3.5 Dinero (solo gerencia, 11.2)
  precio_compra       REAL,
  coste_transporte    REAL DEFAULT 0,
  coste_taller        REAL DEFAULT 0,
  coste_preparacion   REAL DEFAULT 0,
  coste_impuestos     REAL DEFAULT 0,
  pvp                 REAL,
  precio_financiado   REAL,
  precio_minimo       REAL,
  regimen_iva         TEXT CHECK (regimen_iva IN ('REBU','deducible')), -- 9.1: usan los dos

  video_url           TEXT,                        -- 4.6: enlace de YouTube
  creado_en           TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3.7 Equipamiento: lista cerrada para poder filtrar en la web
CREATE TABLE IF NOT EXISTS extras (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS vehiculo_extras (
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  extra_id    INTEGER NOT NULL REFERENCES extras(id),
  PRIMARY KEY (vehiculo_id, extra_id)
);

-- 2.2 Historial de estados: un coche está en un estado y solo uno, pero guardamos el recorrido
CREATE TABLE IF NOT EXISTS historial_estados (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  de          TEXT,
  a           TEXT NOT NULL,
  usuario     TEXT,
  fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2.4 Reservas con señal (mínimo 300 €)
CREATE TABLE IF NOT EXISTS reservas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  cliente      TEXT NOT NULL,
  senal        REAL NOT NULL CHECK (senal >= 300),
  fecha        TEXT NOT NULL DEFAULT (datetime('now')),
  caduca_en    TEXT,
  activa       INTEGER NOT NULL DEFAULT 1
);

-- 4. Fotos (dueña: Hafsa). Orden fijo, 15-25 por coche
CREATE TABLE IF NOT EXISTS fotos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  orden        INTEGER NOT NULL,
  ruta_original TEXT NOT NULL,
  ruta_photocall TEXT,                  -- 4.4: versión con el fondo del photocall generada por IA
  es_dano      INTEGER NOT NULL DEFAULT 0,
  publica      INTEGER NOT NULL DEFAULT 1, -- 4.8: los daños que no se reparan pueden quedarse dentro
  creado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Publicaciones en canales (dueño: David)
CREATE TABLE IF NOT EXISTS publicaciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  canal        TEXT NOT NULL CHECK (canal IN ('web','coches_net','milanuncios','wallapop')),
  estado       TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','publicado','retirar','retirado','error')),
  id_externo   TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vehiculo_id, canal)
);
