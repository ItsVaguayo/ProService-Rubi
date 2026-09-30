<?php
/**
 * Plugin Name: Pro Service Stock
 * Description: Mantiene las fichas de «coches» de proservicerubi.com al día con la plataforma de stock, y añade el buscador con filtros.
 * Version: 0.2.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Equipo ECS
 * Text Domain: proservice-stock
 *
 * Cómo funciona: cada 5 minutos lee el feed público de la API y crea, actualiza o retira
 * los posts del tipo «coches» que ya usa la web. No rehace la web (5.2): su plantilla,
 * su diseño y sus URLs se quedan como están. Solo toca los posts que tiene vinculados.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PROSERVICE_VERSION', '0.2.0');
define('PROSERVICE_ARCHIVO', __FILE__);
define('PROSERVICE_DIR', plugin_dir_path(__FILE__));
define('PROSERVICE_URL', plugin_dir_url(__FILE__));

require_once PROSERVICE_DIR . 'includes/class-ajustes.php';
require_once PROSERVICE_DIR . 'includes/class-api.php';
require_once PROSERVICE_DIR . 'includes/class-sync.php';
require_once PROSERVICE_DIR . 'includes/class-admin.php';
require_once PROSERVICE_DIR . 'includes/class-buscador.php';
require_once PROSERVICE_DIR . 'includes/class-redirecciones.php';

register_activation_hook(__FILE__, ['ProService_Sync', 'programar']);
register_deactivation_hook(__FILE__, ['ProService_Sync', 'desprogramar']);

add_action('plugins_loaded', function () {
    ProService_Sync::iniciar();
    ProService_Admin::iniciar();
    ProService_Buscador::iniciar();
    ProService_Redirecciones::iniciar();

    if (defined('WP_CLI') && WP_CLI) {
        require_once PROSERVICE_DIR . 'includes/class-cli.php';
        WP_CLI::add_command('proservice', 'ProService_CLI');
    }
});
