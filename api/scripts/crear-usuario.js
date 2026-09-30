// Crea un usuario del panel. La contraseña se pide por teclado para que no quede en el historial.
//   npm run usuario --workspace api -- --email jaume@proservicerubi.com --nombre Jaume --rol gerencia
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { abrirDb } from '../src/db.js';
import { crearUsuario, ROLES } from '../src/modules/auth/sesiones.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, nombre: { type: 'string' }, rol: { type: 'string' } },
});

if (!values.email || !values.nombre || !ROLES.includes(values.rol)) {
  console.error(`Uso: --email <correo> --nombre <nombre> --rol <${ROLES.join('|')}>`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const contrasena = await rl.question('Contraseña (mínimo 10 caracteres): ');
rl.close();

const db = abrirDb();
try {
  const id = crearUsuario(db, { ...values, contrasena });
  console.log(`Usuario ${values.email} creado con id ${id} y rol ${values.rol}`);
} catch (e) {
  console.error(e.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Ya existe un usuario con ese correo' : e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
