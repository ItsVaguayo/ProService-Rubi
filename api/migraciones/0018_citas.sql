-- Ampliación del 7-oct, bloque 10: cita previa de pruebas de conducción.
-- Las pide la web (huecos libres dentro del horario) o se apuntan desde el panel (agenda.html).
-- Dueño: Victor.

-- Horario en el que se hacen pruebas, por día de la semana (1 = lunes … 7 = domingo), en hora de Rubí.
-- Por defecto, el de la duda H12: de lunes a viernes de 10:00 a 13:30 y de 16:30 a 19:30; sábado de
-- 10:00 a 13:30. La última prueba de cada franja empieza media hora antes de que acabe.
CREATE TABLE horario_pruebas (
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  desde      TEXT NOT NULL,   -- 'HH:MM'
  hasta      TEXT NOT NULL,   -- 'HH:MM'
  PRIMARY KEY (dia_semana, desde)
);
INSERT INTO horario_pruebas (dia_semana, desde, hasta) VALUES
  (1, '10:00', '13:30'), (1, '16:30', '19:30'),
  (2, '10:00', '13:30'), (2, '16:30', '19:30'),
  (3, '10:00', '13:30'), (3, '16:30', '19:30'),
  (4, '10:00', '13:30'), (4, '16:30', '19:30'),
  (5, '10:00', '13:30'), (5, '16:30', '19:30'),
  (6, '10:00', '13:30');

CREATE TABLE citas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id),
  inicio       TEXT NOT NULL,   -- 'AAAA-MM-DD HH:MM', hora de Rubí; en punto o y media (las pruebas duran 30 min)
  estado       TEXT NOT NULL DEFAULT 'pedida' CHECK (estado IN ('pedida', 'confirmada', 'hecha', 'no_vino', 'cancelada')),
  nombre       TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  email        TEXT,
  cliente_id   INTEGER REFERENCES clientes(id),
  contacto_id  INTEGER REFERENCES contactos(id),  -- la petición de la web de la que sale, si sale de una
  origen       TEXT NOT NULL DEFAULT 'panel' CHECK (origen IN ('web', 'panel')),
  notas        TEXT,
  creado_por   INTEGER REFERENCES usuarios(id),   -- vacío si la pidió la web
  creado_en    TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX citas_inicio ON citas (inicio);
-- Sin solapes: las pruebas las acompaña una persona, así que dos citas vivas no empiezan a la misma hora.
-- Lo garantiza la base, también si dos personas piden el mismo hueco en el mismo segundo.
CREATE UNIQUE INDEX citas_sin_solape ON citas (inicio) WHERE estado IN ('pedida', 'confirmada');
