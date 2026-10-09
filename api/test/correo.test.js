// Correos: el aviso de cada contacto de la web, el resumen diario de avisos y el envío con reintentos.
// Nunca se manda nada de verdad: el transporte es uno falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conServidor } from './ayuda.js';
import { configCorreo, crearTransporte, encolar, enviarPendientes, MAX_INTENTOS } from '../src/modules/correo/envio.js';
import { encolarAvisosDelDia } from '../src/modules/correo/mensajes.js';

const CONTACTO = { nombre: 'Marta Ruiz', telefono: '600 111 222', email: 'marta@ejemplo.com', tipo: 'prueba', mensaje: '¿El sábado?', privacidad: true };
const correos = (db) => db.prepare('SELECT * FROM correos ORDER BY id').all();
const conEntorno = async (vars, fn) => {
  const antes = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try { await fn(); } finally {
    for (const [k, v] of Object.entries(antes)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
};
const transporteFalso = (falla = false) => {
  const enviados = [];
  return { enviados, sendMail: async (m) => { if (falla) throw new Error('SMTP caído\r\nX: y'); enviados.push(m); } };
};

test('correo: cada contacto de la web apunta un correo para el comercial', () =>
  conEntorno({ CORREO_CONTACTOS: 'jaume@ejemplo.com, comercial@ejemplo.com', PANEL_URL: 'https://stock.ejemplo.com/panel' }, () =>
    conServidor(async ({ db, pide }) => {
      assert.equal((await pide('/contactos', { method: 'POST', body: CONTACTO, como: null })).status, 201);
      const [c] = correos(db);
      assert.equal(c.tipo, 'contacto');
      assert.equal(c.estado, 'pendiente');
      assert.equal(c.para, 'jaume@ejemplo.com, comercial@ejemplo.com');
      assert.equal(c.asunto, 'Contacto de la web: prueba de conducción · Marta Ruiz');
      assert.match(c.cuerpo, /Teléfono: 600 111 222\nCorreo: marta@ejemplo\.com/);
      assert.match(c.cuerpo, /Mensaje:\n¿El sábado\?/);
      const id = db.prepare('SELECT id FROM contactos').get().id;
      assert.match(c.cuerpo, new RegExp(`https://stock\\.ejemplo\\.com/panel/contactos\\.html\\?id=${id}$`));

      // El robot que rellena el campo trampa no genera correo
      await pide('/contactos', { method: 'POST', body: { ...CONTACTO, web: 'http://spam' }, como: null });
      assert.equal(correos(db).length, 1);
    })));

test('correo: un nombre con saltos de línea no cuela cabeceras en el asunto', () =>
  conServidor(async ({ db, pide }) => {
    await pide('/contactos', { method: 'POST', body: { ...CONTACTO, nombre: 'Ana\r\nBcc: todos@ejemplo.com' }, como: null });
    assert.equal(correos(db)[0].asunto, 'Contacto de la web: prueba de conducción · Ana Bcc: todos@ejemplo.com');
  }));

test('correo: enviar, simulado sin SMTP o sin destinatario, y reintentos espaciados', () =>
  conServidor(async ({ db }) => {
    const bueno = encolar(db, { tipo: 'contacto', para: 'jaume@ejemplo.com', asunto: 'Uno', cuerpo: 'Hola' });
    const t = transporteFalso();
    assert.deepEqual(await enviarPendientes(db, { transporte: t, de: 'Pro Service <a@ejemplo.com>' }), { enviados: 1, simulados: 0, fallidos: 0 });
    assert.deepEqual(t.enviados, [{ from: 'Pro Service <a@ejemplo.com>', to: 'jaume@ejemplo.com', subject: 'Uno', text: 'Hola' }]);
    assert.equal(db.prepare('SELECT estado FROM correos WHERE id = ?').get(bueno).estado, 'enviado');
    assert.deepEqual(await enviarPendientes(db, { transporte: t }), { enviados: 0, simulados: 0, fallidos: 0 }, 'no se manda dos veces');

    const sinSmtp = encolar(db, { tipo: 'contacto', para: 'jaume@ejemplo.com', asunto: 'Dos', cuerpo: '.' });
    const sinPara = encolar(db, { tipo: 'avisos_diario', para: null, asunto: 'Tres', cuerpo: '.' });
    await enviarPendientes(db, { transporte: null });
    const leer = db.prepare('SELECT estado, ultimo_error FROM correos WHERE id = ?');
    assert.deepEqual(leer.get(sinSmtp), { estado: 'simulado', ultimo_error: 'Modo simulado: falta SMTP_URL' });
    assert.deepEqual(leer.get(sinPara), { estado: 'simulado', ultimo_error: 'Sin destinatario: falta CORREO_AVISOS' });

    // Un fallo deja el correo pendiente y no se reintenta en la pasada siguiente, sino más tarde
    const malo = encolar(db, { tipo: 'contacto', para: 'jaume@ejemplo.com', asunto: 'Cuatro', cuerpo: '.' });
    assert.equal((await enviarPendientes(db, { transporte: transporteFalso(true) })).fallidos, 1);
    assert.deepEqual(db.prepare('SELECT estado, intentos, ultimo_error FROM correos WHERE id = ?').get(malo),
      { estado: 'pendiente', intentos: 1, ultimo_error: 'SMTP caído X: y' });
    assert.equal((await enviarPendientes(db, { transporte: transporteFalso(true) })).fallidos, 0, 'aún no toca');
    // Tras el último intento queda en «error»
    db.prepare("UPDATE correos SET intentos = ?, creado_en = datetime('now', '-1 day') WHERE id = ?").run(MAX_INTENTOS - 1, malo);
    await enviarPendientes(db, { transporte: transporteFalso(true) });
    assert.equal(db.prepare('SELECT estado FROM correos WHERE id = ?').get(malo).estado, 'error');

    // Con clave, no se apunta dos veces lo mismo
    assert.ok(encolar(db, { tipo: 'avisos_diario', clave: 'avisos:2026-10-09', para: 'a@ejemplo.com', asunto: 'x', cuerpo: 'x' }));
    assert.equal(encolar(db, { tipo: 'avisos_diario', clave: 'avisos:2026-10-09', para: 'a@ejemplo.com', asunto: 'x', cuerpo: 'x' }), null);
  }));

test('correo: el resumen de avisos sale una vez al día, a partir de la hora, y solo si hay avisos', () =>
  conServidor(async ({ db }) => {
    const cfg = { ...configCorreo({}), avisos: 'jaume@ejemplo.com', panel: 'https://stock.ejemplo.com/panel/' };
    const a7 = new Date('2026-10-09T05:00:00Z'); // 07:00 en Rubí (verano, UTC+2)
    const a9 = new Date('2026-10-09T07:00:00Z'); // 09:00
    const avisos = [
      { tipo: 'itv', gravedad: 'alta', texto: 'Seat Ibiza 1234 BCD: la ITV caducó el 07/10/2026', enlace: 'coche.html?id=12' },
      { tipo: 'coches_parados', gravedad: 'media', texto: 'Peugeot 208 4321 JKL lleva 71 días publicado', enlace: 'coche.html?id=3' },
    ];
    assert.equal(encolarAvisosDelDia(db, cfg, { ahora: a9, calcular: () => [] }), null, 'sin avisos, nada');
    assert.equal(encolarAvisosDelDia(db, cfg, { ahora: a7, calcular: () => avisos }), null, 'antes de las 8, nada');
    const id = encolarAvisosDelDia(db, cfg, { ahora: a9, calcular: () => avisos });
    assert.ok(id);
    assert.equal(encolarAvisosDelDia(db, cfg, { ahora: a9, calcular: () => avisos }), null, 'una vez al día');
    const c = db.prepare('SELECT * FROM correos WHERE id = ?').get(id);
    assert.equal(c.clave, 'avisos:2026-10-09');
    assert.equal(c.asunto, 'Avisos del 09/10/2026: 1 urgente, 2 en total');
    assert.equal(c.cuerpo, [
      'Urgente (1)', '- Seat Ibiza 1234 BCD: la ITV caducó el 07/10/2026', '  https://stock.ejemplo.com/panel/coche.html?id=12', '',
      'Pendiente (1)', '- Peugeot 208 4321 JKL lleva 71 días publicado', '  https://stock.ejemplo.com/panel/coche.html?id=3', '',
      'https://stock.ejemplo.com/panel/avisos.html',
    ].join('\n'));
  }));

test('correo: sin calculador de prueba, el resumen sale de los avisos de verdad', () =>
  conServidor(async ({ db }) => {
    db.prepare("INSERT INTO contactos (nombre, telefono, tipo, recibido_en) VALUES ('Viejo', '600000000', 'prueba', datetime('now', '-2 days'))").run();
    const id = encolarAvisosDelDia(db, { ...configCorreo({}), horaAvisos: 0 });
    assert.match(db.prepare('SELECT cuerpo FROM correos WHERE id = ?').get(id).cuerpo, /Viejo escribió por la web/);
  }));

test('correo: GET /correos, solo gerencia', () =>
  conServidor(async ({ db, pide }) => {
    encolar(db, { tipo: 'contacto', para: 'a@ejemplo.com', asunto: 'x', cuerpo: 'x' });
    assert.equal((await pide('/correos')).json.length, 1);
    assert.equal((await pide('/correos?estado=enviado')).json.length, 0);
    assert.equal((await pide('/correos?estado=raro')).status, 400);
    assert.equal((await pide('/correos', { como: 'comercial' })).status, 403);
  }));

test('correo: configuración desde el entorno', () => {
  const cfg = configCorreo({ CORREO_CONTACTOS: ' a@x.com ,, b@x.com ', AVISOS_HORA: '7', PANEL_URL: 'https://p.com/panel' });
  assert.equal(cfg.contactos, 'a@x.com, b@x.com');
  assert.equal(cfg.avisos, null);
  assert.equal(cfg.horaAvisos, 7);
  assert.equal(cfg.panel, 'https://p.com/panel/');
  assert.equal(cfg.smtp, null);
  assert.equal(configCorreo({ AVISOS_HORA: '25' }).horaAvisos, 8);
  assert.equal(configCorreo({ AVISOS_HORA: '0' }).horaAvisos, 0);
  assert.equal(crearTransporte(cfg), null, 'sin SMTP_URL, simulado');
  assert.equal(typeof crearTransporte(configCorreo({ SMTP_URL: 'smtp://u:p@localhost:2525' })).sendMail, 'function');
});
