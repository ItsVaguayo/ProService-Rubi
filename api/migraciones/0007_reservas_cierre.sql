-- 2.4 y duda C6: cómo termina cada reserva.
--   cierre: cancelada (a mano), caducada (pasó su fecha) o vendida (el coche se vendió con ella)
--   senal_devuelta: al cancelar, si se devolvió la señal (1), si no (0) o sin apuntar (NULL)
-- Dueño: Victor. Sale del PR #6.

ALTER TABLE reservas ADD COLUMN cierre TEXT CHECK (cierre IN ('cancelada', 'caducada', 'vendida'));
ALTER TABLE reservas ADD COLUMN cerrada_en TEXT;
ALTER TABLE reservas ADD COLUMN senal_devuelta INTEGER CHECK (senal_devuelta IN (0, 1));
