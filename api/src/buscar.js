// ?q= de los listados (contactos, actividades, gastos y citas). Cada palabra tiene que salir en alguna de
// las columnas, sin distinguir mayúsculas: «golf marta» encuentra la prueba de Marta con el Golf.
// Los teléfonos se comparan sin espacios, guiones, puntos ni paréntesis, como en clientes.
// Devuelve null sin búsqueda, o { sql, valores } para añadir a los filtros; { error } si no vale.
export const Q_MAX = 100;

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
    const ors = columnas.map((c) => `${c} LIKE ? ESCAPE '\\'`);
    valores.push(...columnas.map(() => `%${literal(palabra)}%`));
    if (comoTelefono) {
      ors.push(...telefonos.map((c) => `${sinSignos(c)} LIKE ? ESCAPE '\\'`));
      valores.push(...telefonos.map(() => `%${literal(comoTelefono)}%`));
    }
    partes.push(`(${ors.join(' OR ')})`);
  }
  return { sql: partes.join(' AND '), valores };
}
