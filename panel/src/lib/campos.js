// Bloques de la ficha (briefing 3.1 a 3.5). Cada id es el nombre que espera la API en
// api/src/modules/vehiculos/campos.js (rama develop). No se cambian sin avisar a Victor.
// "obligatorio" copia OBLIGATORIOS_ALTA de la API; el resto se exige al publicar.
// "cent": la API guarda céntimos y en pantalla se escriben euros (aCent y deCent, en formato.js).
// "si": el campo solo sale cuando otro campo tiene ese valor.

export const OPCIONES = {
  cambio: [['manual', 'Manual'], ['automatico', 'Automático']],
  etiqueta_dgt: [['0', '0 emisiones'], ['ECO', 'ECO'], ['C', 'C'], ['B', 'B'], ['SIN', 'Sin etiqueta']],
  ubicacion: [['patio_taller', 'Patio del taller'], ['parking', 'Parking']],
  regimen_iva: [['REBU', 'REBU'], ['deducible', 'IVA deducible']],
  propiedad: [['propio', 'Propio'], ['deposito', 'En depósito']],
};

// Sugerencias, no listas cerradas: en el esquema son texto libre.
export const SUGERENCIAS = {
  combustible: ['Gasolina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'GLP'],
  traccion: ['Delantera', 'Trasera', 'Total'],
  carroceria: ['Berlina', 'Compacto', 'Utilitario', 'SUV', 'Familiar', 'Monovolumen', 'Coupé', 'Cabrio', 'Pick-up', 'Furgoneta'],
};

export const BLOQUES = [
  {
    id: 'identificacion',
    titulo: 'Identificación',
    campos: [
      { id: 'matricula', label: 'Matrícula', obligatorio: true, tipo: 'matricula' },
      { id: 'bastidor', label: 'VIN (bastidor)', max: 17, mono: true },
      { id: 'referencia', label: 'Referencia interna', soloLectura: true, ayuda: 'Se genera al guardar (PS-00001)' },
      { id: 'marca', label: 'Marca', obligatorio: true },
      { id: 'modelo', label: 'Modelo', obligatorio: true },
      { id: 'version', label: 'Versión o acabado' },
      { id: 'anio', label: 'Año', tipo: 'number', min: 1950, max: 2100 },
      { id: 'fecha_matriculacion', label: 'Primera matriculación', tipo: 'date' },
      { id: 'kilometros', label: 'Kilómetros', tipo: 'number', min: 0, sufijo: 'km' },
    ],
  },
  {
    id: 'mecanica',
    titulo: 'Mecánica',
    campos: [
      { id: 'combustible', label: 'Combustible', tipo: 'sugerencia' },
      { id: 'cambio', label: 'Cambio', tipo: 'select' },
      { id: 'potencia_cv', label: 'Potencia', tipo: 'number', min: 0, sufijo: 'CV' },
      { id: 'cilindrada', label: 'Cilindrada', tipo: 'number', min: 0, sufijo: 'cm³' },
      { id: 'traccion', label: 'Tracción', tipo: 'sugerencia' },
      { id: 'emisiones_co2', label: 'Emisiones CO₂', tipo: 'number', min: 0, sufijo: 'g/km' },
      { id: 'etiqueta_dgt', label: 'Etiqueta DGT', tipo: 'select' },
    ],
  },
  {
    id: 'carroceria',
    titulo: 'Carrocería y equipamiento',
    campos: [
      { id: 'carroceria', label: 'Tipo de carrocería', tipo: 'sugerencia' },
      { id: 'puertas', label: 'Puertas', tipo: 'number', min: 1, max: 9 },
      { id: 'plazas', label: 'Plazas', tipo: 'number', min: 1, max: 9 },
      { id: 'color_exterior', label: 'Color exterior' },
      { id: 'tapiceria', label: 'Tapicería' },
      { id: 'llantas', label: 'Llantas' },
    ],
    pendiente: 'extras',
  },
  {
    id: 'documentacion',
    titulo: 'Estado y documentación',
    nota: 'No sale en la web, salvo el vídeo.',
    campos: [
      { id: 'ultima_revision', label: 'Última revisión', tipo: 'date' },
      { id: 'itv_caducidad', label: 'ITV (caduca)', tipo: 'date' },
      { id: 'garantia_meses', label: 'Garantía', tipo: 'number', min: 12, sufijo: 'meses', defecto: 12, ayuda: 'Mínimo 12 meses' },
      { id: 'ubicacion', label: 'Ubicación física', tipo: 'select' },
      { id: 'propiedad', label: 'Propiedad', tipo: 'select', defecto: 'propio' },
      { id: 'num_llaves', label: 'Llaves', tipo: 'number', min: 0 },
      { id: 'danos', label: 'Daños e historial', tipo: 'textarea', ancho: true },
      { id: 'video_url', label: 'Vídeo (enlace de YouTube)', tipo: 'url', ancho: true },
    ],
  },
  {
    id: 'venta',
    titulo: 'Precio de venta',
    nota: 'Lo ve todo el mundo y sale en la web.',
    campos: [
      { id: 'pvp_cent', label: 'Precio público', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'precio_financiado_cent', label: 'Precio financiado', tipo: 'number', cent: true, min: 0, sufijo: '€' },
    ],
  },
  {
    id: 'dinero',
    titulo: 'Dinero',
    nota: 'Solo gerencia.',
    soloGerencia: true,
    campos: [
      { id: 'regimen_iva', label: 'Régimen de IVA', tipo: 'select', defecto: 'REBU', ayuda: 'REBU por defecto hasta tener la regla (9.1)' },
      { id: 'precio_compra_cent', label: 'Precio de compra', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'propietario_nombre', label: 'Dueño del coche', si: ['propiedad', 'deposito'] },
      { id: 'propietario_telefono', label: 'Teléfono del dueño', tipo: 'tel', si: ['propiedad', 'deposito'] },
      { id: 'pago_propietario_cent', label: 'Se le paga al dueño', tipo: 'number', cent: true, min: 0, sufijo: '€', si: ['propiedad', 'deposito'] },
      { id: 'coste_transporte_cent', label: 'Transporte', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'coste_taller_cent', label: 'Taller o mecánica', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'coste_preparacion_cent', label: 'Preparación y limpieza', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'coste_impuestos_cent', label: 'Impuestos y gestoría', tipo: 'number', cent: true, min: 0, sufijo: '€' },
      { id: 'precio_minimo_cent', label: 'Mínimo aceptable', tipo: 'number', cent: true, min: 0, sufijo: '€' },
    ],
  },
];

// Un campo con "si" solo cuenta cuando se cumple su condición (los datos del dueño, solo en depósito).
export const campoVisible = (c, datos) => !c.si || datos[c.si[0]] === c.si[1];

export const TODOS_LOS_CAMPOS = BLOQUES.flatMap((b) => b.campos.map((c) => ({ ...c, bloque: b.id })));
