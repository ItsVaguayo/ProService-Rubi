<?php
/**
 * Réplica de las plantillas de coches de proservicerubi.com (tema hijo de hello-biz).
 * La carga imita-proservicerubi.php. El HTML de las partes con datos está calcado de su web
 * (1-oct-2026); el resto (CSS, scripts y secciones fijas) lo baja extraer.py.
 *
 * Lo que hace igual que su web:
 *  - /coches/: portada, filtro por AJAX (admin-ajax.php, acción filtrar_coches, con precio_max,
 *    potencia_min y estado), tarjetas con miniaturas, 10 por página.
 *  - Ficha: portada con la primera foto, precio, «Desde X €/mes», galería con lightbox, ficha técnica
 *    de 6 datos, y su formulario de prueba de conducción.
 * Lo que no se sabe y aquí se supone: los nombres de los campos (ver imita-proservicerubi.php), qué
 * campo pinta el título grande de la ficha (en su web sale vacío) y qué hace su formulario al enviarse.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('REPLICA_DIR', __DIR__ . '/');

function replica_campo($id, $nombre)
{
    $valor = get_post_meta($id, $nombre, true);
    return is_scalar($valor) ? trim((string) $valor) : $valor;
}

/** URLs de la galería. ACF Pro la guarda como lista de ids; aquí, como texto «12,13,14». */
function replica_fotos($id)
{
    $galeria = get_post_meta($id, 'galeria', true);
    $ids = is_array($galeria) ? $galeria : explode(',', (string) $galeria);
    $urls = [];
    foreach (array_filter(array_map('intval', $ids)) as $adjunto) {
        $url = wp_get_attachment_image_url($adjunto, 'large');
        if ($url) {
            $urls[] = $url;
        }
    }
    return $urls;
}

function replica_parte($nombre)
{
    $html = file_get_contents(REPLICA_DIR . $nombre);
    $token = wp_nonce_field('replica_formulario', 'form_token', true, false);
    return str_replace(['{{FORMULARIO_TOKEN}}', '{{AJAX_URL}}'], [$token, admin_url('admin-ajax.php')], $html);
}

/** Tarjeta del listado, con el mismo HTML que su archive-coches. */
function replica_tarjeta($id)
{
    $enlace = esc_url(get_permalink($id));
    $fotos = replica_fotos($id);
    $estado = replica_campo($id, 'estado');
    $precio = replica_campo($id, 'precio');
    $cuota = replica_campo($id, 'cuota');
    $color = replica_campo($id, 'color');
    $meta = array_filter([
        'Kilómetros'  => ($v = replica_campo($id, 'kilometros')) !== '' ? $v . 'KM' : '',
        'Combustible' => replica_campo($id, 'combustible'),
        'Potencia'    => ($v = replica_campo($id, 'potencia')) !== '' ? $v . ' CV' : '',
        'Cilindrada'  => ($v = replica_campo($id, 'cilindrada')) !== '' ? $v . ' cc' : '',
        'Uso'         => replica_campo($id, 'uso_anterior'),
    ]);
    ?>
                <article class="coche-card">
          <div class="coche-img">
            <a href="<?php echo $enlace; ?>">
              <img src="<?php echo esc_url($fotos[0] ?? ''); ?>" data-main-img>
            </a>
            <?php if ($fotos) : ?>
            <div class="coche-thumbs">
              <?php foreach ($fotos as $foto) : ?>
                <img src="<?php echo esc_url($foto); ?>" data-thumb>
              <?php endforeach; ?>
            </div>
            <?php endif; ?>
            <?php if ($estado) : ?>
              <span class="estado"><?php echo esc_html($estado); ?></span>
            <?php endif; ?>
          </div>

          <div class="coche-core">
            <h2 class="coche-title"><a href="<?php echo $enlace; ?>"><?php echo esc_html(get_the_title($id)); ?></a></h2>
            <?php if ($precio !== '') : ?><div class="coche-precio"><?php echo esc_html($precio); ?> €</div><?php endif; ?>
            <?php if ($cuota !== '') : ?><div class="coche-financed">Desde <?php echo esc_html($cuota); ?> €/mes</div><?php endif; ?>
          </div>

          <div class="coche-details">
            <div class="coche-meta">
              <?php foreach ($meta as $nombre => $valor) : ?><span><strong><?php echo esc_html($nombre); ?></strong><?php echo esc_html($valor); ?></span><?php endforeach; ?>
            </div>
            <?php if ($color !== '') : ?>
            <div class="coche-extra-list">
              <span><?php echo esc_html($color); ?></span>
            </div>
            <?php endif; ?>
            <div class="coche-cta">
              <a href="<?php echo $enlace; ?>">🚗 Solicitar prueba</a>
            </div>
          </div>
        </article>
    <?php
}

// --- Plantillas -------------------------------------------------------------------------------------

add_filter('template_include', function ($plantilla) {
    if (is_post_type_archive('coches')) {
        return REPLICA_DIR . 'archivo.php';
    }
    if (is_singular('coches')) {
        return REPLICA_DIR . 'ficha.php';
    }
    return $plantilla;
}, 50); // el plugin buscador, con su ficha propia activada, va después (99) y manda

// --- Su filtro por AJAX -----------------------------------------------------------------------------

function replica_filtrar_coches()
{
    $meta = ['relation' => 'AND'];
    if (isset($_POST['precio_max']) && $_POST['precio_max'] !== '') {
        $meta[] = ['key' => 'precio', 'value' => absint($_POST['precio_max']), 'compare' => '<=', 'type' => 'NUMERIC'];
    }
    if (isset($_POST['potencia_min']) && $_POST['potencia_min'] !== '') {
        // En su web este filtro devuelve 0 coches (1-oct-2026: «mínimo 130 CV» no saca el Niro de 138 CV).
        // Aquí funciona: el fallo será del dato o de su consulta, y no se puede ver desde fuera.
        $meta[] = ['key' => 'potencia', 'value' => absint($_POST['potencia_min']), 'compare' => '>=', 'type' => 'NUMERIC'];
    }
    if (!empty($_POST['estado'])) {
        $meta[] = ['key' => 'estado', 'value' => sanitize_text_field(wp_unslash($_POST['estado']))];
    }
    $coches = get_posts(['post_type' => 'coches', 'post_status' => 'publish', 'numberposts' => -1, 'meta_query' => $meta, 'fields' => 'ids']);
    foreach ($coches as $id) {
        replica_tarjeta($id);
    }
    wp_die();
}
add_action('wp_ajax_filtrar_coches', 'replica_filtrar_coches');
add_action('wp_ajax_nopriv_filtrar_coches', 'replica_filtrar_coches');

// --- Su formulario de prueba de conducción --------------------------------------------------------
// No se sabe qué hace en su web al enviarse. Aquí se guarda en la opción «replica_solicitudes»
// (wp option get replica_solicitudes --format=json) para poder probar los contactos.

add_action('template_redirect', function () {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['form_token']) || !(is_post_type_archive('coches') || is_singular('coches'))) {
        return;
    }
    if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['form_token'])), 'replica_formulario') || !empty($_POST['empresa'])) {
        wp_safe_redirect(add_query_arg('solicitud', 'rechazada'));
        exit;
    }
    $solicitudes = get_option('replica_solicitudes', []);
    $solicitudes[] = [
        'fecha_envio' => current_time('mysql'),
        'pagina'      => home_url(add_query_arg([])),
        'coche'       => is_singular('coches') ? get_the_title() : '',
        'nombre'      => sanitize_text_field(wp_unslash($_POST['nombre'] ?? '')),
        'email'       => sanitize_email(wp_unslash($_POST['email'] ?? '')),
        'telefono'    => sanitize_text_field(wp_unslash($_POST['telefono'] ?? '')),
        'fecha'       => sanitize_text_field(wp_unslash($_POST['fecha'] ?? '')),
        'hora'        => sanitize_text_field(wp_unslash($_POST['hora'] ?? '')),
    ];
    update_option('replica_solicitudes', $solicitudes, false);
    wp_safe_redirect(add_query_arg('solicitud', 'enviada') . '#form');
    exit;
});

function replica_aviso_solicitud()
{
    if (!isset($_GET['solicitud'])) {
        return;
    }
    $ok = $_GET['solicitud'] === 'enviada';
    printf(
        '<p style="max-width:720px;margin:16px auto;padding:12px 16px;border-radius:8px;background:%s;color:#111;text-align:center">%s</p>',
        $ok ? '#e3f4ea' : '#fbeaea',
        $ok ? 'Solicitud recibida. (Réplica: queda guardada en este WordPress, no se envía a nadie.)' : 'No se ha podido enviar la solicitud.'
    );
}
