# Photocall: lo que hacen hoy en su web

Revisado el 19-oct-2026 con cinco fotos publicadas en proservicerubi.com: tres de un Hyundai i20 y dos de un Mitsubishi Colt. Completa la prueba de [photocall.md](photocall.md): aquella compara herramientas de recorte; esta dice qué resultado esperan y qué riesgo tiene lo que usan hoy.

Las fotos y los recortes ampliados (`matriculas.png`, `logos.png`, `colt-rueda.png`, `colt-parabrisas.png`) **no están en el repositorio**: salen matrículas reales y [photocall/README.md](photocall/README.md) pide el OK de Victor antes de guardarlas aquí. Están en la carpeta compartida del proyecto, `Pruebas rembg/ProService-Publico/` y `Pruebas rembg/notas/`.

## Cómo es su «photocall»

- Todas miden 1448 × 1086 (4:3) y son PNG.
- Plató blanco con suelo gris pulido, focos en el techo y el logo pintado en la pared, encima del coche. El coche tiene reflejo y sombra en el suelo: no parece recortado y pegado.
- Una banda abajo (unos 180 px, el 17 % del alto) con cuatro sellos y una línea con la dirección y el teléfono (Ctra. de Terrassa 83, 648 473 853).
- No siempre igual: la frontal del i20 (`i20-2`) no lleva banda.
- **Dos marcas distintas.** El i20 sale con «PROSERVICE RUBI» en verde y sellos «Garantía 12 meses · Vehículos revisados · Confianza y transparencia · Entrega en toda España». El Colt, con «Grupo ProService Rubí» en negro y rojo y otros sellos: «Garantía mínima 12 meses · Taller integral propio · Aceptamos su coche como parte de pago · Gestionamos transportes a toda España». Hay que preguntar cuál es la buena.

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
- **Plantilla por tipo de foto.** La banda no va en todas (la frontal del i20 no la lleva). Plantilla con banda y sin banda, elegida por el hueco del orden fijo.
- **Formato de salida.** 1448 × 1086 en 4:3. Hoy reducimos a 1.600 px de lado largo; la plantilla debería fijar el tamaño final. Y JPG en vez de PNG (sus PNG pesan varias veces más sin ganar nada en una foto).
- **Revisión obligatoria** antes de publicar al principio, con la original al lado, como en la maqueta del panel.

## Para preguntar a Jaume (las pasa Diego)

- ¿Qué herramienta o empresa les hace hoy estas fotos y cuánto pagan?
- ¿Cuál de las dos marcas es la buena, y quieren la banda en todas las fotos?
- ¿Sabían que la herramienta les ha cambiado la matrícula del i20 y las llantas del Colt?
- ¿La matrícula se publica?

## Prototipo por capas (19-oct)

Para ver si se llega a algo parecido sin IA generativa: rembg (`isnet-general-use`) recorta el coche y todo lo demás se compone con código. Probado con dos fotos de internet de un Nissan GT-R (1024 y 739 px), porque aún no hay fotos de Jaume. El guion está fuera del repositorio, en `Pruebas rembg/pipeline/photocall_prototipo.py`, con los resultados al lado.

Capas, de abajo arriba, en 1448 × 1086:

1. **Plató:** pared blanca con tres focos suaves y suelo gris claro. Generado por código mientras falte el fondo del cliente (D2); con su foto se sustituye por ella.
2. **Sombras y reflejo,** sacados de la silueta del coche: una sombra amplia y suave, otra fina y oscura donde apoyan las ruedas, y el coche dado la vuelta, muy tenue, como reflejo en el suelo pulido.
3. **El coche, con sus píxeles originales.** Antes se limpia el recorte: se separa lo que cuelga de un hilo (una farola sobre el techo), se queda la pieza más grande, se quita la sombra semitransparente del suelo original y se afina el borde 1 px para que no quede halo del fondo viejo.
4. **Logo y banda,** imágenes fijas. En el prototipo el logo es texto provisional: falta el fichero bueno (H14) y saber cuál de las dos marcas es la de ahora.

Resultado: de lejos se parece bastante a lo suyo y el coche no cambia (la matrícula, las llantas y el alerón son los de la foto). De cerca se nota:

- **Recorte:** en una foto queda un trozo de farola y un poco de halo del fondo en el techo. Se ve al revisar y se arregla, pero hay que revisarlo.
- **Reflejo y luz:** el reflejo es un espejo del coche, no el de un suelo de verdad, y la luz del coche es la de donde se hizo la foto, no la del plató. Con fotos en un patio a pleno sol se notará más que con fotos en sombra.
- **Ángulo:** si la foto está hecha desde abajo o muy de lado, el coche no «apoya» en el suelo del plató igual que en la foto original.
- **Tiempo:** unos 5 s por foto en este ordenador (recorte, unos 4,5 s; composición, 1 s), con fotos pequeñas. A 1.600 px, algo más.

Lo que sale de aquí para el código: la composición es sharp (ya está en la API) y el recorte, rembg como servicio aparte. La plantilla (fondo, logo, banda) son tres ficheros que se cambian sin tocar código, y cada foto guarda el recorte para recomponerla si cambia la plantilla.
