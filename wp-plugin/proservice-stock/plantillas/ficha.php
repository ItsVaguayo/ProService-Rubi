<?php
/**
 * Ficha pública del coche. Marcado de frontend/web/coche.html con los datos del post.
 * La cabecera y el pie son los del tema o, en modo «página completa», los de la maqueta.
 */

if (!defined('ABSPATH')) {
    exit;
}

ProService_Diseno::cabecera();
the_post();
$c = ProService_Ficha::datos(get_the_ID());
$marca_modelo = trim(get_the_title());
?>
<div class="ps-web">
<main class="envoltorio">

    <p class="miga"><a href="<?php echo esc_url($c['listado']); ?>">Coches de ocasión</a> / <?php echo esc_html($marca_modelo); ?></p>

    <div class="ficha-web">

        <section class="galeria" aria-label="Fotos">
            <div class="galeria__grande">
                <?php if ($c['estado'] === 'reservado') : ?>
                    <span class="cinta">Reservado</span>
                <?php elseif ($c['estado'] === 'vendido') : ?>
                    <span class="cinta cinta--vendido">Vendido</span>
                <?php endif; ?>
                <img src="<?php echo esc_url($c['fotos'][0]['grande'] ?? PROSERVICE_URL . 'assets/coche.svg'); ?>" alt="<?php echo esc_attr($marca_modelo); ?>" data-ps-grande>
            </div>
            <?php if (count($c['fotos']) > 1) : ?>
                <div class="galeria__miniaturas">
                    <?php foreach ($c['fotos'] as $n => $foto) : ?>
                        <img src="<?php echo esc_url($foto['mini']); ?>" data-grande="<?php echo esc_url($foto['grande']); ?>" alt="<?php echo esc_attr(sprintf('Foto %d de %d', $n + 1, count($c['fotos']))); ?>" loading="lazy" tabindex="0" role="button">
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>

        <aside class="resumen">
            <h1><?php echo esc_html($marca_modelo); ?></h1>
            <div class="resumen__datos cifra">
                <?php foreach ($c['resumen'] as $dato) : ?><span><?php echo esc_html($dato); ?></span><?php endforeach; ?>
                <?php if ($c['etiqueta']) : ?>
                    <span class="dgt dgt--<?php echo esc_attr($c['etiqueta'][0]); ?>" title="<?php echo esc_attr('Etiqueta DGT ' . $c['etiqueta'][1]); ?>"><?php echo esc_html($c['etiqueta'][1]); ?></span>
                <?php endif; ?>
            </div>
            <div>
                <span class="precio cifra"><?php echo esc_html($c['precio'] ?: 'Consultar precio'); ?></span>
                <?php if ($c['financiado']) : ?>
                    <!-- La cuota al mes espera el tipo de interés del cliente (duda E2): de momento, el precio financiando. -->
                    <p class="cuota cifra">Financiándolo, <?php echo esc_html($c['financiado']); ?><small>Precio con financiación, sujeto a aprobación de la financiera</small></p>
                <?php endif; ?>
            </div>
            <p class="garantia"><span class="barra-marca barra-marca--roja"></span><span><strong>Revisado en nuestro taller.</strong> <?php echo esc_html((int) $c['garantia']); ?> meses de garantía como mínimo.</span></p>
            <div class="acciones">
                <?php if ($c['whatsapp']) : ?>
                    <a class="boton boton--whatsapp" href="<?php echo esc_url($c['whatsapp']); ?>">Preguntar por WhatsApp</a>
                <?php endif; ?>
                <div class="acciones__dos">
                    <a class="boton boton--borde" href="#contacto">Pedir prueba</a>
                    <a class="boton boton--borde" href="#contacto">Financiarlo</a>
                    <a class="boton boton--borde" href="#contacto">Tasar mi coche</a>
                    <a class="boton boton--borde" href="<?php echo esc_url($c['compartir']); ?>">Compartir</a>
                </div>
            </div>
        </aside>

        <div class="detalles">
            <section class="seccion-web">
                <h2><span class="barra-marca"></span>Datos técnicos</h2>
                <table class="tabla-datos">
                    <?php foreach ($c['tecnicos'] as $nombre => $valor) : ?>
                        <tr><th><?php echo esc_html($nombre); ?></th><td class="cifra">
                            <?php if ($nombre === 'Etiqueta DGT' && $c['etiqueta']) : ?>
                                <span class="dgt dgt--<?php echo esc_attr($c['etiqueta'][0]); ?>"><?php echo esc_html($c['etiqueta'][1]); ?></span>
                            <?php else : ?>
                                <?php echo esc_html($valor); ?>
                            <?php endif; ?>
                        </td></tr>
                    <?php endforeach; ?>
                </table>
            </section>

            <?php if ($c['extras']) : ?>
                <section class="seccion-web">
                    <h2><span class="barra-marca"></span>Equipamiento</h2>
                    <ul class="equipamiento">
                        <?php foreach ($c['extras'] as $extra) : ?><li><?php echo esc_html($extra); ?></li><?php endforeach; ?>
                    </ul>
                </section>
            <?php endif; ?>

            <?php if ($c['video']) : ?>
                <section class="seccion-web">
                    <h2><span class="barra-marca"></span>Vídeo</h2>
                    <iframe class="video" src="<?php echo esc_url('https://www.youtube-nocookie.com/embed/' . $c['video']); ?>" title="<?php echo esc_attr('Vídeo del ' . $marca_modelo); ?>" loading="lazy" allowfullscreen></iframe>
                </section>
            <?php endif; ?>

            <section class="seccion-web" id="contacto">
                <h2><span class="barra-marca"></span>Pregúntanos por este coche</h2>
                <!-- Pendiente: el envío va a POST /api/contactos, que aún no existe. Mientras, el botón está desactivado. -->
                <form class="formulario-web" onsubmit="return false">
                    <label class="campo"><span class="campo__nombre">Nombre</span><input name="nombre" autocomplete="name" required></label>
                    <label class="campo"><span class="campo__nombre">Teléfono</span><input type="tel" name="telefono" autocomplete="tel" required></label>
                    <label class="campo campo--ancho">
                        <span class="campo__nombre">Qué quieres</span>
                        <select name="tipo">
                            <option>Más información</option>
                            <option>Probarlo</option>
                            <option>Financiarlo</option>
                            <option>Tasar mi coche como parte del pago</option>
                        </select>
                    </label>
                    <label class="campo campo--ancho"><span class="campo__nombre">Mensaje</span><textarea name="mensaje"></textarea></label>
                    <label class="casilla">
                        <input type="checkbox" name="privacidad" required>
                        <span>He leído la <a href="<?php echo esc_url(get_privacy_policy_url() ?: '#'); ?>">política de privacidad</a> y acepto que me llaméis por este coche.</span>
                    </label>
                    <button class="boton" type="submit" disabled>Enviar</button>
                    <p class="nota">El formulario aún no envía: falta conectarlo con la plataforma. Mientras, escríbenos por WhatsApp.</p>
                </form>
            </section>
        </div>
    </div>
</main>

<?php if ($c['whatsapp']) : ?>
    <a class="boton boton--whatsapp whatsapp-fijo" href="<?php echo esc_url($c['whatsapp']); ?>">Preguntar por WhatsApp</a>
<?php endif; ?>
</div>

<script>
/* Galería: al pulsar una miniatura, pasa a la foto grande. Sin JavaScript se ve la primera. */
document.querySelectorAll('.ps-web .galeria__miniaturas img').forEach(function (mini) {
    function mostrar() { document.querySelector('.ps-web [data-ps-grande]').src = mini.dataset.grande; }
    mini.addEventListener('click', mostrar);
    mini.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mostrar(); } });
});
</script>
<?php
ProService_Diseno::pie();
