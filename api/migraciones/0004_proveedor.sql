-- Coches propios: a quién se le compró. Solo lo ve gerencia (campos.js, dinero: true),
-- igual que los datos del dueño de los coches en depósito.
-- Dueño: Victor.

ALTER TABLE vehiculos ADD COLUMN proveedor_nombre TEXT;
ALTER TABLE vehiculos ADD COLUMN proveedor_telefono TEXT;
