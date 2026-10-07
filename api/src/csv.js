// CSV que Excel abre bien en español: «;» entre columnas, coma decimal y BOM para los acentos.
// Lo usan los informes y los libros de facturación.

/** Céntimos a «1234,56» (vacío si no hay dato). */
export const eurosCsv = (cent) => (cent == null ? '' : (cent / 100).toFixed(2).replace('.', ','));

// Una celda. Entre comillas si lleva «;», comillas o saltos. Y si empieza por = + - @, con un apóstrofo
// delante: así Excel no la ejecuta como fórmula (una marca escrita a mala idea, por ejemplo). Los números
// negativos (una rectificativa: «-1632,23») se dejan como están.
export function celda(valor) {
  let t = valor == null ? '' : String(valor);
  if (/^[=+\-@]/.test(t) && !/^-?\d+(,\d+)?$/.test(t)) t = `'${t}`;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Responde con el CSV. `columnas`: [[cabecera, (fila) => valor], …]. */
export function enviarCsv(res, nombreFichero, columnas, filas) {
  const lineas = [columnas.map(([nombre]) => celda(nombre)), ...filas.map((f) => columnas.map(([, valor]) => celda(valor(f))))];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${nombreFichero}"`);
  res.send(`﻿${lineas.map((l) => l.join(';')).join('\r\n')}\r\n`);
}
