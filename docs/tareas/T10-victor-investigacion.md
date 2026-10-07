# T10 · Investigar Verifactu, Meta y partners de portales, y la hoja del REBU

**Quién:** Victor.
**Para cuándo:** la parte 1 primero: es la que más prisa corre.
**Qué aprendes:** lo mismo que en T04 (portales): averiguar cómo funciona algo antes de programarlo, distinguiendo lo que dice el proveedor de lo que está comprobado.

Mismo formato que `docs/portales.md`: **[oficial]** si lo dice la web del propio servicio, **[tercero]** si lo dice otro. Lo que no esté claro: **no lo sé**, y la pregunta para su soporte. **Ningún precio inventado.**

## Parte 1 · Verifactu → `docs/verifactu.md` (aplazada: Verifactu pasa a octubre de 2028, duda H1)

Verifactu es el sistema de Hacienda para que las facturas no se puedan manipular: cada factura se manda a la AEAT al emitirla y lleva un QR. La plataforma va a facturar, así que tiene que cumplirlo. No lo vamos a construir desde cero: vamos a usar un servicio que ya lo hace.

1. Busca servicios que ofrezcan **API de Verifactu** para programas propios (por ejemplo Verifacti, y otros que encuentres). Mínimo tres.
2. Para cada uno apunta:
   - Precio (por NIF, por factura, al mes).
   - ¿Tienen documentación pública de la API? Enlace.
   - ¿Tienen entorno de pruebas gratis?
   - ¿Quién firma la **declaración responsable** del programa: ellos o nosotros?
   - ¿Hacen ellos el encadenado de las facturas (la huella o hash) y el QR, o solo lo mandan a la AEAT?
   - ¿Necesita el certificado digital de la empresa del cliente?
3. Busca en la web de la AEAT desde cuándo es obligatorio y para quién (sociedades y autónomos tienen fechas distintas). Apunta el enlace oficial.
4. Tres líneas con tu recomendación.

## Parte 2 · Publicar en Instagram y Facebook → `docs/rrss.md`

La plataforma quiere publicar cada coche en las redes de Pro Service. Averigua, en la documentación de Meta para desarrolladores:

1. ¿Qué cuenta hace falta? (Instagram profesional enlazada a una página de Facebook, app de Meta, Business Manager…)
2. ¿Qué permisos hay que pedir para publicar fotos, carruseles y reels? ¿Hay que pasar una revisión de Meta? ¿Cuánto tarda?
3. ¿Se puede publicar un carrusel de 10 fotos y un reel por API?
4. ¿Se puede borrar o editar un post por API cuando el coche se vende?
5. Límites: cuántas publicaciones al día por API.

## Parte 3 · Partners de portales → añadir a `docs/portales.md`

En T04 viste que Coches.net y Wallapop solo cargan a través de un programa o partner. Busca cuáles aceptan **recibir un fichero (feed XML) de un programa propio** y publicarlo en los tres portales. Precio y qué formato de fichero piden.

## Parte 4 · Casos del margen → `docs/datos/margenes.csv`

Casos calculados a mano para probar el cálculo del margen (y para que David compruebe los incentivos de T12). Con Excel o LibreOffice, haz 6 coches de ejemplo:

- 2 en **REBU** (compramos a un particular). El IVA solo va sobre el margen: IVA = (precio de venta − precio de compra) × 21 ÷ 121. Uno con margen negativo (vendemos por debajo de lo que costó): ahí el IVA es 0.
- 2 en **IVA general** (compramos a un profesional con factura con IVA). Base de venta = precio ÷ 1,21; margen = base de venta − base de compra − base de los gastos.
- 2 en **depósito**: nuestra comisión = precio de venta − lo que se le paga al dueño; IVA del 21 % sobre la comisión.

Columnas: `caso,regimen,pvp,compra,gastos_base,iva_a_pagar,margen_neto`. Céntimos con dos decimales. Estas fórmulas son las que pondremos por defecto: la gestoría del cliente las confirmará.

## Cómo sé que está bien

- Cada dato tiene su enlace y su etiqueta [oficial] o [tercero].
- En el CSV, cada fila la puedes recalcular con la calculadora y sale lo mismo.
- PR hacia `develop` con «T10».
