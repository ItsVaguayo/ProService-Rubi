-- Ampliación del 7-oct, bloque 5: contratos de reserva, compraventa, compra y cesión.
-- Al generarse se congela todo (las partes, el coche, las condiciones y el texto de las cláusulas): un
-- contrato firmado no cambia aunque luego cambie la ficha o la plantilla. Se firman en papel.
-- Los textos están pendientes de revisión por abogado (duda H3).
-- Dueño: Victor.

CREATE TABLE contratos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo         TEXT NOT NULL CHECK (tipo IN ('reserva','compraventa','compra','cesion')),
  anio         INTEGER NOT NULL,
  numero       INTEGER NOT NULL,                 -- correlativo del año: C26-0001
  codigo       TEXT NOT NULL UNIQUE,
  fecha        TEXT NOT NULL,                    -- 'AAAA-MM-DD', día de aquí
  hora         TEXT,                             -- 'HH:MM': desde cuándo responde el comprador del coche
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id),
  factura_id   INTEGER REFERENCES facturas(id),
  reserva_id   INTEGER REFERENCES reservas(id),
  cliente_id   INTEGER REFERENCES clientes(id),
  proveedor_id INTEGER REFERENCES proveedores(id),
  contenido    TEXT NOT NULL,                    -- JSON: partes, coche, condiciones y cláusulas, ya escritas
  creado_por   INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (anio, numero)
);
CREATE INDEX contratos_vehiculo ON contratos (vehiculo_id);
