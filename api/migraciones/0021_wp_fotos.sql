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
