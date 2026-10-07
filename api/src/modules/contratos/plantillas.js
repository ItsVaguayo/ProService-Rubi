// Dueño: Victor. Los textos de los contratos. Cada plantilla recibe los datos ya reunidos (routes.js) y
// devuelve el contrato escrito: partes, coche, condiciones y cláusulas. Ese resultado se guarda tal cual
// al generar el contrato: si mañana cambia una plantilla, los contratos ya firmados no cambian.
//
//   compraventa  El texto que usan hoy en Pymecar (7-oct), con huecos para precio, pago, garantía y prueba.
//   reserva, compra, cesion  Redactados para la plataforma con el mismo estilo.
// TODOS pendientes de revisión por abogado (duda H3). En el de compraventa, las cláusulas 10, 11 y 12 de la
// garantía parecen de la ley anterior a la reforma de 2021: que lo mire antes de usarlo.

export const TITULOS = {
  reserva: 'Contrato de reserva de un vehículo usado',
  compraventa: 'Contrato de compraventa de un vehículo usado',
  compra: 'Contrato de compra de un vehículo usado',
  cesion: 'Contrato de cesión de un vehículo para su venta',
};

// La nota de la cabecera del contrato de compraventa de Pymecar
const NOTA_CONSUMIDORES = 'Modelo de contrato adaptado al Real Decreto Legislativo 1/2007, de 16 de noviembre, Ley general para la defensa de los consumidores y usuarios, aplicable exclusivamente a los compradores que sean personas físicas y que el uso del vehículo sea particular.';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaEscrita = (dia) => { const [a, m, d] = dia.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };
// «RUBÍ a 1 de octubre del 2026 (17:51 horas)», como en Pymecar
const lugarYFecha = (dia, hora) => { const [a, m, d] = dia.split('-').map(Number); return `RUBÍ a ${d} de ${MESES[m - 1]} del ${a}${hora ? ` (${hora} horas)` : ''}`; };
// 15.975 € o 15.975,50 €: como en los contratos de Pymecar
export function eurosTexto(cent) {
  if (cent == null) return '__________ €';
  const n = cent / 100;
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
}
const hueco = (valor, largo = 20) => (valor == null || valor === '' ? '_'.repeat(largo) : String(valor));
const FORMAS = { transferencia: 'TRANSFERENCIA', contado: 'CONTADO', tarjeta: 'TARJETA', a_la_vista: 'A LA VISTA', pago_30: 'PAGO A 30 DÍAS', pago_30_60: 'PAGO A 30 Y 60 DÍAS', financiera: 'FINANCIACIÓN', senal: 'SEÑAL' };

// Una parte del contrato (empresa, cliente, proveedor o dueño), con los mismos datos que la cabecera de los
// contratos de Pymecar. Lo que falte sale como hueco para rellenar a mano.
export function parte(rol, x, { empresa = false } = {}) {
  return {
    rol,
    nombre: hueco(empresa ? x?.razon_social : x?.nombre, 40),
    nif: hueco(x?.nif, 12),
    domicilio: hueco(x?.direccion, 40),
    municipio: hueco(x?.poblacion, 20),
    codigo_postal: hueco(x?.codigo_postal, 6),
    provincia: hueco(x?.provincia, 15),
    telefono: x?.telefono ?? null,
  };
}

// La clase del vehículo, como en Pymecar (TURISMOS), a partir de la carrocería de la ficha
const claseDe = (carroceria) => (/industrial|furgon|comercial/i.test(carroceria ?? '') ? 'Vehículo comercial' : 'Turismo');
// 'AAAA-MM-DD' → 'MM / AAAA', como la primera matriculación en Pymecar
const mesAnio = (dia) => (dia ? `${dia.slice(5, 7)} / ${dia.slice(0, 4)}` : null);
const diaEsp = (dia) => (dia ? dia.split('-').reverse().join('/') : null);

export function datosCoche(v, km) {
  return {
    clase: claseDe(v.carroceria), marca: v.marca, modelo: v.modelo, version: v.version ?? null,
    uso_anterior: v.uso_anterior ?? null, estado: 'Usado',
    itv_ultima: diaEsp(v.itv_ultima), itv_proxima: diaEsp(v.itv_caducidad),
    matricula: v.matricula, bastidor: hueco(v.bastidor, 17),
    kilometros: km ?? v.kilometros ?? null, primera_matriculacion: mesAnio(v.fecha_matriculacion),
    combustible: v.combustible ?? null, color: v.color_exterior ?? null,
  };
}

const intro = 'Ambas partes actúan en nombre propio y se reconocen mutuamente capacidad legal para la firma de este contrato.';
const cierre = 'Y para que conste y donde convenga, se extiende el presente contrato por duplicado y a un solo efecto, quedando un ejemplar en cada una de las partes interesadas.';

// --- Compraventa (Pymecar) ---
function compraventa(d) {
  const pagos = d.pagos.length ? d.pagos.map((p) => `${FORMAS[p.forma] ?? p.forma.toUpperCase()}: ${eurosTexto(p.importe_cent)}`) : [`${hueco(null, 15)}: ${eurosTexto(d.precio_cent)}`];
  return {
    partes: [parte('Vendedor', d.empresa, { empresa: true }), parte('Comprador', d.cliente)],
    intro: [
      'Ambas partes actúan en nombre propio. El vendedor actúa en este contrato como garante del vehículo, y el comprador por tratarse de un consumidor, como titular/beneficiario de la garantía. Se reconocen mutuamente capacidad legal para la firma de este contrato de compraventa, en el que se informa también de la garantía ofrecida y los derechos atribuidos al comprador.',
      'Puestos previamente de acuerdo, formalizan la compraventa con arreglo a las siguientes:',
    ],
    secciones: [
      {
        titulo: 'Cláusulas',
        items: [
          'El vendedor vende y entrega en este acto al comprador el vehículo que responde a los datos que figuran en el cuadro inmediatamente anterior, y declara que éste es de su legítima propiedad.',
          `El precio de la compraventa, teniendo en cuenta las características del vehículo, a su naturaleza de bien usado, al estado que presentan sus componentes, a su antigüedad y kilómetros recorridos, se pacta de común acuerdo en ${eurosTexto(d.precio_cent)} (IVA INCLUIDO).`,
          { texto: 'Forma de pago:', lista: pagos },
          'El vendedor manifiesta que sobre el vehículo no pesa ningún gravamen, impuesto ni débito de clase alguna pendiente de liquidación a fecha de este contrato, obligándose a estar de entera indemnidad a favor del comprador de cualquier reclamación.',
          'El vendedor facilita al comprador en este acto cuantos documentos son necesarios para que el vehículo quede inscrito a su nombre en la Dirección General de Tráfico.',
          'El comprador se hace cargo desde este momento de cuantas responsabilidades puedan contraerse como consecuencia de la propiedad del vehículo descrito que acepta, por su tenencia o uso.',
          `El vendedor manifiesta que el vehículo se entrega debidamente reacondicionado, con la ITV vigente, y en el estado descrito anteriormente, y el comprador ${d.probado ? 'sí' : 'no'} lo ha probado por sí mismo o por profesional de su confianza, y manifiesta estar informado en todos sus aspectos de estado, antigüedad y kilómetros recorridos.`,
          ...(d.garantia_tipo === 'sin' ? [] : [
            'El vehículo se entrega garantizado de acuerdo a lo previsto en la Ley de Garantías en los bienes de consumo.',
            `Las partes pactan en este acto la duración de la garantía en ${d.garantia_meses ?? 12} MESES. El cómputo de dicho plazo se inicia en la fecha de entrega del vehículo, que es la indicada en el presente contrato.`,
          ]),
        ],
      },
      {
        titulo: 'Derechos del comprador e información del contenido de la garantía',
        items: [
          'Durante el período de vigencia de la garantía, el comprador tendrá derecho a la reparación de la falta de conformidad.',
          'En el supuesto que la reparación efectuada no fuese satisfactoria y el vehículo no revistiese las condiciones óptimas para cumplir el uso al cual fuese destinado, el titular de la garantía tendrá derecho a la rebaja del precio o a la devolución del importe pagado, teniendo en cuenta en este supuesto que el mencionado vehículo no presente daños o desperfectos producidos posteriormente a su entrega.',
          'El vendedor responderá ante el comprador de las faltas de conformidad que existan en el momento de la entrega del vehículo.',
          'El comprador destinará el vehículo a su consumo privado adecuándolo al uso ordinario del vehículo, entendiendo por tal, en función de las características del vehículo, la circulación por vías urbanas e interurbanas.',
          'En caso de falta de conformidad, el comprador tendrá derecho a exigir la reparación del vehículo en plazo razonable, siendo por cuenta del vendedor la mano de obra, materiales, gastos de transporte e impuestos. A estos efectos y de común acuerdo entre las partes firmantes, se entenderá que el plazo de reparación estará en función de la importancia de la falta de conformidad detectada.',
          'En el supuesto de reparación del vehículo, en cuanto a las piezas de repuesto a utilizar - atendiendo a su naturaleza -, éstas deberán ser adecuadas al mismo. En su caso, y cuando ello sea posible y se obtengan los mismos resultados que los previstos para la pieza sustituida, el vendedor podrá usar piezas de repuesto reacondicionadas, reconstruidas o usadas.',
          'El comprador no podrá pedir la reparación del vehículo si resulta imposible o desproporcionada. Se considerará desproporcionada toda forma de saneamiento que imponga al vendedor costes que, en comparación con la otra forma de saneamiento, no sean razonables, teniendo en cuenta el valor que tendría el bien si no hubiera falta de conformidad, la relevancia de la falta de conformidad y si la forma de saneamiento alternativa se pudiese realizar sin inconvenientes mayores para el comprador.',
          'Las reparaciones por falta de conformidad deberán efectuarse en el establecimiento del vendedor o en aquellos talleres específicamente autorizados por éste en el momento de la avería, mediante autorización expresa.',
          'Toda reparación efectuada por el taller reparador en garantía, salvo el presupuesto previo, cumplirá los requisitos administrativos, es decir, orden de trabajo, resguardo de depósito, y factura con la especificación de "sin cargo" o "factura en garantía", o certificación de los trabajos realizados en garantía, siempre con detalle de las operaciones efectuadas.',
          'Durante los primeros seis meses, el vendedor deberá probar que la falta de conformidad no le es imputable. Transcurridos los primeros seis meses, será el comprador el que deba probar que la avería o defecto se debe a una falta de conformidad imputable al vendedor.',
          'Para hacer valer su derecho, el comprador deberá notificar la falta de conformidad en cualquier caso, en el plazo de dos meses, a contar desde la fecha de su conocimiento. Se recomienda, tratándose de un vehículo automóvil, poner a disposición del vendedor el vehículo a la mayor brevedad posible para evitar que una pequeña avería se convierta en un mal mayor y el tiempo y coste de reparación sea consecuentemente también mayor.',
          'En caso de transmisión a un tercero dentro del período de garantía, ésta quedará sin efecto.',
          {
            texto: 'No se considerará falta de conformidad en los siguientes casos:',
            lista: [
              'En aquellos daños que fueran conocidos por el comprador en el momento de la compraventa y dieron origen al precio de la misma, entre los que explícitamente se incluyen los relativos al aspecto interior y exterior y en su caso, los relacionados en el anexo al presente documento, y en general cuantos fueran susceptibles de observación estática y dinámica del vehículo.',
              'Los daños mecánicos producidos por desgaste normal, uso inadecuado, así como la inobservancia de las normas de mantenimiento facilitadas por el fabricante.',
              'Los daños causados en radiador, motor, cambio, diferencial u otros componentes, por falta de refrigeración o lubricantes.',
              'Los daños causados al vehículo por fuerza mayor, heladas, robo o tentativas de robo, accidente de circulación y otras circunstancias sobrevenidas no imputables al vendedor, sea o no el causante de los mismos el titular de la garantía.',
              'Los daños causados en el vehículo como consecuencia de falta intencionada o dolosa del comprador o terceras personas o cuando el vehículo haya participado en competiciones tanto oficiales como privadas.',
              'Cuando el vehículo haya sido transformado o modificado después de la compra, siempre que esta transformación guarde relación con la avería.',
              'Cuando la reparación a título de garantía se realizase fuera de los talleres del vendedor, salvo autorización expresa.',
            ],
          },
        ],
      },
    ],
    firmas: ['Firma y sello del vendedor', 'Firma del comprador'],
  };
}

// --- Reserva: el cliente deja una señal para que no se venda a otro ---
function reserva(d) {
  return {
    partes: [parte('Vendedor', d.empresa, { empresa: true }), parte('Comprador', d.cliente)],
    intro: [intro, 'Puestos previamente de acuerdo, formalizan la reserva del vehículo descrito con arreglo a las siguientes:'],
    secciones: [{
      titulo: 'Cláusulas',
      items: [
        `El vendedor reserva al comprador el vehículo descrito en el cuadro anterior, que se compromete a no vender a terceros mientras la reserva esté vigente, hasta el ${d.caduca ? fechaEscrita(d.caduca) : hueco(null, 20)} incluido.`,
        `El precio de venta pactado es de ${eurosTexto(d.precio_cent)} (IVA INCLUIDO).`,
        `El comprador entrega en este acto la cantidad de ${eurosTexto(d.senal_cent)} en concepto de señal, mediante ${FORMAS[d.forma_senal] ?? hueco(null, 15)}. Esta cantidad se descontará del precio en el momento de la compraventa.`,
        'Si el comprador no formalizara la compraventa dentro del plazo de la reserva por causa que no sea imputable al vendedor, perderá la señal entregada. Si fuera el vendedor quien no pudiera entregar el vehículo en las condiciones pactadas, devolverá la señal al comprador.',
        'La compraventa se formalizará mediante el correspondiente contrato, en el que se recogerán la forma de pago del resto del precio, la garantía y el estado del vehículo.',
      ],
    }],
    firmas: ['Firma y sello del vendedor', 'Firma del comprador'],
  };
}

// --- Compra: Pro Service compra el coche a un particular o a un profesional ---
function compra(d) {
  const particular = d.vendedor_particular;
  return {
    partes: [parte('Vendedor', d.proveedor), parte('Comprador', d.empresa, { empresa: true })],
    intro: [intro, 'Puestos previamente de acuerdo, formalizan la compraventa del vehículo descrito con arreglo a las siguientes:'],
    secciones: [{
      titulo: 'Cláusulas',
      items: [
        'El vendedor vende y entrega en este acto al comprador el vehículo descrito en el cuadro anterior, y declara que es de su legítima propiedad y que puede disponer libremente de él.',
        `El precio de la compraventa se pacta de común acuerdo en ${eurosTexto(d.precio_cent)}${particular ? '' : ', según la factura que emitirá el vendedor'}, que se paga mediante ${FORMAS[d.forma_pago] ?? hueco(null, 15)}.`,
        'El vendedor manifiesta que sobre el vehículo no pesa carga, gravamen, embargo, reserva de dominio ni débito alguno (impuestos, multas o cuotas de financiación) pendiente a la fecha de este contrato, y se obliga a responder frente al comprador de cualquier reclamación que tenga su origen en hechos anteriores a la entrega.',
        `El vendedor declara que los kilómetros que marca el vehículo, ${d.kilometros != null ? `${d.kilometros.toLocaleString('es-ES', { useGrouping: 'always' })} km,` : `${hueco(null, 10)} km,`} son los reales, y que no conoce defectos ocultos distintos de los indicados en este contrato o en su anexo.`,
        'El vendedor entrega en este acto el permiso de circulación, la ficha técnica con la ITV en vigor, las llaves y cuanta documentación sea necesaria para cambiar la titularidad en la Dirección General de Tráfico.',
        `El vendedor responde de las infracciones, sanciones y responsabilidades derivadas del uso del vehículo hasta el día y la hora de la entrega, ${d.hora ? `las ${d.hora} horas del ${fechaEscrita(d.fecha)}` : `que es la de firma de este contrato`}. Desde ese momento, el comprador se hace cargo de ellas.`,
        ...(particular ? ['Al tratarse de una venta entre un particular y una empresa, la operación no está sujeta a IVA. El comprador queda obligado a comunicar la transmisión a la Dirección General de Tráfico.'] : []),
      ],
    }],
    firmas: ['Firma del vendedor', 'Firma y sello del comprador'],
  };
}

// --- Cesión: el dueño deja el coche en la tienda para que se venda (depósito) ---
function cesion(d) {
  return {
    partes: [parte('Propietario (cedente)', d.proveedor), parte('Vendedor (cesionario)', d.empresa, { empresa: true })],
    intro: [intro, 'Puestos previamente de acuerdo, formalizan la cesión del vehículo descrito para su venta con arreglo a las siguientes:'],
    secciones: [{
      titulo: 'Cláusulas',
      items: [
        'El propietario declara ser el titular legítimo del vehículo descrito en el cuadro anterior, que está libre de cargas, embargos y deudas, y lo cede al vendedor para su exposición y venta en sus instalaciones y en sus canales de anuncio.',
        `El propietario percibirá por la venta la cantidad neta de ${eurosTexto(d.precio_cent)}. El precio de venta al público lo fija el vendedor, y la diferencia es su remuneración.`,
        'Cuando el vehículo se venda, el vendedor lo adquirirá al propietario por la cantidad neta pactada y lo venderá a su nombre, en régimen especial de los bienes usados, haciéndose cargo de la garantía frente al comprador. El pago al propietario se hará en el plazo de quince días desde que el comprador haya pagado el precio.',
        'Los gastos de preparación, limpieza, fotografía y publicidad corren a cargo del vendedor. Las reparaciones necesarias para la venta se acordarán previamente por escrito con el propietario.',
        'El vendedor custodiará el vehículo y responderá de los daños que sufra mientras esté en sus instalaciones, salvo los derivados de su desgaste normal o de causas que no le sean imputables. Las pruebas de conducción las hará siempre en presencia de su personal.',
        `La cesión tiene una duración de ${hueco(d.duracion_meses ?? 3, 2)} meses desde la firma y se prorroga por periodos iguales salvo aviso de cualquiera de las partes con quince días de antelación. Si el propietario retira el vehículo antes de su venta, abonará los gastos de reparación acordados.`,
        'El propietario entrega una copia del permiso de circulación y de la ficha técnica con la ITV en vigor, y se compromete a firmar la documentación necesaria para el cambio de titularidad cuando se venda.',
      ],
    }],
    firmas: ['Firma del propietario', 'Firma y sello del vendedor'],
  };
}

const PLANTILLAS = { compraventa, reserva, compra, cesion };

/** El contrato escrito, listo para guardar y para pintar. */
export function escribirContrato(tipo, d) {
  const cuerpo = PLANTILLAS[tipo](d);
  return {
    tipo, titulo: TITULOS[tipo], lugar_fecha: lugarYFecha(d.fecha, d.hora),
    nota_legal: tipo === 'compraventa' ? NOTA_CONSUMIDORES : null,
    pendiente_abogado: true, vehiculo: d.vehiculo, ...cuerpo,
    // Para la cabecera del documento
    empresa: { razon_social: d.empresa.razon_social, nif: d.empresa.nif, direccion: d.empresa.direccion, codigo_postal: d.empresa.codigo_postal,
      poblacion: d.empresa.poblacion, provincia: d.empresa.provincia, telefono: d.empresa.telefono, email: d.empresa.email },
    clausulas_adicionales: d.clausulas_adicionales ?? null,
    cierre,
  };
}
