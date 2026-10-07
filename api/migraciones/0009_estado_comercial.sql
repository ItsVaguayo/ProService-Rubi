-- Ampliación del 7-oct, bloque 9: en qué punto del embudo está cada cliente (CRM de la T11 de David).
-- Va aparte de la T11 para que David no espere a Victor por el campo de clientes.
-- Dueño: Victor.

ALTER TABLE clientes ADD COLUMN estado_comercial TEXT NOT NULL DEFAULT 'nuevo'
  CHECK (estado_comercial IN ('nuevo','interesado','me_lo_pienso','negociando','ganado','perdido'));
CREATE INDEX clientes_estado_comercial ON clientes (estado_comercial);
