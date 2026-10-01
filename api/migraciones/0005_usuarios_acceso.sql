-- Último acceso de cada usuario, para la página «Usuarios» del panel. Se apunta al entrar.
-- Dueño: Victor.

ALTER TABLE usuarios ADD COLUMN ultimo_acceso TEXT;
