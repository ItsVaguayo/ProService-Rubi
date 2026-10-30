# La web real: lo que hay y lo que falta para conectarla

Revisado el 20-oct-2026, el primer día con acceso a la WordPress de proservicerubi.com. **Es producción: de momento solo se lee, no se cambia nada** (lo pidió Diego). Todo lo de aquí se sacó con peticiones GET y OPTIONS.

## El acceso

- Un usuario con rol **Editor** y una contraseña de aplicación (duda B8, a medias: falta el administrador una vez y el DNS).
- Las credenciales **no van en Git ni en el chat**. Viven en un fichero `.env` fuera del repositorio, solo legible por su dueño (en el servidor, el `.env` de la API; en local, uno aparte).
- **La contraseña de aplicación lleva espacios** (seis grupos de cuatro). Cargar el fichero siempre con `node --env-file=RUTA` (lo hacen `npm run wordpress` y `npm start`), nunca con `. fichero` o `source` en bash: la shell corta en el primer espacio e intenta ejecutar el resto como un comando, y el trozo de la clave sale en el error. Pasó el 20-oct: se recomendó revocar esa contraseña y crear otra.

## Diagnóstico

`npm run wordpress --workspace api -- diagnostico` (solo lectura):

| | |
|---|---|
| Sesión | Editor: publicar, editar fichas de otros, subir fotos y crear marcas, sí |
| Tipo «coches» | Se pueden escribir `title`, `status`, `slug`, `date`, `template`, `marca` y `acf` |
| ACF en la API REST | **Sí desde el 30-oct** (B11, comprobado con GET y OPTIONS). 15 campos: `precio`, `financiado`, `estado_coche`, `imagen_principal`, `video`, `ano` (fecha Ymd), `combustible`, `kilometros`, `cilindrada` (texto), `potencia_cv`, `cambio`, `uso_anterior`, `extras` y `colores` (listas cerradas) y `referencia` |
| Campos del mapa (`WP_MAPA`) | El mapa por defecto ya usa esos nombres: el diagnóstico solo echa en falta `cuota_condiciones` (opcional, duda E9) |

## Lo que tienen publicado

- **35 fichas, las 35 publicadas, ninguna en borrador.** En Pymecar había unos 8 coches en stock (7-oct): casi seguro que hay vendidos que siguen en la web (B17).
- La más antigua es de abril de 2026. Altas: 2 en abril, 13 en julio, 1 en agosto, 14 en septiembre y 5 en octubre.
- **Títulos a mano**, con erratas («VOLSKWAGEN», «QASHCAI») y la potencia y la etiqueta dentro del título. La plataforma los sustituirá por marca, modelo y versión al sincronizar.
- **«TOYOTA PROACE 150CV DIESEL 8 PLAZAS» está dos veces** (8503 y 8362): duplicado o dos furgonetas (B19).
- **Ninguna tiene foto destacada**: su galería son las fotos adjuntas al post, y el ACF `imagen_principal` dice la primera (comprobado el 30-oct en la ficha 8835: sus 10 adjuntas salen en la página).
- **Marcas** (taxonomía `marca`, jerárquica: la marca arriba y sus modelos colgando, como Seat → Arona). Hay 39 términos, pero **solo 2 fichas la tienen puesta** (Seat Arona y Toyota Proace). Faltan marcas que sí están en el stock: Mini, Mitsubishi, Jeep, Land Rover, Volkswagen. Ver B18.

## Lo que hace la plataforma con esto (comprobado en el código)

- **Solo pasa a borrador las fichas que conoce**: las que publicó ella o las que se vincularon a un coche (`vincular`). **Una ficha que no se vincule se queda publicada para siempre.** Por eso hay que repasar las 35 antes de la primera sincronización (B17).
- La marca la busca por nombre entre las que existen y, si no está, la crea (el Editor puede). Solo pone la marca, no el modelo (B18).
- Si no hay ningún coche a la venta y en la web hay publicados, no retira nada sin `--forzar`: así una base vacía no vacía la web.

## Pasos para conectarla, en orden

1. Francesc: «Mostrar en la API REST» en el grupo de ACF de «coches» (B11) y campo `referencia` (B16). Hecho el 30-oct: el mapa ya usa los nombres reales; el campo `referencia` existe, vacío en las 31 fichas.
2. Jaume: rellenar la tabla de abajo (B17).
3. Servidor de producción con la API y los coches migrados de Pymecar (28-oct). **La primera sincronización sale de ahí, nunca de un ordenador de desarrollo**: publicaría los coches de prueba en su web.
4. Vincular cada coche en venta con su ficha (`vincular`). Las de vendidos: a borrador (Francesc o, con su OK, nosotros) o vinculadas a su coche vendido para que las retire la plataforma.
5. Bajar las fotos de la web (`POST /api/wordpress/fotos`) y sincronizar. Comprobar la ficha en el navegador antes de enlazar nada en el menú.

## Lo que dicen sus fichas públicas (20-oct)

Leídas las 35 páginas públicas como un visitante (solo GET, sin usuario, con pausa entre una y otra). Lista completa en `~/wp-proservice/fichas-publicas-2026-10-20.json` del ordenador de pruebas.

- **Las 35 dicen «En venta».** Ninguna «Reservado» ni «Vendido»: si hay vendidos, siguen anunciados como en venta (B17).
- **El año está vacío en las 35** (B12). Kilómetros, potencia, cilindrada, combustible y uso anterior sí están.
- **Cuota «Desde X €/mes» en 34 de 35. Desde julio no sale con el 7,5 % a 120 meses** de su calculadora de Pymecar, sino con un **8,75 % aproximadamente**: 25 de 34 cuadran con un 8,7 % a 8,9 % a 120 meses; las dos de abril sí van al 7,5 %, y siete de coches baratos o viejos cuadran con un plazo más corto (de 60 a 108 meses). Con nuestra configuración (7,5 %), al conectar la web **bajarían 32 de sus 34 cuotas**, 14 € de media y hasta 87 €. Ver B20.
- **Fotos: 356, todas en su dominio, de 1 a 21 por ficha. 28 de las 35 tienen menos de 15**, el mínimo que pidieron en el briefing y que la plataforma exige para publicar (D10).
  - En 22 fichas son las **montadas por su herramienta** (PNG de 1448 × 1086, unos 2 MB, con logo y banda verdes).
  - En 13 fichas (de abril, julio y septiembre) son las **originales del móvil** (JPG de 1600 × 1200, en un aparcamiento a pleno sol): es el material que pide la D9 para probar el photocall.
  - Se pueden bajar de la página pública sin depender de B11. Pero las montadas llevan su marca vieja y lo que su herramienta haya cambiado del coche: para el stock, mejor las originales.

## Las 35 fichas (para Jaume)

Una línea por ficha, de la más nueva a la más vieja, con lo que dice su web para reconocer cada coche. En la última columna: **sí** (sigue en venta), **vendido** o **duplicado**.

| Id | Alta | Título en la web | Precio | Km | Fotos | ¿En venta? |
|---|---|---|---|---|---|---|
| 8847 | 2026-10-13 | NISSAN MICRA ETIQUETA C 5-PUERTAS | 5.600 € | 180.000 | 10 (montadas) | |
| 8835 | 2026-10-13 | MITSUBISHI COLT 5-PUERTAS 90CV | 14.500 € | 4.000 | 10 (montadas) | |
| 8805 | 2026-10-07 | MINI ONE 95CV ETIQUETA C | 5.000 € | 161.000 | 20 (montadas) | |
| 8790 | 2026-10-07 | FIAT 500X URBAN 150CV GASOLINA ETIQUETA C | 12.000 € | 68.500 | 6 (montadas) | |
| 8765 | 2026-10-06 | LAND ROVER RANGE ROVER EVOQUE 150CV DIESEL 4X4 AUT | 13.975 € | 180.000 | 8 (montadas) | |
| 8744 | 2026-09-19 | VOLKSWAGEN GOLF TDI 105CV FAMILIAR | 8.000 € | 228.000 | 7 (montadas) | |
| 8736 | 2026-09-13 | HYUNDAI I20 ACTIVE | 8.500 € | 171.000 | 7 (montadas) | |
| 8727 | 2026-09-13 | KIA NIRO HYBRIDO MODELO NUEVO AUTOMATICO | 19.500 € | 92.000 | 8 (montadas) | |
| 8715 | 2026-09-13 | CITROEN SPACETOURER TALLA XL B 115CV DIESEL 6-9 PLACES | 21.900 € | 113.000 | 11 (montadas) | |
| 8708 | 2026-09-13 | CITROEN C3 AIRCROSS GASOLINA 110CV ACABADO SHINE | 9.900 € | 89.000 | 5 (montadas) | |
| 8701 | 2026-09-13 | JEEP RENEGADE SPORT GASOLINA 120CV | 11.975 € | 150.000 | 6 (montadas) | |
| 8693 | 2026-09-13 | VOLSKWAGEN POLO RLINE 95CV ETIQUETA C | 16.975 € | 107.000 | 7 (montadas) | |
| 8679 | 2026-09-13 | FORD FIESTA TDCI DIESEL 75CV | 5.000 € | 220.000 | 8 (montadas) | |
| 8666 | 2026-09-13 | CITROEN C3 GASOLINA 83CV ACABADO FEEL | 9.900 € | 51.344 | 12 (del móvil) | |
| 8655 | 2026-09-13 | KIA RIO 1,2CVVT DRIVE ADVANCED DRIVI 84CV | 10.500 € | 106.000 | 10 (del móvil) | |
| 8644 | 2026-09-13 | HYUNDAI I20 1,2 MPI KLAS IVA DEDUCIBLE | 14.000 € | 78.000 | 10 (del móvil) | |
| 8631 | 2026-09-13 | KIA RIO 1.2 CVVT CONCEPT -PACK STYLE- (MY20) | 11.975 € | 45.000 | 12 (del móvil) | |
| 8602 | 2026-09-13 | RENAULT CAPTUR  ETECH PLUG IN 160CV AUT | 16.975 € | 82.000 | 15 (del móvil) | |
| 8587 | 2026-09-13 | KIA SPORTAGE 1.6 GDI X-TECH18 132cv | 15.100 € | 116.000 | 14 (del móvil) | |
| 8572 | 2026-08-05 | TOYOTA CHR 140CV ADVANCE VEHICULO DE GERENCIA | 31.000 € | 25.000 | 8 (montadas) | |
| 8554 | 2026-07-31 | CITROEN NUEVO BERLINGO TALLA XL BLUEHDI 130CV ACABADO SHINE 7 PLAZAS | 15.000 € | 201.000 | 7 (montadas) | |
| 8534 | 2026-07-31 | CITROEN BERLINGO HDI 100CV SOLO14000KM | 19.900 € | 14.000 | 9 (montadas) | |
| 8511 | 2026-07-26 | FORD TOURNEO CURIER 100CV GASOLINA ETIQUETA C | 12.000 € | 139.000 | 16 (montadas) | |
| 8503 | 2026-07-24 | TOYOTA PROACE 150CV DIESEL 8 PLAZAS | 28.000 € | 110.998 | 11 (del móvil) | |
| 8495 | 2026-07-23 | PEUGEOT 3008 1.2 130CV GASOLINA ACABADO GTLINE | 12.600 € | 112.000 | 6 (montadas) | |
| 8474 | 2026-07-20 | PEUGEOT 3008 HDI 130CV GTLINE | 14.500 € | 10.400 | 1 (montadas) | |
| 8467 | 2026-07-16 | PEUGEOT 208 HDI 75CV ACTIVE 5-PUERTAS | 7.500 € | 17.000 | 6 (montadas) | |
| 8452 | 2026-07-09 | PEUGEOT PARTNER TEPEE OUTDOOR HDI 100CV | 12.400 € | 195.941 | 5 (montadas) | |
| 8425 | 2026-07-08 | JEEP CHEROKEE LIMITED 4X4 | 15.000 € | 39.000 | 15 (del móvil) | |
| 8414 | 2026-07-08 | CITROEN C3 HDI 120CV AUTOMATICO SHINE | 14.000 € | 110.000 | 10 (del móvil) | |
| 8397 | 2026-07-08 | FORD PUMA ECOBOOST 125CV STLINE XMHEV 5P | 18.500 € | 49.115 | 16 (del móvil) | |
| 8362 | 2026-07-08 | TOYOTA PROACE 150CV DIESEL 8 PLAZAS | 29.975 € | 110.998 | 11 (del móvil) | |
| 8353 | 2026-07-08 | NISSAN QASHCAI DCI 115N-CONNECTA | 18.000 € | 85.000 | 7 (montadas) | |
| 7869 | 2026-04-19 | Seat Arona Xcellence | 15.975 € | 63.750 | 21 (del móvil) | |
| 7812 | 2026-04-19 | Toyota Proace | 14.975 € | 115.673 | 21 (del móvil) | |

La misma lista, con la dirección de cada ficha, en `~/wp-proservice/inventario-web-real-2026-10-20.json` del ordenador de pruebas (sacada con GET el 20-oct).
