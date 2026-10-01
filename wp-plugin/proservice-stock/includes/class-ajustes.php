<?php
/**
 * Ajustes del plugin, guardados en la opción «proservice_ajustes».
 *
 * El plugin no escribe datos: los coches los publica la plataforma por la API REST de WordPress.
 * El mapa dice en qué campo de la web (ACF o meta) está cada dato, para poder filtrar y pintar.
 * Tiene que coincidir con el WP_MAPA del conector de la API. Los nombres por defecto son una
 * suposición hasta ver los campos ACF reales (la página de ajustes los lista).
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Ajustes
{
    const OPCION = 'proservice_ajustes';

    // Dato → campo de la web, con los nombres de la réplica de proservicerubi.com (wordpress-pruebas/).
    // Los precios están en euros (el conector ya convierte los céntimos). El estado guarda el texto de
    // su web: «En venta», «Reservado» o «Vendido».
    // «fotos» es la galería: lista de ids de adjuntos, o texto con los ids separados por comas.
    const MAPA_POR_DEFECTO = [
        'pvp_cent'               => 'precio',
        'precio_financiado_cent' => 'precio_financiado',
        'cuota'                  => 'cuota',
        'modelo'                 => 'modelo',
        'anio'                   => 'anio',
        'kilometros'             => 'kilometros',
        'combustible'            => 'combustible',
        'cambio'                 => 'cambio',
        'potencia_cv'            => 'potencia',
        'cilindrada'             => 'cilindrada',
        'traccion'               => 'traccion',
        'emisiones_co2'          => 'emisiones_co2',
        'etiqueta_dgt'           => 'etiqueta_dgt',
        'carroceria'             => 'carroceria',
        'puertas'                => 'puertas',
        'plazas'                 => 'plazas',
        'color_exterior'         => 'color',
        'tapiceria'              => 'tapiceria',
        'llantas'                => 'llantas',
        'garantia_meses'         => 'garantia_meses',
        'video_url'              => 'video',
        'estado'                 => 'estado',
        'fotos'                  => 'galeria',
        'extras'                 => 'extras',
    ];

    public static function todos()
    {
        $guardado = get_option(self::OPCION, []);
        $por_defecto = [
            'tipo_post'      => 'coches',
            'taxonomia'      => 'marca',
            'mapa'           => self::MAPA_POR_DEFECTO,
            'whatsapp'       => '',
            // Ficha pública con el diseño de frontend/web. En proservicerubi.com manda su plantilla: va apagada.
            'ficha_propia'   => false,
            'pagina_listado' => '',
        ];
        $ajustes = array_merge($por_defecto, is_array($guardado) ? $guardado : []);
        // Mapas guardados por la versión 0.3 (con «meta» y «formato»): se quedan con el nombre del campo.
        foreach ($ajustes['mapa'] as $dato => $campo) {
            if (is_array($campo)) {
                $ajustes['mapa'][$dato] = $campo['meta'] ?? '';
            }
        }
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

    /** Campo de la web donde está un dato, o null si no está mapeado. */
    public static function meta_de($dato)
    {
        $mapa = self::get('mapa');
        return !empty($mapa[$dato]) ? $mapa[$dato] : null;
    }

    /** Valida un mapa escrito a mano (JSON {"dato": "campo"}). Devuelve [mapa, errores]. */
    public static function validar_mapa($json)
    {
        $mapa = json_decode($json, true);
        if (!is_array($mapa) || ($mapa && array_keys($mapa) === range(0, count($mapa) - 1))) {
            return [null, ['El mapa no es un JSON válido de la forma {"dato": "campo"}.']];
        }
        $errores = [];
        $limpio = [];
        foreach ($mapa as $dato => $campo) {
            if (!is_string($campo) || $campo === '' || sanitize_key($campo) !== $campo) {
                $errores[] = "«{$dato}» necesita el nombre de un campo (minúsculas, números y guiones bajos).";
                continue;
            }
            $limpio[sanitize_key($dato)] = $campo;
        }
        return [$errores ? null : $limpio, $errores];
    }
}
