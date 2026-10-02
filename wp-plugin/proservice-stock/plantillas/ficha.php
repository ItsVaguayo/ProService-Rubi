<?php
/**
 * Ficha pública del coche. Marcado de frontend/web/coche.html con los datos del post.
 * La cabecera y el pie son los del tema (get_header / get_footer).
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
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
                        <img<?php echo $n === 0 ? ' class="activa"' : ''; ?> src="<?php echo esc_url($foto['mini']); ?>" data-grande="<?php echo esc_url($foto['grande']); ?>" alt="<?php echo esc_attr(sprintf('Foto %d de %d', $n + 1, count($c['fotos']))); ?>" loading="lazy" tabindex="0" role="button">
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
                <?php if ($c['cuota']) : ?>
                    <p class="cuota cifra">Desde <?php echo esc_html($c['cuota']); ?><small>Cuota orientativa, sujeta a aprobación de la financiera</small></p>
                <?php elseif ($c['financiado']) : ?>
                    <p class="cuota cifra">Financiándolo, <?php echo esc_html($c['financiado']); ?><small>Precio con financiación, sujeto a aprobación de la financiera</small></p>
                <?php endif; ?>
            </div>
            <p class="garantia"><span class="barra-marca barra-marca--roja"></span><span><strong>Revisado en nuestro taller.</strong> <?php echo esc_html((int) $c['garantia']); ?> meses de garantía como mínimo.</span></p>
            <div class="acciones">
                <?php if ($c['whatsapp']) : ?>
                    <a class="boton boton--whatsapp" href="<?php echo esc_url($c['whatsapp']); ?>">Preguntar por WhatsApp</a>
                <?php endif; ?>
                <div class="acciones__dos">
                    <?php if ($c['contactos']) : ?>
                        <a class="boton boton--borde" href="#contacto" data-ps-tipo="prueba">Pedir prueba</a>
                        <a class="boton boton--borde" href="#contacto" data-ps-tipo="financiacion">Financiarlo</a>
                        <a class="boton boton--borde" href="#contacto" data-ps-tipo="tasacion">Tasar mi coche</a>
                    <?php endif; ?>
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

            <?php if ($c['contactos']) : ?>
            <section class="seccion-web" id="contacto">
                <h2><span class="barra-marca"></span>Pregúntanos por este coche</h2>
                <!-- Envía a POST /api/contactos de la plataforma (la dirección sale de los ajustes del plugin). -->
                <form class="formulario-web" data-ps-contacto
                      data-api="<?php echo esc_url($c['contactos']); ?>"
                      data-coche="<?php echo esc_attr($c['referencia']); ?>"
                      data-sobre="<?php echo esc_attr($marca_modelo . ' (' . $c['enlace'] . ')'); ?>"
                      data-whatsapp="<?php echo $c['whatsapp'] ? '1' : ''; ?>">
                    <label class="campo"><span class="campo__nombre">Nombre</span><input name="nombre" autocomplete="name" maxlength="100" required></label>
                    <label class="campo"><span class="campo__nombre">Teléfono</span><input type="tel" name="telefono" autocomplete="tel" required></label>
                    <label class="campo campo--ancho">
                        <span class="campo__nombre">Qué quieres</span>
                        <select name="tipo">
                            <option value="informacion">Más información</option>
                            <option value="prueba">Probarlo</option>
                            <option value="financiacion">Financiarlo</option>
                            <option value="tasacion">Tasar mi coche como parte del pago</option>
                        </select>
                    </label>
                    <label class="campo campo--ancho"><span class="campo__nombre">Mensaje</span><textarea name="mensaje" maxlength="1800"></textarea></label>
                    <!-- Campo trampa: fuera de la pantalla (no type="hidden") para que los robots lo rellenen. La API descarta esos envíos. -->
                    <div style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden" aria-hidden="true">
                        <label>Deja este campo vacío <input name="web" tabindex="-1" autocomplete="off"></label>
                    </div>
                    <label class="casilla">
                        <input type="checkbox" name="privacidad" required>
                        <span>He leído la <a href="<?php echo esc_url(get_privacy_policy_url() ?: '#'); ?>">política de privacidad</a> y acepto que me llaméis por este coche.</span>
                    </label>
                    <button class="boton" type="submit">Enviar</button>
                    <p class="nota" data-ps-aviso role="status" aria-live="polite" hidden></p>
                </form>
            </section>
            <?php endif; ?>
        </div>
    </div>
</main>

<?php if ($c['whatsapp']) : ?>
    <a class="boton boton--whatsapp whatsapp-fijo" href="<?php echo esc_url($c['whatsapp']); ?>">Preguntar por WhatsApp</a>
<?php endif; ?>
</div>

<script>
/* Formulario de contacto: manda el contacto a la API de la plataforma en JSON. Sin JavaScript no se envía
   (el botón recarga la página): la API no admite formularios clásicos. */
(function () {
    var form = document.querySelector('.ps-web [data-ps-contacto]');
    if (!form) return;
    var aviso = form.querySelector('[data-ps-aviso]');
    var boton = form.querySelector('button[type=submit]');
    var otraVia = form.getAttribute('data-whatsapp') ? ' o escríbenos por WhatsApp' : ' o llámanos';
    function campo(nombre) { return form.elements.namedItem(nombre); }

    // «Pedir prueba», «Financiarlo» y «Tasar mi coche» dejan elegido lo que se quiere
    document.querySelectorAll('.ps-web [data-ps-tipo]').forEach(function (enlace) {
        enlace.addEventListener('click', function () { campo('tipo').value = enlace.getAttribute('data-ps-tipo'); });
    });

    function avisar(texto, error) {
        aviso.textContent = texto;
        aviso.hidden = false;
        aviso.style.color = error ? '#ff8a80' : '';
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (boton.disabled) return;
        var coche = form.getAttribute('data-coche');
        var mensaje = campo('mensaje').value.trim();
        // Sin referencia (la web no tiene ese campo) se dice en el mensaje de qué coche se pregunta
        if (!coche) mensaje = ('Pregunta por el ' + form.getAttribute('data-sobre') + '\n' + mensaje).trim().slice(0, 2000);
        var datos = {
            nombre: campo('nombre').value.trim(),
            telefono: campo('telefono').value.trim(),
            tipo: campo('tipo').value,
            mensaje: mensaje,
            privacidad: campo('privacidad').checked,
            web: campo('web').value
        };
        if (coche) datos.coche = coche;

        boton.disabled = true;
        boton.textContent = 'Enviando…';
        fetch(form.getAttribute('data-api'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos),
            credentials: 'omit'
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (r) { return { status: res.status, ok: res.ok, error: r.error }; });
        }).then(function (r) {
            if (r.ok) {
                form.reset();
                avisar('Recibido. Te llamamos para hablar de este coche.');
            } else if (r.status === 429) {
                avisar('Has enviado varios mensajes seguidos. Prueba dentro de unos minutos' + otraVia + '.', true);
            } else if (r.status === 400 && r.error) {
                avisar(r.error + '.', true);
            } else {
                avisar('No se ha podido enviar. Vuelve a intentarlo' + otraVia + '.', true);
            }
        }).catch(function () {
            avisar('No se ha podido enviar. Vuelve a intentarlo' + otraVia + '.', true);
        }).then(function () {
            boton.disabled = false;
            boton.textContent = 'Enviar';
        });
    });
})();

/* Galería: al pulsar una miniatura, la foto grande cambia con un fundido (crossfade). Con ratón, al
   pasar por encima de la foto grande se amplía y sigue al cursor (lupa). Sin JavaScript se ve la primera. */
(function () {
    var galeria = document.querySelector('.ps-web .galeria');
    if (!galeria) return;
    var marco = galeria.querySelector('.galeria__grande');
    var grande = marco.querySelector('img');
    var minis = galeria.querySelectorAll('.galeria__miniaturas img');
    var sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var capaActual = null;

    function mostrar(mini) {
        var src = mini.getAttribute('data-grande') || mini.src;
        minis.forEach(function (m) { m.classList.toggle('activa', m === mini); });
        if (capaActual) { capaActual.remove(); capaActual = null; }
        if (grande.src === new URL(src, location.href).href) return;
        if (sinMovimiento) { grande.src = src; return; }

        // La foto nueva se carga en una capa encima; cuando ya está, se funde y pasa a ser la de abajo
        var capa = document.createElement('img');
        capa.className = 'galeria__capa';
        capa.alt = '';
        capa.setAttribute('aria-hidden', 'true');
        capaActual = capa;
        capa.onload = function () {
            if (capaActual !== capa) return;
            marco.appendChild(capa);
            capa.getBoundingClientRect(); // que el navegador pinte la capa transparente antes de fundirla
            capa.classList.add('galeria__capa--visible');
            setTimeout(function () {
                if (capaActual !== capa) return;
                grande.src = src;
                (grande.decode ? grande.decode() : Promise.resolve()).catch(function () {}).then(function () {
                    if (capaActual === capa) { capa.remove(); capaActual = null; }
                });
            }, 300);
        };
        capa.src = src;
    }

    minis.forEach(function (mini) {
        mini.addEventListener('click', function () { mostrar(mini); });
        mini.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mostrar(mini); } });
    });

    // Lupa: solo con ratón (en el móvil, la foto se ve entera)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        marco.addEventListener('mousemove', function (e) {
            var r = marco.getBoundingClientRect();
            marco.style.setProperty('--lupa-x', ((e.clientX - r.left) / r.width * 100) + '%');
            marco.style.setProperty('--lupa-y', ((e.clientY - r.top) / r.height * 100) + '%');
        });
        marco.addEventListener('mouseenter', function () { marco.classList.add('galeria__grande--lupa'); });
        marco.addEventListener('mouseleave', function () { marco.classList.remove('galeria__grande--lupa'); });
    }
})();
</script>
<?php
get_footer();
