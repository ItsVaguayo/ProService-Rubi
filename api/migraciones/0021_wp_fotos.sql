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
-- El post anterior de un coche revinculado: 0 no era nuestro; 1 lo creó la plataforma y falta pasarlo a borrador (si
-- no, el coche saldría dos veces en la web); 2 ya retirado (sus fotos, nuestras, se pueden mover al post nuevo).
ALTER TABLE wp_posts ADD COLUMN anterior_propio INTEGER NOT NULL DEFAULT 0;
-- Las filas de antes quedan en 0 (como fichas hechas a mano): no se distingue una vinculada ya sincronizada de una
-- creada por el conector, y en la duda no se vacía nada suyo. En producción no hay ninguna: el conector no llegó a publicar.
