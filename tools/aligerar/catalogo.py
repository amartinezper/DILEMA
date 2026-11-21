"""Crea el catálogo de personajes a partir de los modelos aprobados de vroid-hub.

Uso (los .vrm descargados son datos no confiables: ejecutar siempre con python -I):
    python -I tools/aligerar/catalogo.py <vroid-hub> <salida-catalogo> [ids...]

Para cada modelo con sirve=true en <vroid-hub>/_registro.json:
  1. lo aligera con la receta de M03-ligero (vrm_ligero.py: texturas <=1024 WebP q85
     y morph targets dispersos), sin tocar el original;
  2. lo verifica contra el original (expresiones, materiales, huesos, datos de geometría);
  3. si pasa, lo deja como <Id>-<nn>.vrm y lo anota en personajes.json.
También escribe CREDITOS.md.
"""
import hashlib, io, json, os, re, struct, sys, time, traceback, urllib.parse
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vrm_optimizar import leer_glb  # noqa: E402
import vrm_ligero  # noqa: E402

ROLES = {
    "M01": "Niña 8", "M02": "Adolescente mujer 15", "M03": "Mujer joven 22", "M04": "Universitaria 22",
    "M05": "Madre 38", "M06": "Profesional mujer 42", "M07": "Médica o psicóloga 35", "M08": "Mujer madura 52",
    "M09-M10": "Mujer mayor 60 a 80", "M11": "Policía mujer 30",
    "H01": "Niño 8", "H02": "Adolescente hombre 16", "H03": "Hombre joven 21", "H04": "Hombre joven 27",
    "H05": "Padre 40", "H06": "Profesional hombre 45 (juez)", "H07": "Médico o psicólogo 38", "H08": "Trabajador 50",
    "H09": "Hombre mayor 67", "H10": "Hombre mayor 80", "H11": "Policía hombre 32",
}

# Edad aparente anotada al revisar cada modelo.
EDADES = {
    "5693712892985744131": "8-10", "5919976917176841907": "8-10", "3976710034451525179": "14-18",
    "7379823763080786071": "16-20", "7057403092053516903": "14-16", "2343542119649989448": "15-17",
    "6711556864964286505": "13-16", "1095566045637127064": "20-25", "5403965150878681237": "20-25",
    "2872500525954576043": "20-28", "2952184614904072712": "20-25", "10575525746729287": "20-25",
    "162260551173402114": "30-38", "7001670167815341416": "30-40", "1252838404115252038": "25-35",
    "1305218592422249728": "25-30", "6907289742214477700": "25-35", "2290888234298164700": "25-32",
    "2060342718675092670": "25-30", "21280177758786328": "25-35", "6295857748080121255": "30-40",
    "6061658851332729757": "55-65", "6827109784341593109": "40-50", "9027447138796778074": "28-35",
    "7118307285003104680": "8-10", "8291620414211158197": "8-12", "5678675938007162159": "14-17",
    "6977922305568299588": "14-16", "608323607310517415": "16-20", "6056633268567222512": "15-18",
    "6165145336509501080": "15-18", "2705665963485579330": "18-23", "4260608305469757611": "18-23",
    "4746755001017872944": "18-23", "5728628125082522478": "18-22", "5265854791577408922": "22-27",
    "340860444786907840": "22-27", "178299437743975939": "25-30", "6710634284033463478": "40-45",
    "6967063174306568747": "25-30", "6797633304401841959": "32-40", "3696820596927486396": "25-35",
    "3877179030975082588": "50-60", "7911164810680359787": "30-40", "1610687958138132094": "25-35",
    "3916861091887700785": "25-32", "2868960598556593456": "40-50", "1506531138757394280": "35-45",
    "5298444106399367485": "25-30", "3731640620759451044": "45-55", "5489551812862156210": "30-40",
    "7122791886834244869": "45-55", "8366925206339721821": "65-75", "6081123482579224685": "40-50",
    "7564841051120285228": "70-80", "8163763284193467487": "25-32",
}

# Ropa de un oficio (revisada mirando cada modelo de cuerpo entero). El motor solo usa "salud" y "policia"
# para personajes con ese rol; para roles familiares o sin rol prefiere null y luego "formal".
ROPA_OFICIO = {
    # salud: bata o uniforme médico
    "6797633304401841959": "salud",   # H05-02 鷲夫: abrigo blanco largo tipo bata
    "5298444106399367485": "salud",   # H07-02 DR Iridium: bata blanca
    "6711556864964286505": "salud",   # M02-04 Eliza Torland: uniforme rosado de enfermera con cofia
    "10575525746729287": "salud",     # M04-01: bata blanca sobre blusa azul
    "21280177758786328": "salud",     # M07-01 クスノキ: bata blanca larga
    "2060342718675092670": "salud",   # M07-02 Helen: bata blanca
    # policia: uniforme
    "7911164810680359787": "policia", # H06-03 tanpatu_suit: gorra de plato con insignia, traje y corbata
    # formal: traje
    "1610687958138132094": "formal",  # H06-01 traje negro
    "3877179030975082588": "formal",  # H06-02 traje negro, gafas
    "2868960598556593456": "formal",  # H06-04 traje azul marino
    "3916861091887700785": "formal",  # H06-05 traje negro, corbata roja
    "6081123482579224685": "formal",  # H09-01 traje azul marino
    "7564841051120285228": "formal",  # H10-01 traje oscuro
    "2290888234298164700": "formal",  # M06-02 Yuzuki: traje negro con falda
    "6907289742214477700": "formal",  # M06-03 Teruha: bolero y falda lápiz
    "6295857748080121255": "formal",  # M08-02 saco y falda negros
    # escolar: uniforme de colegio
    "608323607310517415": "escolar",  # H02-02 chaleco, camisa y moño
    "2705665963485579330": "escolar", # H03-01 chaleco y camisa
    "4746755001017872944": "escolar", # H03-03 camisa blanca de manga corta y corbata
    "5728628125082522478": "escolar", # H03-04 chaleco y camisa
    "5265854791577408922": "escolar", # H04-03 chaleco, pantalón corto y medias altas
    "8163763284193467487": "escolar", # H11-01 chaleco y corbata
    "2343542119649989448": "escolar", # M02-03 chaleco, falda plisada y moño
    "7057403092053516903": "escolar", # M02-05 ビビ: chaleco, falda a cuadros y moño
}

# Grupos casi idénticos: el motor no debe ponerlos en el mismo caso.
CASI_IGUALES = [
    {"6081123482579224685", "2868960598556593456"},  # mismas texturas de traje, corbata y cuerpo
    {"5693712892985744131", "5919976917176841907"},  # misma niña de coletas con la misma ropa base
    {"5678675938007162159", "6977922305568299588", "6056633268567222512"},  # mismo saco con capucha y cabello oscuro
]

EXPR0 = {"joy": "alegria", "angry": "enojo", "sorrow": "tristeza", "fun": "relajado", "surprised": "sorpresa",
         "blink": "parpadeo", "a": "aa", "i": "ih", "u": "ou", "e": "ee", "o": "oh"}
EXPR1 = {"happy": "alegria", "angry": "enojo", "sad": "tristeza", "relaxed": "relajado", "surprised": "sorpresa",
         "blink": "parpadeo", "aa": "aa", "ih": "ih", "ou": "ou", "ee": "ee", "oh": "oh"}
NORMALES = ["alegria", "enojo", "tristeza", "relajado", "sorpresa", "parpadeo", "aa", "ih", "ou", "ee", "oh"]

# Partes de cara y ojo de VRoid que no caben en las zonas pedidas: van a "otros".
PARTES_CARA = ("FaceMouth", "FaceBrow", "FaceEyeline", "FaceEyelash", "EyeWhite", "EyeHighlight", "EyeExtra")


def limpio(n):
    return re.sub(r"\s*\((Instance|Outline)\)", "", n).strip()


def zona(n):
    if "EyeIris" in n: return "iris"
    if "_HAIR" in n or re.search(r"(^|_)Hair", n): return "cabello"
    if re.search(r"Accessory|Glasses|MATCAP|FRAME|LENS|Cap_|_Tie", n): return "accesorios"
    if re.search(r"Tops|Onepiece|Onepice", n): return "ropa_superior"
    if "Bottoms" in n: return "ropa_inferior"
    if "Shoes" in n: return "zapatos"
    if "_SKIN" in n: return "piel"
    return "otros"


def info_vrm(js):
    ext = js["extensions"]
    if "VRMC_vrm" in ext:
        v = ext["VRMC_vrm"]; m = v["meta"]
        ex = v.get("expressions", {})
        nombres = sorted(list(ex.get("preset", {}).keys()) + ["custom:" + k for k in ex.get("custom", {})])
        presentes = {EXPR1[k] for k in ex.get("preset", {}) if k in EXPR1}
        huesos = len(v["humanoid"]["humanBones"])
        lic = {"avatar": m.get("avatarPermission"), "comercial": m.get("commercialUsage"),
               "modificar": m.get("modification"), "redistribuir": m.get("allowRedistribution"),
               "credito": m.get("creditNotation")}
        redis = bool(m.get("allowRedistribution")) or m.get("modification") == "allowModificationRedistribution"
        resumen = (f"avatar: {lic['avatar']}; uso comercial: {lic['comercial']}; modificar: {lic['modificar']}; "
                   f"redistribuir: {'sí' if redis else 'no'}; crédito: {lic['credito']}")
        return "1.0", nombres, presentes, huesos, resumen, redis
    v = ext["VRM"]; m = v["meta"]
    grupos = v.get("blendShapeMaster", {}).get("blendShapeGroups", [])
    nombres = sorted(f"{g.get('presetName') or ''}:{g.get('name') or ''}" for g in grupos)
    presentes = {EXPR0[(g.get("presetName") or "").lower()] for g in grupos if (g.get("presetName") or "").lower() in EXPR0}
    huesos = len(v["humanoid"]["humanBones"])
    q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(m.get("otherPermissionUrl") or m.get("otherLicenseUrl") or "").query))
    redis = q.get("redistribution") == "allow"
    resumen = (f"avatar: {q.get('allowed_to_use_user')}; modificar: {q.get('modification')}; "
               f"uso comercial individual: {q.get('personal_commercial_use')}; empresas: {q.get('corporate_commercial_use')}; "
               f"redistribuir: {q.get('redistribution')}; crédito: {q.get('credit')}")
    return "0.0", nombres, presentes, huesos, resumen, redis


# --- lectura de accessors (con sparse) para comparar geometría ---
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}
FMT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
CS = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}


def leer_acc(js, binc, i):
    a = js["accessors"][i]; k = NC[a["type"]]; f = FMT[a["componentType"]]; n = a["count"] * k
    if "bufferView" in a:
        bv = js["bufferViews"][a["bufferView"]]; o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        paso = bv.get("byteStride") or CS[a["componentType"]] * k
        if paso == CS[a["componentType"]] * k:
            vals = list(struct.unpack_from(f"<{n}{f}", binc, o))
        else:
            vals = []
            for e in range(a["count"]): vals += struct.unpack_from(f"<{k}{f}", binc, o + e * paso)
    else:
        vals = [0] * n
    sp = a.get("sparse")
    if sp:
        iv = js["bufferViews"][sp["indices"]["bufferView"]]; vv = js["bufferViews"][sp["values"]["bufferView"]]
        idx = struct.unpack_from(f"<{sp['count']}{FMT[sp['indices']['componentType']]}", binc,
                                 iv.get("byteOffset", 0) + sp["indices"].get("byteOffset", 0))
        v = struct.unpack_from(f"<{sp['count'] * k}{f}", binc, vv.get("byteOffset", 0) + sp["values"].get("byteOffset", 0))
        for j, ix in enumerate(idx): vals[ix * k:(ix + 1) * k] = v[j * k:(j + 1) * k]
    return vals


def verificar(a_js, a_bin, b_js, b_bin):
    """Devuelve la lista de problemas (vacía si el modelo ligero conserva todo)."""
    p = []
    va = info_vrm(a_js); vb = info_vrm(b_js)
    if va[1] != vb[1]: p.append(f"expresiones distintas ({len(va[1])} -> {len(vb[1])})")
    if len(a_js["materials"]) != len(b_js["materials"]): p.append("número de materiales distinto")
    if va[3] != vb[3]: p.append("huesos humanoides distintos")
    if [len(s["joints"]) for s in a_js.get("skins", [])] != [len(s["joints"]) for s in b_js.get("skins", [])]:
        p.append("huesos de piel (skins) distintos")
    for k in ("materials", "meshes", "nodes", "skins", "scenes", "scene", "samplers", "extensions"):
        if a_js.get(k) != b_js.get(k): p.append(f"JSON '{k}' cambió")
    if len(a_js["accessors"]) != len(b_js["accessors"]):
        p.append("número de accessors distinto")
    else:
        dif = [i for i in range(len(a_js["accessors"])) if leer_acc(a_js, a_bin, i) != leer_acc(b_js, b_bin, i)]
        if dif: p.append(f"{len(dif)} accessors con datos distintos")
    mx = 0
    for img in b_js["images"]:
        bv = b_js["bufferViews"][img["bufferView"]]; o = bv.get("byteOffset", 0)
        im = Image.open(io.BytesIO(b_bin[o:o + bv["byteLength"]])); im.load()
        if im.format != "WEBP": p.append("textura que no es WebP")
        mx = max(mx, *im.size)
    if mx > 1024: p.append(f"textura de {mx} px")
    return p, va[1], len(a_js["materials"]), va[3]


def imagen_de(js, binc, tinfo):
    if not isinstance(tinfo, dict) or "index" not in tinfo: return None
    t = js["textures"][tinfo["index"]]
    src = t.get("source", t.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
    if src is None: return None
    bv = js["bufferViews"][js["images"][src]["bufferView"]]; o = bv.get("byteOffset", 0)
    im = Image.open(io.BytesIO(binc[o:o + bv["byteLength"]])); im.load()
    return im


def luminancia_cabello(js, binc):
    """Luminancia media (0 a 1) de las texturas de cabello, ponderada por píxeles visibles y por el color base."""
    total = suma = 0.0
    for m in js["materials"]:
        if zona(limpio(m.get("name", ""))) != "cabello": continue
        pbr = m.get("pbrMetallicRoughness", {})
        im = imagen_de(js, binc, pbr.get("baseColorTexture"))
        fr, fg, fb, _ = (pbr.get("baseColorFactor") or [1, 1, 1, 1])
        if im is None: continue
        im = im.convert("RGBA"); im.thumbnail((256, 256))
        for r, g, b, a in im.getdata():
            if a < 128: continue
            suma += (0.2126 * r * fr + 0.7152 * g * fg + 0.0722 * b * fb) / 255; total += 1
    return round(suma / total, 3) if total else None


def main(hub, salida, solo):
    os.makedirs(salida, exist_ok=True)
    reg = json.load(open(os.path.join(hub, "_registro.json"), encoding="utf-8"))
    aprobados = [r for r in reg["modelos"] if r["sirve"]]
    if solo: aprobados = [r for r in aprobados if r["id"] in solo]
    # Orden: por Id; primero los que cuentan para la meta, después los extras.
    aprobados.sort(key=lambda r: (r["id_base"], r["id_elenco"] == "extra", int(r["id"])))
    previo = os.path.join(salida, "personajes.json")
    anteriores = {p["vroid_hub_id"]: p for p in json.load(open(previo, encoding="utf-8"))["personajes"]} \
        if solo and os.path.exists(previo) else {}

    contador, personajes, fallos, otros_raros = {}, [], [], set()
    archivo_de = {}
    for r in aprobados:
        base = r["id_base"]; contador[base] = contador.get(base, 0) + 1
        archivo_de[r["id"]] = f"{base}-{contador[base]:02d}.vrm"

    for r in aprobados:
        vid = r["id"]; destino = os.path.join(salida, archivo_de[vid]); origen = os.path.join(hub, r["archivo"])
        t0 = time.time()
        try:
            vrm_ligero.main(origen, destino)
            a_js, a_bin = leer_glb(origen); b_js, b_bin = leer_glb(destino)
            problemas, nombres_expr, n_mat, n_huesos = verificar(a_js, a_bin, b_js, b_bin)
        except Exception as e:  # noqa: BLE001
            problemas = [f"error al procesar: {e!r}"]; traceback.print_exc()
        if problemas:
            fallos.append({"vroid_hub_id": vid, "archivo": archivo_de[vid], "motivos": problemas})
            if os.path.exists(destino): os.replace(destino, destino + ".fallido")
            print(f"FALLA {archivo_de[vid]} {vid}: {problemas}", flush=True)
            continue
        version, _, presentes, _, lic, redis = info_vrm(a_js)
        mats = {z: [] for z in ("piel", "cabello", "iris", "ropa_superior", "ropa_inferior", "zapatos", "accesorios", "otros")}
        for m in a_js["materials"]:
            n = limpio(m.get("name", "")); z = zona(n); mats[z].append(n)
            if z == "otros" and not any(c in n for c in PARTES_CARA): otros_raros.add(n)
        no_juntar = sorted(archivo_de[x] for g in CASI_IGUALES if vid in g for x in g if x != vid and x in archivo_de)
        ent = {
            "archivo": archivo_de[vid], "id_elenco": r["id_base"], "extra": r["id_elenco"] == "extra",
            "genero": "mujer" if r["id_base"].startswith("M") else "hombre",
            "edad_aparente": EDADES.get(vid), "rol": ROLES[r["id_base"]], "ropa_oficio": ROPA_OFICIO.get(vid),
            "vroid_hub_id": vid, "nombre": r["nombre"], "autor": r["autor"], "pide_credito": bool(r["pide_credito"]),
            "licencia": lic, "permite_redistribuir": redis,
            "excepcion_licencia": bool(r.get("excepcion")),
            "version_vrm": version, "peso_original_mb": round(os.path.getsize(origen) / 1e6, 1),
            "peso_ligero_mb": round(os.path.getsize(destino) / 1e6, 1),
            "expresiones": {k: k in presentes for k in NORMALES},
            "expresiones_originales": len(nombres_expr), "materiales_total": n_mat, "huesos_humanoides": n_huesos,
            "materiales": mats, "luminancia_cabello": luminancia_cabello(a_js, a_bin),
            "materiales_fusionados": r["materiales_fusionados"], "no_juntar_con": no_juntar, "notas": r["notas"],
        }
        anteriores.pop(vid, None)
        personajes.append(ent)
        print(f"ok {ent['archivo']:12s} {vid:20s} {ent['peso_original_mb']:5.1f} -> {ent['peso_ligero_mb']:4.1f} MB "
              f"({time.time() - t0:.0f}s)", flush=True)

    personajes += list(anteriores.values())
    personajes.sort(key=lambda p: p["archivo"])
    doc = {"generado": time.strftime("%Y-%m-%d"),
           "receta": "texturas <=1024 px WebP q85 (EXT_texture_webp), morph targets dispersos (sparse); VRM sin cambios",
           "personajes": personajes, "fallidos": fallos}
    with open(previo, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
    escribir_creditos(salida, personajes)
    print("TOTAL", len(personajes), "ok,", len(fallos), "fallidos")
    print("OTROS_RAROS", sorted(otros_raros))


def escribir_creditos(salida, personajes):
    pend = {"5265854791577408922", "9027447138796778074"}
    L = ["# Créditos de los personajes 3D", "",
         "Los modelos de esta carpeta son versiones aligeradas (texturas reducidas, sin otros cambios) de modelos",
         "publicados en VRoid Hub por sus autores, usados según la licencia de cada uno.", "",
         "## Modelos que piden crédito", "",
         "| Archivo | Modelo | Autor | Enlace |", "|---|---|---|---|"]
    for p in personajes:
        if not p["pide_credito"]: continue
        autor = p["autor"] or "**PENDIENTE**: el archivo no trae el autor; tomarlo de la página del modelo"
        if p["vroid_hub_id"] in pend and not p["autor"]: autor = "**PENDIENTE** (el archivo no trae el autor)"
        L.append(f"| {p['archivo']} | {p['nombre'] or '(sin nombre)'} | {autor} | "
                 f"https://hub.vroid.com/characters/models/{p['vroid_hub_id']} |")
    L += ["", "> El enlace usa el número del modelo. Si VRoid Hub no lo abre directamente, buscar el número en el sitio.", "",
          "## Agradecimientos", "",
          "Gracias a todos los autores de VRoid Hub cuyos modelos usamos, pidan crédito o no:", ""]
    vistos = set()
    for p in personajes:
        a = p["autor"] or f"autor del modelo {p['vroid_hub_id']}"
        if a in vistos: continue
        vistos.add(a); L.append(f"- {a}")
    L += ["", "Los modelos se crearon con VRoid Studio (pixiv).", ""]
    excep = [p for p in personajes if p.get("excepcion_licencia")]
    if excep:
        L += ["## Uso con condiciones", ""]
        for p in excep:
            L.append(f"- {p['archivo']} ({p['nombre']}, {p['autor']}): su licencia no permite uso comercial; "
                     "solo puede usarse mientras la aplicación no tenga fines comerciales.")
        L.append("")
    open(os.path.join(salida, "CREDITOS.md"), "w", encoding="utf-8", newline="\n").write("\n".join(L))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], set(sys.argv[3:]))
