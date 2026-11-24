"""Copia del cerebro de DILEMA con fondo transparente, para la ola del encabezado.

No toca la imagen original (frontend/public/dilema-cerebro.jpg). Escribe
frontend/public/dilema-cerebro-ola.webp:
  1. "Color a transparencia": cada píxel se separa del azul marino del fondo (medido en las
     esquinas) y esa distancia es su opacidad; el color se recupera sin el fondo. Así el brillo
     y el halo del cerebro quedan semitransparentes y se funden con cualquier color de ola.
  2. Se borran las estrellas de la imagen (los destellos los dibuja la ola) y lo que queda
     fuera del cerebro y su órbita.
  3. Se recorta al cerebro con su órbita.

Uso: python tools/imagenes/cerebro-transparente.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / 'frontend/public/dilema-cerebro.jpg'
DESTINO = RAIZ / 'frontend/public/dilema-cerebro-ola.webp'

imagen = np.asarray(Image.open(ORIGEN).convert('RGB'), dtype=np.float64)
alto, ancho, _ = imagen.shape

# Color del fondo: promedio de las cuatro esquinas (unos 24 x 24 px cada una).
esquinas = np.concatenate([imagen[:24, :24].reshape(-1, 3), imagen[:24, -24:].reshape(-1, 3),
                           imagen[-24:, :24].reshape(-1, 3), imagen[-24:, -24:].reshape(-1, 3)])
fondo = esquinas.mean(axis=0)

# Color a transparencia: por canal, cuánto más CLARO que el fondo es el píxel (lo más oscuro que el
# fondo son sombras y ruido del JPG, que sobre un azul brillante se verían como manchas grises).
delta = imagen - fondo
alfa_luz = np.clip(np.max(np.maximum(delta, 0) / (255.0 - fondo), axis=2), 0, 1)
alfa = np.clip((alfa_luz - 0.06) / 0.94, 0, 1)
color = np.clip(fondo + delta / np.maximum(alfa, 1e-6)[..., None], 0, 255)
# Pensada para ir sobre la parte azul marino de la ola (casi el color del fondo): ahí se ve igual que la
# imagen original. Por eso el encabezado apoya solo la parte de abajo sobre el borde brillante.

# Solo el cerebro y su órbita: elipse centrada en el cerebro; afuera, transparente con borde suave.
yy, xx = np.mgrid[0:alto, 0:ancho]
elipse = ((xx - 0.505 * ancho) / (0.465 * ancho)) ** 2 + ((yy - 0.455 * alto) / (0.255 * alto)) ** 2
alfa *= np.clip((1.0 - elipse) / 0.12, 0, 1)
# Estrellas de la imagen original (posición en la imagen de 1024 px, radio).
for x, y, r in [(180, 222, 34), (72, 268, 14), (879, 260, 16), (966, 295, 12), (872, 656, 30)]:
    cerca = (xx - x * ancho / 1024) ** 2 + (yy - y * alto / 1024) ** 2 <= (r * ancho / 1024) ** 2
    alfa[cerca] = 0

# Recorte al contenido visible, con un pequeño margen.
filas = np.where(alfa.max(axis=1) > 0.02)[0]
columnas = np.where(alfa.max(axis=0) > 0.02)[0]
margen = 6
y0, y1 = max(filas[0] - margen, 0), min(filas[-1] + margen + 1, alto)
x0, x1 = max(columnas[0] - margen, 0), min(columnas[-1] + margen + 1, ancho)
rgba = np.dstack([color, alfa * 255.0])[y0:y1, x0:x1].round().astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(DESTINO, 'WEBP', quality=90, alpha_quality=95, method=6)
print(f'fondo medido: rgb{tuple(int(round(c)) for c in fondo)} · recorte {x1 - x0}x{y1 - y0} · '
      f'{DESTINO.relative_to(RAIZ)} ({DESTINO.stat().st_size // 1024} KB)')
