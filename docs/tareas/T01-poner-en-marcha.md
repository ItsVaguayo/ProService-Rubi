# T01 · Poner el proyecto en marcha

**Quién:** los tres, cada uno en su ordenador.
**Para cuándo:** jueves 1-oct.
**Qué aprendes:** a instalar lo necesario, bajarte el proyecto y arrancarlo.

## Objetivo

Ver en tu navegador las maquetas del panel y de la web.

## Pasos

1. **Instala lo necesario** (si ya lo tienes, sáltatelo):
   - Git: https://git-scm.com
   - Node.js **22 o más**, la versión que pone **LTS**: https://nodejs.org
   - VS Code: https://code.visualstudio.com
2. **Comprueba** que se han instalado. Abre una terminal y escribe estos dos comandos. Cada uno tiene que devolver un número de versión:
   ```bash
   git --version
   node --version     # tiene que ser 22.9 o más
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
7. **Arranca las maquetas:**
   ```bash
   npm run dev:front
   ```
   Deja esa terminal abierta. Para pararlo, `Ctrl + C`.
8. Se abre solo http://localhost:5173. Si no, ábrelo tú en el navegador.
9. **Abre la carpeta en VS Code** (`code .`) y lee `frontend/README.md`. Explica cómo están hechas las maquetas.

## Cómo sé que está bien

- Ves el índice «Maquetas del frontend» y puedes entrar en el tablero, la ficha de un coche y la web pública.
- Avisas en el canal del equipo: «T01 hecha».

## Si algo falla

Copia el error entero y pregúntale a Claude. Los errores más típicos son la versión de Node (con la 18 o la 20 no arranca la API), la clave SSH y que el puerto 5173 ya esté ocupado.
