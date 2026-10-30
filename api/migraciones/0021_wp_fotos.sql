-- Su galería son las fotos adjuntas al post (30-oct-2026, ACF expuesto): el conector tiene que saber cuáles son suyas.
-- Dueño: David (módulo publicacion).

-- 0: sin mirar (recién vinculada). 1: todas las fotos adjuntas al post son nuestras (lo creó la plataforma, o no
-- tenía otras): solo entonces se desadjuntan las que sobran (ocultas o borradas en el panel). -1: ficha vinculada
-- con fotos subidas a mano; no se sube nada (saldrían mezcladas) hasta que se quiten y se vuelva a vincular.
ALTER TABLE wp_posts ADD COLUMN fotos_propias INTEGER NOT NULL DEFAULT 0;
-- Las fotos (ids de WordPress, en orden) que se cuadraron con el post la última vez: si no cambian, no se repasa.
ALTER TABLE wp_posts ADD COLUMN fotos_huella TEXT;
-- Los avisos del coche en la última pasada (valores fuera de sus opciones, fotos bloqueadas): no son errores, el
-- coche se publicó; van aparte de ultimo_error para que el estado distinga uno de otro.
ALTER TABLE wp_posts ADD COLUMN avisos TEXT;
-- 1: el post lo creó la plataforma. En él un dato que se vacía en el panel se vacía también en la web; en una
-- ficha vinculada (hecha a mano) un dato que no tenemos no se manda, para no borrar lo que pusieron.
ALTER TABLE wp_posts ADD COLUMN propio INTEGER NOT NULL DEFAULT 0;
-- El post que tenía antes el coche si se revinculó a otro: sus fotos (las nuestras) se mueven desde ahí.
ALTER TABLE wp_posts ADD COLUMN wp_post_anterior INTEGER;
