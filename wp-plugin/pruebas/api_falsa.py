"""API falsa para probar el plugin sin la API de verdad.

Sirve en http://127.0.0.1:3998:
  /api/publicacion/feed/web  → el contenido de tmp/feed.json (lo reescribe prueba.php en cada caso)
  /fotos/N.png               → PNG de colores generados al arrancar
Si tmp/modo.txt contiene «caida», el feed responde 503.
"""
import http.server
import os
import struct
import zlib
from urllib.parse import urlparse

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp')
os.makedirs(os.path.join(DIR, 'fotos'), exist_ok=True)


def png(ruta, rgb, w=64, h=48):
    crudo = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))

    def trozo(tipo, datos):
        return struct.pack('>I', len(datos)) + tipo + datos + struct.pack('>I', zlib.crc32(tipo + datos) & 0xffffffff)

    with open(ruta, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + trozo(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                + trozo(b'IDAT', zlib.compress(crudo)) + trozo(b'IEND', b''))


for i, rgb in enumerate([(200, 30, 30), (30, 200, 30), (30, 30, 200), (200, 200, 30)], 1):
    png(os.path.join(DIR, 'fotos', f'{i}.png'), rgb)
if not os.path.exists(os.path.join(DIR, 'feed.json')):
    with open(os.path.join(DIR, 'feed.json'), 'w') as f:
        f.write('[]')


class Manejador(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def responder(self, codigo, tipo=None, cuerpo=b''):
        self.send_response(codigo)
        if tipo:
            self.send_header('Content-Type', tipo)
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        modo = os.path.join(DIR, 'modo.txt')
        camino = urlparse(self.path).path
        if camino == '/api/publicacion/feed/web':
            if os.path.exists(modo) and open(modo).read().strip() == 'caida':
                return self.responder(503)
            return self.responder(200, 'application/json', open(os.path.join(DIR, 'feed.json'), 'rb').read())
        ruta = os.path.normpath(os.path.join(DIR, camino.lstrip('/')))
        if camino.startswith('/fotos/') and ruta.startswith(DIR) and os.path.isfile(ruta):
            return self.responder(200, 'image/png', open(ruta, 'rb').read())
        self.responder(404)


http.server.ThreadingHTTPServer(('127.0.0.1', 3998), Manejador).serve_forever()
