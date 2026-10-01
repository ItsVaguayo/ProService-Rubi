<?php
/**
 * Réplica de la ficha de un coche de proservicerubi.com. Portada, galería y ficha técnica con su HTML;
 * Jaume, comparativa, reseñas y formulario de ficha-despues.html (extraer.py).
 * En su web el título grande y el «Conoce el …» salen vacíos: leen un campo que no está relleno.
 * Aquí se usa el campo «modelo» como suposición, así que también salen vacíos si no se manda.
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
the_post();
$id = get_the_ID();
$fotos = replica_fotos($id);
$modelo = replica_campo($id, 'modelo');
$precio = replica_campo($id, 'precio');
$cuota = replica_campo($id, 'cuota');
$km = replica_campo($id, 'kilometros');
$potencia = replica_campo($id, 'potencia');
$cilindrada = replica_campo($id, 'cilindrada');
?>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/glightbox/dist/css/glightbox.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
<style><?php echo file_get_contents(REPLICA_DIR . 'ficha.css'); ?></style>
<main>

<!-- HERO -->
<section class="hero">

  <!-- IMAGEN EN MOVIL (O SI NO HAY VIDEO) -->
  <div class="hero-bg" id="heroBg"
       style="background-image:url('<?php echo esc_url($fotos[0] ?? ''); ?>')">
  </div>

  <div class="hero-overlay"></div>
  <div class="hero-content" data-a>
    <span class="badge"><?php echo esc_html(replica_campo($id, 'estado') ?: 'En venta'); ?></span>
    <h1><?php echo esc_html($modelo); ?> </h1>
    <p>Vehículo revisado · Garantía real · Sin presión</p>
    <div class="price"><?php echo esc_html($precio); ?>€</div>

    <?php if ($cuota !== '') : ?>
      <div class="financed">Desde <?php echo esc_html($cuota); ?> €/mes</div>
    <?php endif; ?>

    <div class="cta">
      <button class="btn primary" onclick="goForm()">
        <i class="fa-solid fa-car"></i> Solicita tu prueba gratuita
      </button>
    </div>
  </div>
</section>

 <!-- GALERÍA + FICHA TÉCNICA -->
<section class="section light gallery-section" data-a>
  <header class="section-intro">
     <h2>Conoce el <?php echo esc_html($modelo); ?> </h2>
    <p>
      A continuación se presentan las imágenes reales del vehículo, junto con su información técnica y equipamiento correspondiente a esta unidad.
    </p>
  </header>
  <div class="gallery-wrapper">

    <!-- Móvil: solo carrusel -->
    <div class="swiper mobile-gallery-swiper">
      <div class="swiper-wrapper">
        <?php foreach ($fotos as $foto) : ?>
          <div class="swiper-slide">
            <img src="<?php echo esc_url($foto); ?>" alt="Foto del coche">
          </div>
        <?php endforeach; ?>
      </div>
      <div class="swiper-pagination"></div>
    </div>

    <!-- Desktop: miniaturas + imagen principal -->
    <div class="desktop-gallery">
      <div class="gallery-thumbs swiper thumbs-swiper">
        <div class="swiper-wrapper">
          <?php foreach ($fotos as $foto) : ?>
            <div class="swiper-slide">
              <img src="<?php echo esc_url($foto); ?>" data-large="<?php echo esc_url($foto); ?>" alt="Miniatura">
            </div>
          <?php endforeach; ?>
        </div>
        <div class="swiper-pagination"></div>
      </div>

      <div class="gallery-main">
        <a href="<?php echo esc_url($fotos[0] ?? ''); ?>"
          class="glightbox"
          data-gallery="car-gallery">
          <img id="mainImg" src="<?php echo esc_url($fotos[0] ?? ''); ?>" alt="Imagen principal">
        </a>
      </div>
      <div style="display:none">
        <?php foreach ($fotos as $foto) : ?>
          <a href="<?php echo esc_url($foto); ?>" class="glightbox" data-gallery="car-gallery"></a>
        <?php endforeach; ?>
      </div>

    </div>

  </div>

  <!-- Ficha Técnica -->
  <div class="tech-column">
    <h2>Ficha Técnica</h2>
    <div class="tech-grid">
      <div class="tech-card"><strong>Año</strong><span><?php echo esc_html(replica_campo($id, 'anio')); ?></span></div>
      <div class="tech-card"><strong>Combustible</strong><span><?php echo esc_html(replica_campo($id, 'combustible')); ?> </span></div>
      <div class="tech-card"><strong>Kilómetros</strong><span><?php echo esc_html($km !== '' ? $km . ' KM' : ''); ?></span></div>
      <div class="tech-card"><strong>Potencia</strong><span><?php echo esc_html($potencia !== '' ? $potencia . ' CV' : ''); ?></span></div>
      <div class="tech-card"><strong>Cilindrada</strong><span><?php echo esc_html($cilindrada !== '' ? $cilindrada . ' cc' : ''); ?></span></div>
      <div class="tech-card"><strong>Uso anterior</strong><span><?php echo esc_html(replica_campo($id, 'uso_anterior')); ?></span></div>
    </div>

    <!-- Extras -->

    <!-- Seguridad -->
  </div>
</section>

<?php
replica_aviso_solicitud();
echo replica_parte('ficha-despues.html'); // termina en </main>
?>
<script src="https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/glightbox/dist/js/glightbox.min.js"></script>
<script><?php echo file_get_contents(REPLICA_DIR . 'ficha.js'); ?></script>
<?php
get_footer();
