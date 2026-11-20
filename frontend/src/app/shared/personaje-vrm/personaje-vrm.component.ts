import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  effect, inject, input, output, viewChild
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

type Emocion = 'alegria' | 'enojo' | 'tristeza' | 'sorpresa' | 'relajado';

/**
 * Intensidad de las expresiones. "leve" y "normal" combinan partes sueltas de la cara de VRoid;
 * "fuerte" usa la expresión completa a 0.6. "completa" (expresión completa al 100 %) solo existe para comparar.
 */
export type NivelExpresion = 'leve' | 'normal' | 'fuerte' | 'completa';
export const NIVEL_POR_DEFECTO: NivelExpresion = 'normal';

/** Qué puede mostrar el modelo cargado. */
export interface CapacidadesExpresion {
  /** Trae las partes sueltas de cara de VRoid (Fcl_MTH_*, Fcl_EYE_*, Fcl_BRW_*). */
  partes: boolean;
  /** Expresiones VRM completas que trae (happy, angry, sad, relaxed, surprised…). */
  presets: string[];
}

/** Estados del juego como mezcla de emociones (el factor escala la receta del nivel elegido). */
const ESTADOS: Record<string, Partial<Record<Emocion, number>>> = {
  neutral: {},
  alegre: { alegria: 1 },
  amable: { relajado: 1 },
  preocupado: { tristeza: 0.7 },
  tenso: { enojo: 0.6, tristeza: 0.3 },
  alterado: { enojo: 1 },
  sorprendido: { sorpresa: 1 },
  llorando: { tristeza: 1 }
};

/**
 * Recetas con las partes sueltas de VRoid (nombre del morph target sin el prefijo "Fcl_").
 * Ningún peso pasa de 0.7. Las partes que un modelo no trae se ignoran.
 */
const RECETAS: Record<Emocion, Record<'leve' | 'normal', Record<string, number>>> = {
  alegria: {
    leve: { MTH_Fun: 0.45, BRW_Fun: 0.3 },
    normal: { MTH_Fun: 0.7, MTH_Joy: 0.1, EYE_Joy: 0.2, BRW_Fun: 0.5 }
  },
  enojo: {
    leve: { BRW_Angry: 0.45, EYE_Angry: 0.2, MTH_Angry: 0.15 },
    normal: { BRW_Angry: 0.7, EYE_Angry: 0.4, MTH_Angry: 0.35 }
  },
  tristeza: {
    leve: { BRW_Sorrow: 0.45, EYE_Sorrow: 0.15, MTH_Sorrow: 0.2 },
    normal: { BRW_Sorrow: 0.7, EYE_Sorrow: 0.35, MTH_Sorrow: 0.4 }
  },
  sorpresa: {
    leve: { BRW_Surprised: 0.45, EYE_Surprised: 0.25, MTH_Surprised: 0.15 },
    normal: { BRW_Surprised: 0.7, EYE_Surprised: 0.45, MTH_Surprised: 0.35 }
  },
  relajado: {
    leve: { MTH_Fun: 0.25, BRW_Fun: 0.2 },
    normal: { MTH_Fun: 0.4, EYE_Fun: 0.2, BRW_Fun: 0.3 }
  }
};

/** Expresión VRM completa de cada emoción, y la parte "todo en uno" de VRoid si el modelo no trae ese preset. */
const PRESET: Record<Emocion, { preset: string; parteCompleta: string }> = {
  alegria: { preset: 'happy', parteCompleta: 'ALL_Joy' },
  enojo: { preset: 'angry', parteCompleta: 'ALL_Angry' },
  tristeza: { preset: 'sad', parteCompleta: 'ALL_Sorrow' },
  sorpresa: { preset: 'surprised', parteCompleta: 'ALL_Surprised' },
  relajado: { preset: 'relaxed', parteCompleta: 'ALL_Fun' }
};

/** Intensidad de la expresión completa por nivel (para "fuerte" y para modelos sin partes sueltas). */
const INTENSIDAD_COMPLETA: Record<NivelExpresion, number> = { leve: 0.3, normal: 0.45, fuerte: 0.6, completa: 1 };

/** Partes que entrecierran los ojos: el parpadeo se reduce en la misma medida para no pasarse de cerrado. */
const PARTES_OJOS_CERRADOS = ['EYE_Joy', 'EYE_Fun'];

/** Tiempos de carga en segundos: descarga del archivo, preparación del modelo y total hasta el primer cuadro. */
export interface TiemposCarga {
  descarga: number;
  preparacion: number;
  total: number;
  bytes: number;
}

const EMOCIONES = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
const BOCAS = ['aa', 'oh'];
/** Tiempo aproximado (95 %) de la transición entre expresiones. */
const TRANSICION_S = 0.25;
const CAMBIO_BOCA_S = 0.11;

/**
 * Personaje VRM en plano de busto para la novela visual (solo demostración).
 * Dibuja sobre un canvas transparente que se adapta a su contenedor.
 */
@Component({
  selector: 'app-personaje-vrm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #lienzo></canvas>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; position: relative; }
    canvas { display: block; width: 100%; height: 100%; }
  `]
})
export class PersonajeVrmComponent implements AfterViewInit, OnDestroy {
  readonly url = input.required<string>();
  readonly expresion = input<string>('neutral');
  readonly hablando = input<boolean>(false);
  readonly nivel = input<NivelExpresion>(NIVEL_POR_DEFECTO);

  readonly progreso = output<number>();
  readonly cargado = output<void>();
  readonly fallo = output<string>();
  readonly tiempos = output<TiemposCarga>();
  readonly capacidades = output<CapacidadesExpresion>();

  private readonly zona = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  private renderer?: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
  private reloj = new THREE.Clock();
  private vrm?: VRM;
  private raf = 0;
  private observador?: ResizeObserver;
  private destruido = false;

  private readonly pesos = new Map<string, number>();
  private readonly objetivos = new Map<string, number>();
  private proximoParpadeo = 3 + Math.random() * 2;
  private faseParpadeo = -1;
  private tiempoBoca = 0;
  private bocaActual = 0;
  private movimientoReducido = false;
  /** Medición en curso: se completa al dibujar el primer cuadro con el personaje. */
  private medicion?: { inicio: number; descarga: number; preparacion: number; bytes: number };

  /** Partes sueltas de VRoid ("MTH_Joy", "EYE_Close"…) -> morph targets que las forman en cada malla. */
  private partes = new Map<string, { malla: THREE.Mesh; indice: number }[]>();
  private readonly objetivosPartes = new Map<string, number>();
  private readonly pesosPartes = new Map<string, number>();
  /** Lo que se sumó en el cuadro anterior a cada morph target, para retirarlo antes del siguiente. */
  private aplicadoPartes: { malla: THREE.Mesh; indice: number; valor: number }[] = [];
  private presets = new Set<string>();

  constructor() {
    // Recalcula los pesos objetivo cada vez que cambian las entradas.
    effect(() => this.calcularObjetivos(this.expresion(), this.nivel(), this.hablando()));
  }

  ngAfterViewInit(): void {
    this.movimientoReducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.zona.runOutsideAngular(() => {
      const renderer = new THREE.WebGLRenderer({ canvas: this.lienzo().nativeElement, alpha: true, antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      this.renderer = renderer;

      const luz = new THREE.DirectionalLight(0xffffff, 2.2);
      luz.position.set(0.3, 1.2, 1.5);
      this.escena.add(luz, new THREE.AmbientLight(0xffffff, 0.35));

      this.observador = new ResizeObserver(() => this.ajustarTamano());
      this.observador.observe(this.host.nativeElement);
      this.ajustarTamano();
      this.cargarModelo();
      this.bucle();
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    cancelAnimationFrame(this.raf);
    this.observador?.disconnect();
    if (this.vrm) {
      this.escena.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }

  /** Descarga el archivo (sin caché, para medir como una primera visita) y luego prepara el modelo. */
  private async cargarModelo(): Promise<void> {
    const inicio = performance.now();
    try {
      const buffer = await this.descargar(this.url());
      const descarga = performance.now() - inicio;
      if (this.destruido) return;

      const cargador = new GLTFLoader();
      cargador.register(parser => new VRMLoaderPlugin(parser));
      const gltf = await cargador.parseAsync(buffer, '');
      const vrm = gltf.userData['vrm'] as VRM | undefined;
      if (this.destruido) { if (gltf.scene) VRMUtils.deepDispose(gltf.scene); return; }
      if (!vrm) throw new Error('El archivo no contiene un modelo VRM válido.');
      this.partes = this.buscarPartes(gltf.scene, gltf.parser);
      this.presets = new Set(vrm.expressionManager?.expressions.map(e => e.expressionName) ?? []);
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse(o => { o.frustumCulled = false; });
      this.vrm = vrm;
      this.posar(vrm);
      this.escena.add(vrm.scene);
      if (vrm.lookAt) vrm.lookAt.target = this.camara;
      vrm.update(0);
      this.encuadrar(vrm);
      const preparacion = performance.now() - inicio - descarga;
      // El total se cierra en el bucle, cuando se dibuja el primer cuadro con el personaje.
      this.medicion = { inicio, descarga, preparacion, bytes: buffer.byteLength };
      // Con el modelo ya cargado se sabe qué partes y expresiones trae: se recalculan los objetivos.
      this.calcularObjetivos(this.expresion(), this.nivel(), this.hablando());
      this.zona.run(() => {
        this.capacidades.emit({ partes: this.tienePartes(), presets: [...this.presets] });
        this.cargado.emit();
      });
    } catch (error) {
      if (this.destruido) return;
      const mensaje = error instanceof Error ? error.message : String(error);
      this.zona.run(() => this.fallo.emit(mensaje || 'No se pudo cargar el modelo.'));
    }
  }

  private async descargar(url: string): Promise<ArrayBuffer> {
    const respuesta = await fetch(url, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status} al pedir ${url}`);
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (tipo.includes('text/html')) throw new Error(`${url} no existe (el servidor devolvió una página HTML).`);
    // Con compresión el content-length es el tamaño comprimido; el avance se limita a 99 %.
    const total = Number(respuesta.headers.get('content-length')) || 0;
    if (!respuesta.body) return respuesta.arrayBuffer();
    const lector = respuesta.body.getReader();
    const partes: Uint8Array[] = [];
    let recibidos = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value);
      recibidos += value.byteLength;
      if (total) {
        const avance = Math.min(99, Math.round((recibidos / total) * 100));
        this.zona.run(() => this.progreso.emit(avance));
      }
    }
    const datos = new Uint8Array(recibidos);
    let pos = 0;
    for (const p of partes) { datos.set(p, pos); pos += p.byteLength; }
    return datos.buffer;
  }

  /**
   * Baja los brazos de la pose en T y flexiona levemente los antebrazos (solo huesos normalizados).
   * En VRM 0.0 los huesos normalizados conservan la orientación original del modelo (mira hacia -Z) y
   * rotateVRM0 gira la escena 180° en Y; por eso los giros en X y Z van con el signo contrario.
   */
  private posar(vrm: VRM): void {
    const h = vrm.humanoid;
    const hueso = (n: Parameters<typeof h.getNormalizedBoneNode>[0]) => h.getNormalizedBoneNode(n);
    const s = vrm.meta?.metaVersion === '0' ? -1 : 1;
    hueso('leftUpperArm')?.rotation.set(0, 0, -1.22 * s);
    hueso('rightUpperArm')?.rotation.set(0, 0, 1.22 * s);
    hueso('leftLowerArm')?.rotation.set(0, -0.25, 0);
    hueso('rightLowerArm')?.rotation.set(0, 0.25, 0);
  }

  /** Plano de busto a partir de la altura mundial del hueso de la cabeza. */
  private encuadrar(vrm: VRM): void {
    const cabeza = vrm.humanoid.getNormalizedBoneNode('head');
    const pos = new THREE.Vector3();
    cabeza?.getWorldPosition(pos);
    const y = (cabeza ? pos.y : 1.4) - 0.08;
    this.camara.position.set(0, y, 1.9);
    this.camara.lookAt(0, y, 0);
  }

  private ajustarTamano(): void {
    if (!this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.host.nativeElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    // En contenedores verticales se abre el campo para no cortar hombros.
    this.camara.fov = w / h < 0.8 ? 30 : 22;
    this.camara.updateProjectionMatrix();
  }

  /**
   * Traduce el estado del juego y el nivel a pesos objetivo: partes sueltas de VRoid en "leve" y "normal",
   * expresión completa (a 0.6) en "fuerte", y expresión completa con intensidad bajada si el modelo no trae partes.
   */
  private calcularObjetivos(expresion: string, nivel: NivelExpresion, hablando: boolean): void {
    for (const e of EMOCIONES) this.objetivos.set(e, 0);
    for (const k of this.objetivosPartes.keys()) this.objetivosPartes.set(k, 0);
    const usarPartes = this.tienePartes() && (nivel === 'leve' || nivel === 'normal');
    const sumarParte = (parte: string, peso: number) => {
      if (this.partes.has(parte)) this.objetivosPartes.set(parte, (this.objetivosPartes.get(parte) ?? 0) + peso);
    };
    for (const [emocion, factor] of Object.entries(ESTADOS[expresion] ?? {}) as [Emocion, number][]) {
      if (usarPartes) {
        for (const [parte, peso] of Object.entries(RECETAS[emocion][nivel as 'leve' | 'normal'])) sumarParte(parte, peso * factor);
        continue;
      }
      const intensidad = INTENSIDAD_COMPLETA[nivel] * factor;
      const { preset, parteCompleta } = PRESET[emocion];
      // Si el modelo no trae la expresión completa (p. ej. "surprised" en VRM 0.0), se usa la parte "todo en uno".
      if (this.presets.has(preset) || !this.partes.has(parteCompleta)) {
        this.objetivos.set(preset, (this.objetivos.get(preset) ?? 0) + intensidad);
      } else {
        sumarParte(parteCompleta, intensidad);
      }
    }
    if (!hablando) for (const b of BOCAS) this.objetivos.set(b, 0);
  }

  private tienePartes(): boolean {
    return this.partes.has('MTH_Fun') && this.partes.has('BRW_Fun');
  }

  /**
   * Encuentra las partes sueltas de la cara de VRoid por el nombre de cada morph target ("...Fcl_MTH_Joy").
   * Los nombres se leen del glTF porque algunos modelos los guardan por primitiva y three.js los numera.
   */
  private buscarPartes(
    escena: THREE.Object3D,
    parser: { json: any; associations: Map<unknown, { meshes?: number; primitives?: number }> }
  ): Map<string, { malla: THREE.Mesh; indice: number }[]> {
    const partes = new Map<string, { malla: THREE.Mesh; indice: number }[]>();
    escena.traverse(o => {
      const malla = o as THREE.Mesh;
      if (!malla.isMesh || !malla.morphTargetInfluences?.length) return;
      const asoc = parser.associations.get(malla);
      if (asoc?.meshes == null) return;
      const def = parser.json.meshes?.[asoc.meshes];
      const nombres: string[] | undefined = def?.extras?.targetNames ?? def?.primitives?.[asoc.primitives ?? 0]?.extras?.targetNames;
      nombres?.forEach((nombre, indice) => {
        const m = /Fcl_(\w+)$/.exec(nombre);
        if (!m || indice >= malla.morphTargetInfluences!.length) return;
        const lista = partes.get(m[1]) ?? [];
        lista.push({ malla, indice });
        partes.set(m[1], lista);
      });
    });
    return partes;
  }

  /** Retira lo que se sumó en el cuadro anterior (antes de que three-vrm aplique sus expresiones). */
  private retirarPartes(): void {
    for (const a of this.aplicadoPartes) {
      const inf = a.malla.morphTargetInfluences;
      if (inf) inf[a.indice] -= a.valor;
    }
    this.aplicadoPartes = [];
  }

  /** Suma las partes sueltas a los morph targets (después de vrm.update, que reinicia los que usan las expresiones). */
  private aplicarPartes(): void {
    const hablando = this.hablando();
    for (const [parte, peso] of this.pesosPartes) {
      // Mientras habla, la boca de la emoción se reduce para no pelear con las bocas del habla.
      const valor = parte.startsWith('MTH_') && hablando ? peso * 0.5 : peso;
      if (valor < 0.001) continue;
      for (const { malla, indice } of this.partes.get(parte) ?? []) {
        const inf = malla.morphTargetInfluences;
        if (!inf) continue;
        inf[indice] += valor;
        this.aplicadoPartes.push({ malla, indice, valor });
      }
    }
  }

  private bucle = (): void => {
    if (this.destruido) return;
    this.raf = requestAnimationFrame(this.bucle);
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    const t = this.reloj.elapsedTime;
    const vrm = this.vrm;
    if (vrm && this.renderer) {
      this.animarBoca(dt);
      this.animarParpadeo(dt);
      this.mezclarExpresiones(vrm, dt);
      this.animarCuerpo(vrm, t);
      this.retirarPartes();
      vrm.update(dt);
      this.aplicarPartes();
    }
    this.renderer?.render(this.escena, this.camara);
    if (this.medicion && vrm) {
      const m = this.medicion;
      this.medicion = undefined;
      const s = (ms: number) => Math.round(ms) / 1000;
      const tiempos: TiemposCarga = {
        descarga: s(m.descarga), preparacion: s(m.preparacion), total: s(performance.now() - m.inicio), bytes: m.bytes
      };
      this.zona.run(() => this.tiempos.emit(tiempos));
    }
  };

  private animarBoca(dt: number): void {
    if (!this.hablando()) return;
    if (this.movimientoReducido) {
      this.objetivos.set('aa', 0.4);
      this.objetivos.set('oh', 0);
      return;
    }
    this.tiempoBoca -= dt;
    if (this.tiempoBoca > 0) return;
    this.tiempoBoca = CAMBIO_BOCA_S * (0.8 + Math.random() * 0.4);
    this.bocaActual = 1 - this.bocaActual;
    const peso = 0.3 + Math.random() * 0.4;
    this.objetivos.set(BOCAS[this.bocaActual], peso);
    this.objetivos.set(BOCAS[1 - this.bocaActual], 0);
  }

  private animarParpadeo(dt: number): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    if (this.faseParpadeo < 0) {
      this.proximoParpadeo -= dt;
      if (this.proximoParpadeo <= 0) this.faseParpadeo = 0;
      return;
    }
    this.faseParpadeo += dt;
    const duracion = 0.14;
    const p = this.faseParpadeo / duracion;
    // Con los ojos ya entrecerrados por la sonrisa, el parpadeo cierra solo lo que falta.
    const entrecerrado = Math.min(1, PARTES_OJOS_CERRADOS.reduce((s, k) => s + (this.pesosPartes.get(k) ?? 0), 0));
    em.setValue('blink', p < 1 ? Math.sin(p * Math.PI) * (1 - entrecerrado) : 0);
    if (p >= 1) {
      this.faseParpadeo = -1;
      this.proximoParpadeo = 3 + Math.random() * 2;
    }
  }

  private mezclarExpresiones(vrm: VRM, dt: number): void {
    const em = vrm.expressionManager;
    if (!em) return;
    // Las bocas cambian rápido para seguir el ritmo del habla; las emociones y las partes, en ~250 ms.
    const k = 1 - Math.exp(-dt / (TRANSICION_S / 3));
    const kBoca = 1 - Math.exp(-dt / 0.03);
    for (const [nombre, objetivo] of this.objetivos) {
      const actual = this.pesos.get(nombre) ?? 0;
      const nuevo = actual + (objetivo - actual) * (BOCAS.includes(nombre) ? kBoca : k);
      this.pesos.set(nombre, nuevo);
      em.setValue(nombre, nuevo);
    }
    for (const [parte, objetivo] of this.objetivosPartes) {
      const actual = this.pesosPartes.get(parte) ?? 0;
      this.pesosPartes.set(parte, actual + (objetivo - actual) * k);
    }
  }

  private animarCuerpo(vrm: VRM, t: number): void {
    if (this.movimientoReducido) return;
    const h = vrm.humanoid;
    const respiracion = Math.sin(t * (Math.PI * 2) / 4.2);
    const pecho = h.getNormalizedBoneNode('chest') ?? h.getNormalizedBoneNode('spine');
    if (pecho) pecho.rotation.x = respiracion * 0.012;
    const hombroI = h.getNormalizedBoneNode('leftShoulder');
    const hombroD = h.getNormalizedBoneNode('rightShoulder');
    if (hombroI) hombroI.rotation.z = -respiracion * 0.01;
    if (hombroD) hombroD.rotation.z = respiracion * 0.01;
    const cabeza = h.getNormalizedBoneNode('head');
    if (cabeza) {
      cabeza.rotation.y = Math.sin(t * 0.5) * 0.035;
      cabeza.rotation.z = Math.sin(t * 0.37 + 1) * 0.018;
      cabeza.rotation.x = Math.sin(t * 0.29 + 2) * 0.012;
    }
  }
}
