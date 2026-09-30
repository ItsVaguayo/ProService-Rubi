<?php
/**
 * Órdenes de WP-CLI.
 *
 *   wp proservice sync [--forzar]        Sincroniza ahora
 *   wp proservice estado                  Última sincronización y coches vinculados
 *   wp proservice vincular <post> <id>    Une un post que ya existía con un coche de la plataforma
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_CLI
{
    /**
     * Sincroniza el stock con la API.
     *
     * ## OPTIONS
     *
     * [--forzar]
     * : Retira todos los coches aunque el feed llegue vacío.
     */
    public function sync($args, $assoc)
    {
        $r = ProService_Sync::ejecutar(!empty($assoc['forzar']));
        WP_CLI::log(sprintf(
            'Creados %d · actualizados %d · sin cambios %d · retirados %d · fotos descargadas %d · pendientes %d',
            $r['creados'], $r['actualizados'], $r['sin_cambios'], $r['retirados'], $r['fotos_descargadas'], $r['fotos_pendientes']
        ));
        foreach ($r['errores'] as $error) {
            WP_CLI::warning($error);
        }
        $r['errores'] ? WP_CLI::halt(1) : WP_CLI::success('Sincronizado.');
    }

    /** Muestra la última sincronización y los coches vinculados. */
    public function estado()
    {
        $ultima = get_option(ProService_Sync::ULTIMA);
        WP_CLI::log('API: ' . ProService_Ajustes::get('api_url'));
        WP_CLI::log('Última sincronización: ' . ($ultima ? $ultima['fecha'] : 'nunca'));
        $filas = [];
        foreach (ProService_Sync::posts_vinculados(ProService_Ajustes::get('tipo_post')) as $api_id => $p) {
            $filas[] = ['api_id' => $api_id, 'post_id' => $p['post_id'], 'estado' => $p['estado'], 'titulo' => get_the_title($p['post_id'])];
        }
        $filas ? WP_CLI\Utils\format_items('table', $filas, ['api_id', 'post_id', 'estado', 'titulo']) : WP_CLI::log('Ningún coche vinculado.');
    }

    /**
     * Vincula un post existente con un coche de la plataforma. En la próxima sincronización
     * sus datos se sobrescriben con los de la plataforma y su URL se conserva.
     *
     * ## OPTIONS
     *
     * <post_id>
     * : ID del post en WordPress.
     *
     * <api_id>
     * : ID del coche en la plataforma.
     */
    public function vincular($args)
    {
        list($post_id, $api_id) = array_map('intval', $args);
        $error = ProService_Admin::vincular($post_id, $api_id);
        $error ? WP_CLI::error($error) : WP_CLI::success("Post {$post_id} vinculado al coche {$api_id}.");
    }
}
