-- Ampliación del 7-oct, bloque 6 (T12): incentivos de los comerciales. La regla de cada uno y lo que ya
-- se ha pagado de cada mes. La regla del cliente aún no se sabe (duda H9): sin regla, el incentivo es 0.
-- Todo en enteros: el porcentaje en centésimas (500 = 5 %) y el dinero en céntimos.
-- Dueño: David.

CREATE TABLE incentivos_reglas (
  usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),
  tipo           TEXT NOT NULL CHECK (tipo IN ('porcentaje_margen','fijo_por_coche')),
  valor          INTEGER NOT NULL CHECK (valor >= 0),  -- centésimas de porcentaje o céntimos por coche
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE incentivos_liquidados (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mes           TEXT NOT NULL,                      -- 'AAAA-MM'
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  coches        INTEGER NOT NULL,
  importe_cent  INTEGER NOT NULL,
  liquidado_por INTEGER NOT NULL REFERENCES usuarios(id),
  liquidado_en  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mes, usuario_id)                          -- un mes no se paga dos veces
);
