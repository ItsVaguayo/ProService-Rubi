// Carga lo de Pymecar desde las plantillas CSV de docs/migracion/ (proveedores.csv, clientes.csv, vehiculos.csv). Ver docs/migracion.md.
//   node scripts/migrar-pymecar.js --dir ./data/pymecar             → ensayo: lo comprueba todo y no guarda nada
//   node scripts/migrar-pymecar.js --dir ./data/pymecar --aplicar   → guarda, después de copiar la base
// La base es DB_PATH (o ./data/proservice.db). Falta un fichero: se carga lo demás.
// Con un solo error no se guarda nada: se corrige la plantilla y se repite. Lo que ya estaba no se duplica.
import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { abrirDb } from '../src/db.js';
import { leerCsv } from '../src/migracion/leer-csv.js';
import { importar } from '../src/migracion/importar.js';

const { values } = parseArgs({ options: { dir: { type: 'string' }, aplicar: { type: 'boolean', default: false } } });
if (!values.dir) {
  console.error('Falta --dir con la carpeta de las plantillas (proveedores.csv, clientes.csv, vehiculos.csv)');
  process.exit(1);
}
const dir = resolve(values.dir);
const leer = (nombre) => (existsSync(join(dir, nombre)) ? leerCsv(readFileSync(join(dir, nombre), 'utf8')) : []);
const datos = { proveedores: leer('proveedores.csv'), clientes: leer('clientes.csv'), vehiculos: leer('vehiculos.csv') };

const rutaDb = resolve(process.env.DB_PATH || './data/proservice.db');
const db = abrirDb(rutaDb);
if (values.aplicar) {
  // Antes de tocar nada, una copia de la base tal como está: si algo sale mal, se vuelve a ella
  const copia = `${rutaDb}.antes-de-migrar-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  await db.backup(copia);
  console.log(`Copia de la base antes de migrar: ${copia}`);
}

const informe = importar(db, datos, { ensayo: !values.aplicar });
db.close();

console.log(`\n${informe.ensayo ? 'ENSAYO (no se ha guardado nada)' : informe.aplicado ? 'GUARDADO' : 'NO SE HA GUARDADO NADA: hay errores'} · ${rutaDb}\n`);
for (const tabla of ['proveedores', 'clientes', 'vehiculos']) {
  const t = informe[tabla];
  console.log(`${tabla.padEnd(12)} leídos ${t.leidos} · nuevos ${t.nuevos} · ya estaban ${t.ya_estaban}${tabla === 'vehiculos' ? ` · vendidos (histórico) ${t.vendidos}` : ''}`);
}
for (const e of informe.errores) console.log(`ERROR ${e.fichero}, fila ${e.fila}: ${e.errores.join('. ')}`);
for (const a of informe.avisos) console.log(`aviso ${a.fichero}, fila ${a.fila}: ${a.aviso}`);
const salida = join(dir, `informe-${informe.ensayo ? 'ensayo' : 'carga'}.json`);
writeFileSync(salida, JSON.stringify(informe, null, 2));
console.log(`\nInforme completo en ${salida}`);
process.exit(informe.errores.length ? 2 : 0);
