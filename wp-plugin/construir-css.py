"""Genera wp-plugin/proservice-stock/assets/web.css a partir de frontend/css/base.css y web.css.

Todo queda colgado de .ps-web para que el diseño de la maqueta no pise el tema de WordPress
(ni al revés). :root y body pasan a ser .ps-web, así las variables de color solo existen dentro.

    python3 wp-plugin/construir-css.py

Se vuelve a ejecutar cada vez que cambie el CSS de frontend/. El resultado no se edita a mano.
"""
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGENES = [RAIZ / 'frontend/css/base.css', RAIZ / 'frontend/css/web.css']
DESTINO = RAIZ / 'wp-plugin/proservice-stock/assets/web.css'
AMBITO = '.ps-web'


def acotar_selector(sel):
    sel = sel.strip()
    if not sel:
        return sel
    if sel in (':root', 'html', 'body', 'body.web'):
        return AMBITO
    if sel.startswith('body.web '):
        return f'{AMBITO} {sel[len("body.web "):]}'
    if sel.startswith('body '):
        return f'{AMBITO} {sel[len("body "):]}'
    return f'{AMBITO} {sel}'


def acotar(css):
    """Recorre el CSS bloque a bloque. Dentro de @media se acota lo de dentro; @font-face y
    @keyframes se dejan tal cual."""
    salida = []
    i = 0
    while i < len(css):
        llave = css.find('{', i)
        if llave == -1:
            salida.append(css[i:])
            break
        cabecera = css[i:llave]
        # Llave de cierre que empareja, contando anidamiento
        nivel, j = 1, llave + 1
        while nivel and j < len(css):
            nivel += {'{': 1, '}': -1}.get(css[j], 0)
            j += 1
        cuerpo = css[llave + 1:j - 1]
        prefijo_blanco = cabecera[:len(cabecera) - len(cabecera.lstrip())]
        cab = cabecera.strip()
        if cab.startswith('@media') or cab.startswith('@supports'):
            salida.append(f'{prefijo_blanco}{cab} {{{acotar(cuerpo)}}}')
        elif cab.startswith('@'):
            salida.append(f'{prefijo_blanco}{cab} {{{cuerpo}}}')
        else:
            selectores = ', '.join(acotar_selector(s) for s in cab.split(','))
            salida.append(f'{prefijo_blanco}{selectores} {{{cuerpo}}}')
        i = j
    return ''.join(salida)


def main():
    partes = []
    for origen in ORIGENES:
        css = re.sub(r'/\*.*?\*/', '', origen.read_text(encoding='utf-8'), flags=re.S)
        partes.append(f'/* ---- {origen.relative_to(RAIZ)} ---- */\n{acotar(css)}')
    DESTINO.write_text(
        '/* GENERADO por wp-plugin/construir-css.py a partir de frontend/css. No se edita a mano. */\n'
        + '\n'.join(partes),
        encoding='utf-8',
    )
    print(f'{DESTINO.relative_to(RAIZ)}: {DESTINO.stat().st_size} bytes')


if __name__ == '__main__':
    main()
