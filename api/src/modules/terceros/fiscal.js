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
