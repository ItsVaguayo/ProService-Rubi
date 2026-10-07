# Photocall: rembg contra Photoroom

Tarea T08, parte 1. **Sin probar todavía**: faltan las tres fotos de Jaume y el fondo del cliente (duda D2). Hasta entonces, cada dato de la tabla dice «no lo sé (sin probar)». Lo que después de probar siga sin saberse se queda en **no lo sé**: nada de rellenar a ojo.

Diego decide con esta tabla qué herramienta se usa y si se paga. No hay que contratar nada para la prueba.

## Qué se compara

Solo el **recorte**: quitar el fondo original sin comerse el coche. Es la parte difícil y la que cambia de una herramienta a otra. Poner después el coche recortado sobre un fondo (el del photocall, un gris o un blanco de estudio) es otro paso, el de componer, y es de Victor (bloque 7 del plan).

Dos herramientas, las de la ficha. Ninguna otra: ni Gemini ni otra IA de imagen de pago.

- **rembg**: programa gratis que corre en nuestro servidor. Victor lo tiene instalado en su ordenador y lo enseña en 15 minutos.
- **Photoroom**: de pago, con prueba gratis en su web. Las fotos se suben a mano.

## Cómo se hace la prueba

**Fotos**: tres reales de Jaume, las mismas para las dos herramientas: una **frontal**, una **3/4** y una del **interior**. Se las pide Hafsa a Victor.

**Fondo**: el del cliente (D2). Si aún no lo hay, un gris liso.

**rembg**, en el ordenador de Victor:
1. Apuntar qué versión y qué modelo se usa: rembg trae varios y el resultado cambia de uno a otro.
2. La primera vez descarga el modelo y tarda más: esa vuelta no cuenta para los segundos.
3. Cronometrar cada foto. En PowerShell: `Measure-Command { rembg i entrada.jpg salida.png }`.
4. Apuntar el ordenador (procesador, si tiene tarjeta gráfica): el tiempo en el servidor puede ser otro.

**Photoroom**, en su web:
1. Subir cada foto a mano y contar los segundos desde que se suelta hasta que sale el recorte.
2. Descargar el resultado tal cual sale.
3. Mirar en su web el precio de la **API** (no el de la app) para unas **240 fotos al mes** (unos 12 coches × 20 fotos) y apuntar el plan más barato que llegue, con la fecha en que se miró.
4. Si la descarga gratis sale con marca de agua o en baja resolución, apuntarlo.

**Para mirar cada recorte**, ampliar al 100 % y fijarse en:
- ¿Se ha comido algún trozo del coche? Retrovisores, antena, ruedas, limpiaparabrisas.
- ¿Quedan restos del fondo? Entre los radios de las llantas y detrás de los cristales.

## Las 6 pruebas

| # | Foto | Herramienta | ¿Se come algún trozo del coche? | ¿Restos del fondo en radios o cristales? | Segundos | € por foto (240 al mes) | Imagen |
|---|---|---|---|---|---|---|---|
| 1 | Frontal | rembg | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | 0 € (gratis, en nuestro servidor) | — |
| 2 | Frontal | Photoroom | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin mirar) | — |
| 3 | 3/4 | rembg | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | 0 € (gratis, en nuestro servidor) | — |
| 4 | 3/4 | Photoroom | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin mirar) | — |
| 5 | Interior | rembg | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | 0 € (gratis, en nuestro servidor) | — |
| 6 | Interior | Photoroom | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin probar) | no lo sé (sin mirar) | — |

Datos de la prueba, para que se pueda repetir:

| | |
|---|---|
| Fecha | no lo sé (sin probar) |
| Fondo usado | no lo sé: el del cliente (D2) o, si no llega, gris liso |
| rembg: versión y modelo | no lo sé (sin probar) |
| rembg: ordenador | no lo sé (sin probar) |
| Photoroom: plan y precio mirados | no lo sé (sin mirar) |

La foto del interior se prueba igual, aunque quitar el fondo de un interior tiene poco sentido. Lo que salga sirve para decidir si el interior pasa por el photocall o se publica tal cual.

## Aparte: el coche sobre blanco de estudio

Propuesta para Diego, **fuera de la tabla**: con los mismos recortes, el coche sobre un fondo blanco liso, como en un estudio. No es el photocall del cliente (D2 pide su fondo), solo una opción más para enseñarle. Componer sobre blanco no cambia qué herramienta recorta mejor.

| Foto | Con el recorte de | Imagen |
|---|---|---|
| Frontal | no lo sé (sin probar) | — |
| 3/4 | no lo sé (sin probar) | — |

## Recomendación

Tres líneas, cuando estén las 6 pruebas:

1. no lo sé (sin probar)
2. no lo sé (sin probar)
3. no lo sé (sin probar)

## Imágenes

En [`photocall/`](photocall/). Los nombres están en su [README](photocall/README.md).
