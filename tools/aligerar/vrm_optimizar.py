"""Optimiza texturas de un VRM 1.0 (GLB) sin tocar sus extensiones VRM.

Solo cambia: images (bytes y mimeType), textures (EXT_texture_webp), bufferViews,
buffers[0].byteLength, extensionsUsed/extensionsRequired. No une materiales ni texturas.
"""
import io, json, struct, sys
from PIL import Image

MAX = 1024
# Palabras de materiales cuya textura base se deja sin pérdida y sin reducir (cara y ojos)
CARA = ("_FACE", "_EYE", "Face_00_SKIN")


def leer_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67 and version == 2
    off = 12; js = binc = None
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A: js = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942: binc = bytes(chunk)
        off += 8 + clen
    return js, binc


def escribir_glb(path, js, binc):
    j = json.dumps(js, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    b = binc + b'\0' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(b)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(b), 0x004E4942)); f.write(b)


def usos_por_imagen(js):
    uso = {}
    def marca(tinfo, mat, slot):
        if isinstance(tinfo, dict) and 'index' in tinfo:
            src = js['textures'][tinfo['index']]['source']
            uso.setdefault(src, set()).add((mat, slot))
    for m in js['materials']:
        n = m.get('name', '')
        marca(m.get('pbrMetallicRoughness', {}).get('baseColorTexture'), n, 'base')
        for k in ('normalTexture', 'emissiveTexture', 'occlusionTexture'):
            marca(m.get(k), n, k)
        for k, v in m.get('extensions', {}).get('VRMC_materials_mtoon', {}).items():
            marca(v, n, 'mtoon.' + k)
    return uso


def main(entrada, salida):
    js, binc = leer_glb(entrada)
    uso = usos_por_imagen(js)
    vistas_img = {img['bufferView']: i for i, img in enumerate(js['images'])}
    assert len(js['buffers']) == 1

    nuevos = {}  # índice de imagen -> bytes webp
    for i, img in enumerate(js['images']):
        bv = js['bufferViews'][img['bufferView']]
        o = bv.get('byteOffset', 0)
        im = Image.open(io.BytesIO(binc[o:o + bv['byteLength']]))
        im.load()
        usos = uso.get(i, set())
        es_cara = any(any(c in mat for c in CARA) for mat, _ in usos)
        es_normal = any(slot == 'normalTexture' for _, slot in usos)
        con_alfa = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getchannel('A').getextrema()[0] < 255
        im = im.convert('RGBA' if con_alfa else 'RGB')
        w, h = im.size
        if es_cara or max(w, h) <= 64:
            # cara/ojos y texturas auxiliares: sin pérdida y sin reducir
            buf = io.BytesIO(); im.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
            modo = 'sin pérdida'
        else:
            if max(w, h) > MAX:
                f = MAX / max(w, h)
                im = im.resize((max(1, round(w * f)), max(1, round(h * f))), Image.LANCZOS)
            q = 90 if es_normal else 85
            buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, alpha_quality=100, method=6, exact=True)
            modo = f'q{q}'
        nuevos[i] = buf.getvalue()
        print(f"img{i:2d} {img.get('name','')[:28]:28s} {w}x{h} -> {im.size[0]}x{im.size[1]} {im.mode:4s} {modo:12s} "
              f"{bv['byteLength']//1024:5d}KB -> {len(nuevos[i])//1024:5d}KB")

    # reconstruir BIN conservando el orden de bufferViews
    nuevo_bin = bytearray()
    for vi, bv in enumerate(js['bufferViews']):
        while len(nuevo_bin) % 4: nuevo_bin += b'\0'
        if vi in vistas_img:
            datos = nuevos[vistas_img[vi]]
        else:
            o = bv.get('byteOffset', 0); datos = binc[o:o + bv['byteLength']]
        bv['byteOffset'] = len(nuevo_bin); bv['byteLength'] = len(datos)
        nuevo_bin += datos
    js['buffers'][0]['byteLength'] = len(nuevo_bin)

    for img in js['images']:
        img['mimeType'] = 'image/webp'
    for t in js['textures']:
        src = t.pop('source')
        t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': src}
    for k in ('extensionsUsed', 'extensionsRequired'):
        lst = js.setdefault(k, [])
        if 'EXT_texture_webp' not in lst: lst.append('EXT_texture_webp')

    escribir_glb(salida, js, bytes(nuevo_bin))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
