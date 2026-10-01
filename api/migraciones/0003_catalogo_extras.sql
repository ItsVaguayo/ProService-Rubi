-- 3.7 Catálogo cerrado de extras. La API ya no crea extras: solo se pueden marcar los de esta tabla.
-- Lista PROVISIONAL: las 32 casillas del formulario de alta (frontend/panel/coche-nuevo.html).
-- La definitiva sale de la ficha T06 (docs/datos/extras.csv) y entrará en otra migración.
-- Dueño: Victor.

INSERT OR IGNORE INTO extras (nombre) VALUES
  ('Climatizador'),
  ('Climatizador bizona'),
  ('Control de crucero'),
  ('Control de crucero adaptativo'),
  ('Asientos calefactables'),
  ('Asientos eléctricos'),
  ('Volante multifunción'),
  ('Arranque sin llave'),
  ('Portón eléctrico'),
  ('Techo solar'),
  ('Sensores de aparcamiento delanteros'),
  ('Sensores de aparcamiento traseros'),
  ('Cámara de marcha atrás'),
  ('Cámara 360°'),
  ('Aviso de ángulo muerto'),
  ('Aviso de cambio de carril'),
  ('Frenada de emergencia'),
  ('Detector de fatiga'),
  ('Navegador'),
  ('Apple CarPlay'),
  ('Android Auto'),
  ('Bluetooth'),
  ('Pantalla táctil'),
  ('Cargador inalámbrico'),
  ('Equipo de sonido premium'),
  ('Faros LED'),
  ('Faros de xenón'),
  ('Llantas de aleación'),
  ('Barras de techo'),
  ('Enganche de remolque'),
  ('Lunas tintadas'),
  ('Retrovisores plegables eléctricos');
