-- Ampliación del 7-oct, bloque 1 (T15): lo que pide Pymecar en el alta de un proveedor y nos faltaba
-- (docs/pymecar.md, «Proveedores»). Proveedor es a quien se le compran coches; acreedor, quien da un
-- servicio (gestoría, luz, publicidad).
-- Dueño: Victor (módulo terceros); lo hace David con su OK.

ALTER TABLE proveedores ADD COLUMN clase TEXT NOT NULL DEFAULT 'proveedor' CHECK (clase IN ('proveedor','acreedor'));
ALTER TABLE proveedores ADD COLUMN movil TEXT;
ALTER TABLE proveedores ADD COLUMN iban TEXT;             -- sin espacios: ES9121000418450200051332
ALTER TABLE proveedores ADD COLUMN forma_pago TEXT;
ALTER TABLE proveedores ADD COLUMN persona_contacto TEXT;
