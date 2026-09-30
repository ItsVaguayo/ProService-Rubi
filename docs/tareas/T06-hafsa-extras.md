# T06 · Lista cerrada de extras

**Quién:** Hafsa.
**Para cuándo:** viernes 9-oct.
**Qué aprendes:** a preparar datos que después usa el programa. Un dato mal escrito aquí se arrastra a la web y a los portales.

## Objetivo

La lista de extras que Jaume marcará con casillas al dar de alta un coche, y por la que el cliente podrá filtrar en la web (el cliente pidió lista cerrada en la 3.7 del briefing).

## Ficheros

- Crear `docs/datos/extras.csv`

## Pasos

1. Entra en Coches.net, busca cualquier coche y mira los filtros de equipamiento y la lista de extras de un anuncio. Haz lo mismo en Milanuncios. Apunta los que se repiten.
2. Quédate con **entre 30 y 45 extras**. Si hay más, Jaume no los marcará.
3. Agrúpalos en cuatro grupos: **Confort**, **Seguridad**, **Multimedia** y **Exterior**.
4. Escribe el CSV con dos columnas, `grupo` y `nombre`, una fila por extra:
   ```
   grupo,nombre
   Seguridad,Sensores de aparcamiento traseros
   Seguridad,Cámara de marcha atrás
   Multimedia,Navegador
   ```
5. Nombres cortos, con mayúscula solo al principio y sin repetir la misma cosa con dos nombres («GPS» y «Navegador» son lo mismo: elige uno).
6. Ábrelo con Excel o LibreOffice para comprobar que salen dos columnas bien separadas.

## Cómo sé que está bien

- Entre 30 y 45 extras, en 4 grupos, sin duplicados.
- Commit, push y PR hacia `develop`. Victor se lo pasa a Diego para que el cliente lo revise, y Claude lo carga en la base de datos.
