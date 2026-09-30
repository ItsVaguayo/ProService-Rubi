<?php
/**
 * Lectura del feed público de la API: GET {api_url}/publicacion/feed/web
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Api
{
    /** @return array|WP_Error Lista de coches o el error. Nunca una lista vacía por un fallo. */
    public static function obtener_feed()
    {
        $url = ProService_Ajustes::get('api_url') . '/publicacion/feed/web';
        $res = wp_remote_get($url, ['timeout' => 15, 'headers' => ['Accept' => 'application/json']]);

        if (is_wp_error($res)) {
            return new WP_Error('proservice_api', 'No se pudo conectar con la API: ' . $res->get_error_message());
        }
        $codigo = wp_remote_retrieve_response_code($res);
        if ($codigo !== 200) {
            return new WP_Error('proservice_api', "La API respondió {$codigo} en {$url}");
        }
        $coches = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($coches) || ($coches && !isset($coches[0]))) {
            return new WP_Error('proservice_api', 'La API no devolvió una lista de coches.');
        }

        $validos = [];
        foreach ($coches as $coche) {
            if (!is_array($coche) || empty($coche['id'])) {
                continue;
            }
            $validos[] = self::normalizar($coche);
        }
        return $validos;
    }

    private static function normalizar(array $coche)
    {
        $coche['id'] = (int) $coche['id'];
        // Compatibilidad: la plantilla antigua de la API daba euros en «pvp»; la nueva da céntimos.
        foreach (['pvp' => 'pvp_cent', 'precio_financiado' => 'precio_financiado_cent'] as $viejo => $nuevo) {
            if (!array_key_exists($nuevo, $coche) && isset($coche[$viejo]) && is_numeric($coche[$viejo])) {
                $coche[$nuevo] = (int) round($coche[$viejo] * 100);
            }
            unset($coche[$viejo]);
        }
        return $coche;
    }

    /** Solo se descargan fotos del mismo servidor que la API. */
    public static function url_de_confianza($url)
    {
        $api = wp_parse_url(ProService_Ajustes::get('api_url'));
        $foto = wp_parse_url($url);
        return !empty($foto['host']) && !empty($api['host'])
            && in_array($foto['scheme'] ?? '', ['http', 'https'], true)
            && strtolower($foto['host']) === strtolower($api['host']);
    }
}
