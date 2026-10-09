// Dueño: Victor. Los cuatro costes de la ficha (transporte, taller, preparación e impuestos) viven en el
// libro de gastos (migración 0012): uno por casilla y coche, marcado con coste_ficha. Al dar de alta o
// editar el coche con esos campos, aquí se apunta o se corrige su gasto. Va dentro de la transacción del
// alta o la edición del coche.
import { apuntarGasto } from '../gastos/apuntar.js';
import { importes } from '../gastos/calculo.js';
import { registrar } from '../auditoria.js';
import { CASILLAS_COSTE } from '../margen.js';
import { hoyLocal } from '../../fechas.js';

export const CAMPOS_COSTE = CASILLAS_COSTE.map((k) => `coste_${k}_cent`);
// Lo que se ve en el libro de gastos: qué fue, no de dónde vino (todos se llamaban «Desde la ficha del coche»)
export const NOMBRE_COSTE = { transporte: 'Transporte', taller: 'Taller', preparacion: 'Preparación y limpieza', impuestos: 'Impuestos y trámites' };

// Saca los costes de `datos` (para que no vayan a la tabla vehiculos) y los devuelve aparte
export function separarCostes(datos) {
  const costes = {};
  for (const campo of CAMPOS_COSTE) if (campo in datos) { costes[campo] = datos[campo]; delete datos[campo]; }
  return costes;
}

export function guardarCostes(db, vehiculoId, costes, usuarioId) {
  const existente = db.prepare('SELECT * FROM gastos WHERE vehiculo_id = ? AND coste_ficha = ?');
  for (const [campo, valor] of Object.entries(costes)) {
    const casilla = campo.slice('coste_'.length, -'_cent'.length);
    const base = valor ?? 0;
    const antes = existente.get(vehiculoId, casilla);
    if (antes) {
      if (antes.base_cent === base) continue;
      // Un libro registro no se borra: si se vacía la casilla, el gasto se queda a 0
      const nuevos = { base_cent: base, ...importes({ base_cent: base, iva_pct: antes.iva_pct, irpf_pct: antes.irpf_pct }) };
      db.prepare('UPDATE gastos SET base_cent = ?, iva_cent = ?, irpf_cent = ?, total_cent = ? WHERE id = ?')
        .run(nuevos.base_cent, nuevos.iva_cent, nuevos.irpf_cent, nuevos.total_cent, antes.id);
      registrar(db, { usuarioId, entidad: 'gasto', entidadId: antes.id, accion: 'edicion', antes: { base_cent: antes.base_cent }, despues: nuevos });
    } else if (base > 0) {
      apuntarGasto(db, {
        fecha: hoyLocal(), tipo: 'vehiculo', concepto: 'vehiculos', vehiculo_id: vehiculoId,
        base_cent: base, iva_pct: casilla === 'impuestos' ? 0 : 21, irpf_pct: 0, coste_ficha: casilla,
        descripcion: NOMBRE_COSTE[casilla] ?? 'Coste de la ficha del coche',
      }, usuarioId);
    }
  }
}
