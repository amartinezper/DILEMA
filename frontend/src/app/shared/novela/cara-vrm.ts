import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

/**
 * Cara y cuerpo en reposo de un personaje VRM: expresiones por niveles (partes sueltas de VRoid),
 * parpadeo, bocas al hablar, pose de reposo y respiración. Lo usan el visor de la demo
 * (personaje-vrm) y la escena de novela (escena-novela) para que se vean igual.
 */

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
export const ESTADOS: Record<string, Partial<Record<Emocion, number>>> = {
  neutral: {},
  alegre: { alegria: 1 },
  amable: { relajado: 1 },
  preocupado: { tristeza: 0.7 },
  tenso: { enojo: 0.6, tristeza: 0.3 },
  alterado: { enojo: 1 },
  sorprendido: { sorpresa: 1 },
  llorando: { tristeza: 1 },
  // Emociones del guion (guion.ts), con el mismo nombre.
  alegria: { alegria: 1 },
  enojo: { enojo: 1 },
  tristeza: { tristeza: 1 },
  sorpresa: { sorpresa: 1 },
  relajado: { relajado: 1 }
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

const EMOCIONES = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
/** Bocas del habla aleatoria (demo). */
const BOCAS = ['aa', 'oh'];
/** Visemas: las cinco bocas de VRM, que sigue el texto en la novela. */
export const VISEMAS = ['aa', 'ih', 'ou', 'ee', 'oh'] as const;
export type Visema = typeof VISEMAS[number];
const ES_BOCA = new Set<string>(VISEMAS);
/** Tiempo aproximado (95 %) de la transición entre expresiones. */
const TRANSICION_S = 0.25;
const CAMBIO_BOCA_S = 0.11;

type Parte = { malla: THREE.Mesh; indice: number };

/**
 * Encuentra las partes sueltas de la cara de VRoid por el nombre de cada morph target ("...Fcl_MTH_Joy").
 * Los nombres se leen del glTF porque algunos modelos los guardan por primitiva y three.js los numera.
 * Hay que llamarla con la escena recién cargada (antes de cambiar mallas).
 */
export function buscarPartes(
  escena: THREE.Object3D,
  parser: { json: any; associations: Map<unknown, { meshes?: number; primitives?: number }> }
): Map<string, Parte[]> {
  const partes = new Map<string, Parte[]>();
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

/**
 * Baja los brazos de la pose en T y flexiona levemente los antebrazos (solo huesos normalizados).
 * En VRM 0.0 los huesos normalizados conservan la orientación original del modelo (mira hacia -Z) y
 * rotateVRM0 gira la escena 180° en Y; por eso los giros en X y Z van con el signo contrario.
 */
export function posarEnReposo(vrm: VRM): void {
  const h = vrm.humanoid;
  const hueso = (n: Parameters<typeof h.getNormalizedBoneNode>[0]) => h.getNormalizedBoneNode(n);
  const s = vrm.meta?.metaVersion === '0' ? -1 : 1;
  hueso('leftUpperArm')?.rotation.set(0, 0, -1.22 * s);
  hueso('rightUpperArm')?.rotation.set(0, 0, 1.22 * s);
  hueso('leftLowerArm')?.rotation.set(0, -0.25, 0);
  hueso('rightLowerArm')?.rotation.set(0, 0.25, 0);
}

/** Respiración suave y leve balanceo de la cabeza. `desfase` evita que varios personajes respiren a la vez. */
export function respirar(vrm: VRM, t: number, desfase = 0): void {
  const h = vrm.humanoid;
  const tt = t + desfase;
  const respiracion = Math.sin(tt * (Math.PI * 2) / 4.2);
  const pecho = h.getNormalizedBoneNode('chest') ?? h.getNormalizedBoneNode('spine');
  if (pecho) pecho.rotation.x = respiracion * 0.012;
  const hombroI = h.getNormalizedBoneNode('leftShoulder');
  const hombroD = h.getNormalizedBoneNode('rightShoulder');
  if (hombroI) hombroI.rotation.z = -respiracion * 0.01;
  if (hombroD) hombroD.rotation.z = respiracion * 0.01;
  const cabeza = h.getNormalizedBoneNode('head');
  if (cabeza) {
    cabeza.rotation.y = Math.sin(tt * 0.5) * 0.035;
    cabeza.rotation.z = Math.sin(tt * 0.37 + 1) * 0.018;
    cabeza.rotation.x = Math.sin(tt * 0.29 + 2) * 0.012;
  }
}

/**
 * Expresiones de un personaje: niveles leve/normal/fuerte con partes sueltas de VRoid, transiciones
 * de ~250 ms, parpadeo automático (compatible con la sonrisa) y bocas al hablar.
 *
 * Uso en cada cuadro: `cara.antesDeActualizar(dt)` → `vrm.update(dt)` → `cara.despuesDeActualizar()`.
 */
export class CaraVrm {
  readonly presets: Set<string>;
  private readonly pesos = new Map<string, number>();
  private readonly objetivos = new Map<string, number>();
  private readonly objetivosPartes = new Map<string, number>();
  private readonly pesosPartes = new Map<string, number>();
  /** Lo que se sumó en el cuadro anterior a cada morph target, para retirarlo antes del siguiente. */
  private aplicadoPartes: (Parte & { valor: number })[] = [];
  private proximoParpadeo = 2 + Math.random() * 3;
  private faseParpadeo = -1;
  private tiempoBoca = 0;
  private bocaActual = 0;
  private hablando = false;
  /** Con movimiento reducido las bocas no se agitan al hablar. */
  movimientoReducido = false;

  constructor(private readonly vrm: VRM, private readonly mapa: Map<string, Parte[]>) {
    this.presets = new Set(vrm.expressionManager?.expressions.map(e => e.expressionName) ?? []);
  }

  tienePartes(): boolean {
    return this.mapa.has('MTH_Fun') && this.mapa.has('BRW_Fun');
  }

  capacidades(): CapacidadesExpresion {
    return { partes: this.tienePartes(), presets: [...this.presets] };
  }

  /**
   * Traduce el estado del juego y el nivel a pesos objetivo: partes sueltas de VRoid en "leve" y "normal",
   * expresión completa (a 0.6) en "fuerte", y expresión completa con intensidad bajada si el modelo no trae partes.
   */
  fijar(expresion: string, nivel: NivelExpresion, hablando: boolean): void {
    this.hablando = hablando;
    for (const e of EMOCIONES) this.objetivos.set(e, 0);
    for (const k of this.objetivosPartes.keys()) this.objetivosPartes.set(k, 0);
    const usarPartes = this.tienePartes() && (nivel === 'leve' || nivel === 'normal');
    const sumarParte = (parte: string, peso: number) => {
      if (this.mapa.has(parte)) this.objetivosPartes.set(parte, (this.objetivosPartes.get(parte) ?? 0) + peso);
    };
    for (const [emocion, factor] of Object.entries(ESTADOS[expresion] ?? {}) as [Emocion, number][]) {
      if (usarPartes) {
        for (const [parte, peso] of Object.entries(RECETAS[emocion][nivel as 'leve' | 'normal'])) sumarParte(parte, peso * factor);
        continue;
      }
      const intensidad = INTENSIDAD_COMPLETA[nivel] * factor;
      const { preset, parteCompleta } = PRESET[emocion];
      // Si el modelo no trae la expresión completa (p. ej. "surprised" en VRM 0.0), se usa la parte "todo en uno".
      if (this.presets.has(preset) || !this.mapa.has(parteCompleta)) {
        this.objetivos.set(preset, (this.objetivos.get(preset) ?? 0) + intensidad);
      } else {
        sumarParte(parteCompleta, intensidad);
      }
    }
    if (!hablando) for (const b of VISEMAS) this.objetivos.set(b, this.visemaActual === b ? this.pesoVisema : 0);
  }

  private visemaActual: Visema | null = null;
  private pesoVisema = 0;

  /** Boca según el texto que se va escribiendo (null = cerrada). La transición es rápida (~30 ms). */
  fijarBoca(visema: Visema | null, peso = 0.55): void {
    this.visemaActual = visema;
    this.pesoVisema = visema ? peso : 0;
    for (const b of VISEMAS) this.objetivos.set(b, b === visema ? peso : 0);
  }

  /** Bocas, parpadeo y mezcla de expresiones; retira las partes del cuadro anterior. Va antes de vrm.update. */
  antesDeActualizar(dt: number): void {
    this.animarBoca(dt);
    this.animarParpadeo(dt);
    this.mezclar(dt);
    this.retirarPartes();
  }

  /** Suma las partes sueltas (después de vrm.update, que reinicia los morph targets que usan las expresiones). */
  despuesDeActualizar(): void {
    for (const [parte, peso] of this.pesosPartes) {
      // Mientras habla, la boca de la emoción se reduce para no pelear con las bocas del habla.
      const valor = parte.startsWith('MTH_') && this.hablando ? peso * 0.5 : peso;
      if (valor < 0.001) continue;
      for (const { malla, indice } of this.mapa.get(parte) ?? []) {
        const inf = malla.morphTargetInfluences;
        if (!inf) continue;
        inf[indice] += valor;
        this.aplicadoPartes.push({ malla, indice, valor });
      }
    }
  }

  private retirarPartes(): void {
    for (const a of this.aplicadoPartes) {
      const inf = a.malla.morphTargetInfluences;
      if (inf) inf[a.indice] -= a.valor;
    }
    this.aplicadoPartes = [];
  }

  private animarBoca(dt: number): void {
    if (!this.hablando) return;
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
    const em = this.vrm.expressionManager;
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

  private mezclar(dt: number): void {
    const em = this.vrm.expressionManager;
    if (!em) return;
    // Las bocas cambian rápido para seguir el ritmo del habla; las emociones y las partes, en ~250 ms.
    const k = 1 - Math.exp(-dt / (TRANSICION_S / 3));
    const kBoca = 1 - Math.exp(-dt / 0.03);
    for (const [nombre, objetivo] of this.objetivos) {
      const actual = this.pesos.get(nombre) ?? 0;
      const nuevo = actual + (objetivo - actual) * (ES_BOCA.has(nombre) ? kBoca : k);
      this.pesos.set(nombre, nuevo);
      em.setValue(nombre, nuevo);
    }
    for (const [parte, objetivo] of this.objetivosPartes) {
      const actual = this.pesosPartes.get(parte) ?? 0;
      this.pesosPartes.set(parte, actual + (objetivo - actual) * k);
    }
  }
}
