// Dueño: Victor. Carga de lo que viene de Pymecar (plan, semana 4): proveedores, clientes y coches (el stock
// vivo y el histórico de ventas). Lee las plantillas CSV de docs/migracion/ (ver docs/migracion.md), no el export tal
// cual: ese formato aún no lo tenemos (duda B7). Cuando llegue, se pasa a estas plantillas y esto no cambia.
//
// Reglas:
//   · Cada fila pasa por las mismas validaciones que la API (limpiarDatos, limpiarTercero).
//   · O entra todo o nada: con un solo error no se guarda ninguna fila. En ensayo nunca se guarda nada.
//   · Lo que ya está (coche con esa matrícula, cliente o proveedor con ese NIF) no se duplica: se salta.
//     Así se puede repetir la carga del miércoles 28 sobre la del ensayo del martes.
//   · Los coches entran sin fotos (duda D6) y sin costes: los costes viven en el libro de gastos, con su
//     fecha, y van con la migración de ese libro. Un coche «a la venta» sin fotos entra en «Pendiente de fotos».
//   · Un coche con fecha de venta es una venta del histórico: entra «Entregado», con su historial fechado, para
//     que cuente en los informes del mes en que se vendió y no salga en la web.
import { CAMPOS, limpiarDatos } from '../modules/vehiculos/campos.js';
import { faltanParaPublicar } from '../modules/vehiculos/reglas.js';
import { CAMPOS_CLIENTE, CAMPOS_PROVEEDOR, limpiarTercero } from '../modules/terceros/campos.js';
import { normalizarNif } from '../modules/terceros/fiscal.js';
import { ESTADOS, ESTADOS_WEB } from '../modules/estados.js';
import { diaValido } from '../fechas.js';
import { registrar } from '../modules/auditoria.js';

const IDS_ESTADO = ESTADOS.map((e) => e.id);
// En la plantilla el dinero va en euros, como en Excel: «pvp» y no «pvp_cent»
export const EUROS = ['precio_compra', 'pvp', 'precio_financiado', 'precio_minimo', 'pago_propietario'];
const COSTES = ['coste_transporte', 'coste_taller', 'coste_preparacion', 'coste_impuestos'];
const EXTRA_COCHE = ['estado', 'proveedor_nif', 'comprador_nif', 'fecha_alta', 'fecha_venta', 'ref_pymecar'];

class Ensayo extends Error {}

/** «12.900,50», «12900.5» o «12900» → 1290050 céntimos. null si no es un importe. */
export function eurosACent(texto) {
  let t = String(texto).replace(/[\s€]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0')) : null;
}

/** «2021-03-10», «10/03/2021» o «10-03-2021» → '2021-03-10'. null si no es un día que exista. */
export function dia(texto) {
  const t = String(texto).trim();
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t;
  return diaValido(iso) ? iso : null;
}

const entero = (texto) => (/^-?\d+$/.test(String(texto).replace(/[.\s]/g, '')) ? Number(String(texto).replace(/[.\s]/g, '')) : null);

// --- Proveedores y clientes ---------------------------------------------------------------------------

function importarTerceros(db, filas, { tabla, campos, informe }) {
  const porNif = db.prepare(`SELECT id FROM ${tabla} WHERE nif = ?`);
  const porNombreTelefono = db.prepare(`SELECT id FROM ${tabla} WHERE nif IS NULL AND nombre = ? AND telefono IS ?`);
  filas.forEach((fila, i) => {
    const n = i + 2; // la fila 1 es la cabecera
    const cuerpo = {};
    const errores = [];
    for (const [columna, valor] of Object.entries(fila)) {
      if (valor === '') continue;
      if (!campos[columna] || columna === 'activo') { errores.push(`Columna desconocida: ${columna}`); continue; }
      cuerpo[columna] = valor;
    }
    const { datos, errores: deCampos } = limpiarTercero(cuerpo, campos);
    errores.push(...deCampos);
    if (errores.length) return informe.errores.push({ fichero: `${tabla}.csv`, fila: n, errores });

    const existente = datos.nif ? porNif.get(datos.nif) : porNombreTelefono.get(datos.nombre, datos.telefono ?? null);
    if (existente) { informe[tabla].ya_estaban++; return; }
    const columnas = Object.keys(datos);
    let id;
    try {
      id = Number(db.prepare(`INSERT INTO ${tabla} (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => datos[c])).lastInsertRowid);
    } catch (e) {
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
      return informe.errores.push({ fichero: `${tabla}.csv`, fila: n, errores: [`La base no lo acepta: ${e.message}`] });
    }
    registrar(db, { usuarioId: null, entidad: tabla === 'clientes' ? 'cliente' : 'proveedor', entidadId: id, accion: 'migracion', despues: { fila: n } });
    informe[tabla].nuevos++;
  });
}

// --- Coches -----------------------------------------------------------------------------------------

function importarCoches(db, filas, informe) {
  const porMatricula = db.prepare('SELECT id FROM vehiculos WHERE matricula = ?');
  const proveedor = db.prepare('SELECT id FROM proveedores WHERE nif = ?');
  const cliente = db.prepare('SELECT id FROM clientes WHERE nif = ?');
  const historial = db.prepare('INSERT INTO historial_estados (vehiculo_id, de, a, usuario_id, fecha) VALUES (?, ?, ?, NULL, ?)');
  const aviso = (n, texto) => informe.avisos.push({ fichero: 'vehiculos.csv', fila: n, aviso: texto });

  filas.forEach((fila, i) => {
    const n = i + 2;
    const errores = [];
    const cuerpo = {};
    for (const [columna, valor] of Object.entries(fila)) {
      if (valor === '' || EXTRA_COCHE.includes(columna)) continue;
      if (COSTES.includes(columna)) { errores.push(`${columna}: los costes van con el libro de gastos, no en la ficha`); continue; }
      if (EUROS.includes(columna)) {
        const cent = eurosACent(valor);
        if (cent === null) errores.push(`${columna} tiene que ser un importe en euros: «${valor}»`);
        else cuerpo[`${columna}_cent`] = cent;
        continue;
      }
      const def = CAMPOS[columna];
      if (!def || def.tipo === 'cent') { errores.push(`Columna desconocida: ${columna}`); continue; }
      if (def.tipo === 'entero') {
        const v = entero(valor);
        if (v === null) errores.push(`${columna} tiene que ser un número entero: «${valor}»`);
        else cuerpo[columna] = v;
      } else if (def.tipo === 'fecha') {
        const v = dia(valor);
        if (!v) errores.push(`${columna} tiene que ser una fecha: «${valor}»`);
        else cuerpo[columna] = v;
      } else cuerpo[columna] = valor;
    }
    const { datos, errores: deCampos } = limpiarDatos(cuerpo, { puedeDinero: true });
    errores.push(...deCampos);

    // Fechas y estado
    const alta = fila.fecha_alta ? dia(fila.fecha_alta) : null;
    const venta = fila.fecha_venta ? dia(fila.fecha_venta) : null;
    if (fila.fecha_alta && !alta) errores.push(`fecha_alta tiene que ser una fecha: «${fila.fecha_alta}»`);
    if (fila.fecha_venta && !venta) errores.push(`fecha_venta tiene que ser una fecha: «${fila.fecha_venta}»`);
    if (alta && venta && venta < alta) errores.push('fecha_venta es anterior a fecha_alta');
    let estado = fila.estado || (venta ? 'entregado' : 'recibido');
    if (!IDS_ESTADO.includes(estado)) errores.push(`estado no válido: «${fila.estado}»`);
    else if (venta && !['vendido', 'entregado'].includes(estado)) errores.push(`Tiene fecha de venta y el estado es «${estado}»`);
    else if (!venta && ['vendido', 'entregado'].includes(estado)) errores.push(`Está ${estado} pero falta fecha_venta`);

    // Proveedor y comprador, por NIF (de los que ya están o de los de este mismo envío)
    if (fila.proveedor_nif) {
      const p = proveedor.get(normalizarNif(fila.proveedor_nif));
      if (!p) errores.push(`No hay ningún proveedor con NIF ${fila.proveedor_nif}`);
      else datos.proveedor_id = p.id;
    }
    if (fila.comprador_nif) {
      const c = cliente.get(normalizarNif(fila.comprador_nif));
      if (!c) errores.push(`No hay ningún cliente con NIF ${fila.comprador_nif}`);
      else datos.comprador_id = c.id;
    }
    if (errores.length) return informe.errores.push({ fichero: 'vehiculos.csv', fila: n, errores });

    if (porMatricula.get(datos.matricula)) { informe.vehiculos.ya_estaban++; return; }

    // Sin fotos no puede estar en la web: los que estaban a la venta esperan sus fotos
    if (ESTADOS_WEB.includes(estado) && estado !== 'vendido') {
      const faltan = faltanParaPublicar(datos);
      aviso(n, `Entra en «Pendiente de fotos» y no en «${estado}»: llega sin fotos${faltan.length ? ` y le falta ${faltan.join(', ')}` : ''}`);
      estado = 'pendiente_fotos';
    }
    if (estado === 'vendido') aviso(n, 'Entra «Vendido»: sale en la web como vendido hasta que pase a «Entregado»');

    const fechaAlta = `${alta ?? new Date().toISOString().slice(0, 10)} 12:00:00`;
    const nueva = { ...datos, estado, creado_en: fechaAlta, actualizado_en: fechaAlta };
    const columnas = Object.keys(nueva);
    let id;
    try {
      id = Number(db.prepare(`INSERT INTO vehiculos (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((c) => nueva[c])).lastInsertRowid);
    } catch (e) {
      // Un valor fuera de lista (cambio, etiqueta…) o un bastidor repetido: error de la fila, no de la carga
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
      informe.avisos = informe.avisos.filter((a) => !(a.fichero === 'vehiculos.csv' && a.fila === n));
      return informe.errores.push({ fichero: 'vehiculos.csv', fila: n, errores: [`La base no lo acepta: ${e.message}`] });
    }
    db.prepare("UPDATE vehiculos SET referencia = printf('PS-%05d', id) WHERE id = ?").run(id);

    // Historial: entra el día del alta; una venta, el día de la venta (es lo que cuentan los informes)
    if (venta) {
      historial.run(id, null, 'recibido', fechaAlta);
      historial.run(id, 'recibido', 'vendido', `${venta} 12:00:00`);
      if (estado === 'entregado') historial.run(id, 'vendido', 'entregado', `${venta} 12:00:01`);
    } else historial.run(id, null, estado, fechaAlta);

    registrar(db, { usuarioId: null, entidad: 'vehiculo', entidadId: id, accion: 'migracion', despues: { fila: n, ref_pymecar: fila.ref_pymecar || null } });
    informe.vehiculos.nuevos++;
    if (venta) informe.vehiculos.vendidos++;
  });
}

/**
 * Carga lo que llega: { proveedores, clientes, vehiculos }, cada uno una lista de filas de leerCsv (o vacía).
 * Devuelve el informe: cuántos entran, cuántos ya estaban, errores y avisos por fila, y si se guardó.
 */
export function importar(db, { proveedores = [], clientes = [], vehiculos = [] }, { ensayo = true } = {}) {
  const informe = {
    ensayo, aplicado: false,
    proveedores: { leidos: proveedores.length, nuevos: 0, ya_estaban: 0 },
    clientes: { leidos: clientes.length, nuevos: 0, ya_estaban: 0 },
    vehiculos: { leidos: vehiculos.length, nuevos: 0, ya_estaban: 0, vendidos: 0 },
    errores: [], avisos: [],
  };
  try {
    db.transaction(() => {
      importarTerceros(db, proveedores, { tabla: 'proveedores', campos: CAMPOS_PROVEEDOR, informe });
      importarTerceros(db, clientes, { tabla: 'clientes', campos: CAMPOS_CLIENTE, informe });
      importarCoches(db, vehiculos, informe);
      if (ensayo || informe.errores.length) throw new Ensayo(); // deshace todo
    })();
    informe.aplicado = true;
  } catch (e) {
    if (!(e instanceof Ensayo)) throw e;
  }
  return informe;
}
