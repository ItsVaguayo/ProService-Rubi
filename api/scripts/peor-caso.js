// Datos del peor caso realista (skill break-ui) sobre la base de PRUEBAS, por la API como los de verdad.
//   node scripts/peor-caso.js            (con el servidor de pruebas en marcha: npm run dev:pruebas)
// Para volver a los datos normales: npm run seed. Cada valor es algo que puede pasar de verdad, o el
// límite que acepta la API; nada de «aaaa…». Sirve de prueba de regresión cuando se toque una pantalla.
const BASE = process.env.PANEL_URL || 'http://localhost:3001';
let cookie = '';
async function api(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${ruta}`, { method, headers: { 'content-type': 'application/json', origin: BASE, cookie }, body: body && JSON.stringify(body) });
  const galleta = res.headers.get('set-cookie');
  if (galleta) cookie = galleta.split(';')[0];
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${ruta}: ${res.status} ${JSON.stringify(datos)}`);
  return datos;
}
await api('/auth/entrar', { method: 'POST', body: { email: 'jaume@pruebas.local', contrasena: 'pruebas-local-123' } });

// Clientes: razón social larga de verdad (límite 150), tildes y guiones, un nombre de dos letras, correo largo
const empresa = await api('/clientes', { method: 'POST', body: { tipo: 'empresa', nombre: 'Talleres y Automoción Hermanos Fernández-Villaverde de la Torre, Sociedad Limitada Laboral', nif: 'B87654323',
  email: 'administracion.facturacion@talleresfernandezvillaverde-automocion.example.com', telefono: '937 123 456', direccion: 'Polígono Industrial Can Rosés, Carrer de la Indústria 147, nave 12-B', codigo_postal: '08191', poblacion: 'Rubí', provincia: 'Barcelona', estado_comercial: 'negociando' } });
const aleksandra = await api('/clientes', { method: 'POST', body: { nombre: 'Aleksandra Wiśniewska-Kowalczyk', telefono: '+48 601 234 567', email: 'aleksandra.wisniewska-kowalczyk@poczta.example.pl', estado_comercial: 'interesado' } });
await api('/clientes', { method: 'POST', body: { nombre: 'Jo', estado_comercial: 'nuevo' } });
await api('/clientes', { method: 'POST', body: { nombre: 'Nguyễn Thị Phương Thảo', estado_comercial: 'me_lo_pienso' } });

// Coche: versión larga (la API no pone límite), matrícula alemana, precio de seis cifras
const coche = await api('/vehiculos', { method: 'POST', body: { matricula: 'WOB-ZK 2954', marca: 'Mercedes-Benz', modelo: 'Clase V',
  version: '300 d Larga Avantgarde 4MATIC 7G-Tronic Plus 239 CV Edition', kilometros: 1250, anio: 2024, combustible: 'diesel',
  pvp_cent: 12890000, precio_compra_cent: 11200000, regimen_iva: 'deducible' } });
for (const e of ['en_transporte', 'recibido', 'en_taller', 'en_preparacion']) await api(`/vehiculos/${coche.id}/estado`, { method: 'PATCH', body: { estado: e } });

// Factura a la empresa, con observaciones largas y un cobro parcial
const f = await api('/facturas', { method: 'POST', body: { vehiculo_id: coche.id, cliente_id: empresa.id, fecha: new Date().toISOString().slice(0, 10), forma_pago: 'pago_30_60',
  garantia_tipo: 'directa', garantia_meses: 24, observaciones: 'Se entrega con las dos llaves, el libro de mantenimiento sellado en concesionario oficial, la rueda de repuesto y el kit de carga. El cliente se hace cargo del cambio de titularidad y del impuesto de transmisiones.' } });

await api(`/facturas/${f.id}/emitir`, { method: 'POST' });
await api(`/facturas/${f.id}/cobros`, { method: 'POST', body: { importe_cent: 3000000, forma_pago: 'transferencia', fecha: new Date().toISOString().slice(0, 10), nota: 'Primer pago, a cuenta, según lo hablado con la responsable de flota' } });

// Gasto: proveedor de nombre largo, su nº de factura al límite (50) y una descripción larga
const prov = await api('/proveedores', { method: 'POST', body: { nombre: 'Recambios y Neumáticos del Vallès Occidental Distribuciones Integrales, S.L.', clase: 'acreedor', tipo: 'profesional' } });
await api('/gastos', { method: 'POST', body: { fecha: new Date().toISOString().slice(0, 10), concepto: 'vehiculos', tipo: 'vehiculo', vehiculo_id: coche.id, proveedor_id: prov.id,
  base_cent: 1875045, iva_pct: 21, factura_proveedor: 'FRA-2026/000123456-REPUESTOS-SERVICIO-TECNICO-0042'.slice(0, 50),
  descripcion: 'Cambio de distribución completa, bomba de agua, termostato, correa auxiliar y tensores; revisión de frenos delanteros y traseros con discos nuevos' } });

// CRM: actividad larga de un cliente con nombre largo, y otra del de dos letras
const ahora = new Date(Date.now() + 2 * 3600000);
const hora = `${ahora.toISOString().slice(0, 10)} ${String(ahora.getHours()).padStart(2, '0')}:00`;
await api('/actividades', { method: 'POST', body: { tipo: 'visita', cliente_id: empresa.id, programada_para: hora,
  descripcion: 'Vienen el gerente y la responsable de flota a ver la Clase V. Preparar comparativa con la Vito Tourer, condiciones de renting a 48 meses y presupuesto de rotulación de los laterales con su logotipo.' } });
await api('/actividades', { method: 'POST', body: { tipo: 'llamada', cliente_id: aleksandra.id, programada_para: hora, descripcion: 'Llamar' } });
console.log(`Peor caso cargado: cliente ${empresa.id}, coche ${coche.id}, factura ${f.id}, proveedor ${prov.id}`);
