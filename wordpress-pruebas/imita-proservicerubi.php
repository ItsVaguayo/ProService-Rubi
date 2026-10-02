<?php
/**
 * Plugin Name: Imitación de proservicerubi.com
 * Description: Solo para el WordPress de pruebas. Reproduce la web real: su API REST y sus plantillas de coches.
 *
 * Comprobado contra https://proservicerubi.com el 1-oct-2026:
 *  - API REST: tipo «coches» (rest_base coches) que solo admite título, slug, estado, plantilla y «marca».
 *    Sin contenido, foto destacada ni campos personalizados. Clave «acf» presente pero vacía (el grupo
 *    de campos no está expuesto en REST). Contraseñas de aplicación activas.
 *  - Plantillas propias del tema hijo para /coches/ y la ficha (réplica en replica/, ver replica.php).
 *  - Datos que pintan esas plantillas: precio, cuota («Desde X €/mes»), estado (En venta, Reservado,
 *    Vendido), kilómetros, combustible (Gasolina, Diésel, Híbrido…), potencia, cilindrada, uso anterior,
 *    color, año y galería.
 *
 * Los NOMBRES de los campos ACF son una suposición sacada de sus etiquetas y de los parámetros de su
 * filtro (precio_max, potencia_min, estado). Los reales solo se ven con acceso de administrador o
 * cuando el grupo esté expuesto en REST.
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
    // ACF gratuito no trae el campo «galería» (su web usa ACF Pro o similar): aquí es texto con los ids
    // separados por comas. El conector de la API mira el tipo que anuncia el esquema REST y se adapta.
    $campos = [
        'precio'       => ['type' => 'number', 'label' => 'Precio (€)'],
        'cuota'        => ['type' => 'number', 'label' => 'Cuota desde (€/mes)'],
        'modelo'       => ['type' => 'text', 'label' => 'Modelo (título de la ficha)'],
        'anio'         => ['type' => 'number', 'label' => 'Año'],
        'combustible'  => ['type' => 'select', 'label' => 'Combustible', 'choices' => $opciones(['Gasolina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'GLP'])],
        'kilometros'   => ['type' => 'number', 'label' => 'Kilómetros'],
        'potencia'     => ['type' => 'number', 'label' => 'Potencia (CV)'],
        'cilindrada'   => ['type' => 'number', 'label' => 'Cilindrada (cc)'],
        'uso_anterior' => ['type' => 'select', 'label' => 'Uso anterior', 'choices' => $opciones(['Particular', 'Empresa', 'Renting', 'Rent a car'])],
        'color'        => ['type' => 'text', 'label' => 'Color'],
        'estado'       => ['type' => 'select', 'label' => 'Estado', 'choices' => $opciones(['En venta', 'Reservado', 'Vendido']), 'default_value' => 'En venta'],
        'galeria'      => ['type' => 'text', 'label' => 'Galería (ids)'],
        'video'        => ['type' => 'url', 'label' => 'Vídeo'],
        'extras'       => ['type' => 'textarea', 'label' => 'Extras'],
        'seguridad'    => ['type' => 'textarea', 'label' => 'Seguridad'],
        // NO está en su web: lo añadimos para el formulario de la ficha (el contacto llega con su coche).
        // En la real hay que pedir a Francesc que cree este campo de texto en el grupo (duda B16).
        'referencia'   => ['type' => 'text', 'label' => 'Referencia de la plataforma (PS-00001)'],
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
require_once __DIR__ . '/imita-proservicerubi/replica.php';
