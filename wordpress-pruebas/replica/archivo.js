/* Script de su listado · copiado de https://proservicerubi.com el 01-10-2026 por extraer.py · no editar a mano */

document.addEventListener('DOMContentLoaded',()=>{
  // Hover sobre thumbnails
  document.querySelectorAll('.coche-card').forEach(card=>{
    const mainImg = card.querySelector('[data-main-img]');
    const thumbs = card.querySelectorAll('[data-thumb]');
    if(!mainImg || !thumbs.length) return;
    thumbs.forEach(t=>{
      t.addEventListener('mouseenter',()=>{
        thumbs.forEach(i=>i.classList.remove('active'));
        t.classList.add('active');
        mainImg.src = t.src;
      });
    });
  });

  // Filtrado AJAX
  const form = document.getElementById('filtro-coches');
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const formData = new FormData(form);
    formData.append('action','filtrar_coches');

    fetch('{{AJAX_URL}}',{
      method:'POST',
      body:formData
    })
    .then(res=>res.text())
    .then(html=>{
      document.getElementById('resultado-coches').innerHTML = html;
    });
  });
});

// Scroll hacia el formulario
function goForm(){
  const formEl = document.getElementById('form');
  if(formEl){
    formEl.scrollIntoView({behavior:'smooth'});
  }
}

// ===== CARRUSEL MÓVIL CON FLECHAS Y DOTS =====

const grid = document.querySelector('.coches-grid');
const prevBtn = document.querySelector('.nav-prev');
const nextBtn = document.querySelector('.nav-next');
const dotsContainer = document.querySelector('.nav-dots');

if (grid && window.innerWidth <= 768) {

  const cards = grid.querySelectorAll('.coche-card');
  let currentIndex = 0;

  // Crear dots
  cards.forEach((_, index) => {
    const dot = document.createElement('span');
    if (index === 0) dot.classList.add('active');
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll('span');

  function updateCarousel(index) {
    const cardWidth = grid.offsetWidth;
    grid.scrollTo({
      left: cardWidth * index,
      behavior: 'smooth'
    });

    dots.forEach(d => d.classList.remove('active'));
    dots[index].classList.add('active');
    currentIndex = index;
  }

  nextBtn.addEventListener('click', () => {
    if (currentIndex < cards.length - 1) {
      updateCarousel(currentIndex + 1);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      updateCarousel(currentIndex - 1);
    }
  });

  // Detectar scroll manual
  grid.addEventListener('scroll', () => {
    const index = Math.round(grid.scrollLeft / grid.offsetWidth);
    dots.forEach(d => d.classList.remove('active'));
    if (dots[index]) dots[index].classList.add('active');
    currentIndex = index;
  });

}

