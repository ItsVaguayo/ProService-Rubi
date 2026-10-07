// Dueño: David. Libro de gastos (ampliación del 7-oct, bloque 2, T14). Solo gerencia: se monta con
// requiereRol('gerencia') en app.js, como proveedores.
// Sin DELETE: un libro registro no se borra. Un gasto mal apuntado se corrige con PUT.
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { limpiarGasto, TIPOS, CONCEPTOS, FORMAS_PAGO } from './campos.js';
import { importes, reglasIncumplidas } from './calculo.js';
import { apuntarGasto, ErrorGasto } from './apuntar.js';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ENTERO = /^[1-9]\d*$/;
const mesActual = () => new Date().toISOString().slice(0, 7);
const IMPORTES = ['base_cent', 'iva_cent', 'irpf_cent', 'total_cent'];

const SELECT = `SELECT g.*, p.nombre AS proveedor_nombre, c.nombre AS cliente_nombre, u.nombre AS usuario_nombre,
                       v.referencia AS vehiculo_referencia, v.matricula AS vehiculo_matricula,
                       v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo
                  FROM gastos g
                  LEFT JOIN proveedores p ON p.id = g.proveedor_id
                  LEFT JOIN clientes c ON c.id = g.cliente_id
                  LEFT JOIN usuarios u ON u.id = g.usuario_id
                  LEFT JOIN vehiculos v ON v.id = g.vehiculo_id`;

function sumar(lista) {
  const t = { gastos: lista.length };
  for (const campo of IMPORTES) t[campo] = lista.reduce((s, g) => s + g[campo], 0);
  return t;
}

export function rutasGastos(db) {
  const r = Router();
  const leer = db.prepare(`${SELECT} WHERE g.id = ?`);

  // ?mes=AAAA-MM (por defecto, el actual) · ?tipo= · ?concepto= · ?vehiculo=id · ?pagado=1|0
  r.get('/', (req, res) => {
    const { mes = mesActual(), tipo, concepto, vehiculo, pagado } = req.query;
    const errores = [];
    const filtros = [];
    const valores = [];
    if (typeof mes !== 'string' || !MES.test(mes)) errores.push('El mes va como AAAA-MM, por ejemplo 2026-09');
    else { filtros.push('substr(g.fecha, 1, 7) = ?'); valores.push(mes); }
    if (tipo !== undefined) {
      if (!TIPOS.includes(tipo)) errores.push(`tipo tiene que ser ${TIPOS.join(', ')}`);
      else { filtros.push('g.tipo = ?'); valores.push(tipo); }
    }
    if (concepto !== undefined) {
      if (!CONCEPTOS.includes(concepto)) errores.push(`concepto tiene que ser ${CONCEPTOS.join(', ')}`);
      else { filtros.push('g.concepto = ?'); valores.push(concepto); }
    }
    if (vehiculo !== undefined) {
      if (typeof vehiculo !== 'string' || !ENTERO.test(vehiculo)) errores.push('vehiculo tiene que ser un número');
      else { filtros.push('g.vehiculo_id = ?'); valores.push(Number(vehiculo)); }
    }
    if (pagado !== undefined) {
      if (pagado === '1') filtros.push('g.pagado_en IS NOT NULL');
      else if (pagado === '0') filtros.push('g.pagado_en IS NULL');
      else errores.push('pagado tiene que ser 1 o 0');
    }
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    const gastos = db.prepare(`${SELECT} WHERE ${filtros.join(' AND ')} ORDER BY g.fecha DESC, g.numero DESC`).all(...valores);
    // Los totales son de la lista que se devuelve (con sus filtros), así siempre cuadran con ella
    const por_tipo = Object.fromEntries(TIPOS.map((t) => [t, sumar(gastos.filter((g) => g.tipo === t))]).filter(([, s]) => s.gastos));
    const pendiente = gastos.filter((g) => !g.pagado_en);
    res.json({
      mes,
      gastos,
      totales: { ...sumar(gastos), por_tipo, pendiente_cent: pendiente.reduce((s, g) => s + g.total_cent, 0), pendientes: pendiente.length },
    });
  });

  r.get('/:id', (req, res) => {
    const g = leer.get(req.params.id);
    if (!g) return res.status(404).json({ error: 'No existe' });
    res.json(g);
  });

  r.post('/', (req, res) => {
    const { datos, errores } = limpiarGasto(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    try {
      res.status(201).json(leer.get(apuntarGasto(db, datos, req.usuario.id)));
    } catch (e) {
      if (e instanceof ErrorGasto) return res.status(400).json({ error: e.message, errores: e.errores });
      throw e;
    }
  });

  // Cambia lo que llegue, recalcula los importes y vuelve a comprobar las reglas con el gasto entero.
  // El número de registro no se cambia nunca (no está en la lista blanca).
  r.put('/:id', (req, res) => {
    const antes = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const { datos, errores } = limpiarGasto(req.body);
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    if (!Object.keys(datos).length) return res.status(400).json({ error: 'Sin cambios' });

    const nuevo = { ...antes, ...datos };
    const incumplidas = reglasIncumplidas(nuevo);
    if (incumplidas.length) return res.status(400).json({ error: incumplidas.join('. '), errores: incumplidas });
    Object.assign(datos, importes(nuevo));
    const columnas = Object.keys(datos);
    db.transaction(() => {
      db.prepare(`UPDATE gastos SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...columnas.map((c) => datos[c]), antes.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'gasto', entidadId: antes.id, accion: 'edicion',
        antes: Object.fromEntries(columnas.map((c) => [c, antes[c]])), despues: datos });
    })();
    res.json(leer.get(antes.id));
  });

  // { pagado: true, forma_pago? } pone la fecha de hoy · { pagado: false } la quita
  r.patch('/:id/pagado', (req, res) => {
    const antes = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
    if (!antes) return res.status(404).json({ error: 'No existe' });
    const { pagado, forma_pago, ...resto } = req.body ?? {};
    const errores = [];
    if (Object.keys(resto).length) errores.push(`Campo desconocido: ${Object.keys(resto).join(', ')}`);
    if (typeof pagado !== 'boolean') errores.push('pagado tiene que ser true o false');
    if (forma_pago !== undefined && (!pagado || !FORMAS_PAGO.includes(forma_pago))) {
      errores.push(pagado ? `forma_pago tiene que ser ${FORMAS_PAGO.join(', ')}` : 'forma_pago solo va al marcarlo pagado');
    }
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    db.transaction(() => {
      if (pagado) db.prepare("UPDATE gastos SET pagado_en = date('now'), forma_pago = COALESCE(?, forma_pago) WHERE id = ?").run(forma_pago ?? null, antes.id);
      else db.prepare('UPDATE gastos SET pagado_en = NULL WHERE id = ?').run(antes.id);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'gasto', entidadId: antes.id, accion: pagado ? 'pagado' : 'sin_pagar',
        antes: { pagado_en: antes.pagado_en, forma_pago: antes.forma_pago }, despues: { pagado, forma_pago: forma_pago ?? antes.forma_pago } });
    })();
    res.json(leer.get(antes.id));
  });

  return r;
}
