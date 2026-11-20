"""M03-ligero: todas las texturas <=1024 en WebP q85 (con alfa donde haga falta)
y morph targets guardados como accessors dispersos (sparse) de glTF, sin pérdida.

No toca extensiones VRM, expresiones, huesos ni materiales.
"""
import io, struct, sys
from PIL import Image
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from vrm_optimizar import leer_glb, escribir_glb

MAX, Q = 1024, 85


def datos_vista(js, binc, vi):
    bv = js['bufferViews'][vi]; o = bv.get('byteOffset', 0)
    return binc[o:o + bv['byteLength']]


def main(entrada, salida):
    js, binc = leer_glb(entrada)
    piezas = {}  # índice de bufferView -> bytes nuevos (para las vistas que se conservan)

    # 1) texturas
    for i, img in enumerate(js['images']):
        im = Image.open(io.BytesIO(datos_vista(js, binc, img['bufferView']))); im.load()
        con_alfa = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getchannel('A').getextrema()[0] < 255
        im = im.convert('RGBA' if con_alfa else 'RGB')
        w, h = im.size
        if max(w, h) > MAX:
            f = MAX / max(w, h); im = im.resize((round(w * f), round(h * f)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=Q, alpha_quality=100, method=6, exact=True)
        piezas[img['bufferView']] = buf.getvalue()
        img['mimeType'] = 'image/webp'
    for t in js['textures']:
        if 'source' in t:
            src = t.pop('source'); t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': src}
    for k in ('extensionsUsed', 'extensionsRequired'):
        lst = js.setdefault(k, [])
        if 'EXT_texture_webp' not in lst: lst.append('EXT_texture_webp')

    # 2) morph targets -> sparse (solo accessors VEC3 float, sin byteStride)
    morph = sorted({i for m in js['meshes'] for p in m['primitives'] for t in p.get('targets', []) for i in t.values()})
    nuevas_vistas = []  # (bytes) que se agregan al final
    base_nueva = len(js['bufferViews'])
    stats = [0, 0, 0]
    for ai in morph:
        a = js['accessors'][ai]
        if a.get('sparse') or a.get('componentType') != 5126 or a.get('type') != 'VEC3' or 'bufferView' not in a:
            continue
        bv = js['bufferViews'][a['bufferView']]
        if bv.get('byteStride', 12) != 12: continue
        o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        n = a['count']
        vals = struct.unpack_from(f'<{n*3}f', binc, o)
        idx = [v for v in range(n) if vals[3*v] != 0.0 or vals[3*v+1] != 0.0 or vals[3*v+2] != 0.0]
        stats[0] += 1; stats[1] += n; stats[2] += len(idx)
        del a['bufferView']; a.pop('byteOffset', None)
        if not idx:
            continue  # accessor sin bufferView ni sparse = todo ceros (válido en glTF)
        ctype, fmt = (5123, 'H') if n < 65536 else (5125, 'I')
        ib = struct.pack(f'<{len(idx)}{fmt}', *idx)
        vb = struct.pack(f'<{len(idx)*3}f', *[c for v in idx for c in vals[3*v:3*v+3]])
        vi_idx = base_nueva + len(nuevas_vistas); nuevas_vistas.append(ib)
        vi_val = base_nueva + len(nuevas_vistas); nuevas_vistas.append(vb)
        a['sparse'] = {'count': len(idx), 'indices': {'bufferView': vi_idx, 'componentType': ctype},
                       'values': {'bufferView': vi_val}}
    print(f'morph accessors convertidos {stats[0]}; vértices {stats[1]} -> guardados {stats[2]} ({100*stats[2]/max(1,stats[1]):.1f}%)')

    for datos in nuevas_vistas:
        js['bufferViews'].append({'buffer': 0, 'byteLength': len(datos)})
    n_orig = base_nueva

    # 3) quitar bufferViews que ya nadie usa y reconstruir el BIN
    usadas = set()
    for a in js['accessors']:
        if 'bufferView' in a: usadas.add(a['bufferView'])
        if 'sparse' in a: usadas |= {a['sparse']['indices']['bufferView'], a['sparse']['values']['bufferView']}
    for img in js['images']: usadas.add(img['bufferView'])
    orden = sorted(usadas)
    remap = {old: new for new, old in enumerate(orden)}
    nuevo_bin = bytearray(); vistas = []
    for old in orden:
        bv = dict(js['bufferViews'][old])
        if old >= n_orig: datos = nuevas_vistas[old - n_orig]
        elif old in piezas: datos = piezas[old]
        else: datos = datos_vista(js, binc, old)
        while len(nuevo_bin) % 4: nuevo_bin += b'\0'
        bv['byteOffset'] = len(nuevo_bin); bv['byteLength'] = len(datos)
        nuevo_bin += datos; vistas.append(bv)
    js['bufferViews'] = vistas
    for a in js['accessors']:
        if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
        if 'sparse' in a:
            a['sparse']['indices']['bufferView'] = remap[a['sparse']['indices']['bufferView']]
            a['sparse']['values']['bufferView'] = remap[a['sparse']['values']['bufferView']]
    for img in js['images']: img['bufferView'] = remap[img['bufferView']]
    js['buffers'][0]['byteLength'] = len(nuevo_bin)
    escribir_glb(salida, js, bytes(nuevo_bin))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
