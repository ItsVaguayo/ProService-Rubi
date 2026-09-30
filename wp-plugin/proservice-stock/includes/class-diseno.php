<?php
/**
 * Modo «página completa»: el listado y la ficha se pintan con la cabecera, el pie y el <head>
 * de frontend/web, a todo el ancho, sin los estilos del tema.
 *
 * Es para el sistema de pruebas y para enseñar la maqueta con datos reales. En proservicerubi.com
 * va apagado: allí la cabecera y el pie los pone su WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Diseno
{
    const FUENTES = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';

    public static function iniciar()
    {
        add_filter('template_include', [__CLASS__, 'plantilla'], 100);
        add_action('wp_enqueue_scripts', [__CLASS__, 'estilos'], 100);
    }

    public static function activo()
    {
        return (bool) ProService_Ajustes::get('diseno_completo');
    }

    /** ¿Es la página del listado (la que lleva el buscador)? */
    public static function es_listado()
    {
        if (!is_page()) {
            return false;
        }
        $pagina = get_queried_object();
        return $pagina && has_shortcode((string) $pagina->post_content, 'proservice_buscador');
    }

    private static function es_ficha()
    {
        return ProService_Ajustes::get('ficha_propia') && is_singular(ProService_Ajustes::get('tipo_post'));
    }

    public static function plantilla($plantilla)
    {
        if (self::activo() && self::es_listado()) {
            return PROSERVICE_DIR . 'plantillas/listado.php';
        }
        return $plantilla; // la ficha la decide ProService_Ficha
    }

    /** En modo completo, fuera los estilos del tema y de bloques: solo manda el CSS de la maqueta. */
    public static function estilos()
    {
        if (!self::activo() || !(self::es_listado() || self::es_ficha())) {
            return;
        }
        $estilos = wp_styles();
        foreach ((array) $estilos->queue as $handle) {
            $src = isset($estilos->registered[$handle]) ? (string) $estilos->registered[$handle]->src : '';
            if (strpos($src, '/themes/') !== false || in_array($handle, ['global-styles', 'wp-block-library', 'wp-block-library-theme', 'classic-theme-styles'], true)) {
                wp_dequeue_style($handle);
            }
        }
        wp_enqueue_style('proservice-fuentes', self::FUENTES, [], null);
        ProService_Buscador::encolar_css();
    }

    public static function cabecera()
    {
        if (self::activo()) {
            include PROSERVICE_DIR . 'plantillas/cabecera.php';
        } else {
            get_header();
        }
    }

    public static function pie()
    {
        if (self::activo()) {
            include PROSERVICE_DIR . 'plantillas/pie.php';
        } else {
            get_footer();
        }
    }
}
