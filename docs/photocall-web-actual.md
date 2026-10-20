# Photocall: lo que hacen hoy en su web

Revisado el 19-oct-2026 con cinco fotos publicadas en proservicerubi.com: tres de un Hyundai i20 y dos de un Mitsubishi Colt. Completa la prueba de [photocall.md](photocall.md): aquella compara herramientas de recorte; esta dice qué resultado esperan y qué riesgo tiene lo que usan hoy.

Las fotos y los recortes ampliados (`matriculas.png`, `logos.png`, `colt-rueda.png`, `colt-parabrisas.png`) **no están en el repositorio**: salen matrículas reales y [photocall/README.md](photocall/README.md) pide el OK de Victor antes de guardarlas aquí. Están en la carpeta compartida del proyecto, `Pruebas rembg/01-lo-que-publican-hoy/` (con un `00-LEEME.md` que explica toda la carpeta).

## Cómo es su «photocall»

- Todas miden 1448 × 1086 (4:3) y son PNG.
- Plató blanco con suelo gris pulido, focos en el techo y el logo pintado en la pared, encima del coche. El coche tiene reflejo y sombra en el suelo: no parece recortado y pegado.
- Una banda abajo (unos 180 px, el 17 % del alto) con cuatro sellos y una línea con la dirección y el teléfono (Ctra. de Terrassa 83, 648 473 853).
- No siempre igual: la frontal del i20 (`i20-2`) no lleva banda.
- **Dos marcas distintas** (resuelto el 19-oct, ver abajo). El i20 sale con «PROSERVICE RUBI» en verde y sellos «Garantía 12 meses · Vehículos revisados · Confianza y transparencia · Entrega en toda España». El Colt, con «Grupo ProService Rubí» en negro y rojo y otros sellos: «Garantía mínima 12 meses · Taller integral propio · Aceptamos su coche como parte de pago · Gestionamos transportes a toda España». **La buena es la roja y negra, «Grupo ProService Rubí»**: Diego la comprobó el 19-oct con el logo de su web. Es el mismo logo que ya tenemos en `frontend/img/logo-proservice-papel.webp` (letras negras, para fondo claro; `logo-proservice.webp` es la versión de fondo oscuro).

## Lo que más importa: la IA les cambia el coche

1. **La matrícula.** `i20-1` dice 5288 KBN; `i20-2` e `i20-3`, 5536 KBN. Mismo coche, mismo color y mismas llantas: casi seguro que la herramienta reescribió la matrícula (`matriculas.png`).
2. **Las llantas.** Las dos fotos del Colt son la misma toma, pero los radios de las llantas tienen otra forma en cada una (`colt-rueda.png`).
3. **El parabrisas.** En una el Colt lleva la pegatina «50715477» y marcas de rotulador amarillo; en la otra han desaparecido (`colt-parabrisas.png`). Quitar eso está bien, pero lo ha hecho la misma IA que cambia las llantas.
4. **El logo no es fijo.** Cambia de una foto a otra: «RUBI» o «RUBÍ», otra silueta del coche, otro grosor de letra (`logos.png`). La herramienta vuelve a dibujar el logo cada vez en lugar de pegarlo.
5. Los nombres de los ficheros del Colt no cuadran («Trasera» es otra delantera): parece una segunda pasada de la misma foto.

Conclusión: usan una herramienta generativa que vuelve a dibujar la foto entera, coche incluido. Por eso queda tan bien integrado, y por eso se inventa matrículas y llantas. Es justo lo que pregunta la duda D4.

## Qué cambia en la arquitectura

- **El objetivo de calidad es alto.** Lo que esperan es el coche apoyado en el suelo, con reflejo y sombra. Un recorte con rembg pegado sobre un fondo plano (lo probado con el GT-R) se queda bastante por debajo. Hay que enseñárselo antes de construir nada.
- **Composición por capas, nunca generativa, para lo que lleva datos.** Logo, banda de sellos, dirección y teléfono van como imágenes fijas encima (un PNG de plantilla), no dibujados por la IA. Así no salen «RUBI»/«RUBÍ» ni teléfonos inventados.
- **El coche, con sus píxeles.** Si se usa una IA que reilumina o genera suelo y reflejo, después se vuelve a poner encima el coche recortado de la foto original, para que la matrícula, las llantas y los golpes sean los de verdad. O se compara: si la zona del coche cambia más de un umbral, la foto se marca para revisar.
- **Matrícula.** Decidir con Jaume si se publica, se tapa o se pixela. Si se tapa, que lo haga nuestro código sobre una zona marcada, no la IA.
- **Limpiar el parabrisas** (pegatinas, rotulador) es un retoque que sí quieren y que no cabe en «solo el fondo». Hay que decidirlo aparte: o se pide que lo quiten antes de la foto, o se acepta un retoque localizado y revisado.
- **Banda.** Diego la recortó de una foto suya publicada: 1448 × 162, opaca y con fondo blanco. Está en `Pruebas rembg/plantilla/banda/Footer 1.png`, junto al logo en `plantilla/logo/`. Es la de la marca roja (garantía mínima 12 meses, taller propio, coche como parte de pago, transportes). Si algún día cambian un texto, hay que pedirles el original: recortada de una foto no se puede editar.
- **Plantilla por tipo de foto.** La banda no va en todas (la frontal del i20 no la lleva). Plantilla con banda y sin banda, elegida por el hueco del orden fijo.
- **Formato de salida.** 1448 × 1086 en 4:3. Hoy reducimos a 1.600 px de lado largo; la plantilla debería fijar el tamaño final. Y JPG en vez de PNG (sus PNG pesan varias veces más sin ganar nada en una foto).
- **Revisión obligatoria** antes de publicar al principio, con la original al lado, como en la maqueta del panel.

## Para preguntar a Jaume (las pasa Diego)

- ¿Qué herramienta o empresa les hace hoy estas fotos y cuánto pagan?
- ¿Quieren la banda en todas las fotos? (la marca ya está clara: la roja)
- ¿Sabían que la herramienta les ha cambiado la matrícula del i20 y las llantas del Colt?
- ¿La matrícula se publica?

## Prototipo por capas (19-oct)

Para ver si se llega a algo parecido sin IA generativa: rembg (`isnet-general-use`) recorta el coche y todo lo demás se compone con código. Probado con dos fotos de internet de un Nissan GT-R (1024 y 739 px), porque aún no hay fotos de Jaume. El guion está fuera del repositorio, en `Pruebas rembg/herramientas/photocall_prototipo.py`; los resultados, en `Pruebas rembg/03-photocall-por-capas/`.

Capas, de abajo arriba, en 1448 × 1086:

1. **Plató:** pared blanca con tres focos suaves y suelo gris claro. Generado por código mientras falte el fondo del cliente (D2); con su foto se sustituye por ella.
2. **Sombras y reflejo,** sacados de la silueta del coche: una sombra amplia y suave, otra fina y oscura donde apoyan las ruedas, y el coche dado la vuelta, muy tenue, como reflejo en el suelo pulido.
3. **El coche, con sus píxeles originales.** Antes se limpia el recorte: se separa lo que cuelga de un hilo (una farola sobre el techo), se queda la pieza más grande, se quita la sombra semitransparente del suelo original y se afina el borde 1 px para que no quede halo del fondo viejo.
4. **Su logo y su banda,** imágenes fijas: `logo-proservice-papel.webp` a 640 px arriba, centrado, y la banda de 1448 × 162 abajo, sobre blanco. Con eso el formato ya es el suyo.

Resultado: de lejos se parece bastante a lo suyo y el coche no cambia (la matrícula, las llantas y el alerón son los de la foto). De cerca se nota:

- **Recorte:** en una foto queda un trozo de farola y un poco de halo del fondo en el techo. Se ve al revisar y se arregla, pero hay que revisarlo.
- **Reflejo y luz:** el reflejo es un espejo del coche, no el de un suelo de verdad, y la luz del coche es la de donde se hizo la foto, no la del plató. Con fotos en un patio a pleno sol se notará más que con fotos en sombra.
- **Ángulo:** si la foto está hecha desde abajo o muy de lado, el coche no «apoya» en el suelo del plató igual que en la foto original.
- **Tiempo:** unos 5 s por foto en este ordenador (recorte, unos 4,5 s; composición, 1 s), con fotos pequeñas. A 1.600 px, algo más.

Lo que sale de aquí para el código: la composición es sharp (ya está en la API) y el recorte, rembg como servicio aparte. La plantilla (fondo, logo, banda) son tres ficheros que se cambian sin tocar código, y cada foto guarda el recorte para recomponerla si cambia la plantilla.

## Conversión de fotos ya publicadas a la marca roja (19-oct)

Cuatro fotos publicadas de un Citroën C3 Aircross con la marca verde, pasadas por el mismo prototipo: se quitan los 186 px de abajo (su banda verde) antes del recorte, rembg saca el coche y se compone con el logo y la banda rojos. Entre 3,4 y 4,8 s por foto. Antes y después en `Pruebas rembg/04-cambio-de-marca/`.

- Sale bien en las cuatro (3/4 delantera, frontal, trasera y 3/4 trasera): marca roja, misma matrícula (6328 LBL) y mismas llantas. Para cambiar de marca las fotos ya publicadas no hace falta repetirlas.
- **La limpieza del recorte no puede «abrir» la máscara.** Con eso se quitaba la farola del GT-R, pero también la antena del Citroën, que es parte del coche. Ahora solo se queda con la pieza más grande y lo que la toca; lo que esté pegado al coche lo ve quien revisa.
- **El coche va siempre por debajo del logo.** En las tomas de frente y de detrás las barras del techo tocaban «Rubí»; ahora el coche se escala para quedar debajo.
- Lo que no se arregla así: si la foto publicada ya la retocó su herramienta (matrícula o llantas cambiadas), la conversión conserva ese retoque. Para esas fotos hay que partir del original del móvil.

## Fondo: no hay plató que pedir, y fondos de stock (19-oct)

**Su plató no es una imagen fija.** En las nueve fotos publicadas, la línea entre la pared y el suelo cae a una altura distinta en cada una (de 469 a 541 px) y el brillo de pared y suelo cambia. Su herramienta genera un fondo nuevo para cada foto: no hay un fichero que pedirles. El fondo lo ponemos nosotros, y es el mismo en todas las fotos, cosa que hoy no pasa.

**Fondos de stock probados.** Siete candidatos de Unsplash (licencia de uso comercial gratis), cuatro probados con el Citroën. Créditos y resultados en `Pruebas rembg/05-fondos-de-stock/`. El prototipo admite `--fondo=RUTA:H:R`: H es la altura de la línea pared/suelo en la foto de fondo (se coloca a la altura de las ruedas del coche) y R la fuerza del reflejo (0 en suelo de cemento, que no refleja).

| Fondo | Resultado |
|---|---|
| Sala vacía de Julia Taubitz (pared blanca, esquina, cemento gris) | **El que más se parece al suyo.** Neutro, con profundidad por la esquina, y el logo se lee bien. Recomendado. |
| Esquina de frente de Julia Taubitz | Bien, pero la pared tira a amarillo y el suelo tiene marcas. |
| Estudio de Vincenzo Martusciello (pared gris, suelo negro) | Limpio y de estudio, pero el coche se ve más pegado y menos «concesionario». Segunda opción. |
| Oficina con suelo pulido de Julia Taubitz | Descartado: fluorescentes, columnas y extintor; el logo no se lee sobre el techo. |

Lo que tienen todos: la luz del coche es la de su foto, no la del fondo. Para producción, el fondo elegido a tamaño completo y una sola vez en `frontend/img` (o donde viva la plantilla), con su crédito.

## Banda en SVG, fondo según el ángulo y prompt del fondo (19-oct)

**Banda como plantilla.** `Pruebas rembg/plantilla/banda/`: `banda.json` (textos, iconos y colores) y `generar_banda.py`, que crea `banda.svg` y lo pasa a PNG con sharp, el mismo motor que la API. Las columnas se reparten según el largo de los textos, así que cambiar un sello o el teléfono es editar una línea del JSON. Tipografía Barlow Condensed (OFL) e iconos Lucide 0.460.0 (ISC), con sus licencias al lado. Se parece mucho a la suya; la diferencia es que sus iconos son rellenos y estos de trazo (se cambian los `.svg` de `iconos/` sin tocar el código). En el servidor hay que instalar la tipografía, porque el SVG la pide por nombre.

**Fondo según el ángulo.** Diego eligió la «sala vacía» y la «esquina de frente» de Julia Taubitz. El prototipo usa una para las fotos de frente o de detrás y otra para las de tres cuartos, y averigua el ángulo solo: mide cuánto se parece la silueta del coche a su reflejo izquierda-derecha. En 11 fotos, las de frente o detrás dan de 0,95 a 0,97 y las de tres cuartos de 0,54 a 0,83; el corte está en 0,90. En la plataforma el hueco del orden fijo ya dice el ángulo, y la simetría sirve de comprobación.

**Prompt para generar el fondo.** `Pruebas rembg/plantilla/fondo/PROMPT-fondo.md`: uno para frente y detrás y otro para tres cuartos, con las medidas de sus fotos (pared blanca mate, cemento pulido gris claro, línea pared/suelo al 47 % del alto, el tercio de arriba limpio para el logo). Se genera una vez y se reutiliza: la IA solo dibuja el plató vacío, nunca el coche.

## Fondos generados con el prompt (19-oct)

Diego generó los dos fondos con el prompt (`Pruebas rembg/plantilla/fondo/`, 1448 × 1086): limpios, sin texto ni tinte de color. Línea pared/suelo medida: 0,458 del alto en el de frente (recta) y 0,407 en el centro del de tres cuartos. Probados con los 11 coches que tenemos (`Pruebas rembg/07-fondos-generados/`): el ángulo se eligió solo y acertó en los 11, y es el resultado más parecido a sus fotos, con la ventaja de que todas quedan iguales. **Son los que proponemos usar.**

- Al convertir sus fotos ya publicadas puede colarse algo de su logo antiguo cuando toca el coche (la frontal del i20 sale con una «U» sobre el techo). Con fotos del móvil no pasa; en cualquier caso lo ve quien revisa.
- Si se vuelven a generar, mejor al doble de tamaño: para encajar la línea del suelo con el coche el programa amplía el fondo un poco y pierde algo de nitidez.
