-- Ampliación del 7-oct, bloque 2: los costes de la ficha (transporte, taller, preparación e impuestos)
-- pasan al libro de gastos, como gastos de tipo «vehículo» de ese coche. Así hay una sola fuente: un
-- taller apuntado en la ficha o en el libro es el mismo gasto, y no se cuenta dos veces.
-- coste_ficha dice de qué casilla de la ficha sale el gasto (uno por casilla y coche); los demás gastos
-- del coche lo llevan vacío. La API sigue aceptando y devolviendo los cuatro campos (vehiculos/costes.js).
-- Los importes de la ficha son sin IVA; los impuestos y la gestoría no llevan IVA.
-- Dueño: Victor.

ALTER TABLE gastos ADD COLUMN coste_ficha TEXT CHECK (coste_ficha IN ('transporte','taller','preparacion','impuestos'));
CREATE UNIQUE INDEX gastos_coste_ficha ON gastos (vehiculo_id, coste_ficha) WHERE coste_ficha IS NOT NULL;

WITH c AS (
  SELECT id, 'transporte' AS k, coste_transporte_cent AS b, 21 AS iva, creado_en FROM vehiculos WHERE coste_transporte_cent > 0
  UNION ALL SELECT id, 'taller', coste_taller_cent, 21, creado_en FROM vehiculos WHERE coste_taller_cent > 0
  UNION ALL SELECT id, 'preparacion', coste_preparacion_cent, 21, creado_en FROM vehiculos WHERE coste_preparacion_cent > 0
  UNION ALL SELECT id, 'impuestos', coste_impuestos_cent, 0, creado_en FROM vehiculos WHERE coste_impuestos_cent > 0
), n AS (SELECT c.*, ROW_NUMBER() OVER (ORDER BY id, k) AS rn FROM c)
INSERT INTO gastos (numero, fecha, tipo, concepto, descripcion, vehiculo_id, base_cent, iva_pct, iva_cent,
                    irpf_pct, irpf_cent, total_cent, creado_por, coste_ficha)
SELECT (SELECT COALESCE(MAX(numero), 0) FROM gastos) + rn, date(creado_en), 'vehiculo', 'vehiculos',
       'Desde la ficha del coche', id, b, iva, CAST(round(b * iva / 100.0) AS INTEGER),
       0, 0, b + CAST(round(b * iva / 100.0) AS INTEGER), (SELECT MIN(id) FROM usuarios), k
  FROM n;

ALTER TABLE vehiculos DROP COLUMN coste_transporte_cent;
ALTER TABLE vehiculos DROP COLUMN coste_taller_cent;
ALTER TABLE vehiculos DROP COLUMN coste_preparacion_cent;
ALTER TABLE vehiculos DROP COLUMN coste_impuestos_cent;
