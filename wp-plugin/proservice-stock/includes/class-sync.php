<?php
/**
 * Sincronización del feed con los posts del tipo «coches».
 *
 * Reglas:
 *  - Solo se tocan posts vinculados (meta _proservice_id). Los que se crearon a mano en la web
 *    siguen igual hasta que alguien los vincule desde su pantalla de edición.
 *  - La URL de un post no cambia nunca después de crearlo: está indexada.
 *  - Si un coche deja de venir en el feed, su post pasa a borrador (no se borra) y su URL
 *    redirige al listado (ver ProService_Redirecciones).
 *  - Si la API falla o devuelve la lista vacía, no se retira nada. Una caída de la API no puede
 *    vaciar la web.
 *  - Un coche sin cambios (misma huella) no se reescribe.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Sync
{
    const EVENTO = 'proservice_sync';
    const BLOQUEO = 'proservice_sync_bloqueo';
    const ULTIMA = 'proservice_ultima_sync';
    const FOTOS_POR_PASADA = 40; // descargas por ejecución, para no pasarse del tiempo de PHP

    public static function iniciar()
    {
        add_filter('cron_schedules', function ($horarios) {
            $horarios['proservice_5min'] = ['interval' => 5 * MINUTE_IN_SECONDS, 'display' => 'Cada 5 minutos'];
            return $horarios;
        });
        add_action(self::EVENTO, [__CLASS__, 'ejecutar']);
    }

    public static function programar()
    {
        if (!wp_next_scheduled(self::EVENTO)) {
            wp_schedule_event(time() + 60, 'proservice_5min', self::EVENTO);
        }
    }

    public static function desprogramar()
    {
        wp_clear_scheduled_hook(self::EVENTO);
    }

    /**
     * @param bool $forzar Permite retirar todo si el feed llega vacío (solo a mano, desde WP-CLI).
     * @return array Resumen de lo hecho.
     */
    public static function ejecutar($forzar = false)
    {
        $resumen = [
            'fecha' => current_time('mysql'), 'creados' => 0, 'actualizados' => 0, 'sin_cambios' => 0,
            'retirados' => 0, 'fotos_descargadas' => 0, 'fotos_pendientes' => 0, 'errores' => [],
        ];

        if (get_transient(self::BLOQUEO)) {
            $resumen['errores'][] = 'Ya hay una sincronización en marcha.';
            return $resumen;
        }
        set_transient(self::BLOQUEO, 1, 10 * MINUTE_IN_SECONDS);

        try {
            self::sincronizar($resumen, (bool) $forzar);
        } catch (Throwable $e) {
            $resumen['errores'][] = 'Error inesperado: ' . $e->getMessage();
        } finally {
            delete_transient(self::BLOQUEO);
        }

        update_option(self::ULTIMA, $resumen, false);
        if ($resumen['errores']) {
            error_log('[proservice-stock] ' . implode(' | ', $resumen['errores']));
        }
        do_action('proservice_sync_terminada', $resumen);
        return $resumen;
    }

    private static function sincronizar(array &$resumen, $forzar)
    {
        $tipo = ProService_Ajustes::get('tipo_post');
        if (!post_type_exists($tipo)) {
            $resumen['errores'][] = "No existe el tipo de contenido «{$tipo}».";
            return;
        }

        $feed = ProService_Api::obtener_feed();
        if (is_wp_error($feed)) {
            $resumen['errores'][] = $feed->get_error_message();
            return;
        }

        $vinculados = self::posts_vinculados($tipo);
        $publicados = array_filter($vinculados, function ($p) {
            return $p['estado'] === 'publish';
        });

        if (!$feed && $publicados && !$forzar) {
            $resumen['errores'][] = 'El feed llegó vacío y hay ' . count($publicados)
                . ' coches publicados. No se retira nada. Si de verdad no queda stock: wp proservice sync --forzar';
            return;
        }

        $presupuesto_fotos = self::FOTOS_POR_PASADA;
        $en_feed = [];

        foreach ($feed as $coche) {
            $en_feed[$coche['id']] = true;
            $post_id = isset($vinculados[$coche['id']]) ? $vinculados[$coche['id']]['post_id'] : 0;
            $resultado = self::guardar_coche($coche, $post_id, $tipo, $presupuesto_fotos, $resumen);
            if (is_wp_error($resultado)) {
                $resumen['errores'][] = "Coche {$coche['id']}: " . $resultado->get_error_message();
            } else {
                $resumen[$resultado]++;
            }
        }

        foreach ($vinculados as $api_id => $p) {
            if (!isset($en_feed[$api_id]) && $p['estado'] === 'publish') {
                wp_update_post(['ID' => $p['post_id'], 'post_status' => 'draft']);
                update_post_meta($p['post_id'], '_proservice_retirado', current_time('mysql'));
                delete_post_meta($p['post_id'], '_proservice_huella');
                $resumen['retirados']++;
            }
        }

        if ($resumen['creados'] || $resumen['actualizados'] || $resumen['retirados']) {
            ProService_Buscador::olvidar_opciones();
        }
    }

    /** @return array api_id => ['post_id' => int, 'estado' => string] */
    public static function posts_vinculados($tipo)
    {
        global $wpdb;
        $filas = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_status, m.meta_value AS api_id
               FROM {$wpdb->posts} p
               JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_proservice_id'
              WHERE p.post_type = %s AND p.post_status NOT IN ('trash', 'auto-draft')",
            $tipo
        ));
        $vinculados = [];
        foreach ($filas as $fila) {
            $vinculados[(int) $fila->api_id] = ['post_id' => (int) $fila->ID, 'estado' => $fila->post_status];
        }
        return $vinculados;
    }

    /** @return string|WP_Error 'creados', 'actualizados' o 'sin_cambios' */
    private static function guardar_coche(array $coche, $post_id, $tipo, &$presupuesto_fotos, array &$resumen)
    {
        $huella = md5(wp_json_encode($coche));
        if ($post_id && get_post_status($post_id) === 'publish'
            && get_post_meta($post_id, '_proservice_huella', true) === $huella) {
            return 'sin_cambios';
        }

        $titulo = trim(implode(' ', array_filter([$coche['marca'] ?? '', $coche['modelo'] ?? '', $coche['version'] ?? ''])));
        $datos = ['post_type' => $tipo, 'post_title' => $titulo ?: ($coche['referencia'] ?? 'Coche'), 'post_status' => 'publish'];

        if ($post_id) {
            $datos['ID'] = $post_id; // sin post_name: la URL se queda como estaba
            $guardado = wp_update_post(wp_slash($datos), true);
            $accion = 'actualizados';
        } else {
            $datos['post_name'] = sanitize_title($datos['post_title']);
            $guardado = wp_insert_post(wp_slash($datos), true);
            $accion = 'creados';
        }
        if (is_wp_error($guardado)) {
            return $guardado;
        }
        $post_id = (int) $guardado;

        update_post_meta($post_id, '_proservice_id', $coche['id']);
        update_post_meta($post_id, '_proservice_referencia', $coche['referencia'] ?? '');
        delete_post_meta($post_id, '_proservice_retirado');

        $taxonomia = ProService_Ajustes::get('taxonomia');
        if (!empty($coche['marca']) && taxonomy_exists($taxonomia)) {
            wp_set_object_terms($post_id, trim($coche['marca']), $taxonomia, false);
        }

        $fotos_completas = true;
        foreach (ProService_Ajustes::get('mapa') as $campo_api => $destino) {
            if ($destino['formato'] === 'galeria') {
                if (!array_key_exists($campo_api, $coche)) {
                    continue; // el feed aún no manda fotos: no se toca la galería que haya
                }
                $ids = self::sincronizar_fotos($post_id, (array) $coche[$campo_api], $presupuesto_fotos, $resumen);
                if ($ids === null) {
                    $fotos_completas = false;
                    continue;
                }
                self::escribir_campo($post_id, $destino['meta'], $ids);
                if ($ids) {
                    set_post_thumbnail($post_id, $ids[0]);
                }
                continue;
            }
            $valor = self::convertir($coche[$campo_api] ?? null, $destino['formato']);
            self::escribir_campo($post_id, $destino['meta'], $valor);
        }

        // Con fotos a medias no se guarda la huella: la próxima pasada sigue descargando.
        update_post_meta($post_id, '_proservice_huella', $fotos_completas ? $huella : '');
        return $accion;
    }

    public static function convertir($valor, $formato)
    {
        if ($valor === null || $valor === '') {
            return null;
        }
        switch ($formato) {
            case 'entero':
                return is_numeric($valor) ? (int) $valor : null;
            case 'euros':
                return is_numeric($valor) ? (int) round($valor / 100) : null;
            case 'lista':
                return is_array($valor) ? array_values(array_map('sanitize_text_field', array_filter($valor, 'is_scalar'))) : null;
            default:
                return is_scalar($valor) ? sanitize_text_field((string) $valor) : null;
        }
    }

    /** Escribe con ACF si el campo existe para ese post; si no, como meta normal. */
    private static function escribir_campo($post_id, $nombre, $valor)
    {
        $campo = function_exists('acf_maybe_get_field') ? acf_maybe_get_field($nombre, $post_id, false) : null;
        if ($campo && function_exists('update_field')) {
            update_field($campo['key'], $valor, $post_id);
            return;
        }
        if ($valor === null) {
            delete_post_meta($post_id, $nombre);
        } else {
            update_post_meta($post_id, $nombre, $valor);
        }
    }

    /**
     * Descarga las fotos que falten a la biblioteca de medios (una sola vez cada una) y devuelve
     * sus ids en el orden del feed. Devuelve null si quedan fotos por bajar en otra pasada.
     */
    private static function sincronizar_fotos($post_id, array $fotos, &$presupuesto, array &$resumen)
    {
        usort($fotos, function ($a, $b) {
            return ((int) ($a['orden'] ?? 0)) <=> ((int) ($b['orden'] ?? 0));
        });

        $ids = [];
        $pendientes = 0;
        foreach ($fotos as $foto) {
            $url = is_array($foto) ? ($foto['url'] ?? '') : (string) $foto;
            if (!$url || !ProService_Api::url_de_confianza($url)) {
                $resumen['errores'][] = "Foto ignorada (no viene del servidor de la API): {$url}";
                continue;
            }
            $existente = self::adjunto_por_url($url);
            if ($existente) {
                $ids[] = $existente;
                continue;
            }
            if ($presupuesto <= 0) {
                $pendientes++;
                continue;
            }
            $presupuesto--;
            $id = self::descargar_foto($url, $post_id);
            if (is_wp_error($id)) {
                $resumen['errores'][] = 'Foto no descargada: ' . $id->get_error_message() . " ({$url})";
                $pendientes++;
                continue;
            }
            $resumen['fotos_descargadas']++;
            $ids[] = $id;
        }

        $resumen['fotos_pendientes'] += $pendientes;
        return $pendientes ? null : $ids;
    }

    private static function adjunto_por_url($url)
    {
        $ids = get_posts([
            'post_type' => 'attachment', 'post_status' => 'inherit', 'fields' => 'ids', 'numberposts' => 1,
            'meta_key' => '_proservice_foto_url', 'meta_value' => $url,
        ]);
        return $ids ? (int) $ids[0] : 0;
    }

    private static function descargar_foto($url, $post_id)
    {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $temporal = download_url($url, 30);
        if (is_wp_error($temporal)) {
            return $temporal;
        }
        $nombre = sanitize_file_name(wp_basename((string) wp_parse_url($url, PHP_URL_PATH)));
        $id = media_handle_sideload(['name' => $nombre, 'tmp_name' => $temporal], $post_id, get_the_title($post_id));
        if (is_wp_error($id)) {
            @unlink($temporal);
            return $id;
        }
        update_post_meta($id, '_proservice_foto_url', $url);
        update_post_meta($id, '_wp_attachment_image_alt', get_the_title($post_id));
        return (int) $id;
    }
}
