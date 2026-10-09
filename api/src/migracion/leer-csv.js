// Lector de CSV para la migración: el formato que guarda Excel en español (« ; » entre columnas, BOM) y
// también con comas. Comillas dobles para los campos con separador, comillas o saltos de línea dentro.

/** Texto del CSV → [{ columna: valor }]. La primera fila son los nombres de columna (sin espacios ni mayúsculas). */
export function leerCsv(texto) {
  const limpio = texto.replace(/^﻿/, '');
  const primera = limpio.slice(0, limpio.search(/\r?\n|$/));
  const sep = (primera.match(/;/g) ?? []).length >= (primera.match(/,/g) ?? []).length ? ';' : ',';

  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"' && campo === '') entreComillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  const [cabecera, ...datos] = filas.filter((f) => f.some((v) => v.trim() !== ''));
  if (!cabecera) return [];
  const columnas = cabecera.map((c) => c.trim().toLowerCase());
  return datos.map((f) => Object.fromEntries(columnas.map((c, i) => [c, (f[i] ?? '').trim()])));
}
