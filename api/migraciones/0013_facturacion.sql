-- Ampliación del 7-oct, bloque 3: facturación de ventas, cobros y libros (docs/pymecar.md, «Ventas y facturas»).
-- Verifactu queda para octubre de 2028 (duda H1): verifactu_estado es el hueco para entonces.
-- Dueño: Victor.

-- Los datos fiscales de la empresa: una sola fila. Sin dirección no se emite (duda H8).
CREATE TABLE empresa (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  razon_social        TEXT NOT NULL,
  nif                 TEXT NOT NULL,
  direccion           TEXT,
  codigo_postal       TEXT,
  poblacion           TEXT,
  provincia           TEXT,
  telefono            TEXT,
  email               TEXT,
  registro_mercantil  TEXT,              -- tomo, folio, hoja: va al pie de la factura
  iban                TEXT,              -- para pagar por transferencia
  actualizado_en      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO empresa (id, razon_social, nif, telefono, email, poblacion, provincia)
VALUES (1, 'PROSERVICE OCASIÓN SL', 'B56845381', '934 885 233', 'info@proservicerubi.com', 'Rubí', 'Barcelona');

-- Una serie por tipo y año, como en Pymecar: V26 (ventas), R26 (rectificativas). `ultimo` es el último
-- número dado: el siguiente es ultimo + 1, sin huecos. Antes de la primera factura se puede fijar para
-- seguir la numeración de Pymecar (V26 iba por la 38 el 1-oct).
CREATE TABLE series (
  serie   TEXT PRIMARY KEY,
  tipo    TEXT NOT NULL CHECK (tipo IN ('venta','rectificativa')),
  anio    INTEGER NOT NULL,
  ultimo  INTEGER NOT NULL DEFAULT 0 CHECK (ultimo >= 0)
);

CREATE TABLE facturas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo             TEXT NOT NULL DEFAULT 'venta' CHECK (tipo IN ('venta','rectificativa')),
  estado           TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','emitida')),
  serie            TEXT REFERENCES series(serie),   -- al emitir
  numero           INTEGER,                         -- al emitir
  codigo           TEXT UNIQUE,                     -- 'V26-00039', al emitir
  fecha            TEXT NOT NULL,                   -- 'AAAA-MM-DD', día de aquí
  vencimiento      TEXT,
  cliente_id       INTEGER NOT NULL REFERENCES clientes(id),
  vehiculo_id      INTEGER REFERENCES vehiculos(id),
  rectifica_id     INTEGER REFERENCES facturas(id),
  motivo           TEXT,                            -- de una rectificativa
  regimen          TEXT NOT NULL DEFAULT 'REBU' CHECK (regimen IN ('REBU','general')),
  precio_cent      INTEGER NOT NULL,                -- precio de venta del coche, impuestos incluidos
  compra_cent      INTEGER,                         -- REBU: lo que costó (libro REBU)
  base_cent        INTEGER NOT NULL,                -- REBU: el margen sin IVA; general: el precio sin IVA
  iva_pct          INTEGER NOT NULL DEFAULT 21,
  iva_cent         INTEGER NOT NULL,
  suplidos_cent    INTEGER NOT NULL DEFAULT 0,      -- gestoría pagada por cuenta del cliente (en negativo en una rectificativa)
  total_cent       INTEGER NOT NULL,                -- precio + suplidos
  forma_pago       TEXT,
  uso_destino      TEXT CHECK (uso_destino IN ('particular','profesional')),
  garantia_tipo    TEXT CHECK (garantia_tipo IN ('directa','comprada','sin')),
  garantia_meses   INTEGER CHECK (garantia_meses BETWEEN 0 AND 36),
  km_entrega       INTEGER CHECK (km_entrega >= 0),
  observaciones    TEXT,
  datos_empresa    TEXT,                            -- copia (JSON) al emitir: la factura no cambia
  datos_cliente    TEXT,                            -- aunque luego cambie la ficha
  datos_vehiculo   TEXT,
  verifactu_estado TEXT,                            -- vacío hasta 2028
  creado_por       INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en        TEXT NOT NULL DEFAULT (datetime('now')),
  emitida_por      INTEGER REFERENCES usuarios(id),
  emitida_en       TEXT,
  UNIQUE (serie, numero),
  CHECK (estado = 'borrador' OR (serie IS NOT NULL AND numero IS NOT NULL AND codigo IS NOT NULL))
);
CREATE INDEX facturas_fecha ON facturas (fecha);
CREATE INDEX facturas_vehiculo ON facturas (vehiculo_id);
CREATE UNIQUE INDEX facturas_una_rectificativa ON facturas (rectifica_id) WHERE rectifica_id IS NOT NULL;

CREATE TABLE cobros (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  factura_id   INTEGER NOT NULL REFERENCES facturas(id),
  fecha        TEXT NOT NULL,
  importe_cent INTEGER NOT NULL CHECK (importe_cent > 0),
  forma_pago   TEXT NOT NULL,
  reserva_id   INTEGER REFERENCES reservas(id),     -- la señal de una reserva, aplicada como cobro
  nota         TEXT,
  creado_por   INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX cobros_factura ON cobros (factura_id);
CREATE UNIQUE INDEX cobros_una_senal ON cobros (reserva_id) WHERE reserva_id IS NOT NULL;
