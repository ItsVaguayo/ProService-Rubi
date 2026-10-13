/* Script de su ficha · copiado de https://proservicerubi.com el 13-10-2026 por extraer.py · no editar a mano */

function goForm(){document.getElementById('form').scrollIntoView({behavior:'smooth'})}

/* PARALLAX HERO */
window.addEventListener('scroll',()=>{heroBg.style.transform=`translateY(${scrollY*0.25}px)`})

// Miniaturas -> Imagen grande + lightbox
const mainImg = document.getElementById('mainImg');
const mainLink = mainImg.parentElement;

// Array con todas las URLs de la galería
const galleryUrls = [
  "https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/69d4f6b6-3e4c-4647-97ab-fbea26e00d91-1.png",
  ["https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/83c66277-f526-4ec2-bc91-adce4647a851-2.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/69d4f6b6-3e4c-4647-97ab-fbea26e00d91.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/83c66277-f526-4ec2-bc91-adce4647a851.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/c93eb3b2-039f-4f12-b1fc-227880dfc710.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/c774569d-61ab-469d-9680-3f5e9d3b612f.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/d38a96db-32f0-4a16-9626-6af2f0b7549a.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/e3da4b39-731c-47c8-82af-07255831cf33.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/e975ede7-5b8e-457d-81ef-615587745b5b.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/f5feae2f-ba52-49fb-95eb-a370f676fc5d.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/fd00dc88-c547-4549-8e29-490917b050e0.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/7da3e942-54c3-4049-a35b-a7889738ab6e-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/69d4f6b6-3e4c-4647-97ab-fbea26e00d91-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/83c66277-f526-4ec2-bc91-adce4647a851-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/48433b45-234b-4420-9503-2318de6f6f1e.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/c93eb3b2-039f-4f12-b1fc-227880dfc710-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/c774569d-61ab-469d-9680-3f5e9d3b612f-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/d38a96db-32f0-4a16-9626-6af2f0b7549a-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/e3da4b39-731c-47c8-82af-07255831cf33-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/e975ede7-5b8e-457d-81ef-615587745b5b-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/10\/f5feae2f-ba52-49fb-95eb-a370f676fc5d-1.png"] 
].flat();

// Índice actual
let currentIndex = 0;

// Función para abrir GLightbox en un índice concreto
function openGallery(index){
  const lightbox = GLightbox({
    elements: galleryUrls.map(url => ({ href: url, type: 'image' }))
  });
  lightbox.openAt(index);
}

// Miniaturas -> Imagen grande + actualizar índice
document.querySelectorAll('.gallery-thumbs img').forEach((thumb, i) => {
  thumb.addEventListener('mouseenter', () => {
    mainImg.style.opacity = 0;
    mainImg.style.transform = 'scale(1.04)';
    setTimeout(() => {
      mainImg.src = thumb.dataset.large;
      mainImg.style.opacity = 1;
      mainImg.style.transform = 'scale(1)';
      currentIndex = i + 1; // +1 porque principal = 0
    }, 180);

    document.querySelectorAll('.gallery-thumbs img')
      .forEach(img => img.classList.remove('active'));
    thumb.classList.add('active');
  });

  thumb.addEventListener('click', () => openGallery(i+1));
});

// Imagen principal -> abrir lightbox desde imagen actual
mainLink.addEventListener('click', e => {
  e.preventDefault();
  openGallery(currentIndex);
});

// Swiper inicialización
new Swiper('.thumbs-swiper', {
  direction:'vertical',
  slidesPerView:5,
  spaceBetween:10,
  navigation:{nextEl:'.swiper-button-next',prevEl:'.swiper-button-prev'},
  pagination:{el:'.swiper-pagination',clickable:true},
  mousewheel:true
});

/* RESEÑAS */
new Swiper('.reviews-swiper',{
  slidesPerView:3,spaceBetween:30,loop:true,
  navigation:{nextEl:'.reviews-swiper .swiper-button-next',prevEl:'.reviews-swiper .swiper-button-prev'},
  breakpoints:{0:{slidesPerView:1},768:{slidesPerView:2},1024:{slidesPerView:3}}
});

/* SCROLL ANIM */
const o=new IntersectionObserver(e=>e.forEach(i=>i.isIntersecting&&i.target.classList.add('v')),{threshold:.2});
document.querySelectorAll('[data-a]').forEach(el=>o.observe(el));

new Swiper('.mobile-gallery-swiper', {
    slidesPerView: 1,
    spaceBetween: 10,
    loop: true,
    pagination: { el: '.mobile-gallery-swiper .swiper-pagination', clickable: true },
});

