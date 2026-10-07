-- Ampliación del 7-oct, bloque 2 (T14): el libro de gastos, como hoy en Pymecar (docs/pymecar.md, «Libros»).
-- Número de registro correlativo y sin huecos, importes calculados en el servidor y en céntimos.
-- Sin borrar: un libro registro se corrige, no se borra.
-- Dueño: David.

CREATE TABLE gastos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  numero            INTEGER NOT NULL UNIQUE,      -- nº de registro del libro, correlativo, sin huecos
  fecha             TEXT NOT NULL,                -- 'AAAA-MM-DD', la de la factura
  tipo              TEXT NOT NULL CHECK (tipo IN ('general','irpf','comision','rebu','vehiculo')),
  concepto          TEXT NOT NULL CHECK (concepto IN ('alquileres','carburantes','comisiones','compras',
                      'electricidad','gestorias','papelerias','publicidad','vehiculos')),
  descripcion       TEXT,                         -- «Observaciones» en Pymecar
  factura_proveedor TEXT,                         -- el número de su factura: «F-26-000153»
  proveedor_id      INTEGER REFERENCES proveedores(id),
  cliente_id        INTEGER REFERENCES clientes(id),
  usuario_id        INTEGER REFERENCES usuarios(id),  -- el comercial, en los incentivos
  vehiculo_id       INTEGER REFERENCES vehiculos(id),
  base_cent         INTEGER NOT NULL CHECK (base_cent >= 0),
  iva_pct           INTEGER NOT NULL DEFAULT 21 CHECK (iva_pct IN (0, 4, 10, 21)),
  iva_cent          INTEGER NOT NULL,
  irpf_pct          INTEGER NOT NULL DEFAULT 0 CHECK (irpf_pct IN (0, 7, 15, 19)),
  irpf_cent         INTEGER NOT NULL,
  total_cent        INTEGER NOT NULL,             -- base + IVA − IRPF: lo que se paga
  forma_pago        TEXT,
  pagado_en         TEXT,                         -- vacío = sin pagar
  creado_por        INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX gastos_fecha ON gastos (fecha);
CREATE INDEX gastos_vehiculo ON gastos (vehiculo_id);
