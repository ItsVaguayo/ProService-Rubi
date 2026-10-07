-- Ampliación del 7-oct, bloque 1: clientes y proveedores con sus datos fiscales.
-- Los clientes los ven los dos roles (CRM); los proveedores solo gerencia, como proveedor_nombre (0004).
-- Dueño: Victor.

CREATE TABLE clientes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL DEFAULT 'particular' CHECK (tipo IN ('particular','empresa')),
  nombre          TEXT NOT NULL,              -- nombre y apellidos o razón social
  nif             TEXT,                       -- DNI, NIE o CIF, normalizado; hace falta para facturar
  direccion       TEXT,
  codigo_postal   TEXT,
  poblacion       TEXT,
  provincia       TEXT,
  pais            TEXT NOT NULL DEFAULT 'ES',
  telefono        TEXT,
  email           TEXT,
  origen          TEXT,                       -- web, tienda, teléfono, portal…
  notas           TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX clientes_nif ON clientes (nif) WHERE nif IS NOT NULL;
CREATE INDEX clientes_telefono ON clientes (telefono);

CREATE TABLE proveedores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL DEFAULT 'profesional' CHECK (tipo IN ('profesional','particular','subasta','comisionista')),
  nombre          TEXT NOT NULL,
  nif             TEXT,
  direccion       TEXT,
  codigo_postal   TEXT,
  poblacion       TEXT,
  provincia       TEXT,
  pais            TEXT NOT NULL DEFAULT 'ES',
  telefono        TEXT,
  email           TEXT,
  notas           TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  creado_en       TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX proveedores_nif ON proveedores (nif) WHERE nif IS NOT NULL;

ALTER TABLE vehiculos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
ALTER TABLE vehiculos ADD COLUMN comprador_id INTEGER REFERENCES clientes(id);
ALTER TABLE contactos ADD COLUMN cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;

-- Los proveedores escritos a mano en la ficha (0004) pasan a la tabla, uno por nombre y teléfono
INSERT INTO proveedores (nombre, telefono)
  SELECT DISTINCT proveedor_nombre, proveedor_telefono FROM vehiculos WHERE proveedor_nombre IS NOT NULL;
UPDATE vehiculos SET proveedor_id = (
  SELECT p.id FROM proveedores p WHERE p.nombre = vehiculos.proveedor_nombre AND p.telefono IS vehiculos.proveedor_telefono
) WHERE proveedor_nombre IS NOT NULL;
