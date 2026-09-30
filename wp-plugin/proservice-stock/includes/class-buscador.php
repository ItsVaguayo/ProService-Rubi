<?php
/**
 * Buscador con los filtros de la 5.4: [proservice_buscador]
 *
 * Trabaja sobre los posts «coches» publicados (los que mantiene la sincronización y los que
 * sigan hechos a mano), así que no depende de que la API esté disponible en ese momento.
 * Funciona sin JavaScript: el formulario es un GET y cada búsqueda tiene su propia URL.
 *
 * Atributos: por_pagina (12 por defecto).
 */

if (!defined('ABSPATH')) {
    exit;
}

class ProService_Buscador
{
    const TRANSIENT_OPCIONES = 'proservice_opciones_filtros';

    const COMBUSTIBLES = ['gasolina' => 'Gasolina', 'diesel' => 'Diésel', 'hibrido' => 'Híbrido', 'hibrido_enchufable' => 'Híbrido enchufable', 'electrico' => 'Eléctrico', 'glp' => 'GLP'];
    const CAMBIOS = ['manual' => 'Manual', 'automatico' => 'Automático'];
    const ETIQUETAS = ['0' => '0 emisiones', 'ECO' => 'ECO', 'C' => 'C', 'B' => 'B', 'SIN' => 'Sin etiqueta'];

    public static function iniciar()
    {
        add_action('wp_enqueue_scripts', function () {
            wp_register_style('proservice-buscador', PROSERVICE_URL . 'assets/buscador.css', [], PROSERVICE_VERSION);
        });
        add_shortcode('proservice_buscador', [__CLASS__, 'shortcode']);
        add_shortcode('proservice_stock', [__CLASS__, 'shortcode']); // nombre antiguo de la plantilla
        add_action('save_post_' . ProService_Ajustes::get('tipo_post'), [__CLASS__, 'olvidar_opciones']);
    }

    /**
     * Cifras siempre en formato español (20.900), sea cual sea el idioma de WordPress:
     * number_format_i18n() daría «20,900» en una instalación en inglés.
     */
    public static function cifra($numero)
    {
        return number_format((int) $numero, 0, ',', '.');
    }

    public static function olvidar_opciones()
    {
        delete_transient(self::TRANSIENT_OPCIONES);
    }

    /** Filtros leídos de la URL, ya saneados. */
    public static function filtros()
    {
        $entero = function ($clave) {
            return isset($_GET[$clave]) && $_GET[$clave] !== '' ? absint(wp_unslash($_GET[$clave])) : null;
        };
        $texto = function ($clave) {
            return isset($_GET[$clave]) && $_GET[$clave] !== '' ? sanitize_text_field(wp_unslash($_GET[$clave])) : null;
        };
        $orden = $texto('orden');
        return [
            'marca'       => $texto('marca'),
            'modelo'      => $texto('modelo'),
            'precio_min'  => $entero('precio_min'),
            'precio_max'  => $entero('precio_max'),
            'km_max'      => $entero('km_max'),
            'anio_min'    => $entero('anio_min'),
            'combustible' => $texto('combustible'),
            'cambio'      => $texto('cambio'),
            'carroceria'  => $texto('carroceria'),
            'etiqueta'    => $texto('etiqueta'),
            'color'       => $texto('color'),
            'plazas'      => $entero('plazas'),
            'orden'       => in_array($orden, ['recientes', 'precio', 'km'], true) ? $orden : 'recientes',
            'pagina'      => max(1, (int) $entero('pagina')),
        ];
    }

    /** Argumentos de WP_Query para unos filtros. Separado del HTML para poder probarlo. */
    public static function argumentos(array $f, $por_pagina)
    {
        $meta = ['relation' => 'AND'];
        $num = function ($campo_api, $valor, $comparacion) use (&$meta) {
            $clave = ProService_Ajustes::meta_de($campo_api);
            if ($clave && $valor !== null) {
                $meta[] = ['key' => $clave, 'value' => $valor, 'compare' => $comparacion, 'type' => 'NUMERIC'];
            }
        };
        $igual = function ($campo_api, $valor) use (&$meta) {
            $clave = ProService_Ajustes::meta_de($campo_api);
            if ($clave && $valor !== null) {
                $meta[] = ['key' => $clave, 'value' => $valor, 'compare' => '='];
            }
        };

        $num('pvp_cent', $f['precio_min'], '>=');
        $num('pvp_cent', $f['precio_max'], '<=');
        $num('kilometros', $f['km_max'], '<=');
        $num('anio', $f['anio_min'], '>=');
        $num('plazas', $f['plazas'], '=');
        $igual('modelo', $f['modelo']);
        $igual('combustible', $f['combustible']);
        $igual('cambio', $f['cambio']);
        $igual('carroceria', $f['carroceria']);
        $igual('etiqueta_dgt', $f['etiqueta']);
        $igual('color_exterior', $f['color']);

        $args = [
            'post_type'      => ProService_Ajustes::get('tipo_post'),
            'post_status'    => 'publish',
            'posts_per_page' => $por_pagina,
            'paged'          => $f['pagina'],
            'meta_query'     => $meta,
            'no_found_rows'  => false,
        ];

        $taxonomia = ProService_Ajustes::get('taxonomia');
        if ($f['marca'] && taxonomy_exists($taxonomia)) {
            $args['tax_query'] = [['taxonomy' => $taxonomia, 'field' => 'slug', 'terms' => sanitize_title($f['marca'])]];
        }

        $clave_orden = ['precio' => ProService_Ajustes::meta_de('pvp_cent'), 'km' => ProService_Ajustes::meta_de('kilometros')][$f['orden']] ?? null;
        if ($clave_orden) {
            $args['meta_key'] = $clave_orden;
            $args['orderby'] = ['meta_value_num' => 'ASC', 'date' => 'DESC'];
        } else {
            $args['orderby'] = 'date';
            $args['order'] = 'DESC';
        }
        return $args;
    }

    public static function shortcode($atts)
    {
        $atts = shortcode_atts(['por_pagina' => 12], $atts, 'proservice_buscador');
        wp_enqueue_style('proservice-buscador');

        $f = self::filtros();
        $consulta = new WP_Query(self::argumentos($f, max(1, min(48, (int) $atts['por_pagina']))));
        $opciones = self::opciones();

        ob_start();
        ?>
        <div class="ps-buscador">
            <?php self::pintar_filtros($f, $opciones); ?>
            <section aria-label="Resultados">
                <div class="ps-orden">
                    <span class="ps-nota" aria-live="polite"><strong><?php echo (int) $consulta->found_posts; ?></strong> <?php echo $consulta->found_posts === 1 ? 'coche' : 'coches'; ?></span>
                </div>
                <?php if ($consulta->have_posts()) : ?>
                    <div class="ps-tarjetas">
                        <?php
                        while ($consulta->have_posts()) {
                            $consulta->the_post();
                            self::pintar_tarjeta(get_the_ID());
                        }
                        wp_reset_postdata();
                        ?>
                    </div>
                    <?php self::pintar_paginas($consulta, $f); ?>
                <?php else : ?>
                    <p class="ps-vacio">No hay coches con esos filtros. <a href="<?php echo esc_url(self::url_base()); ?>">Ver todos</a></p>
                <?php endif; ?>
            </section>
        </div>
        <?php
        return ob_get_clean();
    }

    private static function pintar_filtros(array $f, array $o)
    {
        $select = function ($nombre, $etiqueta, $valores, $actual, $todos) {
            echo '<label class="ps-campo"><span class="ps-campo__nombre">' . esc_html($etiqueta) . '</span>';
            echo '<select name="' . esc_attr($nombre) . '"><option value="">' . esc_html($todos) . '</option>';
            foreach ($valores as $valor => $texto) {
                printf('<option value="%s"%s>%s</option>', esc_attr($valor), selected((string) $actual, (string) $valor, false), esc_html($texto));
            }
            echo '</select></label>';
        };
        $numero = function ($nombre, $etiqueta, $actual, $marcador) {
            printf(
                '<label class="ps-campo"><span class="ps-campo__nombre">%s</span><input type="number" min="0" inputmode="numeric" name="%s" value="%s" placeholder="%s"></label>',
                esc_html($etiqueta), esc_attr($nombre), esc_attr($actual === null ? '' : $actual), esc_attr($marcador)
            );
        };
        ?>
        <form class="ps-filtros" method="get" action="<?php echo esc_url(self::url_base()); ?>" role="search" aria-label="Filtrar coches">
            <?php
            $select('marca', 'Marca', $o['marca'], $f['marca'], 'Todas');
            $select('modelo', 'Modelo', $o['modelo'], $f['modelo'], 'Todos');
            echo '<div class="ps-dos">';
            $numero('precio_min', 'Precio desde', $f['precio_min'], '€');
            $numero('precio_max', 'hasta', $f['precio_max'], '€');
            echo '</div>';
            // Cuota máxima al mes: pendiente del tipo de interés del cliente (duda E2).
            $select('km_max', 'Kilómetros hasta', [50000 => '50.000', 100000 => '100.000', 150000 => '150.000', 200000 => '200.000'], $f['km_max'], 'Sin límite');
            $select('anio_min', 'Año desde', $o['anio'], $f['anio_min'], 'Cualquiera');
            $select('combustible', 'Combustible', $o['combustible'], $f['combustible'], 'Todos');
            $select('cambio', 'Cambio', $o['cambio'], $f['cambio'], 'Los dos');
            $select('carroceria', 'Carrocería', $o['carroceria'], $f['carroceria'], 'Todas');
            $select('etiqueta', 'Etiqueta DGT', $o['etiqueta'], $f['etiqueta'], 'Todas');
            echo '<div class="ps-dos">';
            $select('color', 'Color', $o['color'], $f['color'], 'Todos');
            $select('plazas', 'Plazas', $o['plazas'], $f['plazas'], 'Todas');
            echo '</div>';
            $select('orden', 'Ordenar', ['precio' => 'Precio más bajo', 'km' => 'Menos kilómetros'], $f['orden'], 'Más recientes');
            ?>
            <button class="ps-boton" type="submit">Ver coches</button>
            <a class="ps-limpiar" href="<?php echo esc_url(self::url_base()); ?>">Quitar filtros</a>
        </form>
        <?php
    }

    private static function pintar_tarjeta($post_id)
    {
        $m = function ($campo_api) use ($post_id) {
            $clave = ProService_Ajustes::meta_de($campo_api);
            return $clave ? get_post_meta($post_id, $clave, true) : '';
        };
        $titulo = get_the_title($post_id);
        $estado = $m('estado');
        $datos = array_filter([
            $m('anio'),
            $m('kilometros') !== '' ? self::cifra($m('kilometros')) . ' km' : '',
            self::COMBUSTIBLES[$m('combustible')] ?? ucfirst((string) $m('combustible')),
            self::CAMBIOS[$m('cambio')] ?? ucfirst((string) $m('cambio')),
        ]);
        $precio = $m('pvp_cent');
        ?>
        <a class="ps-tarjeta" href="<?php echo esc_url(get_permalink($post_id)); ?>">
            <?php if ($estado === 'reservado') : ?>
                <span class="ps-cinta">Reservado</span>
            <?php elseif ($estado === 'vendido') : ?>
                <span class="ps-cinta ps-cinta--vendido">Vendido</span>
            <?php endif; ?>
            <?php
            if (has_post_thumbnail($post_id)) {
                echo get_the_post_thumbnail($post_id, 'medium_large', ['alt' => $titulo, 'loading' => 'lazy']);
            } else {
                printf('<img src="%s" alt="" loading="lazy">', esc_url(PROSERVICE_URL . 'assets/coche.svg'));
            }
            ?>
            <div class="ps-tarjeta__cuerpo">
                <h2><?php echo esc_html($titulo); ?></h2>
                <span class="ps-tarjeta__datos"><?php echo esc_html(implode(' · ', $datos)); ?></span>
                <div class="ps-tarjeta__precio">
                    <span class="ps-precio"><?php echo $precio !== '' ? esc_html(self::cifra($precio) . ' €') : 'Consultar'; ?></span>
                </div>
            </div>
        </a>
        <?php
    }

    private static function pintar_paginas(WP_Query $consulta, array $f)
    {
        if ($consulta->max_num_pages < 2) {
            return;
        }
        $filtros = array_filter($f, function ($v, $k) {
            return $v !== null && $k !== 'pagina' && !($k === 'orden' && $v === 'recientes');
        }, ARRAY_FILTER_USE_BOTH);
        $enlaces = paginate_links([
            'base'      => add_query_arg('pagina', '%#%', add_query_arg($filtros, self::url_base())),
            'format'    => '',
            'current'   => $f['pagina'],
            'total'     => $consulta->max_num_pages,
            'prev_text' => 'Anterior',
            'next_text' => 'Siguiente',
        ]);
        echo '<nav class="ps-paginas" aria-label="Páginas">' . wp_kses_post($enlaces) . '</nav>';
    }

    private static function url_base()
    {
        return get_permalink() ?: home_url(add_query_arg([]));
    }

    /** Valores que existen de verdad en el stock publicado, para no ofrecer filtros vacíos. */
    public static function opciones()
    {
        $guardadas = get_transient(self::TRANSIENT_OPCIONES);
        if (is_array($guardadas)) {
            return $guardadas;
        }

        $distintos = function ($campo_api) {
            global $wpdb;
            $clave = ProService_Ajustes::meta_de($campo_api);
            if (!$clave) {
                return [];
            }
            return $wpdb->get_col($wpdb->prepare(
                "SELECT DISTINCT m.meta_value FROM {$wpdb->postmeta} m
                   JOIN {$wpdb->posts} p ON p.ID = m.post_id
                  WHERE m.meta_key = %s AND m.meta_value <> '' AND p.post_status = 'publish' AND p.post_type = %s
                  ORDER BY m.meta_value",
                $clave,
                ProService_Ajustes::get('tipo_post')
            ));
        };
        $con_nombres = function (array $valores, array $nombres) {
            $salida = [];
            foreach ($valores as $v) {
                $salida[$v] = $nombres[$v] ?? ucfirst($v);
            }
            return $salida;
        };
        $iguales = function (array $valores) {
            return array_combine($valores, array_map('ucfirst', $valores)) ?: [];
        };

        $marcas = [];
        $taxonomia = ProService_Ajustes::get('taxonomia');
        if (taxonomy_exists($taxonomia)) {
            $terminos = get_terms(['taxonomy' => $taxonomia, 'hide_empty' => true]);
            foreach (is_wp_error($terminos) ? [] : $terminos as $t) {
                $marcas[$t->slug] = $t->name;
            }
        }

        $anios = $distintos('anio');
        rsort($anios, SORT_NUMERIC);
        $plazas = $distintos('plazas');
        sort($plazas, SORT_NUMERIC);

        $opciones = [
            'marca'       => $marcas,
            'modelo'      => $iguales($distintos('modelo')),
            'anio'        => array_combine($anios, $anios) ?: [],
            'combustible' => $con_nombres($distintos('combustible'), self::COMBUSTIBLES),
            'cambio'      => $con_nombres($distintos('cambio'), self::CAMBIOS),
            'carroceria'  => $iguales($distintos('carroceria')),
            'etiqueta'    => $con_nombres($distintos('etiqueta_dgt'), self::ETIQUETAS),
            'color'       => $iguales($distintos('color_exterior')),
            'plazas'      => array_combine($plazas, $plazas) ?: [],
        ];
        set_transient(self::TRANSIENT_OPCIONES, $opciones, HOUR_IN_SECONDS);
        return $opciones;
    }
}
