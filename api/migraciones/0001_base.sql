-- Modelo base sacado del briefing (bloques 2, 3, 4 y 6).
-- Dueño: Victor. Esta migración ya no se edita: los cambios van en 0002_..., 0003_...
--
-- Convenciones:
--   · Dinero en céntimos enteros (sufijo _cent). Nunca REAL: 0,1 + 0,2 no da 0,3.
--   · Al dar de alta solo se exige matrícula, marca y modelo (duda C1). El resto lo
--     exige la API al pasar a «Publicado», no la base de datos.
--   · Matrícula y bastidor se guardan normalizados: mayúsculas, sin espacios ni guiones.

CREATE TABLE usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('gerencia','comercial')), -- 11.2: el margen solo lo ve gerencia
  hash        TEXT NOT NULL,
  activo      INTEGER NOT NULL DEFAULT 1,  -- 11.4: desactivar en vez de borrar
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Se guarda el hash del token, no el token: si alguien lee la base, no puede entrar.
CREATE TABLE sesiones (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  caduca_en   TEXT NOT NULL,
  creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vehiculos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  referencia          TEXT UNIQUE,                 -- 3.1 referencia interna (autogenerada)
  propiedad           TEXT NOT NULL DEFAULT 'propio' CHECK (propiedad IN ('propio','deposito')), -- 1.2: 10 propios / 40 de terceros
  estado              TEXT NOT NULL DEFAULT 'pendiente_recoger' CHECK (estado IN (
                        'pendiente_recoger','en_transporte','recibido','en_taller','en_preparacion',
                        'pendiente_fotos','publicado','reservado','vendido','entregado')),

  -- 3.1 Identificación
  matricula           TEXT NOT NULL,
  bastidor            TEXT,
  marca               TEXT NOT NULL,
  modelo              TEXT NOT NULL,
  version             TEXT,
  anio                INTEGER,
  fecha_matriculacion TEXT,
  kilometros          INTEGER CHECK (kilometros >= 0),

  -- 3.2 Mecánica
  combustible         TEXT,
  cambio              TEXT CHECK (cambio IN ('manual','automatico')),
  potencia_cv         INTEGER,
  cilindrada          INTEGER,
  traccion            TEXT,
  emisiones_co2       INTEGER,
  etiqueta_dgt        TEXT CHECK (etiqueta_dgt IN ('0','ECO','C','B','SIN')),

  -- 3.3 Carrocería
  carroceria          TEXT,
  puertas             INTEGER,
  plazas              INTEGER,
  color_exterior      TEXT,
  tapiceria           TEXT,
  llantas             TEXT,

  -- 3.4 Estado y documentación (no sale en la web)
  ultima_revision     TEXT,
  itv_caducidad       TEXT,
  danos               TEXT,
  garantia_meses      INTEGER NOT NULL DEFAULT 12, -- 9.7: 12 mínimo
  ubicacion           TEXT CHECK (ubicacion IN ('patio_taller','parking')), -- 1.5
  num_llaves          INTEGER,

  -- Coches en depósito (1.2, dudas B3 y B4). Por defecto, margen = PVP − lo que se paga al dueño.
  propietario_nombre     TEXT,
  propietario_telefono   TEXT,
  pago_propietario_cent  INTEGER CHECK (pago_propietario_cent >= 0),

  -- 3.5 Dinero (solo gerencia, 11.2)
  precio_compra_cent      INTEGER CHECK (precio_compra_cent >= 0),
  coste_transporte_cent   INTEGER NOT NULL DEFAULT 0 CHECK (coste_transporte_cent >= 0),
  coste_taller_cent       INTEGER NOT NULL DEFAULT 0 CHECK (coste_taller_cent >= 0),
  coste_preparacion_cent  INTEGER NOT NULL DEFAULT 0 CHECK (coste_preparacion_cent >= 0),
  coste_impuestos_cent    INTEGER NOT NULL DEFAULT 0 CHECK (coste_impuestos_cent >= 0),
  pvp_cent                INTEGER CHECK (pvp_cent >= 0),
  precio_financiado_cent  INTEGER CHECK (precio_financiado_cent >= 0),
  precio_minimo_cent      INTEGER CHECK (precio_minimo_cent >= 0),
  regimen_iva             TEXT CHECK (regimen_iva IN ('REBU','deducible')), -- 9.1: usan los dos

  video_url           TEXT,                        -- 4.6: enlace de YouTube
  creado_en           TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX vehiculos_matricula ON vehiculos (matricula);
CREATE UNIQUE INDEX vehiculos_bastidor ON vehiculos (bastidor) WHERE bastidor IS NOT NULL;
CREATE INDEX vehiculos_estado ON vehiculos (estado);

-- 3.7 Equipamiento: lista cerrada para poder filtrar en la web
CREATE TABLE extras (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);
CREATE TABLE vehiculo_extras (
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  extra_id    INTEGER NOT NULL REFERENCES extras(id),
  PRIMARY KEY (vehiculo_id, extra_id)
);

-- 2.2 Historial de estados: un coche está en un estado y solo uno, pero guardamos el recorrido
CREATE TABLE historial_estados (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  de          TEXT,
  a           TEXT NOT NULL,
  usuario_id  INTEGER REFERENCES usuarios(id),
  fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX historial_estados_vehiculo ON historial_estados (vehiculo_id);

-- 2.4 Reservas con señal (mínimo 300 €)
CREATE TABLE reservas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  cliente      TEXT NOT NULL,
  senal_cent   INTEGER NOT NULL CHECK (senal_cent >= 30000),
  fecha        TEXT NOT NULL DEFAULT (datetime('now')),
  caduca_en    TEXT,
  activa       INTEGER NOT NULL DEFAULT 1
);
-- Un coche no puede tener dos reservas activas: es lo que impide venderlo dos veces (2.3).
CREATE UNIQUE INDEX reservas_una_activa ON reservas (vehiculo_id) WHERE activa = 1;

-- 4. Fotos (dueña: Hafsa). Orden fijo, 15-25 por coche
CREATE TABLE fotos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id    INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  orden          INTEGER NOT NULL,
  ruta_original  TEXT NOT NULL,
  ruta_photocall TEXT,                  -- 4.4: versión con el fondo del photocall generada por IA
  es_dano        INTEGER NOT NULL DEFAULT 0,
  publica        INTEGER NOT NULL DEFAULT 1, -- 4.8: los daños que no se reparan pueden quedarse dentro
  creado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX fotos_vehiculo ON fotos (vehiculo_id, orden);

-- 6. Publicaciones en canales (dueño: David)
CREATE TABLE publicaciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id    INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  canal          TEXT NOT NULL CHECK (canal IN ('web','coches_net','milanuncios','wallapop')),
  estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','publicado','retirar','retirado','error')),
  id_externo     TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vehiculo_id, canal)
);

-- Rastro de cambios: quién tocó qué, cuándo, y cómo estaba antes.
CREATE TABLE auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id),
  entidad     TEXT NOT NULL,
  entidad_id  INTEGER,
  accion      TEXT NOT NULL,
  antes       TEXT,  -- JSON
  despues     TEXT,  -- JSON
  fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX auditoria_entidad ON auditoria (entidad, entidad_id);
