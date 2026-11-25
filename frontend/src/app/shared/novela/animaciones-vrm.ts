import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { AnimacionCatalogo } from './gestos';

/**
 * Animaciones de Mixamo (FBX, sin piel, 30 fps) para los personajes VRM de la novela.
 *
 * La conversión sigue el ejemplo oficial de three-vrm (loadMixamoAnimation + mixamoVRMRigMap): cada
 * rotación de Mixamo se pasa al espacio de los huesos normalizados de VRM y, para VRM 0.0, se invierten
 * X y Z. Además el personaje queda ANCLADO: la cadera no se desplaza a los lados ni hacia adelante y el
 * cuerpo no gira (se quita el giro vertical de la cadera y el giro medio del pecho); así cada personaje
 * se queda en su lugar mirando al frente.
 *
 * La app carga las animaciones ya convertidas (JSON liviano en public/animaciones/vrm/, generado una vez con
 * tools/animaciones): solo los huesos que se usan, sin pistas quietas repetidas y los reposos a 15 cuadros por
 * segundo. Si falta un JSON, se descarga el FBX y se convierte en el navegador como respaldo (FBXLoader se
 * descarga solo en ese caso). Cada animación se carga una sola vez (caché compartida por todos los personajes);
 * cada personaje recibe su propio AnimationClip (caché por modelo).
 */

const CARPETA = '/animaciones/';

/** Mapa de huesos de Mixamo a huesos humanoides de VRM (mixamoVRMRigMap del ejemplo oficial). */
export const MIXAMO_A_VRM: Record<string, VRMHumanBoneName> = {
  mixamorigHips: 'hips', mixamorigSpine: 'spine', mixamorigSpine1: 'chest', mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck', mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder', mixamorigLeftArm: 'leftUpperArm', mixamorigLeftForeArm: 'leftLowerArm', mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal', mixamorigLeftHandThumb2: 'leftThumbProximal', mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal', mixamorigLeftHandIndex2: 'leftIndexIntermediate', mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal', mixamorigLeftHandMiddle2: 'leftMiddleIntermediate', mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal', mixamorigLeftHandRing2: 'leftRingIntermediate', mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal', mixamorigLeftHandPinky2: 'leftLittleIntermediate', mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder', mixamorigRightArm: 'rightUpperArm', mixamorigRightForeArm: 'rightLowerArm', mixamorigRightHand: 'rightHand',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal', mixamorigRightHandThumb2: 'rightThumbProximal', mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal', mixamorigRightHandIndex2: 'rightIndexIntermediate', mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal', mixamorigRightHandMiddle2: 'rightMiddleIntermediate', mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal', mixamorigRightHandRing2: 'rightRingIntermediate', mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal', mixamorigRightHandPinky2: 'rightLittleIntermediate', mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg', mixamorigLeftLeg: 'leftLowerLeg', mixamorigLeftFoot: 'leftFoot', mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg', mixamorigRightLeg: 'rightLowerLeg', mixamorigRightFoot: 'rightFoot', mixamorigRightToeBase: 'rightToes'
};

/** Una pista convertida al espacio normalizado de VRM 1.0 (sin depender de un modelo concreto). */
interface PistaBase { hueso: VRMHumanBoneName; tiempos: Float32Array; valores: Float32Array; }

/** Animación convertida: rotaciones de cada hueso y altura de la cadera (en proporción a la de Mixamo). */
export interface AnimacionBase {
  duracion: number;
  rotaciones: PistaBase[];
  /** Altura de la cadera en cada cuadro, dividida por la altura de la cadera de Mixamo en reposo. */
  cadera: { tiempos: Float32Array; alturas: Float32Array } | null;
}

const EJE_Y = new THREE.Vector3(0, 1, 0);

/** Giro vertical (rad) de una rotación: hacia dónde apunta el frente (+Z) visto desde arriba. */
function giroVertical(q: THREE.Quaternion): number {
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return Math.atan2(frente.x, frente.z);
}

/**
 * Convierte el FBX de Mixamo (ya leído) a pistas de huesos normalizados de VRM 1.0, con el personaje anclado:
 * sin desplazamiento horizontal de la cadera y sin giro del cuerpo.
 */
export function convertirMixamo(fbx: THREE.Group): AnimacionBase {
  const clip = THREE.AnimationClip.findByName(fbx.animations, 'mixamo.com') ?? fbx.animations[0];
  if (!clip) throw new Error('El archivo no trae animación.');
  const caderaMixamo = fbx.getObjectByName('mixamorigHips');
  const alturaMixamo = caderaMixamo?.position.y || 1;
  const inversaReposo = new THREE.Quaternion();
  const padreReposo = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const rotaciones: PistaBase[] = [];
  let cadera: AnimacionBase['cadera'] = null;

  for (const pista of clip.tracks) {
    const [nodo, propiedad] = pista.name.split('.');
    const hueso = MIXAMO_A_VRM[nodo];
    const original = fbx.getObjectByName(nodo);
    if (!hueso || !original?.parent) continue;
    if (pista.ValueTypeName === 'quaternion' && propiedad === 'quaternion') {
      original.getWorldQuaternion(inversaReposo).invert();
      original.parent.getWorldQuaternion(padreReposo);
      const valores = new Float32Array(pista.values.length);
      for (let i = 0; i < valores.length; i += 4) {
        q.fromArray(pista.values, i).premultiply(padreReposo).multiply(inversaReposo).toArray(valores, i);
      }
      rotaciones.push({ hueso, tiempos: Float32Array.from(pista.times), valores });
    } else if (pista.ValueTypeName === 'vector' && propiedad === 'position' && hueso === 'hips') {
      // Solo la altura: la cadera sube y baja (respira, se agacha un poco) pero no se desplaza.
      const alturas = new Float32Array(pista.times.length);
      for (let k = 0; k < alturas.length; k++) alturas[k] = pista.values[k * 3 + 1] / alturaMixamo;
      cadera = { tiempos: Float32Array.from(pista.times), alturas };
    }
  }
  anclarGiro(rotaciones);
  return { duracion: clip.duration, rotaciones, cadera };
}

/**
 * Quita el giro del cuerpo: en cada cuadro la cadera vuelve a mirar al frente y, si el pecho queda girado
 * en promedio (la animación se graba de lado), se compensa en la cadera. Las inclinaciones se conservan.
 */
function anclarGiro(rotaciones: PistaBase[]): void {
  const cadera = rotaciones.find(p => p.hueso === 'hips');
  if (!cadera) return;
  const q = new THREE.Quaternion(), giro = new THREE.Quaternion();
  for (let i = 0; i < cadera.valores.length; i += 4) {
    q.fromArray(cadera.valores, i);
    giro.setFromAxisAngle(EJE_Y, -giroVertical(q));
    q.premultiply(giro).toArray(cadera.valores, i);
  }
  // Giro medio del pecho (cadera · columna · pecho · pecho alto) con la cadera ya al frente.
  const cadena = ['spine', 'chest', 'upperChest'].map(h => rotaciones.find(p => p.hueso === h))
    .filter((p): p is PistaBase => !!p && p.valores.length === cadera.valores.length);
  const n = cadera.valores.length / 4;
  if (!n) return;
  let suma = 0;
  const parcial = new THREE.Quaternion();
  for (let k = 0; k < n; k++) {
    q.fromArray(cadera.valores, k * 4);
    for (const p of cadena) q.multiply(parcial.fromArray(p.valores, k * 4));
    suma += giroVertical(q);
  }
  const medio = suma / n;
  if (Math.abs(medio) < 0.05) return;
  giro.setFromAxisAngle(EJE_Y, -medio);
  for (let i = 0; i < cadera.valores.length; i += 4) q.fromArray(cadera.valores, i).premultiply(giro).toArray(cadera.valores, i);
}

/** Huesos que quedan quietos en el reposo: sin balanceo de lado a lado ni cambio de peso. */
const QUIETOS_EN_REPOSO = new Set<VRMHumanBoneName>(['hips', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes']);
/** Cuánto movimiento conservan el pecho, los hombros, los brazos y la cabeza en el reposo (respiración suave). */
export const INTENSIDAD_REPOSO = 0.35;

/** Rotación media de una pista (promedio de cuaterniones con el mismo signo, normalizado). */
function rotacionMedia(valores: Float32Array): THREE.Quaternion {
  const suma = new THREE.Vector4();
  const q = new THREE.Vector4();
  const primero = new THREE.Vector4().fromArray(valores, 0);
  for (let i = 0; i < valores.length; i += 4) {
    q.fromArray(valores, i);
    if (q.dot(primero) < 0) q.negate();
    suma.add(q);
  }
  suma.normalize();
  return new THREE.Quaternion(suma.x, suma.y, suma.z, suma.w);
}

/**
 * Reposo tranquilo: cadera y piernas fijas en su pose media (la altura de la cadera también) y el resto del
 * cuerpo solo se aparta de su pose media un `intensidad` de lo que se movía en la animación original.
 */
export function suavizarReposo(base: AnimacionBase, intensidad = INTENSIDAD_REPOSO): AnimacionBase {
  const q = new THREE.Quaternion();
  const rotaciones = base.rotaciones.map(p => {
    const media = rotacionMedia(p.valores);
    const valores = new Float32Array(p.valores.length);
    const t = QUIETOS_EN_REPOSO.has(p.hueso) ? 0 : intensidad;
    for (let i = 0; i < valores.length; i += 4) {
      q.copy(media).slerp(new THREE.Quaternion().fromArray(p.valores, i), t).toArray(valores, i);
    }
    return { ...p, valores };
  });
  let cadera = base.cadera;
  if (cadera) {
    const media = cadera.alturas.reduce((s, a) => s + a, 0) / Math.max(1, cadera.alturas.length);
    cadera = { tiempos: cadera.tiempos, alturas: new Float32Array(cadera.alturas.length).fill(media) };
  }
  return { duracion: base.duracion, rotaciones, cadera };
}

/**
 * AnimationClip para un modelo concreto. Las pistas apuntan a los huesos normalizados por su uuid
 * (los nombres cambian entre modelos). En VRM 0.0 se invierten X y Z de las rotaciones, como en el ejemplo oficial.
 */
export function clipParaVrm(base: AnimacionBase, vrm: VRM, nombre: string): THREE.AnimationClip {
  const h = vrm.humanoid;
  const vrm0 = vrm.meta?.metaVersion === '0';
  const pistas: THREE.KeyframeTrack[] = [];
  for (const p of base.rotaciones) {
    const nodo = h.getNormalizedBoneNode(p.hueso);
    if (!nodo) continue;
    const valores = vrm0 ? p.valores.map((v, i) => (i % 2 === 0 ? -v : v)) : p.valores;
    pistas.push(new THREE.QuaternionKeyframeTrack(`${nodo.uuid}.quaternion`, p.tiempos, valores));
  }
  const cadera = h.getNormalizedBoneNode('hips');
  const reposo = h.normalizedRestPose.hips?.position;
  if (base.cadera && cadera && reposo) {
    // La cadera se queda en su lugar (x, z del reposo) y solo sube o baja en proporción al modelo.
    const alto = Math.abs(reposo[1]);
    const valores = new Float32Array(base.cadera.alturas.length * 3);
    base.cadera.alturas.forEach((a, k) => { valores[k * 3] = reposo[0]; valores[k * 3 + 1] = a * alto; valores[k * 3 + 2] = reposo[2]; });
    pistas.push(new THREE.VectorKeyframeTrack(`${cadera.uuid}.position`, base.cadera.tiempos, valores));
  }
  return new THREE.AnimationClip(nombre, base.duracion, pistas);
}

// ---------------------------------------------------------------- formato liviano (JSON)

/** Animación convertida y lista para VRM, como se guarda en public/animaciones/vrm/<id>.json. */
export interface AnimacionLiviana {
  formato: 'dilema-vrm-anim';
  version: 1;
  duracion: number;
  /** Tiempos comunes a todas las pistas (s). */
  tiempos: number[];
  /** Rotación (x, y, z, w) de cada hueso en cada tiempo, o una sola si el hueso no se mueve. */
  huesos: Partial<Record<VRMHumanBoneName, number[]>>;
  /** Altura de la cadera (proporción de la de Mixamo) en cada tiempo, o una sola si no cambia. */
  cadera: number[] | null;
}

/** Valor de una pista en el tiempo t (interpolación lineal; esférica para rotaciones). */
function muestrear(tiempos: Float32Array, valores: Float32Array, n: number, t: number, salida: number[]): void {
  let k = 0;
  while (k < tiempos.length - 2 && tiempos[k + 1] < t) k++;
  const j = Math.min(k + 1, tiempos.length - 1);
  const t0 = tiempos[k], t1 = tiempos[j];
  const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  if (n === 4) {
    const a = new THREE.Quaternion().fromArray(valores, k * 4), b = new THREE.Quaternion().fromArray(valores, j * 4);
    a.slerp(b, f).toArray(salida, 0);
  } else for (let c = 0; c < n; c++) salida[c] = valores[k * n + c] + (valores[j * n + c] - valores[k * n + c]) * f;
}

/** 3 decimales: el error en las rotaciones es menor a 0,1° (no se nota). */
const redondear = (v: number) => Math.round(v * 1e3) / 1e3;

/**
 * Pasa una animación convertida al formato liviano: todas las pistas a los mismos tiempos (`fps` cuadros por
 * segundo), valores con 3 decimales y una sola muestra para los huesos que no se mueven. `maximo` recorta la
 * duración (los gestos nunca se ven más allá de su límite en escena).
 */
export function aLiviana(completa: AnimacionBase, fps: number, maximo = Infinity): AnimacionLiviana {
  const base = { ...completa, duracion: Math.min(completa.duracion, maximo) };
  const n = Math.max(2, Math.round(base.duracion * fps) + 1);
  const tiempos = Array.from({ length: n }, (_, k) => redondear(Math.min(base.duracion, k / fps)));
  tiempos[n - 1] = redondear(base.duracion);
  const tmp = [0, 0, 0, 0];
  const huesos: AnimacionLiviana['huesos'] = {};
  for (const p of base.rotaciones) {
    const valores: number[] = [];
    for (const t of tiempos) { muestrear(p.tiempos, p.valores, 4, t, tmp); valores.push(...tmp.map(redondear)); }
    const quieto = valores.every((v, i) => Math.abs(v - valores[i % 4]) < 2e-4);
    huesos[p.hueso] = quieto ? valores.slice(0, 4) : valores;
  }
  let cadera: number[] | null = null;
  if (base.cadera) {
    const c = base.cadera;
    cadera = tiempos.map(t => { muestrear(c.tiempos, c.alturas, 1, t, tmp); return redondear(tmp[0]); });
    if (cadera.every(v => Math.abs(v - cadera![0]) < 2e-4)) cadera = [cadera[0]];
  }
  return { formato: 'dilema-vrm-anim', version: 1, duracion: base.duracion, tiempos, huesos, cadera };
}

/** Lee el formato liviano (las pistas quietas vuelven a tener dos claves: inicio y fin). */
export function desdeLiviana(d: AnimacionLiviana): AnimacionBase {
  if (d?.formato !== 'dilema-vrm-anim' || d.version !== 1) throw new Error('Formato de animación desconocido.');
  const todos = Float32Array.from(d.tiempos);
  const extremos = Float32Array.from([0, d.duracion]);
  // Con 3 decimales las rotaciones quedan apenas fuera de la unidad: se normalizan al leerlas.
  const normalizadas = (v: number[]) => {
    const r = Float32Array.from(v);
    for (let i = 0; i < r.length; i += 4) {
      const n = Math.hypot(r[i], r[i + 1], r[i + 2], r[i + 3]) || 1;
      r[i] /= n; r[i + 1] /= n; r[i + 2] /= n; r[i + 3] /= n;
    }
    return r;
  };
  const rotaciones: PistaBase[] = Object.entries(d.huesos).map(([hueso, v]) => v!.length === 4
    ? { hueso: hueso as VRMHumanBoneName, tiempos: extremos, valores: normalizadas([...v!, ...v!]) }
    : { hueso: hueso as VRMHumanBoneName, tiempos: todos, valores: normalizadas(v!) });
  const cadera = !d.cadera ? null : d.cadera.length === 1
    ? { tiempos: extremos, alturas: Float32Array.from([d.cadera[0], d.cadera[0]]) }
    : { tiempos: todos, alturas: Float32Array.from(d.cadera) };
  return { duracion: d.duracion, rotaciones, cadera };
}

/** Cuadros por segundo del formato liviano: los reposos (lentos y suavizados) con menos. */
export const FPS_LIVIANA = { reposo: 15, gesto: 30 };
/**
 * Duración máxima que se guarda de un gesto (s): en escena se cortan a los 6 s con un fundido de 0,5 s
 * (LIMITE_GESTO_S y FUNDIDO_S de escena-novela), así que lo que sigue nunca se ve. Los reposos se guardan enteros.
 */
export const DURACION_MAXIMA_GESTO = 6.5;

/**
 * Catálogo y caché de animaciones. Cada FBX se descarga y convierte una sola vez; si falla, la promesa
 * se descarta para poder reintentar más tarde.
 */
export class BibliotecaAnimaciones {
  private catalogoPromesa?: Promise<AnimacionCatalogo[]>;
  private readonly bases = new Map<string, Promise<AnimacionBase>>();
  private readonly clips = new WeakMap<VRM, Map<string, THREE.AnimationClip>>();
  /** Animaciones ya convertidas (para usarlas sin esperar). */
  private readonly listas = new Map<string, AnimacionBase>();

  catalogo(): Promise<AnimacionCatalogo[]> {
    this.catalogoPromesa ??= fetch(CARPETA + 'animaciones.json')
      .then(r => { if (!r.ok) throw new Error(`animaciones.json: ${r.status}`); return r.json(); })
      .then((d: { animaciones: AnimacionCatalogo[] }) => d.animaciones ?? [])
      .catch(e => { this.catalogoPromesa = undefined; throw e; });
    return this.catalogoPromesa;
  }

  /** Carga una animación (o la toma de la caché): el JSON liviano y, si falta, el FBX convertido aquí. */
  base(a: AnimacionCatalogo): Promise<AnimacionBase> {
    let p = this.bases.get(a.id);
    if (!p) {
      p = fetch(CARPETA + 'vrm/' + encodeURIComponent(a.id) + '.json')
        .then(r => { if (!r.ok) throw new Error(`${a.id}.json: ${r.status}`); return r.json(); })
        .then((d: AnimacionLiviana) => desdeLiviana(d))
        .catch(() => this.desdeFbx(a))
        .then(b => { this.listas.set(a.id, b); return b; });
      p.catch(() => this.bases.delete(a.id));
      this.bases.set(a.id, p);
    }
    return p;
  }

  /** Respaldo: descarga el FBX y lo convierte en el navegador (el cargador FBX se descarga solo aquí). */
  private async desdeFbx(a: AnimacionCatalogo): Promise<AnimacionBase> {
    const r = await fetch(CARPETA + encodeURIComponent(a.archivo));
    if (!r.ok) throw new Error(`${a.archivo}: ${r.status}`);
    const buffer = await r.arrayBuffer();
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const base = convertirMixamo(new FBXLoader().parse(buffer, ''));
    return a.categoria === 'reposo' ? suavizarReposo(base) : base;
  }

  /** Suelta las animaciones cargadas (al salir del caso); el catálogo se conserva. */
  vaciar(): void {
    this.bases.clear();
    this.listas.clear();
  }

  /** Precarga en segundo plano todas las versiones (no pendientes) de esas categorías. */
  precargar(categorias: Iterable<string>): void {
    const quiero = new Set(categorias);
    this.catalogo().then(c => {
      for (const a of c) if (!a.pendiente && quiero.has(a.categoria)) this.base(a).catch(() => undefined);
    }).catch(() => undefined);
  }

  /** Clip del modelo si la animación ya está convertida; null si todavía no. */
  clipListo(vrm: VRM, a: AnimacionCatalogo): THREE.AnimationClip | null {
    const base = this.listas.get(a.id);
    if (!base) return null;
    let porModelo = this.clips.get(vrm);
    if (!porModelo) { porModelo = new Map(); this.clips.set(vrm, porModelo); }
    let clip = porModelo.get(a.id);
    if (!clip) { clip = clipParaVrm(base, vrm, a.id); porModelo.set(a.id, clip); }
    return clip;
  }
}

/** Una sola biblioteca para toda la app: las animaciones se reutilizan entre escenas y personajes. */
export const animaciones = new BibliotecaAnimaciones();
