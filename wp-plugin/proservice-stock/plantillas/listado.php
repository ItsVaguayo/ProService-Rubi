<?php
/**
 * Página del listado en modo «página completa»: cabecera y pie de la maqueta, y el contenido
 * de la página (el [proservice_buscador]) dentro de main.envoltorio, como en frontend/web/index.html.
 * El título de la página no se pinta: lo pone el buscador con cabecera="si".
 */

if (!defined('ABSPATH')) {
    exit;
}

ProService_Diseno::cabecera();
the_post();
?>
<main class="envoltorio">
    <?php the_content(); ?>
</main>
<?php
ProService_Diseno::pie();
