<?php
/**
 * Ajustes del plugin, guardados en la opción «proservice_ajustes».
 *
 * El mapa de campos dice en qué campo de WordPress (ACF o meta) se escribe cada dato del feed.
 * Los nombres por defecto son una suposición: se ajustan en Ajustes → Pro Service Stock en cuanto
 * se vean los campos ACF reales de la web (la propia página los lista).
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Ajustes
{
    const OPCION = 'proservice_ajustes';

    // Formatos: texto, entero, euros (céntimos → euros enteros), galeria (lista de ids de adjuntos)
    const MAPA_POR_DEFECTO = [
        'pvp_cent'               => ['meta' => 'precio', 'formato' => 'euros'],
        'precio_financiado_cent' => ['meta' => 'precio_financiado', 'formato' => 'euros'],
        'modelo'                 => ['meta' => 'modelo', 'formato' => 'texto'],
        'version'                => ['meta' => 'version', 'formato' => 'texto'],
        'anio'                   => ['meta' => 'anio', 'formato' => 'entero'],
        'kilometros'             => ['meta' => 'kilometros', 'formato' => 'entero'],
        'combustible'            => ['meta' => 'combustible', 'formato' => 'texto'],
        'cambio'                 => ['meta' => 'cambio', 'formato' => 'texto'],
        'potencia_cv'            => ['meta' => 'potencia', 'formato' => 'entero'],
        'cilindrada'             => ['meta' => 'cilindrada', 'formato' => 'entero'],
        'traccion'               => ['meta' => 'traccion', 'formato' => 'texto'],
        'emisiones_co2'          => ['meta' => 'emisiones_co2', 'formato' => 'entero'],
        'etiqueta_dgt'           => ['meta' => 'etiqueta_dgt', 'formato' => 'texto'],
        'carroceria'             => ['meta' => 'carroceria', 'formato' => 'texto'],
        'puertas'                => ['meta' => 'puertas', 'formato' => 'entero'],
        'plazas'                 => ['meta' => 'plazas', 'formato' => 'entero'],
        'color_exterior'         => ['meta' => 'color', 'formato' => 'texto'],
        'tapiceria'              => ['meta' => 'tapiceria', 'formato' => 'texto'],
        'llantas'                => ['meta' => 'llantas', 'formato' => 'texto'],
        'garantia_meses'         => ['meta' => 'garantia_meses', 'formato' => 'entero'],
        'video_url'              => ['meta' => 'video', 'formato' => 'texto'],
        'estado'                 => ['meta' => 'estado_venta', 'formato' => 'texto'],
        'fotos'                  => ['meta' => 'galeria', 'formato' => 'galeria'],
    ];

    const FORMATOS = ['texto', 'entero', 'euros', 'galeria'];

    public static function todos()
    {
        $guardado = get_option(self::OPCION, []);
        $por_defecto = [
            'api_url'    => defined('PROSERVICE_API_URL') ? PROSERVICE_API_URL : 'http://localhost:3001/api',
            'tipo_post'  => 'coches',
            'taxonomia'  => 'marca',
            'mapa'       => self::MAPA_POR_DEFECTO,
            'whatsapp'   => '',
        ];
        $ajustes = array_merge($por_defecto, is_array($guardado) ? $guardado : []);
        // Una constante en wp-config.php manda sobre lo guardado: así cada entorno apunta a su API.
        if (defined('PROSERVICE_API_URL')) {
            $ajustes['api_url'] = PROSERVICE_API_URL;
        }
        $ajustes['api_url'] = untrailingslashit($ajustes['api_url']);
        return $ajustes;
    }

    public static function get($clave)
    {
        $ajustes = self::todos();
        return $ajustes[$clave] ?? null;
    }

    public static function guardar(array $nuevos)
    {
        update_option(self::OPCION, array_merge(get_option(self::OPCION, []) ?: [], $nuevos), false);
    }

    /** Campo de WordPress donde va un dato del feed, o null si no está mapeado. */
    public static function meta_de($campo_api)
    {
        $mapa = self::get('mapa');
        return isset($mapa[$campo_api]['meta']) ? $mapa[$campo_api]['meta'] : null;
    }

    /**
     * Valida un mapa escrito a mano (JSON). Devuelve [mapa, errores].
     */
    public static function validar_mapa($json)
    {
        $mapa = json_decode($json, true);
        if (!is_array($mapa)) {
            return [null, ['El mapa no es un JSON válido.']];
        }
        $errores = [];
        $limpio = [];
        foreach ($mapa as $campo_api => $destino) {
            if (!is_array($destino) || empty($destino['meta']) || !is_string($destino['meta'])) {
                $errores[] = "«{$campo_api}» necesita un «meta» con el nombre del campo.";
                continue;
            }
            $formato = $destino['formato'] ?? 'texto';
            if (!in_array($formato, self::FORMATOS, true)) {
                $errores[] = "«{$campo_api}» tiene un formato desconocido: {$formato}.";
                continue;
            }
            $limpio[sanitize_key($campo_api)] = ['meta' => sanitize_key($destino['meta']), 'formato' => $formato];
        }
        return [$errores ? null : $limpio, $errores];
    }
}
