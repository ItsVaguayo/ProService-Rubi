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
| ACF en la API REST | **No.** Sigue la duda B11: sin ella, la plataforma solo manda título, estado y marca. Ni precio, ni km, ni fotos |
| Campos del mapa (`WP_MAPA`) | No se pueden comprobar hasta que ACF esté expuesto: los nombres reales siguen siendo una suposición |

## Lo que tienen publicado

- **35 fichas, las 35 publicadas, ninguna en borrador.** En Pymecar había unos 8 coches en stock (7-oct): casi seguro que hay vendidos que siguen en la web (B17).
- La más antigua es de abril de 2026. Altas: 2 en abril, 13 en julio, 1 en agosto, 14 en septiembre y 5 en octubre.
- **Títulos a mano**, con erratas («VOLSKWAGEN», «QASHCAI») y la potencia y la etiqueta dentro del título. La plataforma los sustituirá por marca, modelo y versión al sincronizar.
- **«TOYOTA PROACE 150CV DIESEL 8 PLAZAS» está dos veces** (8503 y 8362): duplicado o dos furgonetas (B19).
- **Ninguna tiene foto destacada**: las fotos van en la galería de ACF, que no se puede leer mientras ACF no esté expuesto.
- **Marcas** (taxonomía `marca`, jerárquica: la marca arriba y sus modelos colgando, como Seat → Arona). Hay 39 términos, pero **solo 2 fichas la tienen puesta** (Seat Arona y Toyota Proace). Faltan marcas que sí están en el stock: Mini, Mitsubishi, Jeep, Land Rover, Volkswagen. Ver B18.

## Lo que hace la plataforma con esto (comprobado en el código)

- **Solo pasa a borrador las fichas que conoce**: las que publicó ella o las que se vincularon a un coche (`vincular`). **Una ficha que no se vincule se queda publicada para siempre.** Por eso hay que repasar las 35 antes de la primera sincronización (B17).
- La marca la busca por nombre entre las que existen y, si no está, la crea (el Editor puede). Solo pone la marca, no el modelo (B18).
- Si no hay ningún coche a la venta y en la web hay publicados, no retira nada sin `--forzar`: así una base vacía no vacía la web.

## Pasos para conectarla, en orden

1. Francesc: «Mostrar en la API REST» en el grupo de ACF de «coches» (B11) y campo `referencia` (B16). Después, repetir el diagnóstico y ajustar `WP_MAPA` a los nombres reales.
2. Jaume: rellenar la tabla de abajo (B17).
3. Servidor de producción con la API y los coches migrados de Pymecar (28-oct). **La primera sincronización sale de ahí, nunca de un ordenador de desarrollo**: publicaría los coches de prueba en su web.
4. Vincular cada coche en venta con su ficha (`vincular`). Las de vendidos: a borrador (Francesc o, con su OK, nosotros) o vinculadas a su coche vendido para que las retire la plataforma.
5. Bajar las fotos de la web (`POST /api/wordpress/fotos`) y sincronizar. Comprobar la ficha en el navegador antes de enlazar nada en el menú.

## Las 35 fichas (para Jaume)

Una línea por ficha, de la más nueva a la más vieja. En la última columna: **sí** (sigue en venta), **vendido** o **duplicado**.

| Id | Alta | Título en la web | Dirección | ¿En venta? |
|---|---|---|---|---|
| 8847 | 2026-10-13 | NISSAN MICRA ETIQUETA C 5-PUERTAS | /coches/nissan-micra-etiqueta-c-5-puertas/ | |
| 8835 | 2026-10-13 | MITSUBISHI COLT 5-PUERTAS 90CV | /coches/mitsubishi-colt-5-puertas-90cv/ | |
| 8805 | 2026-10-07 | MINI ONE 95CV ETIQUETA C | /coches/mini-one-95cv-etiqueta-c/ | |
| 8790 | 2026-10-07 | FIAT 500X URBAN 150CV GASOLINA ETIQUETA C | /coches/fiat-500x-urban-150cv-gasolina-etiqueta-c/ | |
| 8765 | 2026-10-06 | LAND ROVER RANGE ROVER EVOQUE 150CV DIESEL 4X4 AUT | /coches/land-rover-range-rover-evoque-150cv-diesel-4x4-aut/ | |
| 8744 | 2026-09-19 | VOLKSWAGEN GOLF TDI 105CV FAMILIAR | /coches/volkswagen-golf-tdi-105cv-familiar/ | |
| 8736 | 2026-09-13 | HYUNDAI I20 ACTIVE | /coches/hyundai-i20-active/ | |
| 8727 | 2026-09-13 | KIA NIRO HYBRIDO MODELO NUEVO AUTOMATICO | /coches/kia-niro-hybrido-modelo-nuevo-automatico/ | |
| 8715 | 2026-09-13 | CITROEN SPACETOURER TALLA XL B 115CV DIESEL 6-9 PLACES | /coches/citroen-spacetourer-talla-xl-b-115cv-diesel-6-9-places/ | |
| 8708 | 2026-09-13 | CITROEN C3 AIRCROSS GASOLINA 110CV ACABADO SHINE | /coches/citroen-c3-aircross-gasolina-110cv-acabado-shine/ | |
| 8701 | 2026-09-13 | JEEP RENEGADE SPORT GASOLINA 120CV | /coches/jeep-renegade-sport-gasolina-120cv/ | |
| 8693 | 2026-09-13 | VOLSKWAGEN POLO RLINE 95CV ETIQUETA C | /coches/volskwagen-polo-rline-95cv-etiqueta-c/ | |
| 8679 | 2026-09-13 | FORD FIESTA TDCI DIESEL 75CV | /coches/ford-fiesta-tdci-diesel-75cv/ | |
| 8666 | 2026-09-13 | CITROEN C3 GASOLINA 83CV ACABADO FEEL | /coches/citroen-c3-gasolina-83cv-acabado-feel/ | |
| 8655 | 2026-09-13 | KIA RIO 1,2CVVT DRIVE ADVANCED DRIVI 84CV | /coches/kia-rio-12cvvt-drive-advanced-drivi-84cv/ | |
| 8644 | 2026-09-13 | HYUNDAI I20 1,2 MPI KLAS IVA DEDUCIBLE | /coches/hyundai-i20-12-mpi-klas-iva-deducible/ | |
| 8631 | 2026-09-13 | KIA RIO 1.2 CVVT CONCEPT -PACK STYLE- (MY20) | /coches/kia-rio-1-2-cvvt-concept-pack-style-my20/ | |
| 8602 | 2026-09-13 | RENAULT CAPTUR  ETECH PLUG IN 160CV AUT | /coches/renault-captur-etech-plug-in-160cv-aut/ | |
| 8587 | 2026-09-13 | KIA SPORTAGE 1.6 GDI X-TECH18 132cv | /coches/kia-sportage-1-6-gdi-x-tech18-132cv/ | |
| 8572 | 2026-08-05 | TOYOTA CHR 140CV ADVANCE VEHICULO DE GERENCIA | /coches/toyota-chr-140cv-advance-vehiculo-de-gerencia/ | |
| 8554 | 2026-07-31 | CITROEN NUEVO BERLINGO TALLA XL BLUEHDI 130CV ACABADO SHINE 7 PLAZAS | /coches/citroen-nuevo-berlingo-talla-xl-bluehdi-130cv-acabado-shine-7-plazas/ | |
| 8534 | 2026-07-31 | CITROEN BERLINGO HDI 100CV SOLO14000KM | /coches/citroen-berlingo-hdi-100cv-solo14000km/ | |
| 8511 | 2026-07-26 | FORD TOURNEO CURIER 100CV GASOLINA ETIQUETA C | /coches/ford-tourneo-curier-100cv-gasolina-etiqueta-c/ | |
| 8503 | 2026-07-24 | TOYOTA PROACE 150CV DIESEL 8 PLAZAS | /coches/toyota-proace-150cv-diesel-8-plazas-2/ | |
| 8495 | 2026-07-23 | PEUGEOT 3008 1.2 130CV GASOLINA ACABADO GTLINE | /coches/peugeot-3008-1-2-130cv-gasolina-acabado-gtline/ | |
| 8474 | 2026-07-20 | PEUGEOT 3008 HDI 130CV GTLINE | /coches/peugeot-3008-hdi-130cv-gtline/ | |
| 8467 | 2026-07-16 | PEUGEOT 208 HDI 75CV ACTIVE 5-PUERTAS | /coches/peugeot-208-hdi-75cv-active-5-puertas/ | |
| 8452 | 2026-07-09 | PEUGEOT PARTNER TEPEE OUTDOOR HDI 100CV | /coches/peugeot-partner-tepee-outdoor-hdi-100cv/ | |
| 8425 | 2026-07-08 | JEEP CHEROKEE LIMITED 4X4 | /coches/jeep-cherokee-limited-4x4/ | |
| 8414 | 2026-07-08 | CITROEN C3 HDI 120CV AUTOMATICO SHINE | /coches/citroen-c3-hdi-120cv-automatico-shine/ | |
| 8397 | 2026-07-08 | FORD PUMA ECOBOOST 125CV STLINE XMHEV 5P | /coches/ford-puma-ecoboost-125cv-stline-xmhev-5p/ | |
| 8362 | 2026-07-08 | TOYOTA PROACE 150CV DIESEL 8 PLAZAS | /coches/toyota-proace-150cv-diesel-8-plazas/ | |
| 8353 | 2026-07-08 | NISSAN QASHCAI DCI 115N-CONNECTA | /coches/8353/ | |
| 7869 | 2026-04-19 | Seat Arona Xcellence | /coches/seat-arona-xcellence/ | |
| 7812 | 2026-04-19 | Toyota Proace | /coches/toyota-proace/ | |

La misma lista, con marca y fecha de último cambio, en `~/wp-proservice/inventario-web-real-2026-10-20.json` del ordenador de pruebas (sacada con GET el 20-oct).
