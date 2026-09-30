# Cómo trabajamos con las fichas

Cada tarea es una ficha en esta carpeta. Una ficha dice qué hay que conseguir, qué ficheros tocar, los pasos y cómo saber que está bien. Está pensada para hacerse en una o dos tardes.

Las piezas difíciles (login, seguridad, servidor, migración) las monta Claude. Las fichas son lo vuestro, y cada una os enseña algo que vais a necesitar en la siguiente.

## Las fichas de ahora

| Ficha | Quién | Para cuándo |
|---|---|---|
| [T01 · Poner el proyecto en marcha](T01-poner-en-marcha.md) | Los tres | Jueves 1-oct |
| [T02 · Coordinación de la semana 0](T02-victor-coordinacion.md) | Victor | Viernes 2-oct |
| [T03 · Maqueta de la pantalla de alta](T03-hafsa-maqueta-alta.md) | Hafsa | Martes 6-oct |
| [T04 · Investigar los portales](T04-david-portales.md) | David | Martes 6-oct |
| [T05 · Maqueta de la ficha pública](T05-david-maqueta-ficha.md) | David | Viernes 9-oct |
| [T06 · Lista de extras](T06-hafsa-extras.md) | Hafsa | Viernes 9-oct |

Cuando acabéis una, se marca aquí con ✅ y Victor os da la siguiente.

## Cuando os atasquéis

1. Media hora intentándolo por vuestra cuenta está bien. Más de una hora sin avanzar, no.
2. Preguntad a Claude en VS Code o en la terminal. Decidle en qué ficha estáis, qué paso, qué esperabais que pasara y qué ha pasado. Si hay un error rojo, copiadlo entero.
3. Si sigue sin salir, decidlo en el canal del equipo. Nadie se queda un día entero atascado.

## Git en cinco comandos

Siempre en vuestra rama. Nunca en `main`.

```bash
git branch --show-current     # 1. ¿En qué rama estoy? Tiene que salir la vuestra
git pull                      # 2. Al empezar: traer lo último
# ...trabajáis...
git add .                     # 3. Preparar los cambios
git commit -m "T03: maqueta de alta, bloque identificación"   # 4. Guardarlos con un mensaje que diga qué habéis hecho
git push                      # 5. Subirlos a GitHub
```

- Haced commit cada vez que algo funcione, aunque sea poco. Mejor diez commits pequeños que uno enorme.
- Si `git pull` o `git push` dan un error que no entendéis, **parad y preguntad**. No probéis comandos al azar: algunos borran trabajo.
- Cuando la ficha esté acabada: en GitHub, botón **Compare & pull request**, de vuestra rama hacia `develop`. En la descripción, el número de la ficha. Victor lo revisa.
