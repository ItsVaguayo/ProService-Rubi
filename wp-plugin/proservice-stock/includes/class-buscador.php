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
        add_shortcode('proservice_buscador', [__CLASS__, 'shortcode']);
        add_shortcode('proservice_stock', [__CLASS__, 'shortcode']); // nombre antiguo de la plantilla
        add_action('save_post_' . ProService_Ajustes::get('tipo_post'), [__CLASS__, 'olvidar_opciones']);
    }

    /**
     * Carga la hoja con el diseño de frontend/web (acotado a .ps-web por wp-plugin/construir-css.py).
     * Se registra aquí y no en wp_enqueue_scripts para que funcione aunque ese gancho ya haya pasado.
     */
    public static function encolar_css()
    {
        if (!wp_style_is('proservice-web', 'registered')) {
            wp_register_style('proservice-web', PROSERVICE_URL . 'assets/web.css', [], PROSERVICE_VERSION);
        }
        wp_enqueue_style('proservice-web');
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
        $atts = shortcode_atts(['por_pagina' => 12, 'cabecera' => 'no'], $atts, 'proservice_buscador');
        self::encolar_css();

        $f = self::filtros();
        $consulta = new WP_Query(self::argumentos($f, max(1, min(48, (int) $atts['por_pagina']))));
        $opciones = self::opciones();

        ob_start();
        ?>
        <div class="ps-web">
            <?php if ($atts['cabecera'] === 'si') : ?>
                <div class="listado-titulo">
                    <span class="antetitulo"><span class="barra-marca barra-marca--roja"></span>Revisados en nuestro taller de Rubí</span>
                    <h1 class="titulo-marca">Coches de <span>ocasión</span></h1>
                    <p>Cada coche pasa por nuestro taller antes de salir a la venta. Garantía mínima de 12 meses y financiación a tu medida.</p>
                </div>
            <?php endif; ?>
            <div class="listado">
                <?php self::pintar_filtros($f, $opciones); ?>
                <section aria-label="Resultados">
                    <div class="orden">
                        <span class="nota" aria-live="polite"><strong><?php echo (int) $consulta->found_posts; ?></strong> <?php echo $consulta->found_posts === 1 ? 'coche disponible' : 'coches disponibles'; ?></span>
                        <label class="campo">
                            <span class="rotulo">Ordenar</span>
                            <select name="orden" form="ps-filtros" onchange="this.form.requestSubmit()">
                                <?php foreach (['recientes' => 'Más recientes', 'precio' => 'Precio más bajo', 'km' => 'Menos kilómetros'] as $valor => $texto) : ?>
                                    <option value="<?php echo esc_attr($valor); ?>"<?php selected($f['orden'], $valor); ?>><?php echo esc_html($texto); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </label>
                    </div>
                    <?php if ($consulta->have_posts()) : ?>
                        <div class="tarjetas">
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
                        <div class="vacio">
                            <strong>Ahora mismo no tenemos ningún coche así</strong>
                            <p class="nota">Quita algún filtro o dinos qué buscas: entran coches nuevos cada semana y te avisamos.</p>
                            <div class="acciones__dos">
                                <a class="boton boton--borde" href="<?php echo esc_url(self::url_base()); ?>">Quitar filtros</a>
                                <?php if (ProService_Ajustes::get('whatsapp')) : ?>
                                    <a class="boton boton--whatsapp" href="<?php echo esc_url(self::whatsapp('Hola, busco un coche')); ?>">Dinos qué buscas</a>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </section>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /** Enlace de WhatsApp con el mensaje ya escrito. Vacío si no hay número en los ajustes. */
    public static function whatsapp($mensaje)
    {
        $numero = ProService_Ajustes::get('whatsapp');
        return $numero ? 'https://wa.me/' . rawurlencode($numero) . '?text=' . rawurlencode($mensaje) : '';
    }

    private static function pintar_filtros(array $f, array $o)
    {
        $select = function ($nombre, $etiqueta, $valores, $actual, $todos) {
            echo '<label class="campo"><span class="campo__nombre">' . esc_html($etiqueta) . '</span>';
            echo '<select name="' . esc_attr($nombre) . '"><option value="">' . esc_html($todos) . '</option>';
            foreach ($valores as $valor => $texto) {
                printf('<option value="%s"%s>%s</option>', esc_attr($valor), selected((string) $actual, (string) $valor, false), esc_html($texto));
            }
            echo '</select></label>';
        };
        $numero = function ($nombre, $etiqueta, $actual, $marcador) {
            printf(
                '<label class="campo"><span class="campo__nombre">%s</span><input type="number" min="0" inputmode="numeric" name="%s" value="%s" placeholder="%s"></label>',
                esc_html($etiqueta), esc_attr($nombre), esc_attr($actual === null ? '' : $actual), esc_attr($marcador)
            );
        };
        ?>
        <form class="filtros-web" id="ps-filtros" method="get" action="<?php echo esc_url(self::url_base()); ?>" role="search" aria-label="Filtrar coches">
            <h2>Filtrar</h2>
            <?php
            $select('marca', 'Marca', $o['marca'], $f['marca'], 'Todas');
            $select('modelo', 'Modelo', $o['modelo'], $f['modelo'], 'Todos');
            echo '<div class="dos">';
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
            echo '<div class="dos">';
            $select('color', 'Color', $o['color'], $f['color'], 'Todos');
            $select('plazas', 'Plazas', $o['plazas'], $f['plazas'], 'Todas');
            echo '</div>';
            ?>
            <button class="boton" type="submit">Ver coches</button>
        </form>
        <?php
    }

    /** Lee un dato del coche a través del mapa de campos. */
    public static function dato($post_id, $campo_api)
    {
        $clave = ProService_Ajustes::meta_de($campo_api);
        return $clave ? get_post_meta($post_id, $clave, true) : '';
    }

    public static function nombre_combustible($v)
    {
        return self::COMBUSTIBLES[$v] ?? ucfirst((string) $v);
    }

    public static function nombre_cambio($v)
    {
        return self::CAMBIOS[$v] ?? ucfirst((string) $v);
    }

    private static function pintar_tarjeta($post_id)
    {
        $titulo = get_the_title($post_id);
        $estado = self::dato($post_id, 'estado');
        $km = self::dato($post_id, 'kilometros');
        $datos = array_filter([
            self::dato($post_id, 'anio'),
            $km !== '' ? self::cifra($km) . ' km' : '',
            self::dato($post_id, 'combustible') !== '' ? self::nombre_combustible(self::dato($post_id, 'combustible')) : '',
            self::dato($post_id, 'cambio') !== '' ? self::nombre_cambio(self::dato($post_id, 'cambio')) : '',
        ]);
        $precio = self::dato($post_id, 'pvp_cent');
        ?>
        <a class="tarjeta-coche" href="<?php echo esc_url(get_permalink($post_id)); ?>">
            <?php if ($estado === 'reservado') : ?>
                <span class="cinta">Reservado</span>
            <?php elseif ($estado === 'vendido') : ?>
                <span class="cinta cinta--vendido">Vendido</span>
            <?php endif; ?>
            <?php
            if (has_post_thumbnail($post_id)) {
                echo get_the_post_thumbnail($post_id, 'medium_large', ['alt' => $titulo, 'loading' => 'lazy']);
            } else {
                printf('<img src="%s" alt="" loading="lazy">', esc_url(PROSERVICE_URL . 'assets/coche.svg'));
            }
            ?>
            <div class="tarjeta-coche__cuerpo">
                <h2><?php echo esc_html($titulo); ?></h2>
                <ul class="tarjeta-coche__datos cifra"><?php foreach ($datos as $d) : ?><li><?php echo esc_html($d); ?></li><?php endforeach; ?></ul>
                <div class="tarjeta-coche__precio">
                    <span class="precio cifra"><?php echo $precio !== '' ? esc_html(self::cifra($precio) . ' €') : 'Consultar'; ?></span>
                </div>
            </div>
        </a>
        <?php
    }

    private static function pintar_paginas(WP_Query $consulta, array $f)
    {
        $total = (int) $consulta->max_num_pages;
        if ($total < 2) {
            return;
        }
        $filtros = array_filter($f, function ($v, $k) {
            return $v !== null && $k !== 'pagina' && !($k === 'orden' && $v === 'recientes');
        }, ARRAY_FILTER_USE_BOTH);
        $url = function ($n) use ($filtros) {
            return add_query_arg(array_merge($filtros, $n > 1 ? ['pagina' => $n] : []), self::url_base());
        };
        echo '<nav class="paginas" aria-label="Páginas">';
        if ($f['pagina'] > 1) {
            printf('<a class="paginas__siguiente" href="%s">Anterior</a>', esc_url($url($f['pagina'] - 1)));
        }
        for ($n = 1; $n <= $total; $n++) {
            $n === $f['pagina']
                ? printf('<a class="paginas__actual" href="%s" aria-current="page">%d</a>', esc_url($url($n)), $n)
                : printf('<a href="%s">%d</a>', esc_url($url($n)), $n);
        }
        if ($f['pagina'] < $total) {
            printf('<a class="paginas__siguiente" href="%s">Siguiente</a>', esc_url($url($f['pagina'] + 1)));
        }
        echo '</nav>';
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
