"""Copia de proservicerubi.com lo que pintan sus plantillas de coches, para la réplica local.

    python3 wordpress-pruebas/replica/extraer.py

Descarga https://proservicerubi.com/coches/ y la ficha del primer coche, y guarda en esta carpeta:
  archivo.css, archivo.js           CSS y script de su listado (filtro AJAX, miniaturas, carrusel móvil)
  archivo-antes.html, archivo-despues.html   lo fijo del listado, antes y después de las tarjetas
  ficha.css, ficha.js               CSS y script de su ficha (galería, lightbox, parallax)
  ficha-despues.html                lo fijo de la ficha: Jaume, comparativa, reseñas y formulario
  cabecera.html, pie.html           su cabecera y su pie de Elementor (logo, menú, «Pide cita», redes, horario)
  cabecera.css                      el CSS que necesitan: Elementor, sus plantillas, fuentes y el tema hijo
Las partes con datos (tarjetas, portada, galería, ficha técnica) las pintan archivo.php y ficha.php
con el mismo HTML. Solo lee páginas públicas, como un visitante. Volver a ejecutarlo si cambian su web.
"""
import datetime
import pathlib
import re
import urllib.parse
import urllib.request

WEB = 'https://proservicerubi.com'
AQUI = pathlib.Path(__file__).resolve().parent
TOKEN = '{{FORMULARIO_TOKEN}}'


def bajar(url):
    peticion = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (réplica local de pruebas)'})
    with urllib.request.urlopen(peticion, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')


def guardar(nombre, texto, comentario):
    sello = f'copiado de {WEB} el {datetime.date.today():%d-%m-%Y} por extraer.py · no editar a mano'
    if nombre.endswith('.html'):
        texto = f'<!-- {sello} -->\n{texto}'
    else:
        texto = f'/* {comentario} · {sello} */\n{texto}'
    (AQUI / nombre).write_text(texto, encoding='utf-8')
    print(f'{nombre}: {len(texto)} bytes')


def partes(html):
    cuerpo = html[html.find('<body'):]
    principal = cuerpo[cuerpo.find('<main'):cuerpo.find('</main>') + len('</main>')]
    estilos = '\n'.join(re.findall(r'<style>(.*?)</style>', cuerpo, re.S))
    scripts = [s for s in re.findall(r'<script>(.*?)</script>', cuerpo, re.S)
               if 'lazyloadRunObserver' not in s and 'dataLayer' not in s and ('document' in s or 'Swiper' in s)]
    return principal, estilos, '\n;\n'.join(scripts)


def sin_token(html):
    # Su formulario lleva un nonce de WordPress: en la réplica lo pone la plantilla
    html = re.sub(r'<input type="hidden" id="form_token" name="form_token" value="[^"]*" />'
                  r'<input type="hidden" name="_wp_http_referer" value="[^"]*" />', TOKEN, html)
    return re.sub(r'<input type="hidden" name="form_token" value="[^"]*">', TOKEN, html)


archivo = bajar(f'{WEB}/coches/')
principal, estilos, script = partes(archivo)
inicio = principal.find('<article class="coche-card"')
fin = principal.rfind('</article>') + len('</article>')
guardar('archivo.css', estilos, 'CSS de su listado')
guardar('archivo.js', script.replace(f'{WEB}/wp-admin/admin-ajax.php', '{{AJAX_URL}}'), 'Script de su listado')
guardar('archivo-antes.html', principal[:inicio], '')
guardar('archivo-despues.html', sin_token(principal[fin:]), '')

tarjeta = archivo[archivo.find('<article class="coche-card"'):]
primera = re.search(rf'href="({re.escape(WEB)}/coches/[^"/]+/)"', tarjeta).group(1)
ficha = bajar(primera)
principal, estilos, script = partes(ficha)
corte = principal.find('<!-- PERSONA -->')
guardar('ficha.css', estilos, 'CSS de su ficha')
guardar('ficha.js', script, 'Script de su ficha')
guardar('ficha-despues.html', sin_token(principal[corte:]), '')
print(f'Ficha de referencia: {primera}')

# --- Cabecera y pie (plantillas de Elementor de su web) ------------------------------------------------
# Solo HTML y CSS: el JavaScript de Elementor arrastra jQuery y una docena de librerías. Lo poco que hace
# falta (abrir el menú en el móvil) lo pone replica.php. Las fuentes y las imágenes se quedan en su web:
# las rutas del CSS se resuelven a direcciones completas.
cuerpo = archivo[archivo.find('<body'):]
cabecera = cuerpo[cuerpo.find('<header'):cuerpo.find('</header>') + len('</header>')]
pie = cuerpo[cuerpo.find('<footer'):cuerpo.find('</footer>') + len('</footer>')]


def enlaces_locales(html):
    # Inicio y coches, a la réplica; lo demás, a su web (aquí no existe)
    for viejo, nuevo in [(f'"{WEB}/coches/"', '"{{COCHES}}"'), ('"/vehiculos-de-ocasion"', '"{{COCHES}}"'),
                         (f'"{WEB}/"', '"{{INICIO}}"'), (f'"{WEB}"', '"{{INICIO}}"'), ('"/home"', '"{{INICIO}}"')]:
        html = html.replace('href=' + viejo, 'href=' + nuevo)
    html = re.sub(r'href="/([^"]*)"', lambda m: f'href="{WEB}/{m.group(1)}"', html)
    # Su formulario de suscripción no envía nada desde la réplica
    return html.replace('<form ', '<form onsubmit="return false" ')


guardar('cabecera.html', enlaces_locales(cabecera), '')
guardar('pie.html', enlaces_locales(pie), '')

cabeza = archivo[:archivo.find('<body')]
hojas = [h for h in re.findall(r"<link[^>]+rel=['\"]stylesheet['\"][^>]+href=['\"]([^'\"]+)", cabeza)
         if '/elementor' in h or 'hello-biz-child' in h]
trozos = []
for href in hojas:
    url = href.replace('http://', 'https://')
    css = bajar(url)
    # url(...) relativas → completas, para que las fuentes e imágenes se carguen de su web
    css = re.sub(r'url\((["\']?)(?!data:|https?:|//)([^"\')]+)\1\)',
                 lambda m: f'url({m.group(1)}{urllib.parse.urljoin(url, m.group(2))}{m.group(1)})', css)
    if 'google-fonts' in url:
        # De las fuentes, solo el alfabeto latino: el resto (coreano, cirílico, griego…) no lo usa una web en español
        css = '\n'.join(m.group(0) for m in re.finditer(r'/\* (latin|latin-ext) \*/\s*@font-face\s*\{[^}]*\}', css))
    trozos.append(f'/* ---- {url.split("?")[0].replace(WEB, "")} ---- */\n{css}')
guardar('cabecera.css', '\n'.join(trozos), 'CSS de su cabecera y su pie (Elementor, plantillas 7, 90 y 190, fuentes y tema hijo)')
