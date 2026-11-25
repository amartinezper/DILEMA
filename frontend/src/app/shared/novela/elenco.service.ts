import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { CaraVrm, buscarPartes, posarEnReposo } from './cara-vrm';
import {
  Asignacion, Aspecto, ModeloCatalogo, PersonajeEntrada, Rgb, TextosCaso, asignarElenco, luminancia
} from './elenco';

export type { Asignacion } from './elenco';

const CATALOGO = '/personajes/catalogo/';

/** Personaje 3D listo para poner en escena. */
export interface PersonajeCargado {
  vrm: VRM;
  cara: CaraVrm;
  asignacion: Asignacion;
}

/**
 * Elenco de la novela: catálogo de modelos, asignación (funciones puras de elenco.ts), caché de archivos
 * y aplicación del aspecto (recolor por zonas y canas) en cada instancia.
 */
@Injectable({ providedIn: 'root' })
export class ElencoService {
  private catalogoPromesa?: Promise<ModeloCatalogo[]>;
  /** Caché de archivos descargados (bytes), compartida por todas las escenas. */
  private readonly archivos = new Map<string, Promise<ArrayBuffer>>();

  catalogo(): Promise<ModeloCatalogo[]> {
    this.catalogoPromesa ??= fetch(CATALOGO + 'personajes.json')
      .then(r => { if (!r.ok) throw new Error(`personajes.json: ${r.status}`); return r.json(); })
      .then((d: { personajes: ModeloCatalogo[] }) => d.personajes)
      .catch(e => { this.catalogoPromesa = undefined; throw e; });
    return this.catalogoPromesa;
  }

  /** Asignación completa del caso (todos sus personajes, para no repetir modelos). */
  async asignar(casoId: number | string | null | undefined, personajes: PersonajeEntrada[] | null | undefined,
    textos: TextosCaso): Promise<Asignacion[]> {
    return asignarElenco(casoId, personajes, textos, await this.catalogo());
  }

  /** Descarga (o toma de la caché) el archivo de un modelo. */
  bytes(archivo: string): Promise<ArrayBuffer> {
    let p = this.archivos.get(archivo);
    if (!p) {
      p = fetch(CATALOGO + archivo).then(r => {
        if (!r.ok) throw new Error(`${archivo}: el servidor respondió ${r.status}`);
        return r.arrayBuffer();
      });
      p.catch(() => this.archivos.delete(archivo));
      this.archivos.set(archivo, p);
    }
    return p;
  }

  /**
   * Prepara de antemano los personajes de un escenario (la siguiente escena): descarga, lee el modelo y aplica
   * su aspecto, uno por uno y cuando el navegador está libre, para que el cambio de escena sea inmediato.
   * Las escenas abiertas compilan sus shaders al enterarse (alPreparar).
   */
  async precargar(casoId: number | string | null | undefined, personajes: PersonajeEntrada[] | null | undefined,
    textos: TextosCaso, bloque: number): Promise<void> {
    const asignados = await this.asignar(casoId, personajes, textos);
    for (const a of asignados.filter(x => x.modelo && x.personaje.escenarios.includes(bloque))) {
      if (!this.escenasAbiertas) return;
      await enReposo();
      await this.preparar(a).catch(() => undefined);
    }
  }

  // ------------------------------------------------------------ personajes preparados de antemano

  /** Personajes listos para usar (uno por modelo y aspecto), antes de que su escena los pida. */
  private readonly preparados = new Map<string, Promise<PersonajeCargado>>();
  private readonly oyentes = new Set<(p: PersonajeCargado) => void>();
  private escenasAbiertas = 0;

  private claveDe(a: Asignacion): string {
    return `${a.modelo?.archivo}|${JSON.stringify(a.aspecto)}`;
  }

  /** Prepara un personaje y lo guarda hasta que una escena lo pida (si ya está preparado, no repite). */
  preparar(asignacion: Asignacion): Promise<PersonajeCargado> {
    const clave = this.claveDe(asignacion);
    let p = this.preparados.get(clave);
    if (!p) {
      p = this.construir(asignacion);
      this.preparados.set(clave, p);
      p.then(x => { if (this.preparados.get(clave) === p) this.oyentes.forEach(f => f(x)); },
        () => { if (this.preparados.get(clave) === p) this.preparados.delete(clave); });
    }
    return p;
  }

  /** Avisa cada vez que se prepara un personaje (la escena compila sus shaders). Devuelve cómo dejar de escuchar. */
  alPreparar(oyente: (p: PersonajeCargado) => void): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  registrarEscena(): void { this.escenasAbiertas++; }

  /**
   * Al cerrarse la última escena se liberan los personajes preparados que nadie usó y los archivos en memoria.
   * Devuelve true si era la última (entonces también se pueden soltar las animaciones).
   */
  soltarEscena(): boolean {
    this.escenasAbiertas = Math.max(0, this.escenasAbiertas - 1);
    if (this.escenasAbiertas) return false;
    for (const p of this.preparados.values()) p.then(x => this.liberar(x), () => undefined);
    this.preparados.clear();
    this.archivos.clear();
    return true;
  }

  /** Instancia del personaje para una escena: la preparada de antemano si la hay; si no, una nueva. */
  crear(asignacion: Asignacion): Promise<PersonajeCargado> {
    const clave = this.claveDe(asignacion);
    const p = this.preparados.get(clave);
    if (p) {
      this.preparados.delete(clave);
      return p.catch(() => this.construir(asignacion));
    }
    return this.construir(asignacion);
  }

  /** Crea una instancia nueva del personaje (materiales propios) con su aspecto y pose de reposo. */
  private async construir(asignacion: Asignacion): Promise<PersonajeCargado> {
    if (!asignacion.modelo) throw new Error('No hay modelo para este personaje.');
    const buffer = await this.bytes(asignacion.modelo.archivo);
    const cargador = new GLTFLoader();
    cargador.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await cargador.parseAsync(buffer.slice(0), '');
    const vrm = gltf.userData['vrm'] as VRM | undefined;
    if (!vrm) throw new Error('El archivo no contiene un modelo VRM válido.');
    const cara = new CaraVrm(vrm, buscarPartes(gltf.scene, gltf.parser));
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(o => { o.frustumCulled = false; });
    posarEnReposo(vrm);
    if (asignacion.aspecto.recolorear) aplicarAspecto(vrm, asignacion.modelo, asignacion.aspecto);
    vrm.update(0);
    return { vrm, cara, asignacion };
  }

  /** Libera geometrías, materiales y texturas de una instancia. */
  liberar(p: PersonajeCargado): void {
    VRMUtils.deepDispose(p.vrm.scene);
  }
}

/** Espera a que el navegador esté libre (o como mucho 1 s) para no trabar lo que se está viendo. */
function enReposo(): Promise<void> {
  return new Promise(r => {
    const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => r(), { timeout: 1000 }); else setTimeout(r, 200);
  });
}

// ---------------------------------------------------------------- aspecto (three.js + canvas)

type Zona = 'piel' | 'cabello' | 'iris' | 'ropa_superior' | 'ropa_inferior';
const ZONAS_RECOLOR: Zona[] = ['piel', 'cabello', 'iris', 'ropa_superior', 'ropa_inferior'];

function limpio(n: string): string {
  return n.replace(/\s*\((Instance|Outline)\)/g, '').trim();
}

type MaterialMtoon = THREE.Material & {
  color?: THREE.Color;
  shadeColorFactor?: THREE.Color;
  map?: THREE.Texture | null;
  shadeMultiplyTexture?: THREE.Texture | null;
};

/**
 * Recolorea por zonas clonando los materiales de esta instancia. No toca "otros" (boca, cejas, pestañas,
 * blanco del ojo), zapatos ni accesorios. La piel y el cabello oscuro se multiplican por un color; el
 * cabello que hay que aclarar (canas) o que es de un color llamativo, el iris y la ropa llamativa se
 * tiñen en canvas (gris → color), solo para esta instancia.
 */
function aplicarAspecto(vrm: VRM, modelo: ModeloCatalogo, aspecto: Aspecto): void {
  const zonaDe = new Map<string, Zona>();
  for (const z of ZONAS_RECOLOR) for (const n of modelo.materiales[z] ?? []) zonaDe.set(n, z);
  const teñidas = new Map<string, THREE.Texture>();   // misma textura + mismo tinte -> una sola copia

  vrm.scene.traverse(o => {
    const malla = o as THREE.Mesh;
    if (!malla.isMesh) return;
    const lista = Array.isArray(malla.material) ? malla.material : [malla.material];
    const nuevos = lista.map(m => {
      const zona = zonaDe.get(limpio(m.name));
      if (!zona) return m;
      const c = m.clone() as MaterialMtoon;
      recolorear(c, zona, aspecto, modelo, teñidas);
      return c;
    });
    malla.material = Array.isArray(malla.material) ? nuevos : nuevos[0];
  });
}

function multiplicar(color: THREE.Color | undefined, [r, g, b]: Rgb): void {
  if (color) color.setRGB(color.r * r, color.g * g, color.b * b);
}

function recolorear(m: MaterialMtoon, zona: Zona, aspecto: Aspecto, modelo: ModeloCatalogo, cache: Map<string, THREE.Texture>): void {
  const teñir = (color: Rgb, lum: number, soloSiLlamativa = false) => {
    const mapa = m.map;
    if (!mapa?.image) return false;
    const clave = `${mapa.uuid}:${color.join(',')}:${lum.toFixed(2)}:${soloSiLlamativa}`;
    let nueva = cache.get(clave);
    if (nueva === undefined) {
      const resultado = teñirTextura(mapa, color, lum, soloSiLlamativa);
      if (!resultado) return false;
      nueva = resultado;
      cache.set(clave, nueva);
    }
    if (m.shadeMultiplyTexture === mapa) m.shadeMultiplyTexture = nueva;
    m.map = nueva;
    m.color?.setRGB(1, 1, 1);
    // La sombra queda como una versión más oscura del nuevo color.
    m.shadeColorFactor?.setRGB(0.78, 0.76, 0.8);
    m.needsUpdate = true;
    return true;
  };

  switch (zona) {
    case 'piel':
      multiplicar(m.color, aspecto.tonoPiel);
      multiplicar(m.shadeColorFactor, aspecto.tonoPiel);
      break;
    case 'cabello': {
      const { color, modo, canas } = aspecto.cabello;
      if (modo === 'ninguno') break;
      const lumObjetivo = canas ? luminancia(color) * 0.88 : luminancia(color) * 1.15;
      const base = modelo.luminancia_cabello ?? 0.5;
      // Oscurecer basta si el cabello es claro y poco saturado; si es de color (rosado, azul…), se tiñe en canvas.
      const saturado = m.map?.image ? saturacionMedia(m.map) > 0.3 : false;
      if (modo === 'multiplicar' && !saturado) {
        const f = Math.min(1.4, 1 / Math.max(0.05, base));
        m.color?.setRGB(Math.min(1, color[0] * f), Math.min(1, color[1] * f), Math.min(1, color[2] * f));
        multiplicar(m.shadeColorFactor, [0.85, 0.83, 0.82]);
      } else {
        teñir(color, lumObjetivo);
      }
      break;
    }
    case 'iris':
      teñir(aspecto.iris, Math.min(0.85, luminancia(aspecto.iris) * 1.5));
      break;
    case 'ropa_superior':
      teñir(aspecto.ropa.superior, luminancia(aspecto.ropa.superior), true);
      break;
    case 'ropa_inferior':
      teñir(aspecto.ropa.inferior, luminancia(aspecto.ropa.inferior), true);
      break;
  }
}

/** Dibuja la imagen de una textura en un canvas y devuelve sus píxeles (o null si no se puede). */
function pixeles(textura: THREE.Texture): { canvas: HTMLCanvasElement; datos: ImageData } | null {
  const img = textura.image as CanvasImageSource & { width: number; height: number };
  if (!img?.width || !img?.height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  try {
    return { canvas, datos: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  } catch {
    return null;   // imagen de otro origen: no se puede leer
  }
}

const saturaciones = new WeakMap<THREE.Texture, number>();

/** Saturación media (0 a 1) de los píxeles visibles, muestreando uno de cada 16. */
function saturacionMedia(textura: THREE.Texture): number {
  const previa = saturaciones.get(textura);
  if (previa !== undefined) return previa;
  const p = pixeles(textura);
  let suma = 0, n = 0;
  if (p) {
    const d = p.datos.data;
    for (let i = 0; i < d.length; i += 64) {
      if (d[i + 3] < 128) continue;
      const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
      suma += max ? (max - min) / max : 0;
      n++;
    }
  }
  const s = n ? suma / n : 0;
  saturaciones.set(textura, s);
  return s;
}

/**
 * Tiñe una textura: cada píxel pasa a gris y se pinta del color pedido, escalando su luminancia para
 * que la media quede en `lumObjetivo` (así se aclara el cabello para las canas). Conserva el alfa.
 * Con `soloSiLlamativa`, devuelve null si la textura ya es sobria (poco saturada).
 */
function teñirTextura(textura: THREE.Texture, color: Rgb, lumObjetivo: number, soloSiLlamativa: boolean): THREE.Texture | null {
  if (soloSiLlamativa && saturacionMedia(textura) < 0.28) return null;
  const p = pixeles(textura);
  if (!p) return null;
  const d = p.datos.data;
  let suma = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    suma += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    n++;
  }
  if (!n) return null;
  const media = suma / n;
  const k = lumObjetivo / Math.max(0.02, media);
  const lc = Math.max(0.02, luminancia(color));
  const [cr, cg, cb] = color.map(c => c / lc);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const l = Math.min(1, ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) * k);
    d[i] = Math.min(255, cr * l * 255);
    d[i + 1] = Math.min(255, cg * l * 255);
    d[i + 2] = Math.min(255, cb * l * 255);
  }
  p.canvas.getContext('2d')!.putImageData(p.datos, 0, 0);
  const nueva = textura.clone();
  nueva.image = p.canvas;
  nueva.needsUpdate = true;
  return nueva;
}
