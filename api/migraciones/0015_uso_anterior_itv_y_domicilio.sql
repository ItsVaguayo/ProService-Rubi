-- Dos datos de la ficha de Pymecar que salen en el contrato de compraventa y no teníamos (docs/pymecar.md):
-- el uso anterior del coche y la fecha de su última ITV. Y el domicilio fiscal de la empresa, que sale en la
-- cabecera de sus contratos (duda H8): solo si aún está vacío, para no pisar lo que se haya puesto a mano.
-- Dueño: Victor.

ALTER TABLE vehiculos ADD COLUMN uso_anterior TEXT CHECK (uso_anterior IN ('particular','profesional'));
ALTER TABLE vehiculos ADD COLUMN itv_ultima TEXT;

UPDATE empresa SET direccion = 'C/ Llull, 321, planta 4', codigo_postal = '08191', poblacion = 'Rubí', provincia = 'Barcelona'
 WHERE id = 1 AND direccion IS NULL;
