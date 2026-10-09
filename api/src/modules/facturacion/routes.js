// Dueño: Victor. Facturación de ventas (ampliación del 7-oct, bloque 3). Solo gerencia: se monta con
// requiereRol('gerencia') en app.js.
//
//   Borrador  Se crea, se cambia y se borra. Sus importes se recalculan con el coche de ese momento.
//   Emitida   Al emitir recibe su número (serie del año, sin huecos, en una transacción), se congela una
//             copia de la empresa, el cliente y el coche, y ya no se toca. Se corrige con una rectificativa.
//   Cobros    Lo cobrado de cada factura. La señal de la reserva del coche se puede aplicar como cobro
//             (en Pymecar las reservas no se facturan aparte). El estado de cobro se calcula.
// Libros de ingresos y de REBU en libros.js. Verifactu: octubre de 2028 (duda H1).
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { ENTERO, hoyLocal, diaValido } from '../../fechas.js';
import { FORMAS_PAGO, limpiarTercero } from '../terceros/campos.js';
import { ibanValido, normalizarIban } from '../terceros/fiscal.js';
import { limpiarFactura } from './campos.js';
import { importesFactura } from './importes.js';
import { rutasLibros } from './libros.js';

const LETRA_SERIE = { venta: 'V', rectificativa: 'R' };
const FORMAS_COBRO = [...FORMAS_PAGO, 'senal', 'financiera'];

/** 'V26-00039' */
export const codigoDe = (serie, numero) => `${serie}-${String(numero).padStart(5, '0')}`;
const serieDe = (tipo, fecha) => `${LETRA_SERIE[tipo]}${fecha.slice(2, 4)}`;

/** pendiente | parcial | cobrada | vencida, o borrador | anulada | rectificativa */
export function estadoCobro(f, hoy = hoyLocal()) {
  if (f.estado === 'borrador') return 'borrador';
  if (f.tipo === 'rectificativa') return 'rectificativa';
  if (f.anulada) return 'anulada';
  const saldo = f.total_cent - (f.cobrado_cent ?? 0);
  if (saldo <= 0) return 'cobrada';
  if (f.vencimiento && f.vencimiento < hoy) return 'vencida';
  return f.cobrado_cent > 0 ? 'parcial' : 'pendiente';
}

const SELECT = `
  SELECT f.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
         v.marca, v.modelo, v.version, v.matricula, v.referencia,
         (SELECT COALESCE(SUM(k.importe_cent), 0) FROM cobros k WHERE k.factura_id = f.id) AS cobrado_cent,
         (SELECT r.codigo FROM facturas r WHERE r.rectifica_id = f.id) AS rectificada_por
    FROM facturas f
    JOIN clientes c ON c.id = f.cliente_id
    LEFT JOIN vehiculos v ON v.id = f.vehiculo_id`;

function serializar(f) {
  const anulada = !!f.rectificada_por;
  const salida = { ...f, anulada, saldo_cent: f.estado === 'emitida' && f.tipo === 'venta' && !anulada ? f.total_cent - f.cobrado_cent : 0 };
  salida.estado_cobro = estadoCobro(salida);
  for (const campo of ['datos_empresa', 'datos_cliente', 'datos_vehiculo']) salida[campo] = f[campo] ? JSON.parse(f[campo]) : null;
  return salida;
}

export function rutasFacturas(db) {
  const r = Router();
  const leer = db.prepare(`${SELECT} WHERE f.id = ?`);
  const leerCoche = db.prepare('SELECT * FROM vehiculos WHERE id = ?');
  const leerCliente = db.prepare('SELECT * FROM clientes WHERE id = ?');
  const empresa = () => db.prepare('SELECT * FROM empresa WHERE id = 1').get();
  const hayEmitidas = () => !!db.prepare("SELECT 1 FROM facturas WHERE estado = 'emitida' LIMIT 1").get();

  // Lo que costó el coche (la base del REBU): la compra o, en depósito, lo pactado con el dueño
  const compraDe = (v) => (v ? (v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent) : null);
  // Régimen por defecto: el del coche; el depósito siempre en REBU (como en Pymecar)
  const regimenDe = (v) => (!v || v.propiedad === 'deposito' || v.regimen_iva !== 'deducible' ? 'REBU' : 'general');

  r.use('/libros', rutasLibros(db));

  // --- Empresa: los datos fiscales que salen en cada factura ---
  r.get('/empresa', (_req, res) => res.json(empresa()));
  r.put('/empresa', (req, res) => {
    const cuerpo = { ...(req.body ?? {}) };
    const errores = [];
    // Razón social y NIF quedan fijos en cuanto hay una factura emitida: otro NIF es otra empresa
    if (hayEmitidas() && ('razon_social' in cuerpo || 'nif' in cuerpo)) {
      return res.status(409).json({ error: 'Ya hay facturas emitidas: la razón social y el NIF no se cambian desde aquí' });
    }
    const { razon_social: razon, iban, registro_mercantil: registro, ...resto } = cuerpo;
    // Lo común (nif, dirección, teléfono, correo…) se valida como en clientes y proveedores
    const { datos, errores: deTercero } = limpiarTercero({ ...resto, ...(razon !== undefined ? { nombre: razon } : {}) },
      { nombre: { max: 150 }, nif: { nif: true }, direccion: { max: 200 }, codigo_postal: { max: 10 }, poblacion: { max: 100 },
        provincia: { max: 100 }, telefono: { telefono: true }, email: { email: true } }, { parcial: true });
    errores.push(...deTercero);
    if (datos.nif === null) errores.push('nif no puede quedar vacío');
    if (iban !== undefined && iban !== null && iban !== '' && !ibanValido(iban)) errores.push('El IBAN no es válido');
    if (registro !== undefined && registro !== null && (typeof registro !== 'string' || registro.length > 200)) errores.push('registro_mercantil tiene que ser texto');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    if ('nombre' in datos) { datos.razon_social = datos.nombre; delete datos.nombre; }
    if (iban !== undefined) datos.iban = iban ? normalizarIban(iban) : null;
    if (registro !== undefined) datos.registro_mercantil = registro?.trim() || null;
    const columnas = Object.keys(datos);
    if (!columnas.length) return res.status(400).json({ error: 'Sin cambios' });
    const antes = empresa();
    db.transaction(() => {
      db.prepare(`UPDATE empresa SET ${columnas.map((c) => `${c} = ?`).join(', ')}, actualizado_en = datetime('now') WHERE id = 1`).run(...columnas.map((c) => datos[c]));
      registrar(db, { usuarioId: req.usuario.id, entidad: 'empresa', entidadId: 1, accion: 'edicion',
        antes: Object.fromEntries(columnas.map((c) => [c, antes[c]])), despues: datos });
    })();
    res.json(empresa());
  });

  // --- Series: V26, R26… Antes de la primera factura de una serie se fija por qué número va ---
  r.get('/series', (_req, res) => {
    res.json(db.prepare('SELECT s.*, (SELECT COUNT(*) FROM facturas f WHERE f.serie = s.serie) AS emitidas FROM series s ORDER BY anio DESC, serie').all()
      .map((s) => ({ ...s, codigo_siguiente: codigoDe(s.serie, s.ultimo + 1) })));
  });
  r.put('/series/:serie', (req, res) => {
    const { serie } = req.params;
    const m = /^([VR])(\d{2})$/.exec(serie);
    if (!m) return res.status(400).json({ error: 'La serie va como V26 (ventas) o R26 (rectificativas)' });
    const { ultimo } = req.body ?? {};
    if (!Number.isInteger(ultimo) || ultimo < 0) return res.status(400).json({ error: 'ultimo tiene que ser un número entero ≥ 0: el último número que se dio en Pymecar' });
    if (db.prepare('SELECT 1 FROM facturas WHERE serie = ? LIMIT 1').get(serie)) {
      return res.status(409).json({ error: `La serie ${serie} ya tiene facturas: su numeración no se toca` });
    }
    db.transaction(() => {
      db.prepare(`INSERT INTO series (serie, tipo, anio, ultimo) VALUES (?, ?, ?, ?)
                  ON CONFLICT (serie) DO UPDATE SET ultimo = excluded.ultimo`)
        .run(serie, m[1] === 'V' ? 'venta' : 'rectificativa', 2000 + Number(m[2]), ultimo);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'serie', accion: 'numeracion', despues: { serie, ultimo } });
    })();
    res.json({ serie, ultimo, codigo_siguiente: codigoDe(serie, ultimo + 1) });
  });

  // --- Facturas ---
  // ?estado=borrador|pendiente|parcial|cobrada|vencida|anulada|rectificativa · ?q= (número, cliente o matrícula)
  // · ?desde= ?hasta= (AAAA-MM-DD). El resumen es de todo, se filtre lo que se filtre.
  r.get('/', (req, res) => {
    const { estado, q, desde, hasta } = req.query;
    const filtros = [];
    const valores = [];
    if (typeof q === 'string' && q.trim()) {
      const t = `%${q.trim()}%`;
      filtros.push("(f.codigo LIKE ? OR c.nombre LIKE ? OR v.matricula LIKE ?)");
      valores.push(t, t, `%${q.trim().toUpperCase().replace(/[\s-]/g, '')}%`);
    }
    if (typeof desde === 'string' && desde) { filtros.push('f.fecha >= ?'); valores.push(desde); }
    if (typeof hasta === 'string' && hasta) { filtros.push('f.fecha <= ?'); valores.push(hasta); }
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    let lista = db.prepare(`${SELECT} ${donde} ORDER BY f.estado = 'emitida', f.fecha DESC, f.numero DESC, f.id DESC`).all(...valores).map(serializar);
    const todas = donde ? db.prepare(SELECT).all().map(serializar) : lista;
    if (estado) lista = lista.filter((f) => f.estado_cobro === estado);

    const pendientes = todas.filter((f) => ['pendiente', 'parcial', 'vencida'].includes(f.estado_cobro));
    const vencidas = todas.filter((f) => f.estado_cobro === 'vencida');
    res.json({
      facturas: lista,
      resumen: {
        pendiente_cent: pendientes.reduce((s, f) => s + f.saldo_cent, 0),
        pendientes: pendientes.length,
        vencido_cent: vencidas.reduce((s, f) => s + f.saldo_cent, 0),
        vencidas: vencidas.length,
        vencida_mas_antigua: vencidas.map((f) => f.vencimiento).sort()[0] ?? null,
        borradores: todas.filter((f) => f.estado === 'borrador').length,
      },
    });
  });

  r.get('/:id', (req, res, next) => {
    if (!ENTERO.test(req.params.id)) return next();
    const f = leer.get(req.params.id);
    if (!f) return res.status(404).json({ error: 'No existe' });
    const cobros = db.prepare(`SELECT k.*, u.nombre AS creado_por_nombre FROM cobros k LEFT JOIN usuarios u ON u.id = k.creado_por
                                WHERE k.factura_id = ? ORDER BY k.fecha, k.id`).all(f.id);
    res.json({ ...serializar(f), cobros });
  });

  // Recalcula los importes de un borrador con el coche de ahora
  const conImportes = (d) => {
    const v = d.vehiculo_id ? leerCoche.get(d.vehiculo_id) : null;
    const compra = d.regimen === 'REBU' ? compraDe(v) : null;
    return { ...d, compra_cent: compra, ...importesFactura({ regimen: d.regimen, precio_cent: d.precio_cent, compra_cent: compra, suplidos_cent: d.suplidos_cent ?? 0 }) };
  };

  // Alta de un borrador. Del coche salen, si no llegan, el precio (su PVP) y el régimen.
  r.post('/', (req, res) => {
    const { datos, errores } = limpiarFactura(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    const v = datos.vehiculo_id ? leerCoche.get(datos.vehiculo_id) : null;
    if (datos.vehiculo_id && !v) return res.status(400).json({ error: 'Ese coche no existe' });
    if (!datos.cliente_id) return res.status(400).json({ error: 'Falta el cliente' });
    if (!leerCliente.get(datos.cliente_id)) return res.status(400).json({ error: 'Ese cliente no existe' });
    const d = {
      tipo: 'venta', fecha: hoyLocal(), regimen: regimenDe(v), precio_cent: v?.pvp_cent ?? null, suplidos_cent: 0,
      ...datos, creado_por: req.usuario.id,
    };
    if (d.precio_cent == null) return res.status(400).json({ error: 'Falta el precio: el coche no tiene PVP' });
    const fila = conImportes(d);
    const columnas = Object.keys(fila);
    const id = db.transaction(() => {
      const nuevo = Number(db.prepare(`INSERT INTO facturas (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`).run(...columnas.map((c) => fila[c])).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'factura', entidadId: nuevo, accion: 'alta', despues: fila });
      return nuevo;
    })();
    res.status(201).json(serializar(leer.get(id)));
  });

  const borrador = (req, res) => {
    if (!ENTERO.test(req.params.id)) { res.status(404).json({ error: 'No existe' }); return null; }
    const f = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    if (!f) { res.status(404).json({ error: 'No existe' }); return null; }
    if (f.estado !== 'borrador') { res.status(409).json({ error: `La ${f.codigo} ya está emitida: no se cambia. Si está mal, hay que rectificarla` }); return null; }
    return f;
  };

  r.put('/:id', (req, res) => {
    const antes = borrador(req, res);
    if (!antes) return;
    const { datos, errores } = limpiarFactura(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    if (!Object.keys(datos).length) return res.status(400).json({ error: 'Sin cambios' });
    if (datos.cliente_id && !leerCliente.get(datos.cliente_id)) return res.status(400).json({ error: 'Ese cliente no existe' });
    if (datos.vehiculo_id && !leerCoche.get(datos.vehiculo_id)) return res.status(400).json({ error: 'Ese coche no existe' });
    const fila = conImportes({ ...antes, ...datos });
    const columnas = [...Object.keys(datos), 'compra_cent', 'base_cent', 'iva_pct', 'iva_cent', 'total_cent'];
    db.transaction(() => {
      db.prepare(`UPDATE facturas SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...columnas.map((c) => fila[c]), antes.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'factura', entidadId: antes.id, accion: 'edicion',
        antes: Object.fromEntries(Object.keys(datos).map((c) => [c, antes[c]])), despues: datos });
    })();
    res.json(serializar(leer.get(antes.id)));
  });

  r.delete('/:id', (req, res) => {
    const f = borrador(req, res);
    if (!f) return;
    db.transaction(() => {
      db.prepare('DELETE FROM facturas WHERE id = ?').run(f.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'factura', entidadId: f.id, accion: 'borrado', antes: f });
    })();
    res.json({ ok: true });
  });

  // Da el siguiente número de la serie de esa fecha. Va dentro de la transacción de quien emite: así dos
  // emisiones a la vez no cogen el mismo número. Las fechas de una serie no van hacia atrás.
  const numerar = (tipo, fecha) => {
    const serie = serieDe(tipo, fecha);
    db.prepare('INSERT OR IGNORE INTO series (serie, tipo, anio) VALUES (?, ?, ?)').run(serie, tipo, Number(fecha.slice(0, 4)));
    const ultimaFecha = db.prepare("SELECT MAX(fecha) AS f FROM facturas WHERE serie = ? AND estado = 'emitida'").get(serie).f;
    if (ultimaFecha && fecha < ultimaFecha) {
      const e = new Error(`La última factura de la serie ${serie} es del ${ultimaFecha}: esta no puede llevar una fecha anterior`);
      e.status = 409;
      throw e;
    }
    const numero = db.prepare('UPDATE series SET ultimo = ultimo + 1 WHERE serie = ? RETURNING ultimo').get(serie).ultimo;
    return { serie, numero, codigo: codigoDe(serie, numero) };
  };

  // Lo que se congela al emitir: si luego cambia la ficha del cliente o del coche, la factura no cambia
  const copiaCoche = (v) => {
    if (!v) return null;
    const proveedor = v.proveedor_id ? db.prepare('SELECT nombre, nif FROM proveedores WHERE id = ?').get(v.proveedor_id) : null;
    const alta = db.prepare('SELECT MIN(fecha) AS f FROM historial_estados WHERE vehiculo_id = ?').get(v.id).f ?? v.creado_en;
    return {
      referencia: v.referencia, marca: v.marca, modelo: v.modelo, version: v.version, matricula: v.matricula, bastidor: v.bastidor,
      kilometros: v.kilometros, fecha_matriculacion: v.fecha_matriculacion, combustible: v.combustible, propiedad: v.propiedad,
      // Para el libro REBU: de quién se compró y cuándo entró
      fecha_compra: alta.slice(0, 10),
      proveedor_nombre: v.propiedad === 'deposito' ? v.propietario_nombre : proveedor?.nombre ?? v.proveedor_nombre,
      proveedor_nif: v.propiedad === 'deposito' ? null : proveedor?.nif ?? null,
    };
  };

  r.post('/:id/emitir', (req, res) => {
    const f = borrador(req, res);
    if (!f) return;
    const faltan = [];
    const e = empresa();
    if (!e.direccion || !e.codigo_postal || !e.poblacion) faltan.push('la dirección fiscal de la empresa (en Facturas → Datos de la empresa)');
    const c = leerCliente.get(f.cliente_id);
    if (!c.nif) faltan.push(`el DNI, NIE o CIF de ${c.nombre}`);
    if (!c.direccion || !c.poblacion) faltan.push(`la dirección de ${c.nombre}`);
    const v = f.vehiculo_id ? leerCoche.get(f.vehiculo_id) : null;
    if (!v) faltan.push('el coche');
    if (f.regimen === 'REBU' && v && compraDe(v) == null) faltan.push(v.propiedad === 'deposito' ? 'lo pactado con el dueño del coche' : 'el precio de compra del coche');
    if (f.precio_cent <= 0) faltan.push('el precio');
    // La fecha de una factura es la del día en que se expide. Una futura, además, bloquearía la serie:
    // las siguientes no pueden llevar una fecha anterior (numerar).
    if (f.fecha > hoyLocal()) return res.status(409).json({ error: `La factura tiene fecha del ${f.fecha}: no se emite con una fecha que aún no ha llegado` });
    if (faltan.length) return res.status(409).json({ error: `Para emitir falta: ${faltan.join(', ')}`, faltan });
    const otra = db.prepare(`SELECT codigo FROM facturas WHERE vehiculo_id = ? AND tipo = 'venta' AND estado = 'emitida'
                               AND id NOT IN (SELECT rectifica_id FROM facturas WHERE rectifica_id IS NOT NULL)`).get(v.id);
    if (otra) return res.status(409).json({ error: `Este coche ya está facturado en la ${otra.codigo}. Si hay que repetirla, rectifica antes esa` });

    try {
      db.transaction(() => {
        const fila = conImportes(f); // con el coche de este momento
        const { serie, numero, codigo } = numerar('venta', f.fecha);
        db.prepare(`UPDATE facturas SET estado = 'emitida', serie = ?, numero = ?, codigo = ?, compra_cent = ?, base_cent = ?, iva_cent = ?,
                      total_cent = ?, datos_empresa = ?, datos_cliente = ?, datos_vehiculo = ?, emitida_por = ?, emitida_en = datetime('now')
                    WHERE id = ?`)
          .run(serie, numero, codigo, fila.compra_cent, fila.base_cent, fila.iva_cent, fila.total_cent,
            JSON.stringify(e), JSON.stringify(c), JSON.stringify(copiaCoche(v)), req.usuario.id, f.id);
        db.prepare('UPDATE vehiculos SET comprador_id = ? WHERE id = ?').run(f.cliente_id, v.id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'factura', entidadId: f.id, accion: 'emision', despues: { codigo, total_cent: fila.total_cent } });
      })();
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    res.json(serializar(leer.get(f.id)));
  });

  // Rectificativa por el total: anula una factura emitida. Va a la serie R del año, con fecha de hoy.
  r.post('/:id/rectificar', (req, res) => {
    if (!ENTERO.test(req.params.id)) return res.status(404).json({ error: 'No existe' });
    const f = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
    if (!f) return res.status(404).json({ error: 'No existe' });
    if (f.estado !== 'emitida' || f.tipo !== 'venta') return res.status(409).json({ error: 'Solo se rectifica una factura de venta emitida' });
    if (db.prepare('SELECT 1 FROM facturas WHERE rectifica_id = ?').get(f.id)) return res.status(409).json({ error: `La ${f.codigo} ya está rectificada` });
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!motivo || motivo.length > 500) return res.status(400).json({ error: 'Hace falta el motivo de la rectificación' });

    let id;
    try {
      id = db.transaction(() => {
        const fecha = hoyLocal();
        const { serie, numero, codigo } = numerar('rectificativa', fecha);
        const nuevo = Number(db.prepare(`INSERT INTO facturas (tipo, estado, serie, numero, codigo, fecha, cliente_id, vehiculo_id, rectifica_id, motivo,
                        regimen, precio_cent, compra_cent, base_cent, iva_pct, iva_cent, suplidos_cent, total_cent, forma_pago,
                        datos_empresa, datos_cliente, datos_vehiculo, creado_por, emitida_por, emitida_en)
                      VALUES ('rectificativa', 'emitida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .run(serie, numero, codigo, fecha, f.cliente_id, f.vehiculo_id, f.id, motivo, f.regimen, -f.precio_cent,
            f.compra_cent == null ? null : -f.compra_cent, -f.base_cent, f.iva_pct, -f.iva_cent, -f.suplidos_cent, -f.total_cent, f.forma_pago,
            f.datos_empresa, f.datos_cliente, f.datos_vehiculo, req.usuario.id, req.usuario.id).lastInsertRowid);
        if (f.vehiculo_id) db.prepare('UPDATE vehiculos SET comprador_id = NULL WHERE id = ? AND comprador_id = ?').run(f.vehiculo_id, f.cliente_id);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'factura', entidadId: nuevo, accion: 'rectificacion', despues: { codigo, rectifica: f.codigo, motivo } });
        return nuevo;
      })();
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    res.status(201).json(serializar(leer.get(id)));
  });

  // --- Cobros ---
  // { importe_cent, forma_pago, fecha?, nota? } o { senal: true } para aplicar la señal de la reserva del coche
  r.post('/:id/cobros', (req, res) => {
    if (!ENTERO.test(req.params.id)) return res.status(404).json({ error: 'No existe' });
    const f = leer.get(req.params.id);
    if (!f) return res.status(404).json({ error: 'No existe' });
    const actual = serializar(f);
    if (f.estado !== 'emitida' || f.tipo !== 'venta' || actual.anulada) return res.status(409).json({ error: 'Solo se cobra una factura de venta emitida y sin rectificar' });
    const b = req.body ?? {};
    let cobro;
    if (b.senal === true) {
      const reserva = db.prepare(`SELECT * FROM reservas WHERE vehiculo_id = ? AND (activa = 1 OR cierre = 'vendida')
                                    AND id NOT IN (SELECT reserva_id FROM cobros WHERE reserva_id IS NOT NULL)
                                  ORDER BY fecha DESC, id DESC LIMIT 1`).get(f.vehiculo_id);
      if (!reserva) return res.status(409).json({ error: 'Este coche no tiene una señal sin aplicar' });
      cobro = { fecha: reserva.fecha.slice(0, 10), importe_cent: reserva.senal_cent, forma_pago: 'senal', reserva_id: reserva.id, nota: `Señal de la reserva de ${reserva.cliente}` };
    } else {
      const errores = [];
      const fecha = b.fecha ?? hoyLocal();
      if (typeof fecha !== 'string' || !diaValido(fecha)) errores.push('fecha tiene que ser AAAA-MM-DD');
      if (!Number.isInteger(b.importe_cent) || b.importe_cent <= 0) errores.push('importe_cent tiene que ser un entero de céntimos mayor que 0');
      if (!FORMAS_COBRO.includes(b.forma_pago)) errores.push(`forma_pago tiene que ser ${FORMAS_COBRO.join(', ')}`);
      if (b.nota != null && (typeof b.nota !== 'string' || b.nota.length > 500)) errores.push('nota tiene que ser texto corto');
      if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
      cobro = { fecha, importe_cent: b.importe_cent, forma_pago: b.forma_pago, reserva_id: null, nota: b.nota?.trim() || null };
    }
    if (cobro.importe_cent > actual.saldo_cent) {
      return res.status(409).json({ error: `Solo quedan ${(actual.saldo_cent / 100).toFixed(2).replace('.', ',')} € por cobrar de la ${f.codigo}` });
    }
    db.transaction(() => {
      const id = Number(db.prepare('INSERT INTO cobros (factura_id, fecha, importe_cent, forma_pago, reserva_id, nota, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(f.id, cobro.fecha, cobro.importe_cent, cobro.forma_pago, cobro.reserva_id, cobro.nota, req.usuario.id).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'cobro', entidadId: id, accion: 'alta', despues: { factura: f.codigo, ...cobro } });
    })();
    res.status(201).json(serializar(leer.get(f.id)));
  });

  // Quitar un cobro mal apuntado
  r.delete('/:id/cobros/:cobro', (req, res) => {
    const k = db.prepare('SELECT * FROM cobros WHERE id = ? AND factura_id = ?').get(req.params.cobro, req.params.id);
    if (!k) return res.status(404).json({ error: 'No existe' });
    db.transaction(() => {
      db.prepare('DELETE FROM cobros WHERE id = ?').run(k.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'cobro', entidadId: k.id, accion: 'borrado', antes: k });
    })();
    res.json(serializar(leer.get(k.factura_id)));
  });

  return r;
}
