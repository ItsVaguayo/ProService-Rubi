<?php
/**
 * Pruebas del plugin (buscador y ficha). Se lanzan con wp-plugin/pruebas/probar.sh, que hace una
 * copia temporal del WordPress de pruebas: este guion BORRA los coches del WordPress donde corre.
 *
 * Los coches se crean como los deja la API por REST en la réplica de su web: título, marca y campos de
 * ACF (precio en euros, estado «En venta» / «Reservado» / «Vendido», galería como texto «12,13»). Uno más va solo con título, como las fichas hechas a mano de la web.
 */

if (!defined('ABSPATH') || !class_exists('ProService_Buscador')) {
    fwrite(STDERR, "Lánzalo con probar.sh: hace falta WordPress con el plugin activo.\n");
    exit(1);
}
if (!getenv('PS_COPIA_DE_PRUEBAS')) {
    fwrite(STDERR, "Solo corre en la copia que hace probar.sh: borra los coches.\n");
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
    if (!$condicion) {
        PS_Prueba::$fallos++;
    }
    echo ($condicion ? '  ok   ' : '  FALLO ') . $mensaje . "\n";
}

function buscar(array $get, $atts = 'por_pagina="48"')
{
    $_GET = $get;
    $html = do_shortcode("[proservice_buscador {$atts}]");
    $_GET = [];
    preg_match_all('/<a class="tarjeta-coche".*?<h2>([^<]+)<\/h2>/s', $html, $m);
    return [$m[1], $html];
}

function coche($titulo, $marca, array $campos)
{
    $id = wp_insert_post(['post_type' => 'coches', 'post_status' => 'publish', 'post_title' => $titulo]);
    if ($marca) {
        wp_set_object_terms($id, $marca, 'marca');
    }
    foreach ($campos as $campo => $valor) {
        update_post_meta($id, $campo, $valor);
    }
    return $id;
}

function foto($post_id, $color)
{
    // PNG de 2×2 escrito a mano: sin depender de GD
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAwMDAwMAAAA0AAf8Kp6cAAAAASUVORK5CYII=');
    $tmp = wp_tempnam("foto-{$color}.png");
    file_put_contents($tmp, $png);
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    return media_handle_sideload(['name' => "foto-{$color}.png", 'tmp_name' => $tmp], $post_id);
}

// --- Preparación ---------------------------------------------------------------------------------
echo "Preparando\n";
foreach (get_posts(['post_type' => 'coches', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']) as $p) {
    wp_delete_post($p, true);
}
delete_option(ProService_Ajustes::OPCION);
ProService_Buscador::olvidar_opciones();

$ateca = coche('Seat Ateca 1.5 TSI Style', 'Seat', ['precio' => 20900, 'precio_financiado' => 19900, 'kilometros' => 62000, 'anio' => 2020,
    'combustible' => 'gasolina', 'cambio' => 'manual', 'carroceria' => 'suv', 'etiqueta_dgt' => 'C', 'color' => 'gris', 'plazas' => 5,
    'potencia' => 150, 'cilindrada' => 1498, 'estado' => 'En venta', 'video' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
$chr = coche('Toyota C-HR 125H Advance', 'Toyota', ['precio' => 21500, 'kilometros' => 81200, 'anio' => 2019, 'combustible' => 'hibrido',
    'cambio' => 'automatico', 'carroceria' => 'suv', 'etiqueta_dgt' => 'ECO', 'estado' => 'Reservado', 'cuota' => 244,
    'extras' => "Navegador\nFaros LED, Cámara trasera"]);
$ibiza = coche('Seat Ibiza 1.0 TSI FR', 'Seat', ['precio' => 12500, 'kilometros' => 73500, 'anio' => 2019, 'combustible' => 'gasolina',
    'cambio' => 'manual', 'carroceria' => 'utilitario', 'estado' => 'Vendido']);
$manual = coche('VOLKSWAGEN GOLF TDI 105CV FAMILIAR', null, []);
$f1 = foto($ateca, 'rojo');
$f2 = foto($ateca, 'azul');
update_post_meta($ateca, 'galeria', "{$f1},{$f2}");
afirmar(!is_wp_error($f1) && !is_wp_error($f2), 'fotos de prueba creadas');

// --- 1. Buscador -----------------------------------------------------------------------------------
echo "1. Buscador\n";
list($todos, $html) = buscar([]);
afirmar(count($todos) === 4, 'sin filtros salen los 4 publicados, también la ficha hecha a mano');
afirmar(strpos($html, 'precio cifra">Consultar') !== false, 'la ficha sin precio dice «Consultar»');
afirmar(preg_match('/<img[^>]+src="[^"]*foto-rojo[^"]*\.png"[^>]*alt="Seat Ateca/', $html) === 1, 'sin foto destacada, la tarjeta usa la primera foto de la galería');
afirmar(substr_count($html, 'assets/coche.svg') === 3, 'los coches sin fotos llevan la imagen genérica');
afirmar(strpos($html, 'class="cinta">Reservado') !== false && strpos($html, 'cinta cinta--vendido">Vendido') !== false, 'cintas de reservado y vendido');
afirmar(strpos($html, 'precio cifra">20.900 €') !== false && strpos($html, '62.000 km') !== false, 'precio y km con punto de miles');
afirmar(strpos($html, 'cuota cifra">o 244 €/mes') !== false, 'la cuota «Desde X €/mes» de su web sale en la tarjeta');
afirmar(strpos($html, '<option value="hibrido">Híbrido</option>') !== false, 'opciones con nombre legible');
afirmar(strpos($html, 'name="modelo"') === false, 'el filtro de modelo no sale: la web no tiene ese dato');
afirmar(strpos($html, '<div class="ps-web">') !== false && wp_style_is('proservice-web', 'enqueued'), 'dentro de .ps-web y con la hoja generada');
list($r) = buscar(['precio_max' => '13000']);
afirmar($r === ['Seat Ibiza 1.0 TSI FR'], 'precio hasta 13.000 €');
list($r) = buscar(['marca' => 'seat']);
sort($r);
afirmar($r === ['Seat Ateca 1.5 TSI Style', 'Seat Ibiza 1.0 TSI FR'], 'por marca');
list($r) = buscar(['combustible' => 'hibrido', 'cambio' => 'automatico']);
afirmar($r === ['Toyota C-HR 125H Advance'], 'combustible y cambio');
list($r) = buscar(['km_max' => '70000', 'anio_min' => '2020']);
afirmar($r === ['Seat Ateca 1.5 TSI Style'], 'km y año');
list($r) = buscar(['orden' => 'precio']);
afirmar($r === ['Seat Ibiza 1.0 TSI FR', 'Seat Ateca 1.5 TSI Style', 'Toyota C-HR 125H Advance'], 'ordenado por precio (los que tienen precio)');
list(, $html) = buscar(['marca' => '"><script>alert(1)</script>']);
afirmar(strpos($html, '<script>alert') === false, 'los filtros no inyectan HTML');
list($pagina1, $html) = buscar([], 'por_pagina="2"');
list($pagina2) = buscar(['pagina' => '2'], 'por_pagina="2"');
afirmar(count($pagina1) === 2 && count($pagina2) === 2 && !array_intersect($pagina1, $pagina2) && strpos($html, 'paginas__siguiente') !== false, 'paginación de 2 en 2');
list($vacio, $html) = buscar(['precio_max' => '1']);
afirmar(!$vacio && strpos($html, 'class="vacio"') !== false, 'sin resultados sale el aviso');

// --- 2. La caché de opciones sigue a los cambios por REST -----------------------------------------
echo "2. Cambios que llegan por REST\n";
ProService_Buscador::opciones();
afirmar(get_transient(ProService_Buscador::TRANSIENT_OPCIONES) !== false, 'opciones en caché');
update_post_meta($ibiza, 'combustible', 'glp');
do_action('rest_after_insert_coches', get_post($ibiza), null, false);
afirmar(get_transient(ProService_Buscador::TRANSIENT_OPCIONES) === false, 'después de escribir por REST se vacía la caché');
afirmar(isset(ProService_Buscador::opciones()['combustible']['glp']), 'y el filtro ve el dato nuevo');

// --- 3. Ficha ---------------------------------------------------------------------------------------
echo "3. Ficha\n";
ProService_Ajustes::guardar(['whatsapp' => '34600000000', 'pagina_listado' => home_url('/coches-de-ocasion/')]);
$f = ProService_Ficha::datos($ateca);
afirmar($f['precio'] === '20.900 €' && $f['financiado'] === '19.900 €', 'precio y financiado con punto');
afirmar(count($f['fotos']) === 2, 'galería leída del texto «id,id»');
update_post_meta($ateca, 'galeria', [$f2]);
afirmar(count(ProService_Ficha::datos($ateca)['fotos']) === 1, 'y también como lista de ids (ACF Pro)');
afirmar($f['etiqueta'] === ['c', 'C'] && $f['video'] === 'dQw4w9WgXcQ', 'etiqueta DGT y vídeo de YouTube');
afirmar(strpos($f['whatsapp'], 'https://wa.me/34600000000?text=Hola%2C%20me%20interesa%20el%20Seat%20Ateca') === 0, 'WhatsApp con el coche y el precio');
afirmar($f['tecnicos']['Kilómetros'] === '62.000 km' && $f['tecnicos']['Potencia'] === '150 CV', 'datos técnicos');
afirmar($f['extras'] === [], 'sin equipamiento en la web, la sección no sale');
$chr_ficha = ProService_Ficha::datos($chr);
afirmar($chr_ficha['cuota'] === '244 €/mes' && $chr_ficha['estado'] === 'reservado', 'ficha: cuota y estado «Reservado» de su web');
afirmar($chr_ficha['extras'] === ['Navegador', 'Faros LED', 'Cámara trasera'], 'equipamiento escrito como texto, por líneas o comas');
afirmar(ProService_Ficha::datos($manual)['precio'] === '', 'ficha hecha a mano: sin precio, no se inventa');
afirmar(ProService_Ficha::youtube('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && ProService_Ficha::youtube('https://vimeo.com/1') === null, 'solo enlaces de YouTube');

query_posts(['p' => $ateca, 'post_type' => 'coches']);
ProService_Ajustes::guardar(['ficha_propia' => true]);
afirmar(substr(apply_filters('template_include', 'tema.php'), -20) === 'plantillas/ficha.php', 'con el ajuste activo, la ficha es la del plugin');
ProService_Ajustes::guardar(['ficha_propia' => false]);
afirmar(strpos(apply_filters('template_include', 'tema.php'), 'proservice-stock/plantillas/ficha.php') === false, 'apagado, no impone su ficha: manda la del tema (en la réplica, la de su web)');
wp_reset_query();

// --- 4. Coches retirados: 301 al listado ------------------------------------------------------------
echo "4. Coches retirados\n";
$listado = home_url('/coches-de-ocasion/');
ProService_Ajustes::guardar(['pagina_listado' => $listado]);
$slug_ibiza = get_post_field('post_name', $ibiza);
afirmar(ProService_Redirecciones::destino("coches/{$slug_ibiza}") === null, 'un coche publicado no se redirige');
wp_update_post(['ID' => $ibiza, 'post_status' => 'draft']); // lo que hace la API al venderlo
afirmar(ProService_Redirecciones::destino("coches/{$slug_ibiza}/") === $listado, 'retirado (borrador): 301 a la página del listado');
afirmar(ProService_Redirecciones::destino('coches/no-ha-existido-nunca') === null, 'una URL que nunca existió sigue dando 404');
afirmar(ProService_Redirecciones::destino("otra-cosa/{$slug_ibiza}") === null, 'solo dentro de /coches/');
afirmar(ProService_Redirecciones::destino("coches/{$slug_ibiza}/page/2") === null, 'rutas raras no se tocan');
ProService_Ajustes::guardar(['pagina_listado' => '']);
afirmar(ProService_Redirecciones::destino("coches/{$slug_ibiza}") === get_post_type_archive_link('coches'), 'sin página de listado configurada, va al archivo de coches');
wp_delete_post($ibiza, true);
afirmar(ProService_Redirecciones::destino("coches/{$slug_ibiza}") === null, 'un coche borrado a mano en WordPress da 404');

// --- 5. Ajustes y lo que queda de la 0.3 -----------------------------------------------------------
echo "5. Ajustes\n";
list($mapa, $errores) = ProService_Ajustes::validar_mapa('{"pvp_cent":"precio_venta"}');
afirmar($mapa === ['pvp_cent' => 'precio_venta'] && !$errores, 'mapa {"dato": "campo"}');
list($mapa, $errores) = ProService_Ajustes::validar_mapa('{"pvp_cent":"Precio Venta"}');
afirmar($mapa === null && $errores, 'rechaza un nombre de campo inválido');
list($mapa, $errores) = ProService_Ajustes::validar_mapa('no es json');
afirmar($mapa === null && $errores, 'rechaza un JSON roto');
ProService_Ajustes::guardar(['mapa' => ['pvp_cent' => ['meta' => 'precio', 'formato' => 'euros']]]);
afirmar(ProService_Ajustes::meta_de('pvp_cent') === 'precio', 'entiende el mapa guardado por la versión 0.3');
delete_option(ProService_Ajustes::OPCION);
wp_schedule_event(time() + 60, 'hourly', 'proservice_sync');
do_action('plugins_loaded');
afirmar(!wp_next_scheduled('proservice_sync'), 'quita la tarea de sincronización de la versión 0.3');
afirmar(!class_exists('ProService_Sync'), 'la sincronización ya no existe en el plugin');

echo "\n" . PS_Prueba::$total . ' comprobaciones, ' . (PS_Prueba::$total - PS_Prueba::$fallos) . ' bien, ' . PS_Prueba::$fallos . " fallos\n";
exit(PS_Prueba::$fallos ? 1 : 0);
