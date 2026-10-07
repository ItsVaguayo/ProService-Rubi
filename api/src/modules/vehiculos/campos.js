// Lista blanca de campos de la ficha. Solo lo que está aquí puede escribirse desde la API:
// los nombres de columna nunca salen del cuerpo de la petición.
//
// tipo: texto | entero | cent (céntimos, entero ≥ 0) | fecha (AAAA-MM-DD)
// dinero: true → solo lo ve y lo escribe gerencia (11.2)

export const CAMPOS = {
  propiedad: { tipo: 'texto' },

  // 3.1 Identificación
  matricula: { tipo: 'texto', normalizar: 'codigo' },
  bastidor: { tipo: 'texto', normalizar: 'codigo' },
  marca: { tipo: 'texto' },
  modelo: { tipo: 'texto' },
  version: { tipo: 'texto' },
  anio: { tipo: 'entero' },
  fecha_matriculacion: { tipo: 'fecha' },
  kilometros: { tipo: 'entero' },

  // 3.2 Mecánica
  combustible: { tipo: 'texto' },
  cambio: { tipo: 'texto' },
  potencia_cv: { tipo: 'entero' },
  cilindrada: { tipo: 'entero' },
  traccion: { tipo: 'texto' },
  emisiones_co2: { tipo: 'entero' },
  etiqueta_dgt: { tipo: 'texto' },

  // 3.3 Carrocería
  carroceria: { tipo: 'texto' },
  puertas: { tipo: 'entero' },
  plazas: { tipo: 'entero' },
  color_exterior: { tipo: 'texto' },
  tapiceria: { tipo: 'texto' },
  llantas: { tipo: 'texto' },

  // 3.4 Estado y documentación
  ultima_revision: { tipo: 'fecha' },
  itv_caducidad: { tipo: 'fecha' },
  itv_ultima: { tipo: 'fecha' }, // 0015, como en Pymecar: sale en el contrato
  uso_anterior: { tipo: 'texto' }, // 0015: particular o profesional (la base lo comprueba)
  danos: { tipo: 'texto' },
  garantia_meses: { tipo: 'entero' },
  ubicacion: { tipo: 'texto' },
  num_llaves: { tipo: 'entero' },

  // Depósito
  propietario_nombre: { tipo: 'texto', dinero: true },
  propietario_telefono: { tipo: 'texto', dinero: true },
  pago_propietario_cent: { tipo: 'cent', dinero: true },

  // Coches propios: a quién se le compró (migración 0004)
  proveedor_nombre: { tipo: 'texto', dinero: true },
  proveedor_telefono: { tipo: 'texto', dinero: true },
  proveedor_id: { tipo: 'entero', dinero: true }, // ficha de proveedores (0008)

  // A quién se vendió (0008)
  comprador_id: { tipo: 'entero' },

  // 3.5 Dinero
  precio_compra_cent: { tipo: 'cent', dinero: true },
  // Los cuatro costes no son columnas: viven en el libro de gastos (vehiculos/costes.js, migración 0012)
  coste_transporte_cent: { tipo: 'cent', dinero: true },
  coste_taller_cent: { tipo: 'cent', dinero: true },
  coste_preparacion_cent: { tipo: 'cent', dinero: true },
  coste_impuestos_cent: { tipo: 'cent', dinero: true },
  pvp_cent: { tipo: 'cent' }, // el PVP sale en la web: lo ve todo el mundo
  precio_financiado_cent: { tipo: 'cent' },
  precio_minimo_cent: { tipo: 'cent', dinero: true },
  regimen_iva: { tipo: 'texto', dinero: true },

  video_url: { tipo: 'texto' },
};

export const CAMPOS_DINERO = Object.keys(CAMPOS).filter((c) => CAMPOS[c].dinero);

// Duda C1: para dar de alta basta con esto. Todo lo demás se exige al publicar.
export const OBLIGATORIOS_ALTA = ['matricula', 'marca', 'modelo'];

// Lo que el cliente marcó como obligatorio (3.1 a 3.3), más lo mínimo para vender.
// Si cambia la respuesta del cliente, se cambia esta lista y nada más.
export const OBLIGATORIOS_PUBLICAR = [
  'matricula', 'bastidor', 'marca', 'modelo', 'version', 'anio', 'fecha_matriculacion', 'kilometros',
  'combustible', 'cambio', 'potencia_cv', 'cilindrada', 'traccion', 'emisiones_co2', 'etiqueta_dgt',
  'carroceria', 'puertas', 'plazas', 'color_exterior', 'tapiceria', 'llantas',
  'ubicacion', 'pvp_cent', 'regimen_iva',
];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function normalizarCodigo(texto) {
  return texto.toUpperCase().replace(/[\s.-]/g, '');
}

// Devuelve { datos, errores }. `datos` solo lleva campos de la lista blanca, ya convertidos.
// Con `parcial` (edición) no se exigen los obligatorios del alta.
export function limpiarDatos(cuerpo, { parcial = false, puedeDinero = false } = {}) {
  const errores = [];
  const datos = {};

  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { datos, errores: ['El cuerpo tiene que ser un objeto'] };
  }

  for (const [campo, valor] of Object.entries(cuerpo)) {
    const def = CAMPOS[campo];
    if (!def) {
      errores.push(`Campo desconocido: ${campo}`);
      continue;
    }
    if (def.dinero && !puedeDinero) {
      errores.push(`Sin permiso para ${campo}`);
      continue;
    }
    if (valor === null || valor === '') {
      datos[campo] = null;
      continue;
    }
    switch (def.tipo) {
      case 'texto':
        if (typeof valor !== 'string') errores.push(`${campo} tiene que ser texto`);
        else datos[campo] = def.normalizar === 'codigo' ? normalizarCodigo(valor) : valor.trim();
        break;
      case 'entero':
        if (!Number.isInteger(valor)) errores.push(`${campo} tiene que ser un número entero`);
        else datos[campo] = valor;
        break;
      case 'cent':
        if (!Number.isInteger(valor) || valor < 0) errores.push(`${campo} tiene que ser un entero de céntimos ≥ 0`);
        else datos[campo] = valor;
        break;
      case 'fecha':
        if (typeof valor !== 'string' || !FECHA.test(valor)) errores.push(`${campo} tiene que ser una fecha AAAA-MM-DD`);
        else datos[campo] = valor;
        break;
    }
  }

  if (!parcial) {
    for (const campo of OBLIGATORIOS_ALTA) {
      if (datos[campo] == null && !errores.some((e) => e.includes(campo))) errores.push(`Falta ${campo}`);
    }
  } else {
    for (const campo of OBLIGATORIOS_ALTA) {
      if (campo in datos && datos[campo] == null) errores.push(`${campo} no puede quedar vacío`);
    }
  }

  return { datos, errores };
}

// Quita el dinero interno a quien no es gerencia. Se aplica en TODAS las respuestas con coches.
export function quitarDinero(vehiculo) {
  const copia = { ...vehiculo };
  for (const campo of CAMPOS_DINERO) delete copia[campo];
  for (const calculado of ['coste_total_cent', 'coste_otros_cent', 'iva_venta_cent', 'margen_bruto_cent', 'margen_cent']) delete copia[calculado];
  return copia;
}
