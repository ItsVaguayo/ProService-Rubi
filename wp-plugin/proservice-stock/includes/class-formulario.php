<?php
/**
 * Formulario de contacto de un coche: información, prueba con día y hora, financiación y tasación con fotos.
 *
 * Sale en la ficha del plugin y, con el shortcode [proservice_contacto], en cualquier sitio de la ficha del
 * tema (proservicerubi.com usa la suya: Francesc lo pone donde quiera). Solo aparece con la dirección de la
 * API en los ajustes. El HTML está en plantillas/formulario.php y el envío en assets/formulario.js.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Formulario
{
    public static function iniciar()
    {
        add_shortcode('proservice_contacto', [__CLASS__, 'shortcode']);
    }

    /** Lo que necesita la plantilla del formulario para el coche de $post_id. */
    public static function datos($post_id)
    {
        $titulo = trim(get_the_title($post_id));
        $precio = ProService_Buscador::dato($post_id, 'pvp_cent');
        $precio_texto = $precio !== '' ? ProService_Buscador::cifra($precio) . ' €' : '';
        $referencia = (string) ProService_Buscador::dato($post_id, 'referencia');
        return [
            'contactos'  => ProService_Ajustes::url_contactos(),
            // La cita necesita el coche: sin referencia en la web (duda B16), la prueba se pide como contacto
            'citas'      => $referencia !== '' ? ProService_Ajustes::url_citas() : '',
            'referencia' => $referencia,
            'sobre'      => $titulo . ' (' . get_permalink($post_id) . ')',
            'whatsapp'   => ProService_Buscador::whatsapp(trim("Hola, me interesa el {$titulo}" . ($precio_texto ? " de {$precio_texto}" : ''))),
        ];
    }

    /** El formulario, ya pintado. '' si no hay API configurada. */
    public static function html($post_id)
    {
        $f = self::datos($post_id);
        if ($f['contactos'] === '') {
            return '';
        }
        self::encolar_js();
        ob_start();
        include PROSERVICE_DIR . 'plantillas/formulario.php';
        return ob_get_clean();
    }

    /** [proservice_contacto] en la ficha de un coche. Fuera de una ficha de «coches», no pinta nada. */
    public static function shortcode($atts = [])
    {
        $post_id = get_the_ID();
        if (!$post_id || get_post_type($post_id) !== ProService_Ajustes::get('tipo_post')) {
            return '';
        }
        $html = self::html($post_id);
        if ($html === '') {
            return '';
        }
        ProService_Buscador::encolar_css();
        return '<div class="ps-web ps-web--incrustado">' . $html . '</div>';
    }

    /** Se encola al pintar el formulario: va al pie aunque wp_enqueue_scripts ya haya pasado. */
    public static function encolar_js()
    {
        wp_enqueue_script('proservice-formulario', PROSERVICE_URL . 'assets/formulario.js', [], PROSERVICE_VERSION, true);
    }
}
