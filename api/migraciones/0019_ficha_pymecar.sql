-- Lo de la ficha y la factura de Pymecar que aún no teníamos (docs/pymecar.md, «Lo que esto cambia»).
-- Dueño: Victor.

-- Ficha: el precio de antes de la oferta (sale tachado en la web y en los anuncios) y el seguro de flota
ALTER TABLE vehiculos ADD COLUMN precio_sin_oferta_cent INTEGER CHECK (precio_sin_oferta_cent >= 0);
ALTER TABLE vehiculos ADD COLUMN seguro_flota TEXT CHECK (seguro_flota IN ('con', 'sin', 'alta_solicitada', 'baja_solicitada'));
-- «Revisado» de Pymecar: la revisión de componentes está hecha. Quién y cuándo.
ALTER TABLE vehiculos ADD COLUMN revisado_en TEXT;
ALTER TABLE vehiculos ADD COLUMN revisado_por INTEGER REFERENCES usuarios(id);

-- La revisión, como la pestaña de Pymecar: lo que se recibe con el coche, lo que se entrega con él y el estado
-- de cada componente (sale como anexo del contrato de compraventa). Lista cerrada, como los extras (0003).
-- PROVISIONAL: recepción y entrega son las de Pymecar; los componentes, una lista estándar hasta ver la suya.
CREATE TABLE revision_elementos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  fase   TEXT NOT NULL CHECK (fase IN ('recepcion', 'entrega', 'componentes')),
  nombre TEXT NOT NULL,
  orden  INTEGER NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (fase, nombre)
);

CREATE TABLE vehiculo_revision (
  vehiculo_id    INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  elemento_id    INTEGER NOT NULL REFERENCES revision_elementos(id),
  marcado        INTEGER NOT NULL DEFAULT 0,       -- recepción y entrega: está o no está
  estado         TEXT CHECK (estado IN ('controlado', 'sustituido', 'cubierto')), -- componentes
  nota           TEXT,                             -- la «información adicional» de Pymecar
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vehiculo_id, elemento_id)
);

INSERT INTO revision_elementos (fase, nombre, orden) VALUES
  ('recepcion', 'Ficha técnica', 1), ('recepcion', 'Permiso de circulación', 2), ('recepcion', 'Libro de mantenimiento', 3),
  ('recepcion', 'Checklist de entrada', 4), ('recepcion', 'Segunda llave', 5),
  ('entrega', 'Segunda llave', 1), ('entrega', 'Gato o kit antipinchazos', 2), ('entrega', 'Rueda de recambio', 3),
  ('entrega', 'Triángulos', 4), ('entrega', 'Chalecos', 5), ('entrega', 'Alfombrillas', 6),
  ('componentes', 'Motor', 1), ('componentes', 'Embrague', 2), ('componentes', 'Caja de cambios', 3), ('componentes', 'Frenos', 4),
  ('componentes', 'Suspensión', 5), ('componentes', 'Dirección', 6), ('componentes', 'Neumáticos', 7), ('componentes', 'Batería', 8),
  ('componentes', 'Sistema eléctrico', 9), ('componentes', 'Luces', 10), ('componentes', 'Climatización', 11),
  ('componentes', 'Refrigeración', 12), ('componentes', 'Escape', 13), ('componentes', 'Limpiaparabrisas', 14),
  ('componentes', 'Carrocería', 15), ('componentes', 'Interior y tapicería', 16);

-- Factura: un coche que entrega el cliente como parte del pago. Su valor se apunta como cobro al emitir.
ALTER TABLE facturas ADD COLUMN parte_pago_cent INTEGER CHECK (parte_pago_cent >= 0);
ALTER TABLE facturas ADD COLUMN parte_pago_vehiculo TEXT;                                  -- marca, modelo y matrícula
ALTER TABLE facturas ADD COLUMN parte_pago_vehiculo_id INTEGER REFERENCES vehiculos(id);   -- si ya se dio de alta en el stock
