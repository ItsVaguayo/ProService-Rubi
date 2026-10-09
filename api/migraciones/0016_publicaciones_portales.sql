-- Portales a mano (docs/portales.md, «Qué se puede hacer ya»): quien sube el anuncio a Coches.net, Milanuncios
-- o Wallapop lo marca como publicado en el panel, con el enlace, y al venderse confirma la baja en cada uno.
-- Dueño: Victor.

ALTER TABLE publicaciones ADD COLUMN enlace TEXT;        -- la dirección del anuncio en el portal
ALTER TABLE publicaciones ADD COLUMN publicado_en TEXT;  -- cuándo se marcó como publicado (UTC)
ALTER TABLE publicaciones ADD COLUMN retirado_en TEXT;   -- cuándo se confirmó la baja (UTC)
