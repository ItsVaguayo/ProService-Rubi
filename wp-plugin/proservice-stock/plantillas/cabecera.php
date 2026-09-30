<?php
/**
 * Cabecera de frontend/web (index.html y coche.html) para el modo «página completa».
 * El <body> lleva .ps-web: es el body.web de la maqueta, acotado para no chocar con WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

$listado = ProService_Ajustes::get('pagina_listado') ?: home_url('/');
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <?php wp_head(); ?>
</head>
<body <?php body_class('ps-web'); ?>>
<?php wp_body_open(); ?>

<header class="web-cabecera">
    <div class="envoltorio">
        <a href="<?php echo esc_url(home_url('/')); ?>"><img class="logo" src="<?php echo esc_url(PROSERVICE_URL . 'assets/logo-proservice.webp'); ?>" alt="Pro Service Rubí"></a>
        <nav class="web-nav" aria-label="Menú">
            <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
            <a href="#">Sobre nosotros</a>
            <a href="#">Servicios</a>
            <a href="<?php echo esc_url($listado); ?>" aria-current="page">Vehículos ocasión</a>
            <a href="#">Compramos tu coche</a>
            <a href="#">Contacto</a>
        </nav>
        <a class="boton boton--pequeno" href="#">Pide cita</a>
    </div>
</header>
