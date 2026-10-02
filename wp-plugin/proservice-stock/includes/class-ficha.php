<?php
/**
 * Ficha pública del coche con el diseño de frontend/web/coche.html.
 *
 * Solo se usa si está activado en los ajustes («Usar la ficha del plugin»). En proservicerubi.com
 * manda la plantilla del tema hijo y esto va apagado; queda por si algún día se quiere sustituir.
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Ficha
{
    const ETIQUETAS_DGT = ['0' => ['cero', '0'], 'ECO' => ['eco', 'ECO'], 'C' => ['c', 'C'], 'B' => ['b', 'B']];

    public static function iniciar()
    {
        add_filter('template_include', [__CLASS__, 'plantilla'], 99);
    }

    public static function plantilla($plantilla)
    {
        if (ProService_Ajustes::get('ficha_propia') && is_singular(ProService_Ajustes::get('tipo_post'))) {
            ProService_Buscador::encolar_css();
            return PROSERVICE_DIR . 'plantillas/ficha.php';
        }
        return $plantilla;
    }

    /** Todo lo que pinta la plantilla, ya calculado. Separado del HTML para poder probarlo. */
    public static function datos($post_id)
    {
        $d = function ($campo) use ($post_id) {
            return ProService_Buscador::dato($post_id, $campo);
        };
        $titulo = get_the_title($post_id);
        $precio = $d('pvp_cent');
        $precio_texto = $precio !== '' ? ProService_Buscador::cifra($precio) . ' €' : '';

        $fotos = [];
        foreach (self::ids_galeria($d('fotos')) as $id) {
            $grande = wp_get_attachment_image_url((int) $id, 'large');
            if ($grande) {
                $fotos[] = ['grande' => $grande, 'mini' => wp_get_attachment_image_url((int) $id, 'medium') ?: $grande];
            }
        }
        if (!$fotos && has_post_thumbnail($post_id)) {
            $fotos[] = ['grande' => get_the_post_thumbnail_url($post_id, 'large'), 'mini' => get_the_post_thumbnail_url($post_id, 'medium')];
        }

        $etiqueta = self::ETIQUETAS_DGT[$d('etiqueta_dgt')] ?? null;
        $km = $d('kilometros');
        $tecnicos = array_filter([
            'Año'              => $d('anio'),
            'Kilómetros'       => $km !== '' ? ProService_Buscador::cifra($km) . ' km' : '',
            'Combustible'      => $d('combustible') !== '' ? ProService_Buscador::nombre_combustible($d('combustible')) : '',
            'Cambio'           => $d('cambio') !== '' ? ProService_Buscador::nombre_cambio($d('cambio')) : '',
            'Potencia'         => $d('potencia_cv') !== '' ? $d('potencia_cv') . ' CV' : '',
            'Cilindrada'       => $d('cilindrada') !== '' ? ProService_Buscador::cifra($d('cilindrada')) . ' cc' : '',
            'Tracción'         => ucfirst((string) $d('traccion')),
            'Etiqueta DGT'     => $d('etiqueta_dgt'),
            'Emisiones'        => $d('emisiones_co2') !== '' ? $d('emisiones_co2') . ' g/km' : '',
            'Carrocería'       => $d('carroceria') === 'suv' ? 'SUV' : ucfirst((string) $d('carroceria')),
            'Puertas y plazas' => $d('puertas') !== '' || $d('plazas') !== '' ? trim(($d('puertas') !== '' ? $d('puertas') . ' puertas' : '') . ' · ' . ($d('plazas') !== '' ? $d('plazas') . ' plazas' : ''), ' ·') : '',
            'Color'            => ucfirst((string) $d('color_exterior')),
            'Tapicería'        => ucfirst((string) $d('tapiceria')),
            'Llantas'          => $d('llantas'),
            'Garantía'         => $d('garantia_meses') !== '' ? $d('garantia_meses') . ' meses' : '',
        ], function ($v) {
            return $v !== '' && $v !== null;
        });

        return [
            'titulo'      => $titulo,
            'referencia'  => (string) $d('referencia'),
            'enlace'      => get_permalink($post_id),
            'contactos'   => ProService_Ajustes::url_contactos(),
            'estado'      => ProService_Buscador::estado($post_id),
            'cuota'       => $d('cuota') !== '' ? ProService_Buscador::cifra($d('cuota')) . ' €/mes' : '',
            'precio'      => $precio_texto,
            'financiado'  => $d('precio_financiado_cent') !== '' ? ProService_Buscador::cifra($d('precio_financiado_cent')) . ' €' : '',
            'resumen'     => array_values(array_filter([$d('anio'), $tecnicos['Kilómetros'] ?? '', $tecnicos['Combustible'] ?? '', $tecnicos['Cambio'] ?? ''])),
            'etiqueta'    => $etiqueta,
            'garantia'    => $d('garantia_meses') ?: 12,
            'fotos'       => $fotos,
            'tecnicos'    => $tecnicos,
            'extras'      => self::lista($d('extras')),
            'video'       => self::youtube($d('video_url')),
            'whatsapp'    => ProService_Buscador::whatsapp(trim("Hola, me interesa el {$titulo}" . ($precio_texto ? " de {$precio_texto}" : ''))),
            'compartir'   => 'https://wa.me/?text=' . rawurlencode($titulo . ' ' . get_permalink($post_id)),
            'listado'     => ProService_Ajustes::get('pagina_listado') ?: get_post_type_archive_link(ProService_Ajustes::get('tipo_post')) ?: home_url('/'),
        ];
    }

    /**
     * Ids de la galería. ACF Pro la guarda como lista de ids; si el campo es de texto, viene
     * como «12,13,14». Se aceptan las dos formas.
     */
    public static function ids_galeria($valor)
    {
        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }
        return array_values(array_filter(array_map('intval', (array) $valor)));
    }

    /** Equipamiento: lista, o texto con un elemento por línea o separado por comas. */
    public static function lista($valor)
    {
        if (is_string($valor)) {
            $valor = preg_split('/[\r\n,]+/', $valor);
        }
        return array_values(array_filter(array_map('trim', (array) $valor), 'strlen'));
    }

    /** Id de un vídeo de YouTube a partir de su URL, o null. */
    public static function youtube($url)
    {
        if (!$url || !preg_match('~(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})~', (string) $url, $m)) {
            return null;
        }
        return $m[1];
    }
}
