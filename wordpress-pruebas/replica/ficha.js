/* Script de su ficha · copiado de https://proservicerubi.com el 01-10-2026 por extraer.py · no editar a mano */

function goForm(){document.getElementById('form').scrollIntoView({behavior:'smooth'})}

/* PARALLAX HERO */
window.addEventListener('scroll',()=>{heroBg.style.transform=`translateY(${scrollY*0.25}px)`})

// Miniaturas -> Imagen grande + lightbox
const mainImg = document.getElementById('mainImg');
const mainLink = mainImg.parentElement;

// Array con todas las URLs de la galería
const galleryUrls = [
  "https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/5e479d4b-3b48-4c64-ba5d-7cb471d0108c.png",
  ["https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/5e479d4b-3b48-4c64-ba5d-7cb471d0108c.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/0d00c39c-0ada-42ac-9e0d-289416770cb6.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/3ba70149-9a77-45b5-85d2-b983e3831a6d.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/906b236a-18d6-4513-8dc8-2ad0fd356cd7.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/ae42fc0d-6f00-4c50-81f1-c1fd9044c5fe.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/b257eb55-fc1b-4680-949f-ce93fa41da0a.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/e68bb278-021b-4f24-bbc8-501aa70ee2d7-1.png","https:\/\/proservicerubi.com\/wp-content\/uploads\/2026\/09\/e68bb278-021b-4f24-bbc8-501aa70ee2d7.png"] 
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

