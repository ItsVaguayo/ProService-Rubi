<?php
/**
 * Un coche retirado (post en borrador) deja su URL en 404. Google la tiene indexada y alguien
 * puede tenerla guardada, así que se manda al listado con un 301.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Redirecciones
{
    public static function iniciar()
    {
        add_action('template_redirect', [__CLASS__, 'redirigir_retirados']);
    }

    public static function redirigir_retirados()
    {
        if (!is_404()) {
            return;
        }
        global $wp;
        $slug = sanitize_title(wp_basename((string) $wp->request));
        if (!$slug) {
            return;
        }
        $tipo = ProService_Ajustes::get('tipo_post');
        $retirados = get_posts([
            'post_type' => $tipo, 'post_status' => 'draft', 'name' => $slug, 'numberposts' => 1, 'fields' => 'ids',
            'meta_key' => '_proservice_retirado', 'meta_compare' => 'EXISTS',
        ]);
        if (!$retirados) {
            return;
        }
        $destino = ProService_Ajustes::get('pagina_listado') ?: get_post_type_archive_link($tipo) ?: home_url('/');
        wp_safe_redirect($destino, 301, 'Pro Service Stock');
        exit;
    }
}
