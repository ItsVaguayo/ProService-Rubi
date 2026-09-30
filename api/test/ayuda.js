// Utilidades de los tests: servidor con base en memoria y usuarios de los dos roles ya logueados.
import { abrirDb } from '../src/db.js';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/modules/auth/sesiones.js';

export const CONTRASENA = 'contrasena-de-prueba';

export const coche = {
  matricula: '1234 abc', bastidor: 'vf1rfb00000000001', marca: 'Renault', modelo: 'Clio', version: 'Zen',
  anio: 2021, fecha_matriculacion: '2021-03-10', kilometros: 45000, combustible: 'gasolina', cambio: 'manual',
  potencia_cv: 90, cilindrada: 999, traccion: 'delantera', emisiones_co2: 118, etiqueta_dgt: 'C',
  carroceria: 'utilitario', puertas: 5, plazas: 5, color_exterior: 'blanco', tapiceria: 'tela', llantas: '16"',
  ubicacion: 'parking', regimen_iva: 'REBU',
  precio_compra_cent: 900000, coste_transporte_cent: 20000, coste_taller_cent: 30000, pvp_cent: 1290000,
};

export async function conServidor(fn) {
  const db = abrirDb(':memory:');
  crearUsuario(db, { email: 'jaume@ejemplo.com', nombre: 'Jaume', rol: 'gerencia', contrasena: CONTRASENA });
  crearUsuario(db, { email: 'comercial@ejemplo.com', nombre: 'Comercial', rol: 'comercial', contrasena: CONTRASENA });

  const server = crearApp(db).listen(0);
  const base = `http://localhost:${server.address().port}/api`;

  const entrar = async (email) => {
    const res = await fetch(`${base}/auth/entrar`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, contrasena: CONTRASENA }),
    });
    if (res.status !== 200) throw new Error(`Login falló: ${res.status}`);
    return res.headers.get('set-cookie').split(';')[0];
  };

  // Cliente mínimo: pide(ruta, { method, body, como: 'gerencia' | 'comercial' | null })
  const cookies = { gerencia: await entrar('jaume@ejemplo.com'), comercial: await entrar('comercial@ejemplo.com') };
  const pide = async (ruta, { method = 'GET', body, como = 'gerencia' } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (como) headers.cookie = cookies[como];
    const res = await fetch(`${base}${ruta}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const texto = await res.text();
    return { status: res.status, json: texto ? JSON.parse(texto) : null, headers: res.headers };
  };

  try {
    await fn({ db, base, pide });
  } finally {
    server.closeAllConnections();
    server.close();
    db.close();
  }
}

// Mete N fotos públicas a un coche directamente en la base (el módulo de fotos aún no sube).
export function meterFotos(db, vehiculoId, n) {
  const ins = db.prepare('INSERT INTO fotos (vehiculo_id, orden, ruta_original) VALUES (?, ?, ?)');
  for (let i = 1; i <= n; i++) ins.run(vehiculoId, i, `foto-${i}.jpg`);
}
