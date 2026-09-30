# T03 · Maqueta de la pantalla de alta de un coche

**Quién:** Hafsa.
**Para cuándo:** martes 6-oct.
**Qué aprendes:** formularios en HTML y diseño que funciona en PC y en móvil.

## Objetivo

Una página en HTML y CSS con el formulario para dar de alta un coche. **Solo diseño: no guarda nada todavía.** Cuando esté aprobada, Claude la conecta a la API y tú aprendes cómo se hace mirando el cambio.

Es la pantalla que más va a usar Jaume. Si es cómoda, la usará. Si es un tostón, volverá a Pymecar.

## Ficheros

- Crear `panel/maquetas/alta-coche.html`
- Crear `panel/maquetas/alta-coche.css`

## Pasos

1. Crea la carpeta `panel/maquetas/` y los dos ficheros.
2. Empieza con este esqueleto:
   ```html
   <!doctype html>
   <html lang="es">
   <head>
     <meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>Alta de coche</title>
     <link rel="stylesheet" href="alta-coche.css">
   </head>
   <body>
     <h1>Nuevo coche</h1>
     <form>
       <fieldset>
         <legend>Identificación</legend>
         <label>Matrícula * <input name="matricula" required></label>
         <!-- sigue aquí -->
       </fieldset>
     </form>
   </body>
   </html>
   ```
3. Haz un `<fieldset>` por bloque, con estos campos. El `name` de cada campo tiene que ser **exactamente** el de la lista, porque luego la API los espera así:

   | Bloque | Campos (`name`) |
   |---|---|
   | Identificación | `matricula`, `bastidor`, `marca`, `modelo`, `version`, `anio`, `fecha_matriculacion`, `kilometros` |
   | Mecánica | `combustible`, `cambio`, `potencia_cv`, `cilindrada`, `traccion`, `emisiones_co2`, `etiqueta_dgt` |
   | Carrocería | `carroceria`, `puertas`, `plazas`, `color_exterior`, `tapiceria`, `llantas` |
   | Documentación | `ultima_revision`, `itv_caducidad`, `danos`, `garantia_meses`, `ubicacion`, `num_llaves` |
   | Propiedad | `propiedad` (propio o depósito) |
   | Dinero | `precio_compra`, `coste_transporte`, `coste_taller`, `coste_preparacion`, `coste_impuestos`, `pvp`, `precio_financiado`, `precio_minimo`, `regimen_iva` |

4. Usa el tipo de campo adecuado. Así Jaume escribe menos y se equivoca menos:
   - Números (`kilometros`, `potencia_cv`, precios…): `<input type="number">`
   - Fechas: `<input type="date">`
   - Opciones fijas: `<select>`
     - `cambio`: manual, automático
     - `etiqueta_dgt`: 0, ECO, C, B, sin etiqueta
     - `ubicacion`: patio del taller, parking
     - `propiedad`: propio, depósito
     - `regimen_iva`: REBU, deducible
   - Texto largo (`danos`): `<textarea>`
5. Marca los obligatorios con un `*` en la etiqueta. De momento son matrícula, marca, modelo y precio de compra (el resto se exige al publicar, no al dar de alta).
6. El bloque **Dinero** tiene que verse distinto, por ejemplo con fondo gris y el título «Solo gerencia», porque el comercial no lo verá.
7. Estilos en `alta-coche.css`. Usa los colores del panel que hay en `panel/src/estilos.css`: rojo `#b03035`, fondo `#f6f6f7`, bordes `#e2e2e5`.
8. **En PC**, los campos de dos en dos o de tres en tres por fila. **En móvil**, uno debajo de otro. Pregúntale a Claude por «CSS grid con media query» si no sabes cómo.
9. Un botón «Guardar coche» al final. No hace nada todavía.

## Cómo lo pruebo

- Abre el fichero en el navegador: doble clic en `alta-coche.html`, o en VS Code con clic derecho → «Open with Live Server» si tienes esa extensión.
- Pulsa F12 → icono del móvil, y comprueba que se ve bien en pantalla de móvil.
- Pulsa «Guardar» con la matrícula vacía: el navegador tiene que quejarse.

## Cómo sé que está bien

- Están todos los campos de la tabla, con su `name` exacto.
- Se ve bien en PC y en móvil.
- Commit, push y PR hacia `develop` con el título «T03 maqueta de alta». Haz una captura de pantalla y ponla en el PR.
