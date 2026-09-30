# T05 · Maqueta de la ficha pública de un coche

**Quién:** David.
**Para cuándo:** viernes 9-oct.
**Qué aprendes:** diseño de página pensado primero para el móvil, que es por donde entra casi todo el que busca coche.

## Objetivo

La página que verá un cliente en proservicerubi.com cuando pulse un coche. **Solo HTML y CSS, con datos inventados.** Después la convertimos en la plantilla del plugin de WordPress.

## Ficheros

- Crear `wp-plugin/proservice-stock/maquetas/ficha.html`
- Crear `wp-plugin/proservice-stock/maquetas/ficha.css`

## Pasos

1. **Mira antes la web actual** (www.proservicerubi.com) y copia sus colores y su tipo de letra, para que la ficha no desentone. Pregúntale a Claude cómo sacar los colores de una web con F12 si no sabes.
2. Las partes de la ficha, en este orden:
   1. **Galería de fotos:** una grande y miniaturas debajo. Pon 4 o 5 fotos de coches de https://www.pexels.com (gratis).
   2. **Título:** marca, modelo y versión. Debajo, año, kilómetros, combustible y cambio.
   3. **Precio**, bien grande. Debajo, «o desde X €/mes» (la cuota).
   4. Una **etiqueta «Reservado»** encima de la foto. Haz dos versiones de la página, una con la etiqueta y otra sin ella, o déjala en el HTML y escóndela con una clase.
   5. **Botones:** WhatsApp, «Te llamamos», «Pedir prueba», «Calcular cuota» y «Compartir». En el móvil, el de WhatsApp fijo abajo en la pantalla.
   6. **Datos técnicos** en una tabla: potencia, cilindrada, tracción, etiqueta DGT, emisiones, carrocería, puertas, plazas, color, tapicería, llantas y garantía.
   7. **Equipamiento:** lista de extras con un icono o un ✓.
   8. **Vídeo:** un hueco para un vídeo de YouTube. Busca cómo se inserta un `iframe` de YouTube.
   9. **Formulario de contacto:** nombre, teléfono, mensaje y una casilla «He leído la política de privacidad» obligatoria.
3. **Diseña primero para el móvil** (360 px de ancho) y después haz que en PC la galería y los datos vayan en dos columnas.
4. **Nunca aparece:** precio de compra, margen, bastidor ni proveedor.

## Cómo lo pruebo

- Abre el fichero en el navegador y con F12 → icono del móvil.
- Pásale la captura del móvil a alguien que no sea del equipo y pregúntale qué haría para contactar. Si duda, el botón no se ve lo suficiente.

## Cómo sé que está bien

- Están las 9 partes y se ve bien en móvil y en PC.
- Commit, push y PR hacia `develop` con capturas de las dos versiones.
