// Documentos de identidad fiscal de España: DNI (NIF de persona), NIE y CIF (NIF de sociedad).
// Se comprueba la letra o el dígito de control: un NIF mal escrito en una factura la invalida.

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CIF = 'JABCDEFGHI';

export function normalizarNif(texto) {
  return String(texto).toUpperCase().replace(/[\s.-]/g, '');
}

function dniValido(nif) {
  const m = /^(\d{8})([A-Z])$/.exec(nif);
  return !!m && LETRAS_DNI[Number(m[1]) % 23] === m[2];
}

function nieValido(nif) {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  return !!m && dniValido(`${'XYZ'.indexOf(m[1])}${m[2]}${m[3]}`);
}

function cifValido(nif) {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif);
  if (!m) return false;
  const digitos = m[2].split('').map(Number);
  let suma = 0;
  digitos.forEach((d, i) => {
    if (i % 2 === 1) suma += d; // posiciones pares (2, 4, 6)
    else { const doble = d * 2; suma += Math.floor(doble / 10) + (doble % 10); }
  });
  const control = (10 - (suma % 10)) % 10;
  const [, letra, , final] = m;
  if ('PQRSNW'.includes(letra)) return final === LETRAS_CIF[control]; // siempre letra
  if ('ABEH'.includes(letra)) return final === String(control); // siempre número
  return final === String(control) || final === LETRAS_CIF[control];
}

// 'dni' | 'nie' | 'cif' | null (no es válido)
export function tipoNif(texto) {
  const nif = normalizarNif(texto);
  if (dniValido(nif)) return 'dni';
  if (nieValido(nif)) return 'nie';
  if (cifValido(nif)) return 'cif';
  return null;
}

// IBAN: dos letras de país, dos dígitos de control y de 11 a 30 letras o números (en España, 24 en total).
// Se pasan los cuatro primeros al final, cada letra a su número (A = 10 … Z = 35) y el resultado módulo 97
// tiene que dar 1. El número sale de hasta 70 cifras: demasiado para un Number, así que el resto se va
// sacando por trozos de 9 cifras (cabe de sobra en un entero de JavaScript).
export function normalizarIban(texto) {
  return String(texto).toUpperCase().replace(/\s/g, '');
}

export function ibanValido(texto) {
  const iban = normalizarIban(texto);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('ES') && iban.length !== 24) return false;
  const numeros = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (l) => String(l.charCodeAt(0) - 55));
  let resto = 0;
  for (let i = 0; i < numeros.length; i += 9) resto = Number(String(resto) + numeros.slice(i, i + 9)) % 97;
  return resto === 1;
}
