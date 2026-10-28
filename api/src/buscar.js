// ?q= de los listados (contactos, actividades, gastos y citas). Cada palabra tiene que salir en alguna de
// las columnas, sin distinguir mayúsculas ni tildes: «golf marta» encuentra la prueba de Marta con el Golf,
// y «garcia», a García.
// Los teléfonos se comparan sin espacios, guiones, puntos ni paréntesis, como en clientes.
// Devuelve null sin búsqueda, o { sql, valores } para añadir a los filtros; { error } si no vale.
export const Q_MAX = 100;

// «García Núñez» → «garcia nunez». La base la tiene como sin_acentos() (db.js): el LIKE de SQLite solo
// ignora las mayúsculas de la A a la Z, no las de «Á» ni las tildes.
export const sinAcentos = (texto) => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const sinSignos = (columna) => `replace(replace(replace(replace(replace(${columna}, ' ', ''), '-', ''), '.', ''), '(', ''), ')', '')`;
// % y _ son comodines de LIKE: lo que escribe la persona se busca tal cual
const literal = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

export function filtroBusqueda(q, columnas, telefonos = []) {
  if (q === undefined) return null;
  if (typeof q !== 'string') return { error: 'q tiene que ser un texto' };
  const texto = q.trim();
  if (!texto) return null;
  if (texto.length > Q_MAX) return { error: `q no puede pasar de ${Q_MAX} caracteres` };
  const partes = [];
  const valores = [];
  for (const palabra of texto.split(/\s+/)) {
    const comoTelefono = palabra.replace(/[\s().-]/g, '');
    const ors = columnas.map((c) => `sin_acentos(${c}) LIKE ? ESCAPE '\\'`);
    valores.push(...columnas.map(() => `%${literal(sinAcentos(palabra))}%`));
    if (comoTelefono) {
      ors.push(...telefonos.map((c) => `${sinSignos(c)} LIKE ? ESCAPE '\\'`));
      valores.push(...telefonos.map(() => `%${literal(comoTelefono)}%`));
    }
    partes.push(`(${ors.join(' OR ')})`);
  }
  return { sql: partes.join(' AND '), valores };
}
