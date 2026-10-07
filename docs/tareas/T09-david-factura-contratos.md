# T09 · Factura y contratos imprimibles

**Quién:** David.
**Para cuándo:** en cuanto acabes lo que tengas abierto.
**Qué aprendes:** a maquetar para papel. Una factura o un contrato que se corta a mitad de hoja no vale.

## Objetivo

Seis documentos en HTML que se imprimen en A4 (o se guardan como PDF desde el navegador) con datos de ejemplo. La API los rellenará después con los datos de verdad.

| Fichero | Qué es |
|---|---|
| `factura.html` | Factura de venta de un coche |
| `contrato-reserva.html` | El cliente deja una señal para reservar un coche |
| `contrato-compraventa.html` | Le vendemos un coche a un cliente |
| `contrato-compra.html` | Le compramos un coche a un profesional |
| `contrato-compra-particular.html` | Le compramos un coche a un particular |
| `contrato-deposito.html` | Un dueño nos deja su coche para venderlo (cesión en depósito) |

## Ficheros

- Crear los seis en `frontend/panel/documentos/`.
- Un solo CSS para todos: `frontend/css/documentos.css`.

## Pasos

1. Empieza por la factura. Arriba: logo, nombre de la empresa, CIF y dirección (pon `B00000000` y la dirección de la web hasta que Victor tenga la real). Debajo: número de factura, fecha, datos del cliente y del coche (marca, modelo, matrícula, bastidor, km). Después las líneas, los totales y, abajo a la derecha, un cuadrado de 3 × 3 cm para el **código QR** de Verifactu con el texto «Factura verificable en la sede electrónica de la AEAT».
2. Haz **dos versiones** de la zona de totales, separadas por un comentario:
   - **REBU** (la mayoría de sus coches): un solo total, **sin** IVA desglosado, y la frase «Régimen especial de los bienes usados».
   - **IVA general**: base imponible, IVA 21 % y total.
3. En el CSS, para que salga bien en papel:
   ```css
   @page { size: A4; margin: 15mm; }
   @media print { .no-imprimir { display: none; } }
   ```
   Y `break-inside: avoid` en los bloques que no se pueden partir (los totales, las firmas).
4. Los contratos: misma cabecera que la factura, título, las dos partes (nosotros y el cliente o el dueño), los datos del coche, el precio y la forma de pago, las cláusulas y, al final, dos cajas para firmar con nombre, DNI y fecha. **El texto de las cláusulas te lo pasa Victor** en `docs/contratos/`: tú copias el texto, no lo redactas. Hasta que lo tengas, pon párrafos de relleno.
5. Arriba de cada contrato, una banda amarilla que diga «Borrador pendiente de revisión por abogado», con la clase `no-imprimir` **no**: tiene que salir también en papel hasta que Diego diga que se quita.
6. Prueba cada uno con Ctrl+P → «Guardar como PDF». Mira el PDF entero.

## Cómo sé que está bien

- En el PDF no se parte ninguna tabla, ni los totales, ni las firmas.
- La factura cabe en una hoja con 3 líneas.
- Ninguna página tiene datos de una persona real.
- PR hacia `develop` con «T09».
