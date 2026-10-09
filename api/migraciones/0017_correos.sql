-- Correos que manda la plataforma: el aviso al llegar un contacto de la web y el resumen diario de avisos.
-- Se apuntan aquí y los envía un proceso aparte (correo/envio.js), así un SMTP caído no tumba el formulario.
-- Sin SMTP configurado (duda H13) quedan como «simulado»: se ven en el panel, pero no salen.
-- Dueño: Victor.

CREATE TABLE correos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo         TEXT NOT NULL CHECK (tipo IN ('contacto', 'avisos_diario')),
  clave        TEXT UNIQUE,              -- evita mandar dos veces lo mismo: 'avisos:2026-10-09'
  para         TEXT,                     -- vacío si no hay destinatario configurado
  asunto       TEXT NOT NULL,
  cuerpo       TEXT NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'simulado', 'error')),
  intentos     INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  creado_en    TEXT NOT NULL DEFAULT (datetime('now')),
  enviado_en   TEXT
);
CREATE INDEX correos_pendientes ON correos (estado, id);
