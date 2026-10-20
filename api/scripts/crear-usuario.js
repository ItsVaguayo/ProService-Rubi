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

// En una terminal no se ve lo que se escribe (como sudo) y se pide dos veces: el día del alta la escribe
// Jaume delante de alguien. Por tubería (echo clave | npm run usuario ...) se lee una línea, como antes.
function preguntarOculta(pregunta) {
  return new Promise((resolver, rechazar) => {
    const entrada = process.stdin;
    process.stdout.write(pregunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');
    let texto = '';
    const alTeclear = (trozo) => {
      for (const c of trozo) {
        if (c === '\r' || c === '\n') {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off('data', alTeclear);
          process.stdout.write('\n');
          return resolver(texto);
        }
        if (c === '\u0003') { // Ctrl+C
          entrada.setRawMode(false);
          process.stdout.write('\n');
          return rechazar(new Error('Cancelado'));
        }
        if (c === '\u007f' || c === '\b') texto = texto.slice(0, -1);
        else if (c >= ' ') texto += c;
      }
    };
    entrada.on('data', alTeclear);
  });
}

let contrasena;
if (process.stdin.isTTY) {
  contrasena = await preguntarOculta('Contraseña (mínimo 8 caracteres, no se ve al escribir): ');
  if (contrasena !== await preguntarOculta('Repítela: ')) {
    console.error('Las dos contraseñas no coinciden. No se ha creado nada.');
    process.exit(1);
  }
} else {
  const rl = createInterface({ input: process.stdin });
  contrasena = (await rl[Symbol.asyncIterator]().next()).value ?? '';
  rl.close();
}

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
