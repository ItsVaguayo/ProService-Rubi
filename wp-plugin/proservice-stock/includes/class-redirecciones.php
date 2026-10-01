<?php
/**
 * Coches retirados: 301 al listado.
 *
 * Cuando un coche se vende o se entrega, la plataforma pasa su post a borrador por la API REST.
 * Su URL (/coches/<nombre>/) está indexada en Google y guardada por clientes, y daría 404:
 * se manda con un 301 a la página del listado. Basta con que el post exista y no esté publicado;
 * los que se borran a mano en WordPress siguen dando 404.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Redirecciones
{
    public static function iniciar()
    {
        add_action('template_redirect', [__CLASS__, 'redirigir'], 1);
    }

    public static function redirigir()
    {
        if (!is_404()) {
            return;
        }
        global $wp;
        $destino = self::destino((string) $wp->request);
        if ($destino) {
            wp_safe_redirect($destino, 301, 'Pro Service Buscador');
            exit;
        }
    }

    /** Adónde mandar una ruta como «coches/seat-ibiza», o null si no es un coche retirado. */
    public static function destino($ruta)
    {
        $tipo = ProService_Ajustes::get('tipo_post');
        $objeto = get_post_type_object($tipo);
        if (!$objeto) {
            return null;
        }
        $base = is_array($objeto->rewrite) && !empty($objeto->rewrite['slug']) ? trim($objeto->rewrite['slug'], '/') : $tipo;
        $ruta = trim($ruta, '/');
        if (strpos($ruta, $base . '/') !== 0) {
            return null;
        }
        $slug = substr($ruta, strlen($base) + 1);
        if ($slug === '' || strpos($slug, '/') !== false || sanitize_title($slug) !== $slug) {
            return null;
        }
        $retirado = get_posts([
            'post_type' => $tipo, 'name' => $slug, 'post_status' => ['draft', 'pending', 'private'],
            'numberposts' => 1, 'fields' => 'ids',
        ]);
        if (!$retirado) {
            return null;
        }
        return ProService_Ajustes::get('pagina_listado') ?: get_post_type_archive_link($tipo) ?: home_url('/');
    }
}
