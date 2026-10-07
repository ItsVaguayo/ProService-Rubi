// Dueño: Victor. Qué coches se vendieron en un mes y quién los vendió. Lo usan los informes y los
// incentivos de los comerciales (T12 de David).
//
// Una venta es la última vez que el coche pasó a vendido: a «Vendido», o directamente a «Entregado» si se
// saltó ese paso (el paso de «Vendido» a «Entregado» no es otra venta). Solo cuentan los coches que siguen
// vendidos o entregados: si se deshace la venta, deja de contar. Quien vendió es quien hizo ese paso.
// Los meses van en hora UTC, como las fechas de la base.

const consultas = new WeakMap(); // una sentencia preparada por base

function consulta(db) {
  if (!consultas.has(db)) {
    consultas.set(db, db.prepare(`
      WITH venta AS (
        SELECT vehiculo_id,
               MAX(CASE WHEN a = 'vendido' OR (a = 'entregado' AND (de IS NULL OR de <> 'vendido')) THEN fecha END) AS fecha,
               MIN(fecha) AS alta
          FROM historial_estados GROUP BY vehiculo_id
      ),
      quien AS (
        SELECT h.vehiculo_id, h.usuario_id,
               ROW_NUMBER() OVER (PARTITION BY h.vehiculo_id ORDER BY h.id DESC) AS n
          FROM historial_estados h JOIN venta ON venta.vehiculo_id = h.vehiculo_id AND h.fecha = venta.fecha
         WHERE h.a = 'vendido' OR (h.a = 'entregado' AND (h.de IS NULL OR h.de <> 'vendido')) -- el paso que fue la venta
      )
      SELECT v.*, venta.fecha AS fecha_venta, COALESCE(venta.alta, v.creado_en) AS fecha_alta,
             quien.usuario_id AS vendio_id, u.nombre AS vendio
        FROM vehiculos v
        JOIN venta ON venta.vehiculo_id = v.id
        LEFT JOIN quien ON quien.vehiculo_id = v.id AND quien.n = 1
        LEFT JOIN usuarios u ON u.id = quien.usuario_id
       WHERE v.estado IN ('vendido', 'entregado') AND venta.fecha IS NOT NULL AND substr(venta.fecha, 1, 7) = ?
       ORDER BY venta.fecha DESC, v.id DESC`));
  }
  return consultas.get(db);
}

// Las filas completas del coche (con su dinero: quien las use decide qué enseña), más fecha_venta,
// fecha_alta, vendio_id y vendio (nombre). `mes` es 'AAAA-MM'.
export function ventasDelMes(db, mes) {
  return consulta(db).all(mes);
}
