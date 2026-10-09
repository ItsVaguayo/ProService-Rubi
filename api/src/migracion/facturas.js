// Dueño: Victor. Las facturas que vienen de Pymecar (plantilla facturas.csv, docs/migracion.md). Pymecar no se
// renueva, así que sus facturas tienen que quedarse aquí: entran como emitidas, con su número de Pymecar
// (V25-00012), sus importes tal cual los calculó Pymecar, sus cobros y la copia congelada del cliente y del
// coche. Así salen en los libros de ingresos y de REBU, y la serie sigue por el número siguiente.
import { limpiarFactura } from '../modules/facturacion/campos.js';
import { importesFactura } from '../modules/facturacion/importes.js';
import { codigoDe, copiaDelCoche, FORMAS_COBRO } from '../modules/facturacion/routes.js';
import { normalizarNif } from '../modules/terceros/fiscal.js';
import { registrar } from '../modules/auditoria.js';

// «V26-00038», y también como sale en la lista de Pymecar: «F-V26-00038»
const CODIGO = /^(?:F-)?([VR])(\d{2})-(\d{1,5})$/;
const COLUMNAS = ['codigo', 'tipo', 'fecha', 'vencimiento', 'cliente_nif', 'matricula', 'regimen', 'precio', 'compra', 'base', 'iva_pct',
  'iva', 'suplidos', 'total', 'forma_pago', 'uso_destino', 'garantia_tipo', 'garantia_meses', 'km_entrega', 'observaciones',
  'rectifica', 'motivo', 'cobrado', 'fecha_cobro', 'forma_cobro'];
const IVAS = [0, 10, 21]; // los de Pymecar

const matriculaNormal = (t) => t.toUpperCase().replace(/[\s.-]/g, '');

/** Importe con signo: «-1.632,23» → -163223. Las rectificativas van en negativo. */
export function importeConSigno(texto, eurosACent) {
  const t = String(texto).trim();
  const negativo = t.startsWith('-');
  const cent = eurosACent(negativo ? t.slice(1) : t);
  return cent === null ? null : negativo ? -cent : cent;
}

export function importarFacturas(db, filas, { informe, usuarioId, eurosACent, dia }) {
  const t = informe.facturas;
  if (!filas.length) return;
  if (!usuarioId) {
    informe.errores.push({ fichero: 'facturas.csv', fila: 1, errores: ['Hace falta un usuario de gerencia activo: las facturas se apuntan a su nombre'] });
    return;
  }
  const empresa = JSON.stringify(db.prepare('SELECT * FROM empresa WHERE id = 1').get());
  const porCodigo = db.prepare('SELECT * FROM facturas WHERE codigo = ?');
  const cliente = db.prepare('SELECT * FROM clientes WHERE nif = ?');
  const coche = db.prepare('SELECT * FROM vehiculos WHERE matricula = ?');
  const series = new Map(); // serie → { tipo, anio, numeros: Set }
  const aviso = (n, texto) => informe.avisos.push({ fichero: 'facturas.csv', fila: n, aviso: texto });

  // Las de venta antes que las rectificativas: una rectificativa necesita que ya exista la que anula
  const ordenadas = filas.map((fila, i) => ({ fila, n: i + 2 }))
    .sort((a, b) => Number(CODIGO.exec(a.fila.codigo ?? '')?.[1] === 'R') - Number(CODIGO.exec(b.fila.codigo ?? '')?.[1] === 'R'));

  for (const { fila, n } of ordenadas) {
    const errores = [];
    for (const columna of Object.keys(fila)) if (fila[columna] !== '' && !COLUMNAS.includes(columna)) errores.push(`Columna desconocida: ${columna}`);
    const euros = (columna) => {
      if (!fila[columna]) return undefined;
      const v = importeConSigno(fila[columna], eurosACent);
      if (v === null) errores.push(`${columna} tiene que ser un importe en euros: «${fila[columna]}»`);
      return v ?? undefined;
    };

    const m = CODIGO.exec((fila.codigo ?? '').toUpperCase());
    if (!m) { errores.push(`codigo tiene que ser como V26-00038: «${fila.codigo ?? ''}»`); }
    const tipo = m?.[1] === 'R' ? 'rectificativa' : 'venta';
    if (fila.tipo && fila.tipo !== tipo) errores.push(`El código ${fila.codigo} es de una ${tipo}, no de una ${fila.tipo}`);
    const serie = m ? `${m[1]}${m[2]}` : null;
    const numero = m ? Number(m[3]) : null;
    const codigo = m ? codigoDe(serie, numero) : null;
    const signo = tipo === 'rectificativa' ? -1 : 1;

    const fecha = fila.fecha ? dia(fila.fecha) : null;
    if (!fecha) errores.push(`fecha tiene que ser una fecha: «${fila.fecha ?? ''}»`);
    else if (m && fecha.slice(2, 4) !== m[2]) aviso(n, `${codigo} es de la serie de 20${m[2]} y su fecha es del ${fecha.slice(0, 4)}`);

    // Lo que también se puede escribir desde el panel pasa por su lista blanca
    const cuerpo = {};
    for (const c of ['forma_pago', 'uso_destino', 'garantia_tipo', 'observaciones']) if (fila[c]) cuerpo[c] = fila[c];
    for (const c of ['garantia_meses', 'km_entrega']) {
      if (!fila[c]) continue;
      const v = Number(fila[c].replace(/[.\s]/g, ''));
      cuerpo[c] = Number.isInteger(v) ? v : fila[c];
    }
    if (fila.vencimiento) cuerpo.vencimiento = dia(fila.vencimiento) ?? fila.vencimiento;
    const { datos, errores: deCampos } = limpiarFactura(cuerpo);
    errores.push(...deCampos);

    const c = fila.cliente_nif ? cliente.get(normalizarNif(fila.cliente_nif)) : null;
    if (!fila.cliente_nif) errores.push('Falta cliente_nif: una factura emitida lleva el NIF del cliente');
    else if (!c) errores.push(`No hay ningún cliente con NIF ${fila.cliente_nif}`);
    const v = fila.matricula ? coche.get(matriculaNormal(fila.matricula)) : null;
    if (fila.matricula && !v) errores.push(`No hay ningún coche con matrícula ${fila.matricula}`);

    const regimen = fila.regimen || 'REBU';
    if (!['REBU', 'general'].includes(regimen)) errores.push('regimen tiene que ser REBU o general');
    const ivaPct = fila.iva_pct ? Number(fila.iva_pct) : 21;
    if (!IVAS.includes(ivaPct)) errores.push(`iva_pct tiene que ser ${IVAS.join(', ')}`);

    // Importes: los de Pymecar mandan. Si falta alguno, se calcula como lo haría la plataforma.
    const precio = euros('precio');
    const suplidos = euros('suplidos') ?? 0;
    if (precio === undefined && !errores.some((e) => e.startsWith('precio'))) errores.push('Falta el precio');
    for (const [nombre, valor] of [['precio', precio], ['suplidos', suplidos]]) {
      if (valor && Math.sign(valor) !== signo) errores.push(`${nombre} va ${signo < 0 ? 'en negativo en una rectificativa' : 'en positivo en una factura de venta'}`);
    }

    let original = null;
    if (tipo === 'rectificativa') {
      const r = CODIGO.exec((fila.rectifica ?? '').toUpperCase());
      original = r ? porCodigo.get(codigoDe(`${r[1]}${r[2]}`, Number(r[3]))) : null;
      if (!fila.rectifica) errores.push('Una rectificativa necesita rectifica: el código de la factura que anula');
      else if (!original || original.tipo !== 'venta') errores.push(`No hay ninguna factura de venta ${fila.rectifica}`);
      if (!fila.motivo) errores.push('Una rectificativa necesita el motivo');
    } else if (fila.rectifica || fila.motivo) errores.push('rectifica y motivo solo van en una rectificativa');

    const compraFicha = v ? (v.propiedad === 'deposito' ? v.pago_propietario_cent : v.precio_compra_cent) : null;
    const compra = regimen !== 'REBU' ? null
      : euros('compra') ?? (original ? original.compra_cent && -original.compra_cent : compraFicha == null ? null : signo * compraFicha);
    if (regimen === 'REBU' && compra == null && !errores.length) aviso(n, 'REBU sin precio de compra: en el libro REBU saldrá sin compra');

    if (errores.length) { informe.errores.push({ fichero: 'facturas.csv', fila: n, errores }); continue; }

    const calculado = importesFactura({ regimen, precio_cent: Math.abs(precio), compra_cent: compra == null ? null : Math.abs(compra),
      suplidos_cent: Math.abs(suplidos), iva_pct: ivaPct });
    const importes = {};
    for (const [campo, columna] of [['base_cent', 'base'], ['iva_cent', 'iva'], ['total_cent', 'total']]) {
      const dado = euros(columna);
      importes[campo] = dado ?? signo * calculado[campo];
      if (dado !== undefined && Math.abs(dado - signo * calculado[campo]) > 1) {
        aviso(n, `${columna} de Pymecar (${(dado / 100).toFixed(2)}) no cuadra con la cuenta de la plataforma (${(signo * calculado[campo] / 100).toFixed(2)}): se deja el de Pymecar`);
      }
    }
    if (errores.length) { informe.errores.push({ fichero: 'facturas.csv', fila: n, errores }); continue; }

    if (porCodigo.get(codigo)) { t.ya_estaban++; continue; }

    const nueva = {
      tipo, estado: 'emitida', serie, numero, codigo, fecha, cliente_id: c.id, vehiculo_id: v?.id ?? original?.vehiculo_id ?? null,
      rectifica_id: original?.id ?? null, motivo: fila.motivo || null, regimen, precio_cent: precio, compra_cent: compra,
      iva_pct: ivaPct, suplidos_cent: suplidos, ...importes, ...datos,
      datos_empresa: empresa, datos_cliente: JSON.stringify(c), datos_vehiculo: JSON.stringify(copiaDelCoche(db, v)),
      creado_por: usuarioId, emitida_por: usuarioId, emitida_en: `${fecha} 12:00:00`,
    };
    // La serie existe antes de la factura (clave foránea); su último número se ajusta al final
    db.prepare('INSERT OR IGNORE INTO series (serie, tipo, anio, ultimo) VALUES (?, ?, ?, 0)').run(serie, tipo, 2000 + Number(m[2]));
    let id;
    try {
      const columnas = Object.keys(nueva);
      id = Number(db.prepare(`INSERT INTO facturas (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`)
        .run(...columnas.map((k) => nueva[k])).lastInsertRowid);
    } catch (e) {
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
      informe.errores.push({ fichero: 'facturas.csv', fila: n, errores: [`La base no la acepta: ${e.message}`] });
      continue;
    }

    // Cobro: por defecto, cobrada entera (son facturas ya cerradas en Pymecar). «cobrado» = 0 la deja pendiente.
    if (tipo === 'venta') {
      const cobrado = fila.cobrado ? importeConSigno(fila.cobrado, eurosACent) : importes.total_cent;
      const forma = fila.forma_cobro || datos.forma_pago || 'transferencia';
      const fechaCobro = fila.fecha_cobro ? dia(fila.fecha_cobro) : fecha;
      const mal = [];
      if (cobrado === null || cobrado < 0 || cobrado > importes.total_cent) mal.push(`cobrado tiene que ir de 0 al total: «${fila.cobrado}»`);
      if (!FORMAS_COBRO.includes(forma)) mal.push(`forma_cobro tiene que ser ${FORMAS_COBRO.join(', ')}`);
      if (!fechaCobro) mal.push(`fecha_cobro tiene que ser una fecha: «${fila.fecha_cobro}»`);
      if (mal.length) { informe.errores.push({ fichero: 'facturas.csv', fila: n, errores: mal }); continue; }
      if (cobrado > 0) {
        db.prepare("INSERT INTO cobros (factura_id, fecha, importe_cent, forma_pago, nota, creado_por) VALUES (?, ?, ?, ?, 'De Pymecar', ?)")
          .run(id, fechaCobro, cobrado, forma, usuarioId);
        t.cobros++;
      }
    }
    // Como al emitir desde el panel: el cliente queda como comprador del coche, si no lo tenía ya
    if (tipo === 'venta' && v && !v.comprador_id) db.prepare('UPDATE vehiculos SET comprador_id = ? WHERE id = ?').run(c.id, v.id);
    registrar(db, { usuarioId: null, entidad: 'factura', entidadId: id, accion: 'migracion', despues: { fila: n, codigo } });
    if (!series.has(serie)) series.set(serie, new Set());
    series.get(serie).add(numero);
    t.nuevos++;
  }

  // Cada serie sigue por el número siguiente al más alto. Y si faltan números, se avisa: el export está incompleto.
  for (const [serie, numeros] of series) {
    const todos = new Set([...numeros, ...db.prepare('SELECT numero FROM facturas WHERE serie = ?').all(serie).map((f) => f.numero)]);
    const max = Math.max(...todos);
    db.prepare('UPDATE series SET ultimo = MAX(ultimo, ?) WHERE serie = ?').run(max, serie);
    const faltan = [];
    for (let i = 1; i <= max && faltan.length < 20; i++) if (!todos.has(i)) faltan.push(codigoDe(serie, i));
    if (faltan.length) aviso(0, `En la serie ${serie} faltan números: ${faltan.join(', ')}${faltan.length === 20 ? '…' : ''}. Hacienda pide la numeración sin huecos: ¿el export está completo?`);
  }
}
