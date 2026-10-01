<?php
/**
 * Plugin Name: Imitación de proservicerubi.com
 * Description: Solo para el WordPress de pruebas. Reproduce lo que la web real expone por su API REST.
 *
 * Comprobado contra https://proservicerubi.com/wp-json el 1-oct-2026:
 *  - Tipo «coches» (rest_base coches) que en REST solo admite título, slug, estado, plantilla y «marca».
 *    No tiene contenido, foto destacada ni campos personalizados.
 *  - Clave «acf» presente pero sin campos: el grupo de campos no está expuesto en REST.
 *  - Contraseñas de aplicación activas.
 *
 * Interruptor: define('PS_ACF_EN_REST', true) en wp-config.php simula que alguien con administrador
 * ha marcado «Mostrar en la API REST» en el grupo de campos de ACF.
 * Los nombres de los campos son una suposición hasta ver los reales.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    register_post_type('coches', [
        'label'        => 'Coches',
        'public'       => true,
        'has_archive'  => 'coches',
        'show_in_rest' => true,
        'rewrite'      => ['slug' => 'coches'],
        'supports'     => ['title'], // como la real: nada de contenido ni foto destacada por REST
    ]);
    register_taxonomy('marca', 'coches', ['label' => 'Marcas', 'public' => true, 'show_in_rest' => true, 'hierarchical' => true]);
});

add_action('acf/include_fields', function () {
    if (!function_exists('acf_add_local_field_group')) {
        return;
    }
    // ACF gratuito no trae el campo «galería»: aquí es un texto con los ids separados por comas.
    // El conector mira el tipo que anuncia el esquema REST y adapta el valor.
    $campos = [
        'precio' => 'number', 'precio_financiado' => 'number', 'anio' => 'number', 'kilometros' => 'number',
        'combustible' => 'text', 'cambio' => 'text', 'potencia' => 'number', 'cilindrada' => 'number',
        'color' => 'text', 'etiqueta_dgt' => 'text', 'carroceria' => 'text', 'estado_venta' => 'text',
        'video' => 'url', 'galeria' => 'text', 'uso_anterior' => 'text',
    ];
    $fields = [];
    foreach ($campos as $nombre => $tipo) {
        $fields[] = ['key' => "field_ps_$nombre", 'label' => $nombre, 'name' => $nombre, 'type' => $tipo];
    }
    acf_add_local_field_group([
        'key'          => 'group_ps_coches',
        'title'        => 'Ficha del coche (imitación)',
        'fields'       => $fields,
        'location'     => [[['param' => 'post_type', 'operator' => '==', 'value' => 'coches']]],
        'show_in_rest' => defined('PS_ACF_EN_REST') && PS_ACF_EN_REST ? 1 : 0,
    ]);
});

// Ficha mínima para ver en el navegador qué ha llegado por REST (la real la pinta el tema hijo).
add_filter('the_content', function ($contenido) {
    if (!is_singular('coches') || !in_the_loop() || !function_exists('get_fields')) {
        return $contenido;
    }
    $campos = get_fields(get_the_ID()) ?: [];
    $salida = '<div class="ficha-imitacion">';
    $ids = array_filter(array_map('intval', explode(',', (string) ($campos['galeria'] ?? ''))));
    foreach (array_slice($ids, 0, 6) as $id) {
        $salida .= wp_get_attachment_image($id, 'medium', false, ['style' => 'display:inline-block;margin:4px']);
    }
    unset($campos['galeria']);
    $salida .= '<table>';
    foreach ($campos as $nombre => $valor) {
        $salida .= '<tr><th>' . esc_html($nombre) . '</th><td>' . esc_html(is_scalar($valor) ? $valor : wp_json_encode($valor)) . '</td></tr>';
    }
    if (!$campos) {
        $salida .= '<tr><td>Sin datos de ACF (el grupo no está expuesto en REST o no se han enviado).</td></tr>';
    }
    return $salida . '</table></div>' . $contenido;
});

