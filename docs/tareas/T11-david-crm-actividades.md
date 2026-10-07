# T11 · API de actividades del CRM

**Quién:** David.
**Para cuándo:** en cuanto acabes lo que tengas abierto.
**Qué aprendes:** a hacer una parte de la API de principio a fin: tabla, rutas, permisos y tests. Es la primera ficha de JavaScript: ve despacio y pregunta a Claude cada vez que una línea no la entiendas.

## Objetivo

Que el panel pueda apuntar y consultar lo que se hace con cada cliente: llamadas, visitas, WhatsApp, correos, pruebas, tareas y notas, con su fecha, su responsable y su resultado. Con esto, la página `crm.html` de Hafsa (T07) enseña «lo de hoy» y la historia de cada cliente.

Los avisos y el correo diario no son tuyos: los monta Victor encima de tu tabla.

## Antes de empezar: lee esto (una tarde)

1. `api/src/modules/terceros/routes.js`: rutas de clientes. Tu módulo se parece mucho: lista con filtros, alta y edición, con `registrar()` para dejar rastro.
2. `api/src/modules/terceros/campos.js`: cómo se limpia lo que llega antes de guardarlo. **Nunca** se mete en el SQL un nombre de columna que venga de la petición.
3. `api/test/terceros.test.js` y `api/test/ayuda.js`: cómo se prueba la API con `pide()`.
4. `api/migraciones/0008_clientes_proveedores.sql`: cómo se crea una tabla.

## Ficheros

- Crear `api/migraciones/NNNN_actividades.sql`. **El número te lo da Victor** cuando vayas a abrir el PR: las migraciones se aplican en orden y una con el número cambiado de sitio deja otras sin aplicar.
- Crear `api/src/modules/crm/campos.js` y `api/src/modules/crm/routes.js` (el módulo `crm` es tuyo).
- Crear `api/test/actividades.test.js`.
- Una línea en `api/src/app.js` para montar las rutas (Victor la revisa).
- Una sección en `docs/api.md`.

## Pasos

### 1. La tabla

```sql
CREATE TABLE actividades (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('llamada','visita','whatsapp','email','prueba','tarea','nota')),
  cliente_id      INTEGER REFERENCES clientes(id),
  contacto_id     INTEGER REFERENCES contactos(id),
  vehiculo_id     INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  programada_para TEXT,             -- 'AAAA-MM-DD HH:MM'; vacía en una nota
  hecha_en        TEXT,             -- vacía = pendiente
  resultado       TEXT,
  responsable_id  INTEGER NOT NULL REFERENCES usuarios(id),
  creado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX actividades_pendientes ON actividades (responsable_id, hecha_en, programada_para);

ALTER TABLE clientes ADD COLUMN estado_comercial TEXT NOT NULL DEFAULT 'nuevo'
  CHECK (estado_comercial IN ('nuevo','interesado','me_lo_pienso','negociando','ganado','perdido'));
```

Pide a Victor que añada `estado_comercial` a la lista de campos de clientes (`terceros/campos.js`): ese módulo es suyo.

### 2. Las rutas (`/api/actividades`, los dos roles)

| Ruta | Qué hace |
|---|---|
| `GET /actividades` | Filtros: `?cliente=`, `?vehiculo=`, `?responsable=yo` o un id, `?pendientes=1` (sin `hecha_en`), `?dia=AAAA-MM-DD` (las programadas ese día). Ordenadas por `programada_para`. Cada una con el nombre del cliente y del responsable (un `LEFT JOIN`) |
| `POST /actividades` | Alta. Obligatorios: `tipo`, `descripcion` y al menos uno de `cliente_id` o `contacto_id`. Si no llega `responsable_id`, el responsable es quien la crea. `creado_por` sale siempre de la sesión (`req.usuario.id`), nunca del cuerpo. 201 |
| `PUT /actividades/:id` | Cambiar descripción, fecha, responsable o tipo. Una actividad ya hecha no se edita: 409 |
| `PATCH /actividades/:id/hecha` | `{ resultado }` la marca hecha ahora. `{ hecha: false }` la devuelve a pendiente |

Reglas:
- `programada_para` tiene que ser `AAAA-MM-DD HH:MM` (usa una expresión regular, como `FECHA` en `vehiculos/campos.js`).
- Un `cliente_id` o un `responsable_id` que no existe: 400 (la base lo rechaza sola si las tablas tienen `REFERENCES` y `app.js` ya traduce ese error).
- Cada alta, edición y «hecha» pasa por `registrar()` dentro de una `db.transaction`.
- Aquí no hay dinero: los dos roles ven y apuntan todo.

### 3. Los tests

Como mínimo:
- El comercial crea una llamada para mañana y sale en `?responsable=yo&pendientes=1`.
- Sin cliente ni contacto: 400. Con un tipo que no existe: 400. Con la fecha mal escrita: 400.
- Marcar hecha la quita de pendientes; editar una hecha da 409.
- `?dia=` solo trae las de ese día.
- Sin sesión: 401.

Lánzalos con `npm test`. Hasta que estén todos en verde, no se abre el PR.

### 4. `docs/api.md`

Una sección «Actividades del CRM» con la misma tabla de rutas de arriba, ya con lo que hayas hecho de verdad.

## Cómo sé que está bien

- `npm test` en verde, los tuyos y los de los demás.
- Ningún nombre de columna sale de `req.body` o `req.query`.
- PR hacia `develop` con «T11» en la descripción. Victor lo revisa.
