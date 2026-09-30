# T01 · Poner el proyecto en marcha

**Quién:** los tres, cada uno en su ordenador.
**Para cuándo:** jueves 1-oct.
**Qué aprendes:** a instalar lo necesario, bajarte el proyecto y arrancarlo.

## Objetivo

Ver en tu navegador el tablero de coches con las columnas de estados.

## Pasos

1. **Instala lo necesario** (si ya lo tienes, sáltatelo):
   - Git: https://git-scm.com
   - Node.js, la versión que pone **LTS**: https://nodejs.org
   - VS Code: https://code.visualstudio.com
2. **Comprueba** que se han instalado. Abre una terminal y escribe estos dos comandos. Cada uno tiene que devolver un número de versión:
   ```bash
   git --version
   node --version     # tiene que ser 18 o más
   ```
3. **Acepta la invitación** de GitHub que te ha mandado Victor. Llega por correo.
4. **Bájate el proyecto:**
   ```bash
   git clone git@github.com:ItsVaguayo/ProService-Rubi.git
   cd ProService-Rubi
   ```
   Si da un error de `Permission denied (publickey)`, te falta la clave SSH. Pregúntale a Claude «cómo configuro una clave SSH para GitHub» y sigue sus pasos.
5. **Pásate a tu rama:**
   ```bash
   git checkout feat/panel-fotos      # Hafsa
   git checkout feat/web-portales     # David
   git checkout feat/core-api         # Victor
   ```
6. **Instala las dependencias** (tarda un par de minutos la primera vez):
   ```bash
   npm install
   ```
7. **Arranca:**
   ```bash
   npm run dev
   ```
   Deja esa terminal abierta. Para pararlo, `Ctrl + C`.
8. **Abre** http://localhost:5173 en el navegador.
9. **Abre la carpeta en VS Code** (`code .`) y da una vuelta por `docs/plan.md` y por tu parte del plan. No hace falta entenderlo todo.

## Cómo sé que está bien

- Ves la palabra «Stock» y diez columnas: «Pendiente de recoger», «En transporte»… Estarán vacías, y es normal: tu base de datos está vacía.
- Avisas en el canal del equipo: «T01 hecha».

## Si algo falla

Copia el error entero y pregúntale a Claude. Los errores más típicos son la versión de Node, la clave SSH y que el puerto 5173 ya esté ocupado.
