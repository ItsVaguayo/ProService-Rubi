<?php
/**
 * Plugin Name: Imitación de proservicerubi.com
 * Description: Solo para el WordPress de pruebas. Reproduce la web real: su API REST y sus plantillas de coches.
 *
 * Comprobado contra https://proservicerubi.com el 1-oct-2026:
 *  - API REST: tipo «coches» (rest_base coches) que admite título, slug, estado, plantilla y «marca».
 *    Sin contenido ni foto destacada. Hasta el 30-oct la clave «acf» salía vacía (grupo sin exponer en REST).
 *    Contraseñas de aplicación activas.
 *  - Plantillas propias del tema hijo para /coches/ y la ficha (réplica en replica/, ver replica.php).
 *  - Grupo de campos ACF de «coches» (expuesto en REST desde el 30-oct-2026, leído con GET y OPTIONS): los
 *    15 campos de abajo, con sus mismos nombres, tipos y opciones. Sin campo de galería: su galería son las
 *    fotos adjuntas al post, e «imagen_principal» la primera.
 *
 * Interruptor: define('PS_ACF_EN_REST', true) en wp-config.php simula que un administrador ha marcado
 * «Mostrar en la API REST» en el grupo de campos de ACF.
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
    $opciones = function (array $valores) {
        return array_combine($valores, $valores);
    };
    $campos = [
        'precio'           => ['type' => 'number', 'label' => 'Precio', 'required' => 1],
        'financiado'       => ['type' => 'number', 'label' => 'Financiado (€/mes)'],
        'estado_coche'     => ['type' => 'select', 'label' => 'Estado', 'choices' => $opciones(['En venta', 'Reservado', 'Vendido']), 'required' => 1, 'allow_null' => 0],
        'imagen_principal' => ['type' => 'image', 'label' => 'Imagen principal', 'return_format' => 'id'],
        'video'            => ['type' => 'text', 'label' => 'Vídeo'],
        'ano'              => ['type' => 'date_picker', 'label' => 'Año', 'display_format' => 'Y', 'return_format' => 'Y'],
        'combustible'      => ['type' => 'select', 'label' => 'Combustible', 'choices' => $opciones(['Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'])],
        'kilometros'       => ['type' => 'number', 'label' => 'Kilómetros'],
        'cilindrada'       => ['type' => 'text', 'label' => 'Cilindrada'],
        'potencia_cv'      => ['type' => 'number', 'label' => 'Potencia (CV)'],
        'cambio'           => ['type' => 'select', 'label' => 'Cambio', 'choices' => $opciones(['Manual', 'Automático'])],
        'uso_anterior'     => ['type' => 'select', 'label' => 'Uso anterior', 'choices' => $opciones(['Particular', 'Empresa'])],
        'extras'           => ['type' => 'checkbox', 'label' => 'Extras', 'choices' => $opciones(['Aire acondicionado', 'Asientos de cuero', 'Bluetooth', 'Cámara trasera', 'Cierre centralizado', 'Climatizador', 'Dirección asistida', 'Elevalunas eléctrico', 'GPS', 'Llantas aleación', 'Ordenador', 'Techo solar'])],
        'colores'          => ['type' => 'checkbox', 'label' => 'Colores', 'choices' => $opciones(['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul', 'Verde', 'Marrón Turmalina'])],
        'referencia'       => ['type' => 'text', 'label' => 'Referencia'],
    ];
    $fields = [];
    foreach ($campos as $nombre => $campo) {
        $fields[] = array_merge(['key' => "field_ps_$nombre", 'name' => $nombre, 'allow_null' => 1], $campo);
    }
    acf_add_local_field_group([
        'key'          => 'group_ps_coches',
        'title'        => 'Ficha del coche (imitación)',
        'fields'       => $fields,
        'location'     => [[['param' => 'post_type', 'operator' => '==', 'value' => 'coches']]],
        'show_in_rest' => defined('PS_ACF_EN_REST') && PS_ACF_EN_REST ? 1 : 0,
    ]);
});

// Sus plantillas de /coches/ y de la ficha
// Enlazado al repo (montar.sh), __DIR__ es wordpress-pruebas/ y la réplica está en replica/; copiado, al lado
require_once is_file(__DIR__ . '/replica/replica.php') ? __DIR__ . '/replica/replica.php' : __DIR__ . '/imita-proservicerubi/replica.php';
