# T04 · Investigar cómo se publica en cada portal

**Quién:** David.
**Para cuándo:** martes 6-oct, por la mañana.
**Qué aprendes:** a investigar una integración antes de programarla. Es lo que decide si la parte más valiosa del proyecto se puede hacer o no.

## Objetivo

Una tabla que diga, para Coches.net, Milanuncios y Wallapop, si un profesional puede subir sus coches de forma automática y cómo. Con esa tabla, Diego decide qué se promete al cliente.

## Ficheros

- Crear `docs/portales.md`

## Pasos

1. Para cada portal, busca en su web la zona de **profesionales** o **concesionarios** (suele estar en el pie de página: «Profesionales», «Vende tu stock», «Pro»).
2. Averigua y apunta:
   - ¿Tiene carga automática para profesionales? Se llama de muchas formas: XML, feed, FTP, API, importador, «integración con tu DMS» o «programas de gestión compatibles».
   - Si la tiene, ¿qué hay que hacer para usarla? ¿Se pide a un comercial? ¿Hay documentación?
   - ¿Cuesta algo aparte de lo que ya pagan?
   - ¿Solo funciona a través de algún programa de gestión (como Pymecar u otros)? Apunta cuáles.
   - ¿Cómo se retira un coche vendido: automático o a mano?
3. Si la web no lo aclara, **no te lo inventes**. Apunta la pregunta y el teléfono o el correo del soporte de profesionales. Diego o Victor llamarán.
4. Coches.net y Milanuncios son de la misma empresa (Adevinta). Mira si comparten el sistema de carga.
5. Rellena la tabla y, debajo, tres líneas con tu recomendación.

## Plantilla de `docs/portales.md`

```markdown
# Portales: cómo publicar de forma automática

| | Coches.net | Milanuncios | Wallapop |
|---|---|---|---|
| ¿Carga automática para profesionales? | | | |
| Cómo (XML, API, a través de un programa…) | | | |
| Qué hay que pedir y a quién | | | |
| Coste aparte | | | |
| Retirada del coche vendido | | | |
| Fuente (enlace o persona con la que hablé) | | | |
| Dudas sin resolver | | | |

## Recomendación

...
```

## Cómo sé que está bien

- Cada casilla tiene un dato con su fuente, o pone «no lo sé» y la pregunta pendiente.
- Commit, push y PR hacia `develop`. Avisa a Victor, que añade su recomendación y se lo pasa a Diego ese mismo día.
