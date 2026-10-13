<?php
/**
 * Formulario de contacto de un coche. Lo usan la ficha del plugin (plantillas/ficha.php) y el shortcode
 * [proservice_contacto], que se puede poner en la ficha del tema. Lo envía assets/formulario.js:
 *   · a POST /api/contactos, en JSON o, con fotos de una tasación, en multipart;
 *   · si se pide una prueba con día y hora, a POST /api/citas/pedir (solo con la referencia del coche).
 *
 * Espera $f = ProService_Formulario::datos($post_id).
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<form class="formulario-web" data-ps-contacto
      data-api="<?php echo esc_url($f['contactos']); ?>"
      data-citas="<?php echo esc_url($f['citas']); ?>"
      data-coche="<?php echo esc_attr($f['referencia']); ?>"
      data-sobre="<?php echo esc_attr($f['sobre']); ?>"
      data-whatsapp="<?php echo $f['whatsapp'] ? '1' : ''; ?>">
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

    <?php if ($f['citas']) : ?>
    <!-- Prueba: día y hora de los huecos libres (GET /api/citas/huecos). Si no cargan, se pide como contacto. -->
    <div class="formulario-web__extra" data-ps-solo="prueba" hidden>
        <label class="campo"><span class="campo__nombre">Día</span>
            <select name="dia"><option value="">Prefiero que me llaméis para quedar</option></select></label>
        <label class="campo"><span class="campo__nombre">Hora</span><select name="hora" disabled></select></label>
        <p class="nota campo--ancho" data-ps-citas-aviso>La prueba dura media hora. Te llamamos para confirmarla.</p>
    </div>
    <?php endif; ?>

    <!-- Tasación: el coche que quiere dar como parte del pago y hasta 5 fotos -->
    <fieldset class="formulario-web__extra" data-ps-solo="tasacion" hidden>
        <legend class="campo__nombre">Tu coche</legend>
        <label class="campo"><span class="campo__nombre">Marca</span><input name="tasacion_marca" maxlength="60" data-ps-obligatorio></label>
        <label class="campo"><span class="campo__nombre">Modelo</span><input name="tasacion_modelo" maxlength="80" data-ps-obligatorio></label>
        <label class="campo"><span class="campo__nombre">Año</span><input name="tasacion_anio" inputmode="numeric" pattern="[0-9]{4}" data-ps-obligatorio></label>
        <label class="campo"><span class="campo__nombre">Kilómetros</span><input name="tasacion_km" inputmode="numeric" pattern="[0-9.]{1,9}" data-ps-obligatorio></label>
        <label class="campo campo--ancho"><span class="campo__nombre">Fotos (hasta 5, opcional)</span>
            <input type="file" name="fotos" accept="image/jpeg,image/png,image/webp" multiple></label>
    </fieldset>

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
