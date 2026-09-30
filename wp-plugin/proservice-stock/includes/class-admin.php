<?php
/**
 * Escritorio de WordPress: página de ajustes, botón de sincronizar, aviso de errores
 * y caja para vincular un coche que ya existía en la web con su ficha de la plataforma.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Admin
{
    const PAGINA = 'proservice-stock';

    public static function iniciar()
    {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_proservice_guardar', [__CLASS__, 'guardar']);
        add_action('admin_post_proservice_sincronizar', [__CLASS__, 'sincronizar']);
        add_action('admin_notices', [__CLASS__, 'aviso_errores']);
        add_action('add_meta_boxes', [__CLASS__, 'caja_vinculo']);
        add_action('save_post', [__CLASS__, 'guardar_vinculo'], 10, 2);
    }

    public static function menu()
    {
        add_options_page('Pro Service Stock', 'Pro Service Stock', 'manage_options', self::PAGINA, [__CLASS__, 'pagina']);
    }

    public static function pagina()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $a = ProService_Ajustes::todos();
        $ultima = get_option(ProService_Sync::ULTIMA);
        $proxima = wp_next_scheduled(ProService_Sync::EVENTO);
        $mensaje = isset($_GET['proservice_msg']) ? sanitize_text_field(wp_unslash($_GET['proservice_msg'])) : '';
        ?>
        <div class="wrap">
            <h1>Pro Service Stock</h1>
            <?php if ($mensaje) : ?>
                <div class="notice notice-info"><p><?php echo esc_html($mensaje); ?></p></div>
            <?php endif; ?>

            <h2>Sincronización</h2>
            <p>
                Última: <strong><?php echo $ultima ? esc_html($ultima['fecha']) : 'nunca'; ?></strong>
                <?php if ($ultima) : ?>
                    · creados <?php echo (int) $ultima['creados']; ?>
                    · actualizados <?php echo (int) $ultima['actualizados']; ?>
                    · sin cambios <?php echo (int) $ultima['sin_cambios']; ?>
                    · retirados <?php echo (int) $ultima['retirados']; ?>
                    · fotos pendientes <?php echo (int) $ultima['fotos_pendientes']; ?>
                <?php endif; ?>
                <br>Próxima automática: <?php echo $proxima ? esc_html(get_date_from_gmt(gmdate('Y-m-d H:i:s', $proxima))) : 'sin programar (reactiva el plugin)'; ?>
            </p>
            <?php if ($ultima && $ultima['errores']) : ?>
                <div class="notice notice-error inline"><ul>
                    <?php foreach ($ultima['errores'] as $error) : ?><li><?php echo esc_html($error); ?></li><?php endforeach; ?>
                </ul></div>
            <?php endif; ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="proservice_sincronizar">
                <?php wp_nonce_field('proservice_sincronizar'); ?>
                <?php submit_button('Sincronizar ahora', 'secondary', 'submit', false); ?>
            </form>

            <h2>Ajustes</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="proservice_guardar">
                <?php wp_nonce_field('proservice_guardar'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="ps-api">URL de la API</label></th>
                        <td>
                            <input id="ps-api" name="api_url" type="url" class="regular-text" value="<?php echo esc_attr($a['api_url']); ?>" <?php disabled(defined('PROSERVICE_API_URL')); ?>>
                            <?php if (defined('PROSERVICE_API_URL')) : ?><p class="description">Fijada en wp-config.php con PROSERVICE_API_URL.</p><?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-tipo">Tipo de contenido</label></th>
                        <td><input id="ps-tipo" name="tipo_post" class="regular-text" value="<?php echo esc_attr($a['tipo_post']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-tax">Taxonomía de marca</label></th>
                        <td><input id="ps-tax" name="taxonomia" class="regular-text" value="<?php echo esc_attr($a['taxonomia']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-wa">WhatsApp (solo números, con prefijo)</label></th>
                        <td><input id="ps-wa" name="whatsapp" class="regular-text" inputmode="numeric" value="<?php echo esc_attr($a['whatsapp']); ?>" placeholder="34600000000"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-mapa">Mapa de campos</label></th>
                        <td>
                            <textarea id="ps-mapa" name="mapa" rows="16" class="large-text code"><?php echo esc_textarea(wp_json_encode($a['mapa'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></textarea>
                            <p class="description">Dato del feed → campo de WordPress. Formatos: <code>texto</code>, <code>entero</code>, <code>euros</code> (el feed da céntimos) y <code>galeria</code>.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Guardar ajustes'); ?>
            </form>

            <h2>Campos ACF de «<?php echo esc_html($a['tipo_post']); ?>»</h2>
            <?php self::tabla_campos_acf($a['tipo_post']); ?>
        </div>
        <?php
    }

    /** Lista los campos ACF del tipo de contenido para poder rellenar el mapa sin tocar código. */
    private static function tabla_campos_acf($tipo)
    {
        if (!function_exists('acf_get_field_groups')) {
            echo '<p>ACF no está activo: los datos se guardarán como campos personalizados normales.</p>';
            return;
        }
        $grupos = acf_get_field_groups(['post_type' => $tipo]);
        if (!$grupos) {
            echo '<p>No hay grupos de campos ACF para este tipo de contenido.</p>';
            return;
        }
        $en_uso = wp_list_pluck(ProService_Ajustes::get('mapa'), 'meta');
        echo '<table class="widefat striped"><thead><tr><th>Grupo</th><th>Etiqueta</th><th>Nombre</th><th>Tipo</th><th>¿En el mapa?</th></tr></thead><tbody>';
        foreach ($grupos as $grupo) {
            foreach (acf_get_fields($grupo) ?: [] as $campo) {
                printf(
                    '<tr><td>%s</td><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s</td></tr>',
                    esc_html($grupo['title']), esc_html($campo['label']), esc_html($campo['name']),
                    esc_html($campo['type']), in_array($campo['name'], $en_uso, true) ? 'Sí' : '—'
                );
            }
        }
        echo '</tbody></table>';
    }

    public static function guardar()
    {
        if (!current_user_can('manage_options')) {
            wp_die('Sin permiso', 403);
        }
        check_admin_referer('proservice_guardar');

        list($mapa, $errores) = ProService_Ajustes::validar_mapa(wp_unslash($_POST['mapa'] ?? ''));
        if ($errores) {
            self::volver(implode(' ', $errores));
        }
        $nuevos = [
            'tipo_post' => sanitize_key(wp_unslash($_POST['tipo_post'] ?? 'coches')),
            'taxonomia' => sanitize_key(wp_unslash($_POST['taxonomia'] ?? 'marca')),
            'whatsapp'  => preg_replace('/\D/', '', wp_unslash($_POST['whatsapp'] ?? '')),
            'mapa'      => $mapa,
        ];
        if (!defined('PROSERVICE_API_URL') && isset($_POST['api_url'])) {
            $nuevos['api_url'] = esc_url_raw(wp_unslash($_POST['api_url']), ['http', 'https']);
        }
        ProService_Ajustes::guardar($nuevos);
        ProService_Buscador::olvidar_opciones();
        self::volver('Ajustes guardados.');
    }

    public static function sincronizar()
    {
        if (!current_user_can('manage_options')) {
            wp_die('Sin permiso', 403);
        }
        check_admin_referer('proservice_sincronizar');
        $r = ProService_Sync::ejecutar();
        self::volver($r['errores']
            ? 'Sincronización con errores. Míralos abajo.'
            : sprintf('Sincronizado: %d nuevos, %d actualizados, %d retirados.', $r['creados'], $r['actualizados'], $r['retirados']));
    }

    private static function volver($mensaje)
    {
        wp_safe_redirect(add_query_arg(['page' => self::PAGINA, 'proservice_msg' => rawurlencode($mensaje)], admin_url('options-general.php')));
        exit;
    }

    public static function aviso_errores()
    {
        $aviso = get_transient('proservice_aviso_' . get_current_user_id());
        if ($aviso) {
            delete_transient('proservice_aviso_' . get_current_user_id());
            printf('<div class="notice notice-error"><p>Pro Service Stock: %s</p></div>', esc_html($aviso));
        }
        if (!current_user_can('manage_options') || (isset($_GET['page']) && $_GET['page'] === self::PAGINA)) {
            return;
        }
        $ultima = get_option(ProService_Sync::ULTIMA);
        if (!$ultima || !$ultima['errores']) {
            return;
        }
        printf(
            '<div class="notice notice-warning"><p>Pro Service Stock: la última sincronización (%s) tuvo errores. <a href="%s">Ver detalle</a></p></div>',
            esc_html($ultima['fecha']),
            esc_url(admin_url('options-general.php?page=' . self::PAGINA))
        );
    }

    // --- Vincular un post existente -------------------------------------------------------

    public static function caja_vinculo()
    {
        add_meta_box('proservice-vinculo', 'Plataforma de stock', [__CLASS__, 'pintar_caja'], ProService_Ajustes::get('tipo_post'), 'side');
    }

    public static function pintar_caja($post)
    {
        $api_id = get_post_meta($post->ID, '_proservice_id', true);
        wp_nonce_field('proservice_vinculo', 'proservice_vinculo_nonce');
        ?>
        <p>
            <label for="ps-api-id">ID del coche en la plataforma</label>
            <input id="ps-api-id" name="proservice_api_id" type="number" min="1" class="widefat" value="<?php echo esc_attr($api_id); ?>">
        </p>
        <?php if ($api_id) : ?>
            <p class="description">Referencia <?php echo esc_html(get_post_meta($post->ID, '_proservice_referencia', true) ?: '—'); ?>.
            Los datos de este coche los manda la plataforma: lo que se edite aquí se pisa en la siguiente sincronización.</p>
        <?php else : ?>
            <p class="description">Sin vincular: la plataforma no toca este post. Al vincularlo, sus datos se sustituyen por los de la plataforma y la URL se conserva.</p>
        <?php endif;
    }

    public static function guardar_vinculo($post_id, $post)
    {
        if ($post->post_type !== ProService_Ajustes::get('tipo_post') || wp_is_post_revision($post_id)
            || !isset($_POST['proservice_vinculo_nonce'])
            || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['proservice_vinculo_nonce'])), 'proservice_vinculo')
            || !current_user_can('edit_post', $post_id)) {
            return;
        }
        $api_id = (int) ($_POST['proservice_api_id'] ?? 0);
        if ($api_id === (int) get_post_meta($post_id, '_proservice_id', true)) {
            return;
        }
        if (!$api_id) {
            delete_post_meta($post_id, '_proservice_id');
            delete_post_meta($post_id, '_proservice_huella');
            return;
        }
        $error = self::vincular($post_id, $api_id);
        if ($error) {
            set_transient('proservice_aviso_' . get_current_user_id(), $error, MINUTE_IN_SECONDS);
        }
    }

    /** @return string|null Mensaje de error, o null si ha ido bien. */
    public static function vincular($post_id, $api_id)
    {
        $tipo = ProService_Ajustes::get('tipo_post');
        if (get_post_type($post_id) !== $tipo) {
            return "El post {$post_id} no es del tipo «{$tipo}».";
        }
        if ($api_id < 1) {
            return 'El ID de la plataforma tiene que ser un número positivo.';
        }
        $vinculados = ProService_Sync::posts_vinculados($tipo);
        if (isset($vinculados[$api_id]) && $vinculados[$api_id]['post_id'] !== $post_id) {
            return "El coche {$api_id} ya está vinculado al post {$vinculados[$api_id]['post_id']}.";
        }
        update_post_meta($post_id, '_proservice_id', $api_id);
        delete_post_meta($post_id, '_proservice_huella'); // que la próxima pasada lo reescriba entero
        return null;
    }
}
