<?php
/**
 * Plugin Name: Pro Service Stock
 * Description: Muestra en proservicerubi.com los coches publicados desde la plataforma de stock.
 * Version: 0.1.0
 * Author: Equipo ECS
 *
 * Dueño: David. Se conecta a la web actual (5.2), no la sustituye.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('PROSERVICE_API_URL', getenv('PROSERVICE_API_URL') ?: 'http://localhost:3001/api');

function proservice_obtener_coches() {
    $cache = get_transient('proservice_coches');
    if ($cache !== false) {
        return $cache;
    }
    $res = wp_remote_get(PROSERVICE_API_URL . '/publicacion/feed/web', ['timeout' => 10]);
    if (is_wp_error($res)) {
        return [];
    }
    $coches = json_decode(wp_remote_retrieve_body($res), true) ?: [];
    set_transient('proservice_coches', $coches, 5 * MINUTE_IN_SECONDS);
    return $coches;
}

// Uso en una página: [proservice_stock]
// TODO(David): buscador con los filtros de 5.4, ficha pública, formularios y botón de WhatsApp (5.6)
add_shortcode('proservice_stock', function () {
    $coches = proservice_obtener_coches();
    if (!$coches) {
        return '<p>No hay coches disponibles ahora mismo.</p>';
    }
    $html = '<div class="proservice-stock">';
    foreach ($coches as $c) {
        $reservado = $c['estado'] === 'reservado' ? ' <span class="reservado">Reservado</span>' : '';
        $html .= sprintf(
            '<article><h3>%s %s %s</h3><p>%s · %s km · %s</p>%s</article>',
            esc_html($c['marca']),
            esc_html($c['modelo']),
            esc_html($c['version']),
            esc_html($c['anio']),
            esc_html(number_format_i18n($c['kilometros'])),
            $c['pvp_cent'] === null ? 'Consultar' : esc_html(number_format_i18n($c['pvp_cent'] / 100) . ' €'), // la API da céntimos
            $reservado
        );
    }
    return $html . '</div>';
});
