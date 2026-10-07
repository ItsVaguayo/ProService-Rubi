# T08 · Probar el fondo con IA y los estados de las fotos

**Quién:** Hafsa.
**Para cuándo:** en cuanto acabes T07, o antes si llegan las fotos y el fondo del cliente (dudas D1 y D2).
**Qué aprendes:** a probar un servicio antes de pagarlo, con números y no con impresiones.

## Objetivo

Saber qué herramienta pone mejor el coche sobre el fondo del photocall y cuánto cuesta. Diego decide con tu tabla.

## Parte 1 · La prueba

1. Pide a Victor tres fotos reales de Jaume (una frontal, una 3/4 y una del interior) y el fondo del cliente. Si aún no hay fondo, usa un fondo gris liso.
2. Prueba dos herramientas con las mismas tres fotos:
   - **rembg**, gratis y en nuestro servidor. Victor te lo deja instalado en su ordenador: te sienta con él 15 minutos.
   - **Photoroom**, de pago. Tiene prueba gratis en su web: sube las fotos a mano.
3. Para cada foto y herramienta apunta:
   - ¿Se ha comido algún trozo del coche (retrovisor, antena, ruedas)?
   - ¿Quedan restos del fondo original entre los radios o en los cristales?
   - Segundos que tarda.
   - Precio por foto en el plan más barato que sirva (unas 240 fotos al mes).
4. **No uses Gemini ni ninguna IA de imagen de pago por tu cuenta.** Es una regla del equipo: cada imagen cuesta dinero y ya se ha ido mucho sin darnos cuenta.

Resultado en `docs/photocall.md`: una tabla con las 6 pruebas, las imágenes en `docs/photocall/` y tres líneas con tu recomendación. Lo que no sepas, «no lo sé».

## Parte 2 · Los estados en `fotos.html`

Cuando una foto se sube, el servidor tarda unos segundos en ponerle el fondo. Jaume tiene que verlo. En la maqueta de `fotos.html`, cada miniatura enseña uno de estos estados:

- **Procesando**: miniatura un poco apagada y un indicador que gira.
- **Lista**: la foto con fondo, normal.
- **Falló**: la foto original, un aviso pequeño y un botón «Reintentar».
- Un interruptor por foto: «Usar la original».

Y debajo de la galería, un hueco para el **vídeo** del coche (vertical, con un botón para cambiar a horizontal).

## Cómo sé que está bien

- La tabla tiene las 6 pruebas con los cuatro datos, sin huecos inventados.
- Los tres estados y el interruptor se ven en la maqueta, también en el móvil.
- PR hacia `develop` con «T08».
