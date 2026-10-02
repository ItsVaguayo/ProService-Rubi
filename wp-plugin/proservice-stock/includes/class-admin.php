<?php
/**
 * Ajustes → Pro Service Buscador: dónde están los datos de cada coche y cómo se enseña la ficha.
 * Los coches no se gestionan aquí: los publica la plataforma por la API REST de WordPress.
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
    }

    public static function menu()
    {
        add_options_page('Pro Service Buscador', 'Pro Service Buscador', 'manage_options', self::PAGINA, [__CLASS__, 'pagina']);
    }

    public static function pagina()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $a = ProService_Ajustes::todos();
        $mensaje = isset($_GET['proservice_msg']) ? sanitize_text_field(wp_unslash($_GET['proservice_msg'])) : '';
        $publicados = wp_count_posts($a['tipo_post']);
        ?>
        <div class="wrap">
            <h1>Pro Service Buscador</h1>
            <?php if ($mensaje) : ?>
                <div class="notice notice-info"><p><?php echo esc_html($mensaje); ?></p></div>
            <?php endif; ?>

            <p>
                Los coches los publica la plataforma de stock por la API REST de WordPress. Este plugin solo añade el
                buscador <code>[proservice_buscador]</code> y, si se activa, la ficha con el diseño de la maqueta.
                <br>Coches publicados ahora: <strong><?php echo (int) ($publicados->publish ?? 0); ?></strong>.
            </p>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="proservice_guardar">
                <?php wp_nonce_field('proservice_guardar'); ?>
                <table class="form-table" role="presentation">
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
                        <th scope="row"><label for="ps-api">Dirección de la API</label></th>
                        <td><input id="ps-api" name="api_url" type="url" class="regular-text" value="<?php echo esc_attr($a['api_url']); ?>" placeholder="https://stock.proservicerubi.com">
                            <p class="description">Adonde manda el formulario de la ficha («Pregúntanos por este coche»). Sin ella, la ficha del plugin no enseña el formulario. La API tiene que tener este dominio en <code>CORS_ORIGENES</code>.</p></td>
                    </tr>
                    <tr>
                        <th scope="row">Ficha del coche</th>
                        <td>
                            <label><input name="ficha_propia" type="checkbox" value="1" <?php checked($a['ficha_propia']); ?>> Usar la ficha del plugin (diseño de frontend/web)</label>
                            <p class="description">Apagado, cada coche se ve con la plantilla del tema, como hoy en proservicerubi.com.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-listado">Página del listado</label></th>
                        <td><input id="ps-listado" name="pagina_listado" type="url" class="regular-text" value="<?php echo esc_attr($a['pagina_listado']); ?>" placeholder="<?php echo esc_attr(home_url('/coches-de-ocasion/')); ?>">
                            <p class="description">Donde está el <code>[proservice_buscador]</code>. La usa la miga de pan de la ficha.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="ps-mapa">Mapa de campos</label></th>
                        <td>
                            <textarea id="ps-mapa" name="mapa" rows="16" class="large-text code"><?php echo esc_textarea(wp_json_encode($a['mapa'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></textarea>
                            <p class="description">Dato → campo de la web donde lo deja la plataforma. Tiene que coincidir con el <code>WP_MAPA</code> de la API. Los precios están en euros.</p>
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
            echo '<p>ACF no está activo.</p>';
            return;
        }
        $grupos = acf_get_field_groups(['post_type' => $tipo]);
        if (!$grupos) {
            echo '<p>No hay grupos de campos ACF para este tipo de contenido.</p>';
            return;
        }
        $en_uso = array_values(ProService_Ajustes::get('mapa'));
        echo '<table class="widefat striped"><thead><tr><th>Grupo</th><th>Etiqueta</th><th>Nombre</th><th>Tipo</th><th>¿En la API REST?</th><th>¿En el mapa?</th></tr></thead><tbody>';
        foreach ($grupos as $grupo) {
            foreach (acf_get_fields($grupo) ?: [] as $campo) {
                printf(
                    '<tr><td>%s</td><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td></tr>',
                    esc_html($grupo['title']), esc_html($campo['label']), esc_html($campo['name']), esc_html($campo['type']),
                    !empty($grupo['show_in_rest']) ? 'Sí' : '<strong>No</strong>',
                    in_array($campo['name'], $en_uso, true) ? 'Sí' : '—'
                );
            }
        }
        echo '</tbody></table>';
        echo '<p class="description">Si «¿En la API REST?» dice No, la plataforma no puede escribir ese campo: hay que activar «Mostrar en la API REST» en el grupo de campos.</p>';
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
        ProService_Ajustes::guardar([
            'tipo_post'      => sanitize_key(wp_unslash($_POST['tipo_post'] ?? 'coches')),
            'taxonomia'      => sanitize_key(wp_unslash($_POST['taxonomia'] ?? 'marca')),
            'whatsapp'       => preg_replace('/\D/', '', wp_unslash($_POST['whatsapp'] ?? '')),
            'ficha_propia'   => !empty($_POST['ficha_propia']),
            'pagina_listado' => esc_url_raw(wp_unslash($_POST['pagina_listado'] ?? ''), ['http', 'https']),
            'api_url'        => untrailingslashit(esc_url_raw(wp_unslash($_POST['api_url'] ?? ''), ['http', 'https'])),
            'mapa'           => $mapa,
        ]);
        ProService_Buscador::olvidar_opciones();
        self::volver('Ajustes guardados.');
    }

    private static function volver($mensaje)
    {
        wp_safe_redirect(add_query_arg(['page' => self::PAGINA, 'proservice_msg' => rawurlencode($mensaje)], admin_url('options-general.php')));
        exit;
    }
}
