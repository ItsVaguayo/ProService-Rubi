<?php
/**
 * Solo para el WordPress local: imita lo que hay en proservicerubi.com
 * (tipo de contenido «coches» con archivo en /coches/ y taxonomía «marca»).
 * Los campos ACF son una suposición hasta tener el acceso de administrador.
 */
add_action('init', function () {
    register_post_type('coches', [
        'label' => 'Coches', 'public' => true, 'has_archive' => 'coches', 'show_in_rest' => true,
        'rewrite' => ['slug' => 'coches'], 'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
    ]);
    register_taxonomy('marca', 'coches', ['label' => 'Marcas', 'public' => true, 'show_in_rest' => true, 'hierarchical' => true]);
});

add_action('acf/include_fields', function () {
    if (!function_exists('acf_add_local_field_group')) return;
    $campos = [];
    foreach (['precio' => 'number', 'cuota' => 'number', 'anio' => 'number', 'kilometros' => 'number', 'combustible' => 'text',
              'potencia' => 'number', 'cilindrada' => 'number', 'color' => 'text', 'uso_anterior' => 'text'] as $nombre => $tipo) {
        $campos[] = ['key' => "field_sim_$nombre", 'label' => $nombre, 'name' => $nombre, 'type' => $tipo];
    }
    acf_add_local_field_group([
        'key' => 'group_sim_coches', 'title' => 'Ficha del coche (simulada)', 'fields' => $campos,
        'location' => [[['param' => 'post_type', 'operator' => '==', 'value' => 'coches']]],
    ]);
});

// Solo en local: WordPress bloquea descargas de 127.0.0.1 y la API falsa vive ahí.
add_filter('http_request_host_is_external', function ($externo, $host) {
    return $host === '127.0.0.1' ? true : $externo;
}, 10, 2);
add_filter('http_allowed_safe_ports', function ($puertos) {
    $puertos[] = 3998; // API falsa de wp-plugin/pruebas
    $puertos[] = 3001; // API de pruebas (api-pruebas/arrancar.sh)
    return $puertos;
});
