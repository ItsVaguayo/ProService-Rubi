# Frontend · maquetas del panel y de la web

Todo es **HTML y CSS**, sin JavaScript. Los datos son de ejemplo y los botones todavía no guardan nada: primero cerramos cómo se ve y cómo se usa, y después se conecta a la API.

## Verlo en tu ordenador

```bash
npm install          # solo la primera vez
npm run dev:front
```

Se abre http://localhost:5173 con el índice de todas las páginas. Al guardar un fichero, el navegador se recarga solo.

Sin la terminal también vale: doble clic en `frontend/index.html`.

## Qué hay

```
frontend/
├── index.html            Índice de todas las maquetas
├── css/
│   ├── base.css          Colores, letras y piezas comunes (matrícula, botones, estados, campos, tablas)
│   ├── panel.css         Solo el panel interno
│   └── web.css           Solo la web pública
├── img/coche.svg         Foto provisional
├── panel/                Lo que usan Jaume y el comercial
│   ├── login.html
│   ├── index.html        Tablero con los coches por estado y los avisos
│   ├── coches.html       Listado con filtros
│   ├── coche.html        Ficha: recorrido, datos, fotos, dinero, reserva, portales, historial
│   ├── coche-nuevo.html  Alta de un coche
│   └── contactos.html    Lo que entra por los formularios de la web
└── web/                  Lo que ve el cliente en proservicerubi.com
    ├── index.html        Listado con buscador
    └── coche.html        Ficha pública
```

## Cómo está pensado

- **Colores y medidas, solo en `base.css`**, arriba del todo, en `:root`. Si queréis otro rojo, se cambia en una línea y cambia en todas las páginas. No escribáis colores sueltos (`#d42a2a`) dentro de las reglas: usad la variable (`var(--rojo)`).
- **Las letras.** En el panel, Barlow para el texto y Barlow Condensed para títulos y cifras. Es la letra de las señales de tráfico y de los rótulos de taller. En la web se usa Inter, que es la de su web actual, para no desentonar dentro de su WordPress.
- **La matrícula es el elemento propio.** Jaume reconoce los coches por la matrícula, así que en el panel sale como la placa de verdad. Se usa así: `<span class="matricula">4821 LKM</span>`. En la web pública no sale.
- **Estados por fases.** Los 10 estados se agrupan en 5 colores: llegada, preparación, a la venta, reservado y vendido. Diez colores distintos no se distinguen.
- **Nombres de clase en castellano** y con el formato `bloque__parte--variante`. Por ejemplo, `ficha-mini__coche` es la parte «coche» de la tarjeta pequeña y `boton--secundario` es una variante del botón.
- **El menú del panel se repite** en cada página. Si lo cambiáis, cambiadlo en las seis.
- **Móvil.** Todas las páginas se adaptan. Lo de móvil está al final de cada CSS, dentro de `@media`. Probadlo con F12 → icono del móvil.

## Reglas para no romper nada

1. **No cambiéis los `name` de los campos** de `coche-nuevo.html`, `coche.html` y `login.html`. Son los que espera la API (la lista está en `api/src/modules/vehiculos/campos.js`). Los importes acaban en `_cent` porque la API guarda céntimos, pero en pantalla se escriben euros. Si hace falta un campo nuevo, avisad a Victor.
2. **Nada de dinero fuera del bloque de gerencia.** Compra, costes, margen, precio mínimo, régimen de IVA y los datos del dueño de un coche en depósito solo salen en el bloque oscuro de `coche.html` y de `coche-nuevo.html`, porque el comercial no los recibe. El precio de venta y el financiado sí los ve todo el mundo. En `web/` no aparece nada interno.
3. **Nada de colores ni tamaños sueltos.** Si os falta una variable, añadidla en `base.css`.
4. **Cada campo con su `<label>`** y cada imagen con su `alt`. Así funciona con teclado y con lector de pantalla.

## La ronda de mejoras

Cada uno mejora esta plantilla **en su rama** y después elegimos la mejor versión, o lo mejor de cada una, para conectarla a la API.

**Plazo:** hasta el martes 6-oct a las 14:00. Revisión juntos esa tarde.

**Qué mejorar.** Lo que creáis que Jaume agradecería. Algunas ideas:

- ¿Se entiende el tablero de un vistazo? ¿Se ve qué coche lleva demasiado tiempo parado?
- ¿El alta se puede rellenar rápido? ¿Sobra algo? ¿Está en el orden en que Jaume tiene los datos?
- ¿La ficha pública da ganas de escribir por WhatsApp desde el móvil?
- ¿Cómo se ve en el móvil del comercial?
- ¿Falta alguna pantalla? Por ejemplo, los avisos en su propia página o el detalle de un contacto.

**Cómo presentarlo.** Un PR hacia `develop` con:

- capturas en PC y en móvil de lo que habéis cambiado;
- tres o cuatro líneas: qué cambiasteis y por qué.

**Cómo se elige.** No gana la más bonita. Gana la que mejor aguanta estas pruebas:

1. Alguien que no la conoce da de alta un coche con los datos de la ficha real. ¿Cuánto tarda y dónde duda?
2. En el móvil, desde la ficha pública, ¿cuántos toques hacen falta para escribir por WhatsApp?
3. Mirando el tablero cinco segundos, ¿sabe decir qué coche hay que mover primero?
4. El código: ¿se entiende? ¿Respeta las reglas de arriba?

Si Diego puede, la elige él con Jaume.
