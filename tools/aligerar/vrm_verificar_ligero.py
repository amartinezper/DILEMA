"""Verifica que M03-ligero conserva todo: JSON VRM, geometría y morph targets (decodificando sparse)."""
import io, struct, sys
from PIL import Image
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from vrm_optimizar import leer_glb

a_js, a_bin = leer_glb(sys.argv[1])   # original
b_js, b_bin = leer_glb(sys.argv[2])   # ligero
CS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
FMT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}


def leer_acc(js, binc, i):
    a = js['accessors'][i]; n = a['count'] * NC[a['type']]; f = FMT[a['componentType']]
    if 'bufferView' in a:
        bv = js['bufferViews'][a['bufferView']]
        stride = bv.get('byteStride'); o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        assert not stride or stride == CS[a['componentType']] * NC[a['type']], 'stride no soportado en la verificación'
        vals = list(struct.unpack_from(f'<{n}{f}', binc, o))
    else:
        vals = [0] * n
    sp = a.get('sparse')
    if sp:
        ivw = b_js['bufferViews'][sp['indices']['bufferView']] if js is b_js else js['bufferViews'][sp['indices']['bufferView']]
        idx = struct.unpack_from(f"<{sp['count']}{FMT[sp['indices']['componentType']]}", binc, ivw['byteOffset'] + sp['indices'].get('byteOffset', 0))
        vvw = js['bufferViews'][sp['values']['bufferView']]
        k = NC[a['type']]
        v = struct.unpack_from(f"<{sp['count']*k}{f}", binc, vvw['byteOffset'] + sp['values'].get('byteOffset', 0))
        for j, ix in enumerate(idx): vals[ix*k:(ix+1)*k] = v[j*k:(j+1)*k]
    return vals

# JSON que no debe cambiar
for k in ('materials', 'meshes', 'nodes', 'skins', 'scenes', 'scene', 'samplers', 'asset', 'extensions'):
    print(('IGUAL    ' if a_js.get(k) == b_js.get(k) else 'DISTINTO ') + k)
assert len(a_js['accessors']) == len(b_js['accessors'])
dif = [i for i in range(len(a_js['accessors'])) if leer_acc(a_js, a_bin, i) != leer_acc(b_js, b_bin, i)]
print('accessors con datos distintos:', dif)
campos = [i for i, (x, y) in enumerate(zip(a_js['accessors'], b_js['accessors']))
          if {k: v for k, v in x.items() if k not in ('bufferView', 'byteOffset', 'sparse')} !=
             {k: v for k, v in y.items() if k not in ('bufferView', 'byteOffset', 'sparse')}]
print('accessors con metadatos distintos (count/type/min/max):', campos)
mx = 0
for img in b_js['images']:
    bv = b_js['bufferViews'][img['bufferView']]
    im = Image.open(io.BytesIO(b_bin[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']])); im.load()
    assert im.format == 'WEBP'; mx = max(mx, *im.size)
print('imágenes WebP:', len(b_js['images']), 'lado máx', mx, '| sparse:', sum('sparse' in a for a in b_js['accessors']),
      '| sin datos (ceros):', sum('bufferView' not in a and 'sparse' not in a for a in b_js['accessors']))
print('extensionsUsed', b_js['extensionsUsed'], '| required', b_js['extensionsRequired'])
