<?php
/** Réplica del listado /coches/ de proservicerubi.com. Partes fijas y CSS de extraer.py. */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
echo '<style>' . file_get_contents(REPLICA_DIR . 'archivo.css') . '</style>';

echo replica_parte('archivo-antes.html');
while (have_posts()) {
    the_post();
    replica_tarjeta(get_the_ID());
}
echo replica_parte('archivo-despues.html');
replica_aviso_solicitud();

echo '<script>' . replica_parte('archivo.js') . '</script>';
get_footer();
