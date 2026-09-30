<?php
/**
 * Pruebas del plugin contra la API falsa. Se lanzan dentro de un WordPress de pruebas:
 *
 *   python3 wp-plugin/pruebas/api_falsa.py &          # API falsa en 127.0.0.1:3998
 *   wp eval-file wp-plugin/pruebas/prueba.php
 *
 * Necesita el tipo de contenido «coches» y la taxonomía «marca» (en local los crea un mu-plugin,
 * ver wp-plugin/pruebas/README.md). BORRA los coches vinculados y sus fotos: nunca en producción.
 */

if (!defined('ABSPATH') || !class_exists('ProService_Sync')) {
    fwrite(STDERR, "Lánzalo con wp eval-file y el plugin activo.\n");
    exit(1);
}
if (strpos(home_url(), 'localhost') === false && strpos(home_url(), '127.0.0.1') === false) {
    fwrite(STDERR, "Solo se ejecuta en un WordPress local: borra datos.\n");
    exit(1);
}

// Dentro de wp eval-file, __DIR__ va vacío y las variables no son globales: se lanza desde la raíz del repo.
define('PS_PRUEBAS_TMP', getenv('PS_PRUEBAS_TMP') ?: getcwd() . '/wp-plugin/pruebas/tmp');
if (!is_dir(PS_PRUEBAS_TMP)) {
    fwrite(STDERR, 'No encuentro ' . PS_PRUEBAS_TMP . ": lánzalo desde la raíz del repo con la API falsa en marcha.\n");
    exit(1);
}

class PS_Prueba
{
    public static $total = 0;
    public static $fallos = 0;
}

function afirmar($condicion, $mensaje)
{
    PS_Prueba::$total++;
    if ($condicion) {
        echo "  ok   {$mensaje}\n";
    } else {
        PS_Prueba::$fallos++;
        echo "  FALLO {$mensaje}\n";
    }
}
function feed(array $coches)
{
    file_put_contents(PS_PRUEBAS_TMP . '/feed.json', wp_json_encode($coches));
}
function modo($m)
{
    file_put_contents(PS_PRUEBAS_TMP . '/modo.txt', $m);
}
function sync($forzar = false)
{
    delete_transient(ProService_Sync::BLOQUEO);
    return ProService_Sync::ejecutar($forzar);
}
function post_de($api_id)
{
    $v = ProService_Sync::posts_vinculados('coches');
    return isset($v[$api_id]) ? $v[$api_id]['post_id'] : 0;
}
function buscar(array $get)
{
    $_GET = $get;
    $html = do_shortcode('[proservice_buscador por_pagina="48"]');
    $_GET = [];
    preg_match_all('/<h2>([^<]+)<\/h2>/', $html, $m);
    return $m[1];
}
function coche($id, array $cambios = [])
{
    $base = [
        'id' => $id, 'referencia' => sprintf('PS-%05d', $id), 'estado' => 'publicado', 'marca' => 'Seat', 'modelo' => 'Ibiza',
        'version' => 'FR', 'anio' => 2020, 'kilometros' => 60000, 'combustible' => 'gasolina', 'cambio' => 'manual',
        'potencia_cv' => 110, 'cilindrada' => 999, 'traccion' => 'delantera', 'emisiones_co2' => 120, 'etiqueta_dgt' => 'C',
        'carroceria' => 'utilitario', 'puertas' => 5, 'plazas' => 5, 'color_exterior' => 'blanco', 'tapiceria' => 'tela',
        'llantas' => '16"', 'garantia_meses' => 12, 'pvp_cent' => 1290000, 'precio_financiado_cent' => 1190000, 'video_url' => null,
    ];
    return array_merge($base, $cambios);
}
function foto($n, $orden, $extra = '')
{
    return ['id' => $orden, 'orden' => $orden, 'url' => "http://127.0.0.1:3998/fotos/{$n}.png{$extra}"];
}

// --- Preparación ---------------------------------------------------------------------------
echo "Preparando\n";
modo('ok');
ProService_Ajustes::guardar(['api_url' => 'http://127.0.0.1:3998/api', 'tipo_post' => 'coches', 'taxonomia' => 'marca', 'mapa' => ProService_Ajustes::MAPA_POR_DEFECTO]);
foreach (ProService_Sync::posts_vinculados('coches') as $p) {
    wp_delete_post($p['post_id'], true);
}
foreach (get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'numberposts' => -1, 'fields' => 'ids', 'meta_key' => '_proservice_foto_url']) as $a) {
    wp_delete_attachment($a, true);
}
$manual = get_page_by_path('volkswagen-golf-tdi-105cv-familiar', OBJECT, 'coches');
if (!$manual) {
    $manual = get_post(wp_insert_post(['post_type' => 'coches', 'post_status' => 'publish', 'post_title' => 'VOLKSWAGEN GOLF TDI 105CV FAMILIAR', 'post_name' => 'volkswagen-golf-tdi-105cv-familiar']));
}
wp_update_post(['ID' => $manual->ID, 'post_title' => 'VOLKSWAGEN GOLF TDI 105CV FAMILIAR', 'post_status' => 'publish']);
delete_post_meta($manual->ID, '_proservice_id');
update_post_meta($manual->ID, 'precio', 8000);

// --- 1. Alta ---------------------------------------------------------------------------------
echo "1. Alta de dos coches\n";
feed([
    coche(1, ['fotos' => [foto(2, 2), foto(1, 1), foto(3, 3)]]),
    coche(2, ['marca' => 'Toyota', 'modelo' => 'C-HR', 'version' => '125H Advance', 'anio' => 2019, 'kilometros' => 81200, 'combustible' => 'hibrido', 'cambio' => 'automatico', 'carroceria' => 'suv', 'pvp_cent' => 2150000]),
]);
$r = sync();
afirmar($r['creados'] === 2 && !$r['errores'], 'crea 2 posts sin errores');
$p1 = post_de(1);
afirmar(get_the_title($p1) === 'Seat Ibiza FR', 'título = marca modelo versión');
afirmar(get_post_field('post_name', $p1) === 'seat-ibiza-fr', 'URL limpia');
afirmar((int) get_field('precio', $p1) === 12900, 'precio en euros a partir de céntimos (campo ACF)');
afirmar((int) get_field('kilometros', $p1) === 60000 && get_post_meta($p1, 'combustible', true) === 'gasolina', 'kilómetros y combustible');
afirmar(get_post_meta($p1, 'precio_financiado', true) == 11900, 'campo sin ACF va como meta normal');
afirmar(wp_get_post_terms($p1, 'marca', ['fields' => 'names']) === ['Seat'], 'marca como término');
$galeria = get_post_meta($p1, 'galeria', true);
afirmar(is_array($galeria) && count($galeria) === 3 && $r['fotos_descargadas'] === 3, '3 fotos descargadas a la galería');
afirmar(is_array($galeria) && get_post_thumbnail_id($p1) === $galeria[0] && get_post_meta($galeria[0], '_proservice_foto_url', true) === 'http://127.0.0.1:3998/fotos/1.png', 'la destacada es la foto de orden 1');
afirmar(!metadata_exists('post', post_de(2), 'galeria'), 'sin «fotos» en el feed no se toca la galería');
afirmar(get_post($manual->ID)->post_title === 'VOLKSWAGEN GOLF TDI 105CV FAMILIAR' && (int) get_post_meta($manual->ID, 'precio', true) === 8000, 'el post hecho a mano no se toca');

// --- 2. Sin cambios ---------------------------------------------------------------------------
echo "2. Segunda pasada sin cambios\n";
$r = sync();
afirmar($r['sin_cambios'] === 2 && $r['actualizados'] === 0 && $r['fotos_descargadas'] === 0, 'no reescribe ni vuelve a bajar fotos');

// --- 3. Cambio de precio y versión ------------------------------------------------------------
echo "3. Cambio de precio y de versión\n";
feed([
    coche(1, ['version' => 'FR Plus', 'pvp_cent' => 1250000, 'fotos' => [foto(1, 1), foto(2, 2), foto(3, 3)]]),
    coche(2, ['marca' => 'Toyota', 'modelo' => 'C-HR', 'version' => '125H Advance', 'anio' => 2019, 'kilometros' => 81200, 'combustible' => 'hibrido', 'cambio' => 'automatico', 'carroceria' => 'suv', 'pvp_cent' => 2150000, 'estado' => 'reservado']),
]);
$r = sync();
afirmar($r['actualizados'] === 2, 'actualiza los dos');
afirmar((int) get_field('precio', $p1) === 12500, 'precio nuevo');
afirmar(get_the_title($p1) === 'Seat Ibiza FR Plus' && get_post_field('post_name', $p1) === 'seat-ibiza-fr', 'cambia el título pero la URL se queda');
afirmar($r['fotos_descargadas'] === 0, 'las mismas fotos no se vuelven a bajar');

// --- 4. Buscador ------------------------------------------------------------------------------
echo "4. Buscador\n";
afirmar(count(buscar([])) === 3, 'sin filtros salen los 3 publicados (incluido el manual)');
$baratos = buscar(['precio_max' => '13000']);
sort($baratos);
afirmar($baratos === ['Seat Ibiza FR Plus', 'VOLKSWAGEN GOLF TDI 105CV FAMILIAR'], 'precio hasta 13.000 € (el Seat y el Golf manual de 8.000 €)');
afirmar(buscar(['marca' => 'toyota']) === ['Toyota C-HR 125H Advance'], 'por marca');
afirmar(buscar(['combustible' => 'hibrido', 'cambio' => 'automatico']) === ['Toyota C-HR 125H Advance'], 'combustible y cambio');
afirmar(buscar(['km_max' => '70000', 'anio_min' => '2020']) === ['Seat Ibiza FR Plus'], 'km y año');
$orden = buscar(['orden' => 'precio']);
afirmar(array_slice($orden, 0, 2) === ['VOLKSWAGEN GOLF TDI 105CV FAMILIAR', 'Seat Ibiza FR Plus'], 'ordenado por precio');
$_GET = [];
$html = do_shortcode('[proservice_buscador]');
afirmar(strpos($html, 'ps-cinta">Reservado') !== false, 'cinta de reservado');
afirmar(strpos($html, '<option value="hibrido">Híbrido</option>') !== false, 'opciones con nombre legible');
$_GET = ['marca' => '"><script>alert(1)</script>'];
$html = do_shortcode('[proservice_buscador]');
$_GET = [];
afirmar(strpos($html, '<script>alert') === false, 'los filtros no inyectan HTML');

// --- 5. Retirada -----------------------------------------------------------------------------
echo "5. Coche que sale del feed\n";
feed([coche(1, ['version' => 'FR Plus', 'pvp_cent' => 1250000, 'fotos' => [foto(1, 1), foto(2, 2), foto(3, 3)]])]);
$r = sync();
$p2 = post_de(2);
afirmar($r['retirados'] === 1 && get_post_status($p2) === 'draft', 'pasa a borrador, no se borra');
afirmar((bool) get_post_meta($p2, '_proservice_retirado', true), 'marcado como retirado (para el 301)');

// --- 6. Fallos de la API ------------------------------------------------------------------------
echo "6. La API falla o llega vacía\n";
feed([]);
$r = sync();
afirmar($r['errores'] && get_post_status($p1) === 'publish', 'feed vacío: no retira nada');
modo('caida');
$r = sync();
afirmar($r['errores'] && strpos($r['errores'][0], '503') !== false && get_post_status($p1) === 'publish', 'API caída: no toca nada');
modo('ok');
file_put_contents(PS_PRUEBAS_TMP . '/feed.json', '{"error":"algo"}');
$r = sync();
afirmar($r['errores'] && get_post_status($p1) === 'publish', 'respuesta que no es una lista: no toca nada');

// --- 7. Fotos de fuera y presupuesto ---------------------------------------------------------------
echo "7. Fotos\n";
$muchas = [];
for ($i = 1; $i <= 42; $i++) {
    $muchas[] = foto(($i % 4) + 1, $i, "?v={$i}");
}
feed([
    coche(1, ['version' => 'FR Plus', 'pvp_cent' => 1250000, 'fotos' => [foto(1, 1), ['orden' => 2, 'url' => 'http://otro-servidor.test/malo.png']]]),
    coche(3, ['marca' => 'Kia', 'modelo' => 'Niro', 'version' => '', 'fotos' => $muchas]),
]);
$r = sync();
afirmar((bool) array_filter($r['errores'], function ($e) { return strpos($e, 'otro-servidor.test') !== false; }), 'una foto de otro servidor se ignora');
afirmar(count((array) get_post_meta($p1, 'galeria', true)) === 1, 'la galería queda con las fotos válidas');
$p3 = post_de(3);
afirmar($r['fotos_descargadas'] === ProService_Sync::FOTOS_POR_PASADA - 0 && $r['fotos_pendientes'] === 2, 'como mucho 40 fotos por pasada, 2 pendientes');
afirmar(get_post_meta($p3, '_proservice_huella', true) === '', 'con fotos pendientes no se guarda la huella');
$r = sync();
afirmar($r['fotos_descargadas'] === 2 && count((array) get_post_meta($p3, 'galeria', true)) === 42, 'la siguiente pasada completa la galería');

// --- 8. Vincular el post hecho a mano ----------------------------------------------------------------
echo "8. Vincular un post que ya existía\n";
afirmar(ProService_Admin::vincular($manual->ID, 1) !== null, 'no deja vincular un coche que ya tiene post');
afirmar(ProService_Admin::vincular($manual->ID, 4) === null, 'vincula el Golf al coche 4');
feed([coche(4, ['marca' => 'Volkswagen', 'modelo' => 'Golf', 'version' => 'TDI 105CV Familiar', 'pvp_cent' => 790000])]);
$r = sync(true);
afirmar(!$r['creados'] && $r['actualizados'] === 1, 'actualiza el post existente en vez de crear otro');
afirmar(get_post_field('post_name', $manual->ID) === 'volkswagen-golf-tdi-105cv-familiar' && (int) get_field('precio', $manual->ID) === 7900, 'conserva su URL y toma el precio de la plataforma');

// --- 9. Compatibilidad y ajustes --------------------------------------------------------------------
echo "9. Feed antiguo en euros y mapa de campos\n";
$viejo = coche(4, ['marca' => 'Volkswagen', 'modelo' => 'Golf', 'version' => 'TDI 105CV Familiar', 'pvp' => 7500]);
unset($viejo['pvp_cent'], $viejo['precio_financiado_cent']);
feed([$viejo]);
sync(true);
afirmar((int) get_field('precio', $manual->ID) === 7500, 'lee «pvp» en euros de la API antigua');
list($mapa, $errores) = ProService_Ajustes::validar_mapa('{"pvp_cent":{"meta":"precio","formato":"dolares"}}');
afirmar($mapa === null && $errores, 'rechaza un formato desconocido');
list($mapa, $errores) = ProService_Ajustes::validar_mapa('no es json');
afirmar($mapa === null && $errores, 'rechaza un JSON roto');

// --- Limpieza del estado de la API falsa -------------------------------------------------------------
modo('ok');
feed([]);

echo "\n" . PS_Prueba::$total . ' comprobaciones, ' . (PS_Prueba::$total - PS_Prueba::$fallos) . ' bien, ' . PS_Prueba::$fallos . " fallos\n";
exit(PS_Prueba::$fallos ? 1 : 0);
