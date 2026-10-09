// Dueño: David. Incentivos de los comerciales (ampliación del 7-oct, bloque 6, T12).
//   GET  /api/incentivos             → los dos roles: gerencia ve a todos; el comercial solo lo suyo y sin margen
//   reglas y liquidar                → solo gerencia
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { requiereRol } from '../auth/sesiones.js';
import { calcularIncentivos, MES, TIPOS_REGLA } from './calculo.js';
import { apuntarGasto } from '../gastos/apuntar.js';
import { hoyLocal } from '../../fechas.js';

const esGerencia = (u) => u?.rol === 'gerencia';
const mesActual = () => new Date().toISOString().slice(0, 7); // UTC, como ventasDelMes
const ENTERO = /^[1-9]\d*$/;

export function rutasIncentivos(db) {
  const r = Router();
  const usuario = db.prepare('SELECT id, nombre, rol FROM usuarios WHERE id = ?');
  const regla = db.prepare('SELECT * FROM incentivos_reglas WHERE usuario_id = ?');
  const soloGerencia = requiereRol('gerencia');

  r.get('/reglas', soloGerencia, (_req, res) => {
    res.json(db.prepare(`SELECT u.id AS usuario_id, u.nombre, u.rol, u.activo, r.tipo, r.valor, r.actualizado_en
                           FROM usuarios u LEFT JOIN incentivos_reglas r ON r.usuario_id = u.id
                          ORDER BY u.nombre COLLATE NOCASE, u.id`).all());
  });

  // { tipo, valor }: porcentaje_margen en centésimas (500 = 5 %, como mucho 10.000) o fijo_por_coche en céntimos
  r.put('/reglas/:usuarioId', soloGerencia, (req, res) => {
    if (!ENTERO.test(req.params.usuarioId)) return res.status(404).json({ error: 'No existe' });
    const u = usuario.get(Number(req.params.usuarioId));
    if (!u) return res.status(404).json({ error: 'No existe' });
    const { tipo, valor, ...resto } = req.body ?? {};
    const errores = [];
    if (Object.keys(resto).length) errores.push(`Campo desconocido: ${Object.keys(resto).join(', ')}`);
    if (!TIPOS_REGLA.includes(tipo)) errores.push(`tipo tiene que ser ${TIPOS_REGLA.join(' o ')}`);
    if (!Number.isInteger(valor) || valor < 0) errores.push('valor tiene que ser un número entero, sin decimales y no negativo');
    else if (tipo === 'porcentaje_margen' && valor > 10000) errores.push('El porcentaje va en centésimas: 500 es un 5 %, y no puede pasar de 10.000 (100 %)');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    const antes = regla.get(u.id);
    db.transaction(() => {
      db.prepare(`INSERT INTO incentivos_reglas (usuario_id, tipo, valor) VALUES (?, ?, ?)
                  ON CONFLICT (usuario_id) DO UPDATE SET tipo = excluded.tipo, valor = excluded.valor, actualizado_en = datetime('now')`)
        .run(u.id, tipo, valor);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'incentivo_regla', entidadId: u.id, accion: antes ? 'edicion' : 'alta',
        antes: antes ? { tipo: antes.tipo, valor: antes.valor } : null, despues: { tipo, valor } });
    })();
    res.json({ usuario_id: u.id, nombre: u.nombre, ...regla.get(u.id) });
  });

  r.get('/', (req, res) => {
    const mes = req.query.mes ?? mesActual();
    if (typeof mes !== 'string' || !MES.test(mes)) return res.status(400).json({ error: 'El mes va como AAAA-MM, por ejemplo 2026-09' });
    const calculo = calcularIncentivos(db, mes);
    if (esGerencia(req.usuario)) return res.json(calculo);

    // El comercial: solo él, y sin el margen de ningún coche (el incentivo sí lo ve)
    const suyo = calculo.comerciales.find((c) => c.usuario_id === req.usuario.id)
      ?? { usuario_id: req.usuario.id, nombre: req.usuario.nombre, rol: req.usuario.rol, regla: null, coches: [], total_cent: 0, liquidado: null };
    const coches = suyo.coches.map(({ margen_cent, ...c }) => c);
    const liquidado = suyo.liquidado && { coches: suyo.liquidado.coches, importe_cent: suyo.liquidado.importe_cent, liquidado_en: suyo.liquidado.liquidado_en };
    // Ni el porcentaje: con él y su incentivo se despeja el margen de cada coche. El fijo por coche sí lo ve.
    const regla = suyo.regla && (suyo.regla.tipo === 'fijo_por_coche' ? suyo.regla : { tipo: suyo.regla.tipo });
    res.json({ mes, comerciales: [{ ...suyo, regla, coches, liquidado }] });
  });

  // { mes, usuario_id }: guarda lo calculado. Un mes solo se liquida cuando ha terminado, y una sola vez.
  r.post('/liquidar', soloGerencia, (req, res) => {
    const { mes, usuario_id, ...resto } = req.body ?? {};
    const errores = [];
    if (Object.keys(resto).length) errores.push(`Campo desconocido: ${Object.keys(resto).join(', ')}`);
    if (typeof mes !== 'string' || !MES.test(mes)) errores.push('El mes va como AAAA-MM, por ejemplo 2026-09');
    if (!Number.isInteger(usuario_id) || usuario_id < 1) errores.push('usuario_id tiene que ser un número');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });
    if (!usuario.get(usuario_id)) return res.status(404).json({ error: 'Ese usuario no existe' });
    if (mes >= mesActual()) return res.status(409).json({ error: 'El mes aún no ha terminado: se liquida a partir del día 1 del siguiente' });

    const resultado = db.transaction(() => {
      if (db.prepare('SELECT 1 FROM incentivos_liquidados WHERE mes = ? AND usuario_id = ?').get(mes, usuario_id)) return null;
      const c = calcularIncentivos(db, mes).comerciales.find((x) => x.usuario_id === usuario_id);
      const coches = c?.coches.length ?? 0;
      const importe = c?.total_cent ?? 0;
      const id = Number(db.prepare('INSERT INTO incentivos_liquidados (mes, usuario_id, coches, importe_cent, liquidado_por) VALUES (?, ?, ?, ?, ?)')
        .run(mes, usuario_id, coches, importe, req.usuario.id).lastInsertRowid);
      registrar(db, { usuarioId: req.usuario.id, entidad: 'incentivo_liquidado', entidadId: id, accion: 'alta',
        despues: { mes, usuario_id, coches, importe_cent: importe, regla: c?.regla ?? null } });
      // Lo pagado va al libro de gastos (T14), en la misma transacción: o entran los dos o ninguno.
      // Fecha de hoy (cuando se liquida) y sin IVA ni IRPF, como pide la T14. Si el comercial es externo y
      // factura (duda F5), llevaría IVA: se cambia aquí.
      if (importe > 0) {
        apuntarGasto(db, {
          fecha: hoyLocal(), tipo: 'comision', concepto: 'comisiones', usuario_id,
          base_cent: importe, iva_pct: 0, irpf_pct: 0, descripcion: `Incentivo de ${usuario.get(usuario_id).nombre}, ${mes}`,
        }, req.usuario.id);
      }
      return db.prepare('SELECT * FROM incentivos_liquidados WHERE id = ?').get(id);
    })();
    if (!resultado) return res.status(409).json({ error: 'Ese mes ya está liquidado para este comercial' });
    res.status(201).json(resultado);
  });

  return r;
}
