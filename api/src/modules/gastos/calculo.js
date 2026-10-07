// Dueño: David. Importes y reglas del libro de gastos (T14). Todo en céntimos enteros y en el servidor.

// Si no llega el tipo, sale del concepto (como en Pymecar)
const TIPO_POR_CONCEPTO = { alquileres: 'irpf', gestorias: 'irpf', comisiones: 'comision', vehiculos: 'vehiculo', compras: 'rebu' };

/** IVA, IRPF y total de una base. Se redondea una vez cada importe: 33,33 € al 21 % → 7,00 € (6,9993). */
export function importes({ base_cent, iva_pct, irpf_pct }) {
  const iva_cent = Math.round((base_cent * iva_pct) / 100);
  const irpf_cent = Math.round((base_cent * irpf_pct) / 100);
  return { iva_cent, irpf_cent, total_cent: base_cent + iva_cent - irpf_cent };
}

/** Los valores por defecto de un alta: el tipo según el concepto y los porcentajes según el tipo. */
export function conDefectos(datos) {
  const d = { ...datos };
  if (d.tipo == null && d.concepto) d.tipo = TIPO_POR_CONCEPTO[d.concepto] ?? 'general';
  if (d.irpf_pct == null) d.irpf_pct = d.tipo === 'irpf' ? (d.concepto === 'alquileres' ? 19 : 15) : 0;
  if (d.iva_pct == null) d.iva_pct = d.tipo === 'rebu' ? 0 : 21;
  return d;
}

/** Lo que incumple un gasto completo (alta, o lo que había más lo que cambia). Vacío = vale. */
export function reglasIncumplidas(g) {
  const errores = [];
  for (const [campo, texto] of [['fecha', 'la fecha'], ['tipo', 'el tipo'], ['concepto', 'el concepto'], ['base_cent', 'la base'], ['iva_pct', 'el IVA (iva_pct)'], ['irpf_pct', 'el IRPF (irpf_pct)']]) {
    if (g[campo] == null) errores.push(`Falta ${texto}`);
  }
  switch (g.tipo) {
    case 'general':
      if (g.irpf_pct !== 0) errores.push('Un gasto general no lleva IRPF: irpf_pct tiene que ser 0 (si lo lleva, el tipo es irpf)');
      break;
    case 'irpf':
      if (!(g.irpf_pct > 0)) errores.push('Un gasto con IRPF necesita un porcentaje de IRPF (7, 15 o 19)');
      break;
    case 'comision':
      if (g.proveedor_id == null && g.usuario_id == null) errores.push('Una comisión necesita a quién se paga: proveedor_id (un comisionista) o usuario_id (un comercial)');
      break;
    case 'rebu':
      if (g.vehiculo_id == null) errores.push('Una factura con REBU es la compra de un coche: hace falta vehiculo_id');
      if (g.iva_pct !== 0 || g.irpf_pct !== 0) errores.push('En REBU la factura no lleva IVA ni IRPF: iva_pct e irpf_pct tienen que ser 0');
      break;
    case 'vehiculo':
      if (g.vehiculo_id == null) errores.push('Un gasto de vehículo necesita el coche: vehiculo_id');
      break;
  }
  return errores;
}
