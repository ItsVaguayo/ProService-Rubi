// Contraseñas con scrypt de node:crypto: sin dependencias nativas extra.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const N = 16384;
const LARGO = 64;

export function hashContrasena(contrasena) {
  const sal = randomBytes(16);
  const hash = scryptSync(contrasena, sal, LARGO, { N });
  return `scrypt$${N}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function verificarContrasena(contrasena, guardado) {
  const [alg, n, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = scryptSync(contrasena, Buffer.from(sal, 'base64'), esperado.length, { N: Number(n) });
  return timingSafeEqual(esperado, calculado);
}
