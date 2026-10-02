<?php
/**
 * Plugin Name: Pro Service Buscador
 * Description: Buscador con filtros y ficha opcional para los coches de proservicerubi.com. Los coches los publica la plataforma de stock por la API REST de WordPress.
 * Version: 0.5.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Equipo ECS
 * Text Domain: proservice-stock
 *
 * Qué hace: [proservice_buscador] con los filtros de la 5.4 sobre los posts «coches», y una ficha con
 * el diseño de frontend/web que se puede activar en los ajustes, y 301 al listado de los coches retirados.
 * No habla con la plataforma ni escribe
 * coches: eso lo hace la API con un usuario Editor (api/src/modules/publicacion/wordpress.js).
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PROSERVICE_VERSION', '0.5.0');
define('PROSERVICE_DIR', plugin_dir_path(__FILE__));
define('PROSERVICE_URL', plugin_dir_url(__FILE__));

require_once PROSERVICE_DIR . 'includes/class-ajustes.php';
require_once PROSERVICE_DIR . 'includes/class-admin.php';
require_once PROSERVICE_DIR . 'includes/class-buscador.php';
require_once PROSERVICE_DIR . 'includes/class-ficha.php';
require_once PROSERVICE_DIR . 'includes/class-redirecciones.php';

add_action('plugins_loaded', function () {
    ProService_Admin::iniciar();
    ProService_Buscador::iniciar();
    ProService_Ficha::iniciar();
    ProService_Redirecciones::iniciar();

    // La versión 0.3 sincronizaba cada 5 minutos: si se actualiza encima, se quita esa tarea.
    if (wp_next_scheduled('proservice_sync')) {
        wp_clear_scheduled_hook('proservice_sync');
    }
});
