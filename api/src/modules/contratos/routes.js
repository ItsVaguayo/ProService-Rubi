// Dueño: Victor. Contratos (ampliación del 7-oct, bloque 5). Se genera uno con los datos de ese momento y
// se guarda escrito (plantillas.js): firmado en papel, ya no cambia. Número correlativo del año: C26-0001.
//
//   compraventa  Desde una factura de venta emitida: cliente, precio, cobros, garantía y km de la factura.
//   reserva      Del coche con su reserva y el cliente que se elija (la reserva solo guarda su nombre).
//   compra       Lo que Pro Service paga a un proveedor (particular o profesional) por un coche propio.
//   cesion       El coche en depósito: lo pactado con el dueño.
// Compra y cesión llevan el precio de compra: solo gerencia. Reserva y compraventa, los dos roles.
import { Router } from 'express';
import { registrar } from '../auditoria.js';
import { ENTERO, hoyLocal, diaValido } from '../../fechas.js';
import { escribirContrato, datosCoche } from './plantillas.js';

const TIPOS = ['reserva', 'compraventa', 'compra', 'cesion'];
const DE_GERENCIA = ['compra', 'cesion'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

class ErrorContrato extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

export function rutasContratos(db) {
  const r = Router();
  const esGerencia = (u) => u?.rol === 'gerencia';
  const uno = (sql, ...v) => db.prepare(sql).get(...v);
  const empresa = () => uno('SELECT * FROM empresa WHERE id = 1');

  const leer = (id) => {
    const c = uno(`SELECT c.*, u.nombre AS creado_por_nombre FROM contratos c LEFT JOIN usuarios u ON u.id = c.creado_por WHERE c.id = ?`, id);
    return c && { ...c, contenido: JSON.parse(c.contenido) };
  };

  // Reúne los datos de cada tipo. Lo que no haya sale como hueco para rellenar a mano, salvo lo imprescindible.
  const reunir = {
    compraventa(b) {
      if (!b.factura_id) throw new ErrorContrato(400, 'Falta la factura de la venta (factura_id)');
      const f = uno('SELECT * FROM facturas WHERE id = ?', b.factura_id);
      if (!f || f.tipo !== 'venta' || f.estado !== 'emitida') throw new ErrorContrato(409, 'El contrato de compraventa sale de una factura de venta emitida');
      if (uno('SELECT 1 FROM facturas WHERE rectifica_id = ?', f.id)) throw new ErrorContrato(409, `La ${f.codigo} está rectificada`);
      const v = uno('SELECT * FROM vehiculos WHERE id = ?', f.vehiculo_id);
      // La forma de pago: lo cobrado, por forma; y lo que falte, con la forma de la factura
      const cobros = db.prepare('SELECT forma_pago AS forma, SUM(importe_cent) AS importe_cent FROM cobros WHERE factura_id = ? GROUP BY forma_pago ORDER BY MIN(id)').all(f.id);
      const cobrado = cobros.reduce((s, k) => s + k.importe_cent, 0);
      const pagos = [...cobros, ...(f.total_cent - cobrado > 0 ? [{ forma: f.forma_pago ?? 'transferencia', importe_cent: f.total_cent - cobrado }] : [])];
      return {
        fila: { vehiculo_id: v.id, factura_id: f.id, cliente_id: f.cliente_id },
        datos: { cliente: JSON.parse(f.datos_cliente), vehiculo: datosCoche({ ...v, ...JSON.parse(f.datos_vehiculo) }, f.km_entrega),
          precio_cent: f.total_cent, pagos, garantia_tipo: f.garantia_tipo, garantia_meses: f.garantia_meses, probado: b.probado !== false },
      };
    },
    reserva(b) {
      const v = coche(b);
      const res = uno("SELECT * FROM reservas WHERE vehiculo_id = ? AND (activa = 1 OR cierre = 'vendida') ORDER BY fecha DESC, id DESC LIMIT 1", v.id);
      if (!res) throw new ErrorContrato(409, 'Este coche no tiene una reserva: se reserva desde su ficha');
      if (!b.cliente_id) throw new ErrorContrato(400, `Elige el cliente (la reserva solo dice «${res.cliente}»)`);
      const cliente = uno('SELECT * FROM clientes WHERE id = ?', b.cliente_id);
      if (!cliente) throw new ErrorContrato(400, 'Ese cliente no existe');
      return {
        fila: { vehiculo_id: v.id, reserva_id: res.id, cliente_id: cliente.id },
        datos: { cliente, vehiculo: datosCoche(v), precio_cent: v.pvp_cent, senal_cent: res.senal_cent, forma_senal: b.forma_pago ?? null,
          caduca: res.caduca_en ? res.caduca_en.slice(0, 10) : null },
      };
    },
    compra(b) {
      const v = coche(b);
      if (v.propiedad === 'deposito') throw new ErrorContrato(409, 'Este coche está en depósito: su contrato es el de cesión');
      const proveedor = b.proveedor_id ? uno('SELECT * FROM proveedores WHERE id = ?', b.proveedor_id)
        : v.proveedor_id ? uno('SELECT * FROM proveedores WHERE id = ?', v.proveedor_id) : null;
      if (b.proveedor_id && !proveedor) throw new ErrorContrato(400, 'Ese proveedor no existe');
      const vendedor = proveedor ?? { nombre: v.proveedor_nombre, telefono: v.proveedor_telefono };
      return {
        fila: { vehiculo_id: v.id, proveedor_id: proveedor?.id ?? null },
        datos: { proveedor: vendedor, vendedor_particular: proveedor ? proveedor.tipo === 'particular' : true, vehiculo: datosCoche(v),
          kilometros: v.kilometros, precio_cent: v.precio_compra_cent, forma_pago: b.forma_pago ?? 'transferencia' },
      };
    },
    cesion(b) {
      const v = coche(b);
      if (v.propiedad !== 'deposito') throw new ErrorContrato(409, 'Solo los coches en depósito llevan contrato de cesión');
      const proveedor = b.proveedor_id ? uno('SELECT * FROM proveedores WHERE id = ?', b.proveedor_id) : null;
      if (b.proveedor_id && !proveedor) throw new ErrorContrato(400, 'Ese proveedor no existe');
      return {
        fila: { vehiculo_id: v.id, proveedor_id: proveedor?.id ?? null },
        datos: { proveedor: proveedor ?? { nombre: v.propietario_nombre, telefono: v.propietario_telefono }, vehiculo: datosCoche(v),
          precio_cent: v.pago_propietario_cent, duracion_meses: Number.isInteger(b.duracion_meses) ? b.duracion_meses : 3 },
      };
    },
  };
  const coche = (b) => {
    if (!Number.isInteger(b.vehiculo_id)) throw new ErrorContrato(400, 'Falta el coche (vehiculo_id)');
    const v = uno('SELECT * FROM vehiculos WHERE id = ?', b.vehiculo_id);
    if (!v) throw new ErrorContrato(404, 'Ese coche no existe');
    return v;
  };

  // ?vehiculo= · ?factura=. El comercial solo ve los de reserva y compraventa.
  r.get('/', (req, res) => {
    const filtros = [];
    const valores = [];
    for (const [param, col] of [['vehiculo', 'vehiculo_id'], ['factura', 'factura_id']]) {
      const v = req.query[param];
      if (v === undefined) continue;
      if (typeof v !== 'string' || !ENTERO.test(v)) return res.status(400).json({ error: `${param} tiene que ser un número` });
      filtros.push(`${col} = ?`);
      valores.push(Number(v));
    }
    if (!esGerencia(req.usuario)) {
      filtros.push(`tipo NOT IN (${DE_GERENCIA.map(() => '?').join(',')})`);
      valores.push(...DE_GERENCIA);
    }
    const donde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    res.json(db.prepare(`SELECT id, tipo, codigo, fecha, hora, vehiculo_id, factura_id, reserva_id, cliente_id, proveedor_id, creado_en
                           FROM contratos ${donde} ORDER BY fecha DESC, id DESC`).all(...valores));
  });

  r.get('/:id', (req, res) => {
    if (!ENTERO.test(req.params.id)) return res.status(404).json({ error: 'No existe' });
    const c = leer(req.params.id);
    if (!c || (DE_GERENCIA.includes(c.tipo) && !esGerencia(req.usuario))) return res.status(404).json({ error: 'No existe' });
    res.json(c);
  });

  // { tipo, factura_id | vehiculo_id, cliente_id?, proveedor_id?, fecha?, hora?, probado?, forma_pago?,
  //   duracion_meses?, clausulas_adicionales? }
  r.post('/', (req, res) => {
    const b = req.body ?? {};
    if (!TIPOS.includes(b.tipo)) return res.status(400).json({ error: `tipo tiene que ser ${TIPOS.join(', ')}` });
    if (DE_GERENCIA.includes(b.tipo) && !esGerencia(req.usuario)) return res.status(403).json({ error: 'Los contratos de compra y de cesión son de gerencia' });
    const fecha = b.fecha ?? hoyLocal();
    const errores = [];
    if (typeof fecha !== 'string' || !diaValido(fecha)) errores.push('fecha tiene que ser AAAA-MM-DD');
    if (b.hora != null && (typeof b.hora !== 'string' || !HORA.test(b.hora))) errores.push('hora tiene que ser HH:MM');
    if (b.clausulas_adicionales != null && (typeof b.clausulas_adicionales !== 'string' || b.clausulas_adicionales.length > 4000)) errores.push('clausulas_adicionales tiene que ser texto');
    if (b.probado != null && typeof b.probado !== 'boolean') errores.push('probado tiene que ser true o false');
    if (errores.length) return res.status(400).json({ error: errores.join('. '), errores });

    try {
      const id = db.transaction(() => {
        const { fila, datos } = reunir[b.tipo](b);
        const contenido = escribirContrato(b.tipo, {
          ...datos, empresa: empresa(), fecha, hora: b.hora ?? null, clausulas_adicionales: b.clausulas_adicionales?.trim() || null,
        });
        const anio = Number(fecha.slice(0, 4));
        const numero = uno('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM contratos WHERE anio = ?', anio).n;
        const codigo = `C${String(anio).slice(2)}-${String(numero).padStart(4, '0')}`;
        const nuevo = Number(db.prepare(`INSERT INTO contratos (tipo, anio, numero, codigo, fecha, hora, vehiculo_id, factura_id, reserva_id, cliente_id,
                                           proveedor_id, contenido, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(b.tipo, anio, numero, codigo, fecha, b.hora ?? null, fila.vehiculo_id, fila.factura_id ?? null, fila.reserva_id ?? null,
            fila.cliente_id ?? null, fila.proveedor_id ?? null, JSON.stringify(contenido), req.usuario.id).lastInsertRowid);
        registrar(db, { usuarioId: req.usuario.id, entidad: 'contrato', entidadId: nuevo, accion: 'alta', despues: { codigo, tipo: b.tipo, ...fila } });
        return nuevo;
      })();
      res.status(201).json(leer(id));
    } catch (e) {
      if (e instanceof ErrorContrato) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  });

  return r;
}
