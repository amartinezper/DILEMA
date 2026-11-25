import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  computed, effect, inject, input, output, signal, untracked, viewChild
} from '@angular/core';
import * as THREE from 'three';
import { NivelExpresion, Visema, respirar } from './cara-vrm';
import { animaciones } from './animaciones-vrm';
import { AnimacionCatalogo, Gesto, elegirVersion } from './gestos';
import { Asignacion, ElencoService, PersonajeCargado } from './elenco.service';
import { personajesValidos } from './elenco';
import { EscenaService, FondoElegido } from './escena.service';

/** Caso tal como lo necesita la escena (sirve el Caso del docente y lo que recibe el estudiante). */
export interface CasoNovela {
  id?: number | string | null;
  nombre: string;
  desarrolloSituacional?: string;
  contexto?: string;
  bloques: { nombre: string; contexto: string }[];
}
export interface BloqueNovela { indice: number; nombre: string; contexto: string; }
export interface PersonajeNovela { nombre: string; descripcion: string; escenarios: number[]; }
/** Posición del boceto del docente: x = lados (0–78 %), y = más lejos (0) o más cerca (70). */
export interface PosicionNovela { x: number; y: number; }

/** Emoción de un personaje en escena (nombres de ESTADOS en cara-vrm.ts, p. ej. "tristeza" o "neutral"). */
export interface EmocionNovela { emocion: string; nivel: NivelExpresion; }

/**
 * Identificador de un personaje en la escena: su índice en el caso, o 10 + orden si lo detectó el motor
 * en el texto. El guion (guion.ts) usa los mismos identificadores.
 */
export function slotDe(a: Asignacion, orden: number): number {
  return a.personaje.indice >= 0 ? a.personaje.indice : 10 + orden;
}

/** Materiales de una instancia con sus colores originales (para oscurecer y desvanecer). */
interface MaterialGuardado {
  mat: THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color };
  color?: THREE.Color; sombra?: THREE.Color;
}

/** Lo que muestra la capa sobre el canvas para cada personaje. */
interface Ficha {
  slot: number;
  nombre: string;
  etiqueta: string;
  silueta: boolean;
  pos: PosicionNovela;
  asignacion?: Asignacion;
}
/** silueta: se dibuja la figura gris; falta: es una "Persona N" sin descripción. */
interface Marca { slot: number; nombre: string; etiqueta: string; silueta: boolean; falta: boolean; izq: number; arriba: number; abajo: number; ancho: number; }

/** Posiciones por defecto (x del boceto, 0–78) según cuántos personajes hay en escena. */
const REPARTO: Record<number, number[]> = { 1: [39], 2: [22, 56], 3: [10, 39, 68], 4: [2, 26, 50, 74] };
const Y_DEFECTO = 58;

// ---- Plano medio (estilo novela visual): de un poco arriba de la cabeza a la cadera
/**
 * La cadera del más alto queda en esta línea (fracción de la altura): justo en el borde superior del cuadro
 * de diálogo (que ocupa como máximo el 22 % de abajo). El resto del cuerpo sigue detrás del cuadro.
 */
const LINEA_CADERA = 0.74;
/** Margen mínimo arriba de la cabeza (fracción de la altura): ninguna cabeza toca el borde. */
const MARGEN_SUPERIOR = 0.12;
/** Torso mínimo de referencia (m, de la coronilla a la cadera): un niño solo no se agranda como un adulto. */
const TORSO_MINIMO = 0.68;
/** Con más personajes se achican un poco más para que quede espacio entre ellos y se vea el fondo. */
const ACHIQUE_POR_CANTIDAD: Record<number, number> = { 1: 1, 2: 1, 3: 0.9, 4: 0.82 };
/** Escala por profundidad: y = 0 (más lejos) a y = 70 (más cerca). */
const PROFUNDIDAD: [number, number] = [0.92, 1.06];
/** Separación mínima entre centros, en proporción al ancho de hombros: los cuerpos no se tocan. */
const SEPARACION_MINIMA = 1.05;

/** Medidas de un modelo en reposo (m, desde los pies): rodilla, cadera, cabeza, coronilla y ancho de hombros con brazos. */
interface Medidas { rodilla: number; cadera: number; cabeza: number; tope: number; hombros: number; }
/** Medidas de una persona adulta para las siluetas (sin modelo cargado). */
const MEDIDAS_SILUETA: Medidas = { rodilla: 0.5, cadera: 0.95, cabeza: 1.45, tope: 1.66, hombros: 0.56 };

/** Transición entre animaciones (s): nunca un salto brusco. */
const FUNDIDO_S = 0.5;
/** Un gesto largo (algunos de Mixamo duran 20 s) se corta con un fundido a los 6 s: el personaje no gesticula toda la línea. */
const LIMITE_GESTO_S = 6;
/** Gesto por defecto (sin guion, en el editor o con movimiento reducido). */
const REPOSO: Gesto = { categoria: 'reposo', papel: 'escucha' };
/** Fracción del ancho desde la que un personaje está junto al borde (sin gestos de brazos muy abiertos). */
const BORDE = 0.27;

/** Cuerpo animado de un personaje: mezclador, animación actual y punto al que miran sus ojos. */
interface Cuerpo {
  mezclador: THREE.AnimationMixer;
  accion: THREE.AnimationAction | null;
  animacion: string | null;
  /** Animación pedida que todavía se está descargando. */
  pedida: string | null;
  /** El gesto de esta línea ya terminó (o quien habla terminó su texto): queda en reposo hasta la siguiente. */
  terminado: boolean;
  /** Segundos que lleva el gesto de esta línea (0 en reposo). */
  tiempoGesto: number;
  esGesto: boolean;
  mirada: THREE.Object3D;
}

let hayWebgl: boolean | undefined;
/** Prueba WebGL una sola vez y suelta el contexto de prueba (cada contexto ocupa memoria de video). */
function webglDisponible(): boolean {
  if (hayWebgl !== undefined) return hayWebgl;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    hayWebgl = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    hayWebgl = false;
  }
  return hayWebgl;
}

function esCelular(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/**
 * Resolución interna (pixelRatio) con la que se dibuja la escena. En celular: la de la pantalla hasta 2 (un
 * iPhone de DPR 3 dibuja a 2, nítido y sin pagar el triple de píxeles); en computador: hasta 1,5, como antes.
 */
function resolucionMaxima(): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.min(dpr, esCelular() ? 2 : 1.5);
}

/**
 * Piso de calidad: la calidad adaptativa nunca dibuja por debajo de esto. En celulares con pantalla retina
 * (DPR 2 o más) nunca menos de 1,5; en los demás, la resolución de la pantalla hasta 1.
 */
function resolucionPiso(): number {
  const dpr = window.devicePixelRatio || 1;
  if (esCelular() && dpr >= 2) return 1.5;
  return Math.min(dpr, 1);
}

/** Si nada cambia (solo el reposo), se dibuja a 30 cuadros por segundo. */
const INTERVALO_QUIETO_S = 1 / 30;
/** Tras un cambio (gesto, fundido, entrada, expresión, mirada) se dibuja a todo ritmo durante este tiempo. */
const MOVIMIENTO_TRAS_CAMBIO_S = 0.9;
/** Por debajo de estos cuadros por segundo (moviéndose) baja un nivel de calidad. */
const FPS_MINIMO = 30;
/** Con el tope de 30 cuadros por segundo (nivel 2), lento es bajar de esto. */
const FPS_MINIMO_CON_TOPE = 24;
/**
 * Niveles de calidad adaptativa, de a uno y en este orden (lo último que se toca es la resolución):
 * 0 normal; 1 ligera (sin desenfoque y sin física de cabello y ropa en quienes no hablan); 2 además tope de
 * 30 cuadros por segundo; 3 además la resolución baja hasta el piso (resolucionPiso), nunca por debajo.
 */
const NIVEL_MAXIMO = 3;

/**
 * Mismo orden que VRM.update de three-vrm, pero sin la física del cabello y la ropa (huesos con resortes):
 * en calidad ligera solo la conserva quien habla.
 */
function actualizarSinFisica(vrm: PersonajeCargado['vrm'], dt: number): void {
  vrm.humanoid.update();
  vrm.lookAt?.update(dt);
  vrm.expressionManager?.update();
  vrm.nodeConstraintManager?.update();
  vrm.materials?.forEach(m => (m as THREE.Material & { update?: (d: number) => void }).update?.(dt));
}

/**
 * Escena de novela visual: fondo elegido para el escenario, los personajes del escenario en 3D (un solo
 * canvas, pose de reposo, parpadeo y respiración) y un cuadro de diálogo con el nombre y el contexto.
 * Si no hay WebGL o algo falla, queda el plan B: fondo + texto, sin romper la pantalla.
 */
@Component({
  selector: 'app-escena-novela',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ligero]': 'ligero()' },
  template: `
    <div class="novela" [class.editor]="modoEditor()" [class.sin-dialogo]="!mostrarDialogo()">
      @if (fondoPrevio(); as previo) { <img class="fondo" [src]="previo" alt="" /> }
      @for (f of fondoActual(); track f.ruta) {
        <img class="fondo entra" [src]="f.ruta" alt="" (error)="fondoRoto.set(true)" [class.oculto]="fondoRoto()" />
      }
      <canvas #lienzo [class.oculto]="!usar3d()" aria-hidden="true"></canvas>

      <div class="capa">
        @for (m of marcas(); track m.slot) {
          <div class="marca" [class.silueta]="m.silueta" [class.falta]="m.falta" [class.arrastrable]="modoEditor() && !bloqueado()"
            [style.left.px]="m.izq" [style.top.px]="m.arriba" [style.width.px]="m.ancho" [style.height.px]="m.abajo - m.arriba"
            (pointerdown)="arrastrar($event, m.slot)">
            @if (m.silueta) {
              <svg class="figura" viewBox="0 0 60 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
                <circle cx="30" cy="16" r="13" />
                <path d="M12 40c0-7 6-12 13-12h10c7 0 13 5 13 12v46H40v58H20V86H12z" />
              </svg>
            }
            @if (modoEditor()) {
              <span class="etiqueta">
                <b>{{ m.nombre }}</b>
                <small>{{ m.falta ? 'Escribe la descripción' : m.etiqueta }}</small>
              </span>
            }
          </div>
        }
      </div>

      @if (estado() === 'cargando') { <span class="aviso">Cargando personajes…</span> }
      @if (estado() === 'planb' && modoEditor()) { <span class="aviso">{{ motivoPlanB() }}</span> }

      @if (mostrarDialogo()) {
        <div class="dialogo">
          @if (nombreDialogo()) { <span class="nombre">{{ nombreDialogo() }}</span> }
          <p>{{ texto() ?? bloque().contexto }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .novela { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 14px;
      background: linear-gradient(180deg, #d8e4ea, #b7c7cf); container-type: inline-size; }
    /* Agrandada: la escena sigue en 16:9 (el reproductor la centra con franjas negras), sin deformar personajes. */
    :host-context(.pantalla-completa) .novela { border-radius: 6px; }
    .fondo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .fondo.entra { animation: aparecer .4s ease both; }
    @keyframes aparecer { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .fondo.entra { animation: none; } }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .oculto { visibility: hidden; }
    .capa { position: absolute; inset: 0; pointer-events: none; }
    .marca { position: absolute; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
    .marca.arrastrable { pointer-events: auto; cursor: grab; touch-action: none; }
    .marca.arrastrable:active { cursor: grabbing; }
    .figura { width: 100%; flex: 1; min-height: 0; fill: rgba(90, 96, 104, .55); stroke: rgba(255,255,255,.7); stroke-width: 1.5; }
    .etiqueta { display: grid; justify-items: center; gap: 1px; padding: 3px 8px; border-radius: 8px; white-space: nowrap;
      background: rgba(255,255,255,.92); color: #1d2430; font-size: 11px; line-height: 1.25; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
    .etiqueta b { font-weight: 600; }
    .etiqueta small { font-size: 10px; color: #4b5563; }
    .falta .etiqueta small { color: #8c1d18; }
    .aviso { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); padding: 5px 12px; border-radius: 8px;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; max-width: 90%; text-align: center; }
    /* Unas 3 líneas de texto (máximo el 22 % de la escena); el borde superior queda en la línea de la cadera. */
    .dialogo { position: absolute; left: 3%; right: 3%; bottom: 3.5%; min-height: 6.2em; max-height: 22%; overflow: auto;
      padding: 8px 14px 10px; border-radius: 10px; background: rgba(15,20,28,.8); color: #f3f3f3;
      border: 1px solid rgba(255,255,255,.15); font-size: clamp(.8rem, 1.8cqi, 1.05rem); }
    /* Agrandada: semitransparente, máximo 25 % del alto y sin pasar por debajo de los controles (columna a la derecha). */
    :host-context(.pantalla-completa) .dialogo { left: 2%; right: calc(112px + 16px); bottom: 3%; min-height: 0;
      max-height: 25%; background: rgba(15,20,28,.62); backdrop-filter: blur(4px); }
    /* Calidad ligera (el equipo no llega a 30 cuadros por segundo): sin desenfoque, fondo del cuadro un poco más opaco. */
    :host-context(.pantalla-completa):host(.ligero) .dialogo { backdrop-filter: none; background: rgba(15,20,28,.74); }
    .dialogo p { margin: 0; line-height: 1.35; white-space: pre-line; }
    .dialogo .nombre { display: inline-block; margin-bottom: 4px; padding: 2px 10px; border-radius: 6px;
      background: #2f6f68; color: #fff; font-weight: 600; font-size: clamp(.72rem, 1.6cqi, .9rem); }
    @media (max-width: 640px) { .etiqueta { font-size: 9px; padding: 2px 5px; } .etiqueta small { font-size: 8px; } }
  `]
})
export class EscenaNovelaComponent implements AfterViewInit, OnDestroy {
  readonly caso = input.required<CasoNovela>();
  readonly bloque = input.required<BloqueNovela>();
  readonly personajes = input<PersonajeNovela[] | null>(null);
  /** Vista del docente: siluetas para "Persona N" sin descripción, etiquetas y arrastre. */
  readonly modoEditor = input(false);
  readonly bloqueado = input(false);
  /** Fondo fijado a mano por el docente (id de FONDOS_MANUALES); null = automático. */
  readonly fondoManual = input<string | null>(null);
  /** Posiciones del boceto por índice de personaje (solo en la vista del docente). */
  readonly posiciones = input<(PosicionNovela | null | undefined)[] | null>(null);
  /** Muestra a todos los personajes del caso, no solo los del escenario (resumen inicial). */
  readonly todos = input(false);
  readonly titulo = input<string | null>(null);
  readonly texto = input<string | null>(null);
  readonly mostrarDialogo = input(true);
  readonly expresion = input('neutral');
  readonly nivel = input<NivelExpresion>('leve');
  /** Reparto de la escena (ids de slotDe) en orden; null = los del escenario ("Aparece en"). Ordena las posiciones. */
  readonly presentes = input<number[] | null>(null);
  /** De ese reparto, quiénes se ven ahora (los demás esperan ocultos y entran con un fundido). null = todos. */
  readonly visibles = input<number[] | null>(null);
  /** Quién habla: se ilumina y los demás se oscurecen un poco. null = nadie. */
  readonly hablante = input<number | null>(null);
  /** Boca de quien habla según el texto que se escribe. */
  readonly boca = input<{ personaje: number; visema: Visema | null } | null>(null);
  /** Emoción de cada personaje (por id); si falta, usa `expresion` y `nivel`. */
  readonly emociones = input<Record<number, EmocionNovela> | null>(null);
  /** Gesto del cuerpo de cada personaje (por id, de gestos.ts); null = todos en reposo. */
  readonly gestos = input<Record<number, Gesto> | null>(null);
  /** Hay una ventana encima que tapa la escena (historial en celular, resultados): no se dibuja. */
  readonly pausado = input(false);
  /** Línea actual (índice del paso): al cambiar, con Siguiente o Anterior, cada gesto se hace una vez más. */
  readonly paso = input<number | null>(null);
  /** El texto se está escribiendo: quien habla gesticula solo mientras tanto. */
  readonly escribiendo = input(false);

  /** Asignación del motor para todo el caso (perfil, Id y modelo de cada personaje). */
  readonly elenco = output<Asignacion[]>();
  readonly fondoElegido = output<FondoElegido>();
  readonly mover = output<{ indice: number; x: number; y: number }>();

  private readonly elencoSrv = inject(ElencoService);
  private readonly escenaSrv = inject(EscenaService);
  private readonly zona = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  readonly fondo = signal<FondoElegido | null>(null);
  readonly fondoActual = computed(() => { const f = this.fondo(); return f ? [f] : []; });
  /** Fondo anterior, debajo del nuevo mientras este aparece (~400 ms). */
  readonly fondoPrevio = signal<string | null>(null);
  readonly nombreDialogo = computed(() => this.titulo() ?? this.bloque().nombre);
  private temporizadorFondo?: ReturnType<typeof setTimeout>;
  readonly fondoRoto = signal(false);
  readonly fichas = signal<Ficha[]>([]);
  readonly marcas = signal<Marca[]>([]);
  readonly estado = signal<'listo' | 'cargando' | 'planb'>('listo');
  readonly motivoPlanB = signal('');
  private readonly webgl = signal(true);
  readonly usar3d = computed(() => this.webgl() && this.estado() !== 'planb');

  private renderer?: THREE.WebGLRenderer;
  private readonly escena = new THREE.Scene();
  /** Cámara ortográfica en metros: el encuadre se calcula en píxeles por metro (ver encuadre()). */
  private readonly camara = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 50);
  private readonly reloj = new THREE.Clock();
  private readonly instancias = new Map<string, PersonajeCargado & {
    slot: number; clave: string; medidas: Medidas;
    materiales: MaterialGuardado[];
    /** Aparición (0 = oculto, 1 = en escena), luz (1 = habla o nadie habla) y lo último aplicado a los materiales. */
    aparicion: number; luz: number; luzAplicada: number;
    /** Escala y altura que fija colocar(); la aparición las ajusta un poco. */
    escalaBase: number; yBase: number;
    cuerpo: Cuerpo;
  }>();
  /** Catálogo de animaciones (null mientras carga; vacío si no se pudo leer: respiración por código). */
  private catalogoAnimaciones: AnimacionCatalogo[] | null = null;
  private readonly pendientes = new Set<string>();
  private observador?: ResizeObserver;
  private visor?: IntersectionObserver;
  /** La escena se ve en la pantalla (no quedó fuera al desplazarse). */
  private enPantalla = true;
  /** Calidad ligera: sin desenfoque del cuadro y sin física de cabello y ropa en quienes no hablan. */
  readonly nivelCalidad = signal(0);
  readonly ligero = computed(() => this.nivelCalidad() >= 1);
  /** Tiempo acumulado desde el último dibujo (para dibujar a 30 cuadros por segundo si nada cambia). */
  private acumulado = 0;
  /** Momento (reloj de la escena) del último cambio visible: mientras tanto se dibuja a todo ritmo. */
  private ultimoCambio = 0;
  /** Medición de cuadros por segundo mientras hay movimiento, para pasar a calidad ligera. */
  private medida = { cuadros: 0, tiempo: 0 };
  /** El último dibujo no tenía personajes visibles: no hace falta volver a dibujar el lienzo vacío. */
  private lienzoVacio = false;
  private quitarOyente?: () => void;
  private raf = 0;
  private generacion = 0;
  private destruido = false;
  private movimientoReducido = false;
  private ancho = 0;
  private alto = 0;
  private posicionesLocales = new Map<number, PosicionNovela>();

  constructor() {
    // Fondo: cambia con el escenario, el caso o el fondo manual.
    effect(() => {
      const caso = this.caso(), bloque = this.bloque(), manual = this.fondoManual();
      untracked(() => this.elegirFondo(caso, bloque, manual));
    });
    // Elenco: cambia con los personajes, el caso o el escenario.
    effect(() => {
      const caso = this.caso(), bloque = this.bloque(), personajes = this.personajes();
      const editor = this.modoEditor(), todos = this.todos(), presentes = this.presentes();
      untracked(() => this.armarElenco(caso, bloque, personajes, editor, todos, presentes));
    });
    // Posiciones del boceto: solo mueven a los personajes.
    effect(() => {
      const posiciones = this.posiciones();
      untracked(() => {
        this.fichas.update(f => f.map(x => ({ ...x, pos: this.posicionDe(x.slot, f.indexOf(x), f.length, posiciones) })));
        this.colocar();
      });
    });
    // Expresiones y boca de cada personaje.
    effect(() => {
      // También quien habla y quién se ve: la mirada y la luz cambian (se dibuja a todo ritmo un momento).
      this.expresion(); this.nivel(); this.emociones(); this.boca(); this.hablante(); this.visibles();
      untracked(() => { this.instancias.forEach(i => this.aplicarCara(i)); this.marcarCambio(); });
    });
    // Gestos del cuerpo (animaciones de Mixamo).
    effect(() => {
      this.gestos(); this.paso();
      untracked(() => this.aplicarGestos());
    });
    // Termina de escribirse el texto: quien habla deja de gesticular y pasa al reposo.
    let escribia = false;
    effect(() => {
      const escribe = this.escribiendo();
      untracked(() => {
        if (escribia && !escribe) this.terminarHablante();
        escribia = escribe;
      });
    });
  }

  ngAfterViewInit(): void {
    this.movimientoReducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!webglDisponible()) {
      this.webgl.set(false);
      this.planB('Este equipo no permite gráficos 3D: se muestran solo el fondo y el texto.');
    }
    this.zona.runOutsideAngular(() => {
      if (this.webgl()) {
        try {
          const renderer = new THREE.WebGLRenderer({ canvas: this.lienzo().nativeElement, alpha: true, antialias: true });
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.setPixelRatio(this.resolucionActual());
          renderer.setClearColor(0x000000, 0);
          this.renderer = renderer;
          const luz = new THREE.DirectionalLight(0xffffff, 2.1);
          luz.position.set(0.4, 1.6, 2.2);
          this.escena.add(luz, new THREE.AmbientLight(0xffffff, 0.45));
        } catch {
          this.zona.run(() => { this.webgl.set(false); this.planB('No se pudo iniciar el 3D: se muestran solo el fondo y el texto.'); });
        }
      }
      this.observador = new ResizeObserver(() => this.ajustarTamano());
      this.observador.observe(this.host.nativeElement);
      // Las etiquetas del docente se apoyan en el borde del cuadro de diálogo: si el texto crece, se reacomodan.
      const dialogo = this.host.nativeElement.querySelector('.dialogo');
      if (dialogo) this.observador.observe(dialogo);
      // Fuera de la pantalla (se desplazó la página) no se dibuja.
      this.visor = new IntersectionObserver(e => {
        this.enPantalla = e.some(x => x.isIntersecting);
        if (this.enPantalla) this.marcarCambio();
      });
      this.visor.observe(this.host.nativeElement);
      this.ajustarTamano();
      this.bucle();
    });
    // Los personajes que se preparan de antemano (siguiente escena) compilan aquí sus shaders, en segundo plano.
    this.elencoSrv.registrarEscena();
    this.quitarOyente = this.elencoSrv.alPreparar(p => {
      if (this.renderer && !this.destruido) this.renderer.compileAsync(p.vrm.scene, this.camara, this.escena).catch(() => undefined);
    });
    // Si el elenco se armó antes de tener renderer, se cargan ahora los modelos.
    this.sincronizarInstancias();
    // Catálogo de animaciones: solo la lista; cada FBX se descarga cuando un personaje lo necesita.
    animaciones.catalogo()
      .then(c => { this.catalogoAnimaciones = c; })
      .catch(() => { this.catalogoAnimaciones = []; })
      .finally(() => { if (!this.destruido) this.aplicarGestos(); });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    cancelAnimationFrame(this.raf);
    this.observador?.disconnect();
    this.visor?.disconnect();
    this.quitarOyente?.();
    for (const i of this.instancias.values()) this.quitar(i);
    this.instancias.clear();
    // Al salir del caso se sueltan también los personajes preparados y los archivos en memoria.
    if (this.elencoSrv.soltarEscena()) animaciones.vaciar();
    this.escena.clear();
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    clearTimeout(this.temporizadorFondo);
  }

  private aplicarCara(i: { slot: number; cara: PersonajeCargado['cara'] }): void {
    const propia = this.emociones()?.[i.slot];
    i.cara.fijar(propia ? propia.emocion : this.expresion(), propia ? propia.nivel : this.nivel(), false);
    const boca = this.boca();
    i.cara.fijarBoca(boca && boca.personaje === i.slot ? boca.visema : null);
  }

  // ------------------------------------------------------------ fondo y elenco

  private async elegirFondo(caso: CasoNovela, bloque: BloqueNovela, manual: string | null): Promise<void> {
    try {
      const f = await this.escenaSrv.elegir(caso, bloque, manual);
      if (this.destruido) return;
      const anterior = this.fondo();
      if (anterior?.ruta === f.ruta) return;
      // Fundido: el fondo anterior queda debajo mientras aparece el nuevo.
      clearTimeout(this.temporizadorFondo);
      this.fondoPrevio.set(anterior && !this.movimientoReducido ? anterior.ruta : null);
      this.temporizadorFondo = setTimeout(() => this.fondoPrevio.set(null), 450);
      this.fondoRoto.set(false);
      this.fondo.set(f);
      this.fondoElegido.emit(f);
    } catch {
      this.fondo.set(null);   // queda el degradado de base
    }
  }

  private async armarElenco(caso: CasoNovela, bloque: BloqueNovela, personajes: PersonajeNovela[] | null,
    editor: boolean, todos: boolean, presentes: number[] | null): Promise<void> {
    const gen = ++this.generacion;
    let asignados: Asignacion[] = [];
    try {
      asignados = await this.elencoSrv.asignar(caso.id, personajes, caso);
    } catch {
      if (gen !== this.generacion) return;
      this.planB('No se pudo leer el catálogo de personajes: se muestran solo el fondo y el texto.');
      this.fichas.set([]);
      return;
    }
    if (gen !== this.generacion || this.destruido) return;
    this.elenco.emit(asignados);
    const enEscena = (escenarios: number[]) => todos || escenarios.includes(bloque.indice);

    const lista: Omit<Ficha, 'pos'>[] = [];
    if (editor && personajes?.length) {
      // Docente: cada casilla del caso; las "Persona N" sin descripción salen como silueta.
      const validos = new Set(personajesValidos(personajes, {}).map(v => v.indice));
      personajes.forEach((p, slot) => {
        if (!enEscena(p.escenarios ?? [])) return;
        const a = asignados.find(x => x.personaje.indice === slot);
        if (validos.has(slot) && a) lista.push({ slot, nombre: p.nombre || `Persona ${slot + 1}`, etiqueta: a.perfil.etiqueta, silueta: false, asignacion: a });
        else lista.push({ slot, nombre: p.nombre || `Persona ${slot + 1}`, etiqueta: '', silueta: true });
      });
    } else if (presentes) {
      // Reparto indicado (reproductor): en ese orden.
      for (const slot of presentes) {
        const orden = asignados.findIndex((a, o) => slotDe(a, o) === slot);
        if (orden < 0) continue;
        const a = asignados[orden];
        lista.push({ slot, nombre: a.personaje.nombre, etiqueta: a.perfil.etiqueta, silueta: false, asignacion: a });
      }
    } else {
      asignados.forEach((a, orden) => {
        if (!enEscena(a.personaje.escenarios)) return;
        lista.push({ slot: slotDe(a, orden), nombre: a.personaje.nombre, etiqueta: a.perfil.etiqueta, silueta: false, asignacion: a });
      });
    }
    const posiciones = this.posiciones();
    this.fichas.set(lista.map((f, i) => ({ ...f, pos: this.posicionDe(f.slot, i, lista.length, posiciones) })));
    if (this.estado() === 'planb' && this.webgl() && this.motivoPlanB().startsWith('No se pudo leer')) this.estado.set('listo');
    this.sincronizarInstancias();
  }

  private posicionDe(slot: number, orden: number, total: number, posiciones: (PosicionNovela | null | undefined)[] | null): PosicionNovela {
    const local = this.posicionesLocales.get(slot);
    if (local) return local;
    const guardada = this.modoEditor() ? posiciones?.[slot] : null;
    if (guardada) return { x: guardada.x, y: guardada.y };
    const reparto = REPARTO[Math.min(4, Math.max(1, total))];
    return { x: reparto[Math.min(orden, reparto.length - 1)], y: Y_DEFECTO };
  }

  // ------------------------------------------------------------ 3D

  private claveDe(f: Ficha): string {
    const a = f.asignacion!;
    return `${f.slot}|${a.modelo?.archivo}|${JSON.stringify(a.aspecto)}`;
  }

  /** Carga los personajes que faltan y quita los que ya no están (o cambiaron de modelo o aspecto). */
  private sincronizarInstancias(): void {
    if (!this.renderer || this.estado() === 'planb') { this.proyectar(); return; }
    const deseadas = new Map<string, Ficha>();
    for (const f of this.fichas()) if (!f.silueta && f.asignacion?.modelo) deseadas.set(this.claveDe(f), f);
    for (const [clave, inst] of this.instancias) {
      if (deseadas.has(clave)) continue;
      this.quitar(inst);
      this.instancias.delete(clave);
    }
    const faltan = [...deseadas].filter(([clave]) => !this.instancias.has(clave) && !this.pendientes.has(clave));
    if (faltan.length) this.estado.set('cargando');
    for (const [clave, ficha] of faltan) {
      this.pendientes.add(clave);
      this.elencoSrv.crear(ficha.asignacion!).then(async p => {
        const medidas = this.medir(p.vrm);
        // Compila sus shaders en segundo plano antes de mostrarlo: si no, el primer dibujo congela la página
        // (la primera vez puede tardar varios segundos en algunos equipos).
        try { await this.renderer?.compileAsync(p.vrm.scene, this.camara, this.escena); } catch { /* se compila al dibujar */ }
        this.pendientes.delete(clave);
        const sigue = this.fichas().some(f => !f.silueta && f.asignacion && this.claveDe(f) === clave);
        if (this.destruido || !sigue) { this.elencoSrv.liberar(p); return; }
        p.cara.movimientoReducido = this.movimientoReducido;
        const inst = {
          ...p, slot: ficha.slot, clave, medidas, materiales: this.guardarMateriales(p.vrm.scene),
          aparicion: 0, luz: 1, luzAplicada: 1, escalaBase: 1, yBase: 0, cuerpo: this.crearCuerpo(p)
        };
        this.aplicarCara(inst);
        this.instancias.set(clave, inst);
        this.escena.add(p.vrm.scene);
        this.colocar();
        this.aplicarGestos();
      }).catch(() => {
        this.pendientes.delete(clave);
        if (!this.destruido) this.planB('No se pudieron cargar los personajes: se muestran solo el fondo y el texto.');
      }).finally(() => {
        if (!this.pendientes.size && this.estado() === 'cargando') this.estado.set('listo');
      });
    }
    this.colocar();
  }

  private planB(motivo: string): void {
    this.motivoPlanB.set(motivo);
    this.estado.set('planb');
    for (const i of this.instancias.values()) this.quitar(i);
    this.instancias.clear();
    this.proyectar();
  }

  /** Mide el modelo en reposo, en el origen y a escala 1: cadera, cabeza, coronilla y hombros. */
  private medir(vrm: PersonajeCargado['vrm']): Medidas {
    vrm.scene.position.set(0, 0, 0);
    vrm.scene.scale.setScalar(1);
    vrm.scene.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(vrm.scene);
    const punto = (n: 'hips' | 'head' | 'leftUpperArm' | 'rightUpperArm' | 'leftLowerLeg' | 'rightLowerLeg') =>
      vrm.humanoid.getNormalizedBoneNode(n)?.getWorldPosition(new THREE.Vector3()) ?? null;
    const cadera = punto('hips')?.y ?? caja.min.y + (caja.max.y - caja.min.y) * 0.53;
    const cabeza = punto('head')?.y ?? caja.max.y - 0.2;
    // Coronilla: lo más alto del modelo (cabello, gorra), sin contar adornos muy altos.
    const tope = Math.min(caja.max.y, cabeza + (cabeza - cadera) * 0.45);
    const i = punto('leftUpperArm'), d = punto('rightUpperArm');
    const hombros = i && d ? Math.abs(i.x - d.x) + 0.24 : MEDIDAS_SILUETA.hombros;
    // Rodilla: el hueso de la pierna (lowerLeg empieza en la rodilla).
    const rodilla = punto('leftLowerLeg')?.y ?? punto('rightLowerLeg')?.y ?? cadera * 0.53;
    return { rodilla, cadera, cabeza, tope, hombros };
  }

  private medidasDe(slot: number): Medidas {
    for (const i of this.instancias.values()) if (i.slot === slot) return i.medidas;
    return MEDIDAS_SILUETA;
  }

  /**
   * Escala común (px por metro) y línea del suelo. Todos se paran en el mismo suelo (debajo del borde
   * inferior), así un niño se ve más bajo que un adulto. El más alto va de la coronilla (con al menos
   * MARGEN_SUPERIOR libre arriba) hasta la cadera, que queda en LINEA_CADERA. Con 3 o 4 se achican un poco
   * más, y si aun así los cuerpos se tocarían, se achican todos por igual.
   */
  private encuadre(): { s: number; suelo: number } {
    const fichas = this.fichas();
    const medidas = fichas.map(f => this.medidasDe(f.slot));
    const ref = medidas.reduce((a, m) => (m.tope > a.tope ? m : a), medidas[0] ?? MEDIDAS_SILUETA);
    const torso = Math.max(TORSO_MINIMO, ref.tope - ref.cadera);
    const n = Math.min(4, fichas.length);
    let s = ((LINEA_CADERA - MARGEN_SUPERIOR) * this.alto / torso) * (ACHIQUE_POR_CANTIDAD[n] ?? 1);
    if (n > 1) {
      const r = REPARTO[n];
      const separacion = Math.min(...r.slice(1).map((v, k) => v - r[k])) / 100 * this.ancho;
      const hombros = Math.max(...medidas.map(m => m.hombros)) * PROFUNDIDAD[1] * s;
      if (hombros * SEPARACION_MINIMA > separacion) s *= separacion / (hombros * SEPARACION_MINIMA);
    }
    // Suelo: la coronilla del más alto queda en el margen superior. Sin achicar, su cadera cae en
    // LINEA_CADERA; al achicar, todos suben juntos (así las caras no quedan detrás del diálogo).
    const suelo = MARGEN_SUPERIOR * this.alto + ref.tope * PROFUNDIDAD[1] * s;
    return { s, suelo };
  }

  private profundidad(pos: PosicionNovela): number {
    const t = Math.min(70, Math.max(0, pos.y)) / 70;
    return PROFUNDIDAD[0] + t * (PROFUNDIDAD[1] - PROFUNDIDAD[0]);
  }

  /** x del boceto (0–78) a fracción del ancho (0.11–0.89). */
  private fraccionX(pos: PosicionNovela): number {
    return (Math.min(78, Math.max(0, pos.x)) + 11) / 100;
  }

  /** Ubica a cada personaje (de pie sobre el mismo suelo) y actualiza la capa de etiquetas. */
  private colocar(): void {
    this.marcarCambio();
    if (!this.ancho || !this.alto) return;
    const { s, suelo } = this.encuadre();
    // Cámara ortográfica en metros: 1 m = s px. Arriba a la izquierda es (0, 0).
    this.camara.left = 0; this.camara.right = this.ancho / s;
    this.camara.top = 0; this.camara.bottom = -this.alto / s;
    this.camara.position.set(0, 0, 10);
    this.camara.updateProjectionMatrix();
    const fichas = this.fichas();
    for (const inst of this.instancias.values()) {
      const f = fichas.find(x => x.slot === inst.slot);
      if (!f) continue;
      const k = this.profundidad(f.pos);
      const fx = this.fraccionX(f.pos);
      const antes = inst.vrm.scene.position.clone(), escalaAntes = inst.vrm.scene.scale.x, giroAntes = inst.vrm.scene.rotation.y;
      inst.escalaBase = k;
      inst.yBase = -suelo / s;
      inst.vrm.scene.scale.setScalar(k * (0.96 + 0.04 * inst.aparicion));
      // Los pies (origen del modelo) en el suelo, por debajo del borde inferior de la escena.
      inst.vrm.scene.position.set(fx * this.ancho / s, inst.yBase - (1 - inst.aparicion) * 0.05, f.pos.y / 70);
      inst.vrm.scene.rotation.y = (inst.vrm.meta?.metaVersion === '0' ? Math.PI : 0) - (fx - 0.5) * 0.35;
      // Un salto de lugar, escala o giro deja atrás los huesos con física (falda, pelo) y la ropa queda
      // levantada o deformada: se reinician en la pose nueva.
      if (antes.distanceTo(inst.vrm.scene.position) > 0.02 || Math.abs(escalaAntes - inst.vrm.scene.scale.x) > 0.005
        || Math.abs(giroAntes - inst.vrm.scene.rotation.y) > 0.01) {
        inst.vrm.scene.updateMatrixWorld(true);
        inst.vrm.springBoneManager?.reset();
      }
    }
    this.proyectar(s, suelo);
  }

  /** Calcula dónde dibujar etiquetas, siluetas y zonas de arrastre (en píxeles del contenedor). */
  private proyectar(s?: number, suelo?: number): void {
    if (!this.ancho || !this.alto) return;
    if (s === undefined || suelo === undefined) ({ s, suelo } = this.encuadre());
    const bordeDialogo = this.mostrarDialogo()
      ? this.host.nativeElement.querySelector<HTMLElement>('.dialogo')?.offsetTop ?? this.alto
      : this.alto;
    const marcas: Marca[] = this.fichas().map(f => {
      const m = this.medidasDe(f.slot);
      const k = this.profundidad(f.pos);
      const centro = this.fraccionX(f.pos) * this.ancho;
      const ancho = Math.max(44, m.hombros * k * s!);
      const arriba = Math.max(0, suelo! - m.tope * k * s!);
      // La etiqueta se apoya sobre el borde del diálogo (o a la altura de la cadera si queda más arriba).
      const abajo = Math.max(arriba + 40, Math.min(bordeDialogo - 4, suelo! - m.rodilla * k * s!));
      return {
        slot: f.slot, nombre: f.nombre, etiqueta: f.etiqueta, silueta: f.silueta || !this.usar3d(), falta: f.silueta,
        izq: centro - ancho / 2, arriba, abajo, ancho
      };
    });
    this.zona.run(() => this.marcas.set(marcas));
  }

  /** Recalcula el lienzo (lo llama el reproductor al agrandar, salir o girar el celular). */
  reajustar(): void {
    this.ajustarTamano();
  }

  private ajustarTamano(): void {
    // offsetWidth es el ancho de maquetación: no cambia con la rotación CSS de la escena agrandada en iPhone
    // (getBoundingClientRect daría el ancho ya girado y los personajes se verían estirados).
    const ancho = this.host.nativeElement.offsetWidth;
    const w = Math.round(ancho), h = Math.round(ancho * 9 / 16);
    if (!w || !h) return;
    this.ancho = w; this.alto = h;
    if (this.renderer && this.renderer.getPixelRatio() !== this.resolucionActual()) this.renderer.setPixelRatio(this.resolucionActual());
    this.renderer?.setSize(w, h, false);
    this.colocar();
  }

  /** Baja un nivel de calidad (ver NIVEL_MAXIMO); en el último, la resolución baja solo hasta el piso. */
  private bajarCalidad(): void {
    const nivel = Math.min(NIVEL_MAXIMO, this.nivelCalidad() + 1);
    this.nivelCalidad.set(nivel);
    if (nivel >= NIVEL_MAXIMO) this.ajustarTamano();
  }

  /** pixelRatio del nivel actual: el máximo, o el piso en el último nivel. */
  private resolucionActual(): number {
    return this.nivelCalidad() >= NIVEL_MAXIMO ? Math.min(resolucionMaxima(), resolucionPiso()) : resolucionMaxima();
  }

  /** Algo visible cambió (gesto, fundido, entrada, cara, posición): se dibuja a todo ritmo un momento. */
  private marcarCambio(): void {
    this.ultimoCambio = this.reloj.elapsedTime;
    this.lienzoVacio = false;
  }

  /** Hay movimiento que conviene dibujar a todo ritmo (no solo el reposo). */
  private hayMovimiento(): boolean {
    if (this.escribiendo() || this.reloj.elapsedTime - this.ultimoCambio < MOVIMIENTO_TRAS_CAMBIO_S) return true;
    const hablante = this.hablante();
    for (const i of this.instancias.values()) {
      if (i.cuerpo.esGesto && !i.cuerpo.terminado) return true;
      if (Math.abs(i.aparicion - (this.esVisible(i.slot) ? 1 : 0)) > 0.001) return true;
      if (Math.abs(i.luz - (hablante === null || hablante === i.slot ? 1 : 0.68)) > 0.003) return true;
    }
    return false;
  }

  /**
   * Cuadros por segundo mientras hay movimiento (ventanas de 2 s): si bajan de 30, pasa a calidad ligera y
   * se queda así en este caso (sin ir y volver).
   */
  private medirRitmo(dt: number, moviendo: boolean): void {
    if (this.nivelCalidad() >= NIVEL_MAXIMO || !moviendo || this.estado() !== 'listo' || this.pendientes.size) { this.medida = { cuadros: 0, tiempo: 0 }; return; }
    this.medida.cuadros++;
    this.medida.tiempo += dt;
    if (this.medida.tiempo < 2) return;
    if (this.medida.cuadros / this.medida.tiempo < (this.nivelCalidad() >= 2 ? FPS_MINIMO_CON_TOPE : FPS_MINIMO)) this.bajarCalidad();
    this.medida = { cuadros: 0, tiempo: 0 };
  }

  private bucle = (): void => {
    if (this.destruido) return;
    this.raf = requestAnimationFrame(this.bucle);
    if (!this.renderer || this.estado() === 'planb') return;
    // Pausa: pestaña oculta, escena fuera de la pantalla o una ventana encima. Al volver no hay salto (dt se descarta).
    if (document.hidden || !this.enPantalla || this.pausado()) { this.reloj.getDelta(); this.acumulado = 0; return; }
    this.acumulado += this.reloj.getDelta();
    const moviendo = this.hayMovimiento();
    // Si solo queda el reposo, a 30 cuadros por segundo.
    // Si solo queda el reposo (o la calidad está en el tope de 30), a 30 cuadros por segundo.
    if ((!moviendo || this.nivelCalidad() >= 2) && this.acumulado < INTERVALO_QUIETO_S - 0.004) return;
    const dt = Math.min(this.acumulado, 0.1);
    this.acumulado = 0;
    this.medirRitmo(dt, moviendo);
    const t = this.reloj.elapsedTime;
    const hablante = this.hablante();
    let alguienVisible = false;
    for (const inst of this.instancias.values()) {
      // Entrada (~400 ms): sale de la sombra a su color con un leve acercamiento. Se hace con el color de los
      // materiales y no con transparencia, que obligaría a compilar otros shaders y tarda mucho la primera vez.
      // Quien no habla queda un poco más oscuro (~250 ms).
      const aparicionObjetivo = this.esVisible(inst.slot) ? 1 : 0;
      const luzObjetivo = hablante === null || hablante === inst.slot ? 1 : 0.68;
      if (this.movimientoReducido) { inst.aparicion = aparicionObjetivo; inst.luz = luzObjetivo; }
      else {
        inst.aparicion += Math.sign(aparicionObjetivo - inst.aparicion) * Math.min(Math.abs(aparicionObjetivo - inst.aparicion), dt / 0.4);
        inst.luz += (luzObjetivo - inst.luz) * (1 - Math.exp(-dt / 0.08));
      }
      const a = inst.aparicion;
      inst.vrm.scene.visible = a > 0.01;
      inst.vrm.scene.scale.setScalar(inst.escalaBase * (0.96 + 0.04 * a));
      inst.vrm.scene.position.y = inst.yBase - (1 - a) * 0.05;
      this.aplicarLuz(inst, inst.luz * (0.25 + 0.75 * a));
      inst.cara.antesDeActualizar(dt);
      if (inst.vrm.scene.visible) inst.cuerpo.mezclador.update(dt);
      const c = inst.cuerpo;
      if (c.esGesto && !c.terminado && (c.tiempoGesto += dt) > LIMITE_GESTO_S) { c.terminado = true; this.aplicarGestos(); }
      // Respaldo sin animación (no cargó o falta): respiración suave por código sobre la pose de reposo.
      if (!inst.cuerpo.accion && !this.movimientoReducido) respirar(inst.vrm, t, inst.slot * 1.7);
      this.mirar(inst, hablante, dt);
      // Calidad ligera: la física del cabello y la ropa solo para quien habla.
      if (this.ligero() && inst.slot !== hablante) actualizarSinFisica(inst.vrm, dt);
      else inst.vrm.update(dt);
      inst.cara.despuesDeActualizar();
      if (inst.vrm.scene.visible) alguienVisible = true;
    }
    // Sin nadie en escena (portada, presentación, final) basta con dejar el lienzo limpio una vez.
    if (!alguienVisible && this.lienzoVacio) return;
    this.renderer.render(this.escena, this.camara);
    this.lienzoVacio = !alguienVisible;
  };

  // ------------------------------------------------------------ cuerpo: animaciones y mirada

  private crearCuerpo(p: PersonajeCargado): Cuerpo {
    const mezclador = new THREE.AnimationMixer(p.vrm.scene);
    const mirada = new THREE.Object3D();
    this.escena.add(mirada);
    if (p.vrm.lookAt) { p.vrm.lookAt.target = mirada; p.vrm.lookAt.autoUpdate = true; }
    const cuerpo: Cuerpo = { mezclador, accion: null, animacion: null, pedida: null, terminado: false, tiempoGesto: 0, esGesto: false, mirada };
    // El gesto de la línea termina (quedó en su último cuadro): pasa al reposo con un fundido.
    mezclador.addEventListener('finished', e => {
      if (e.action !== cuerpo.accion) return;
      cuerpo.terminado = true;
      this.aplicarGestos();
    });
    return cuerpo;
  }

  private terminarHablante(): void {
    const hablante = this.hablante();
    for (const inst of this.instancias.values()) {
      if (inst.slot !== hablante || inst.cuerpo.terminado) continue;
      inst.cuerpo.terminado = true;
      this.aplicarGestos();
    }
  }

  private quitar(inst: PersonajeCargado & { cuerpo: Cuerpo }): void {
    inst.cuerpo.mezclador.stopAllAction();
    inst.cuerpo.mezclador.uncacheRoot(inst.vrm.scene);
    this.escena.remove(inst.cuerpo.mirada, inst.vrm.scene);
    this.elencoSrv.liberar(inst);
  }

  /**
   * Elige la animación de cada personaje según su gesto (gestos.ts) sin repetir la misma versión en dos
   * personajes a la vez; quien ya hace un gesto de esa categoría lo sigue haciendo.
   */
  /**
   * Gesto de cada personaje en la línea actual: se hace UNA vez (quien habla, hasta 2 veces mientras se
   * escribe su texto) y después el personaje pasa a un reposo tranquilo hasta la línea siguiente. Al cambiar
   * de línea (Siguiente o Anterior) el gesto vuelve a empezar.
   */
  private aplicarGestos(): void {
    const catalogo = this.catalogoAnimaciones;
    if (!catalogo) return;
    const gestos = this.gestos();
    const paso = this.paso();
    const nuevaLinea = paso !== this.lineaGestos;
    this.lineaGestos = paso;
    const fichas = this.fichas();
    const ocupadas = new Set<string>();
    const lista = [...this.instancias.values()].sort((a, b) => a.slot - b.slot);
    for (const inst of lista) {
      const c = inst.cuerpo;
      if (nuevaLinea) c.terminado = false;
      const pedido = this.movimientoReducido ? REPOSO : gestos?.[inst.slot] ?? REPOSO;
      const gesto = c.terminado ? REPOSO : pedido;
      const esGesto = gesto.categoria !== 'reposo';
      const f = fichas.find(x => x.slot === inst.slot);
      const fx = f ? this.fraccionX(f.pos) : 0.5;
      // En una línea nueva se prefiere otra versión del gesto (si la hay) para no reiniciar la misma de golpe.
      const evitar = new Set(ocupadas);
      if (nuevaLinea && esGesto && c.animacion) evitar.add(c.animacion);
      const opciones = {
        slot: inst.slot, actual: nuevaLinea && esGesto ? null : c.pedida ?? c.animacion,
        ocupadas: evitar, junto_al_borde: fx < BORDE || fx > 1 - BORDE
      };
      const a = elegirVersion(catalogo, gesto, opciones) ?? elegirVersion(catalogo, REPOSO, opciones);
      if (!a) continue;
      ocupadas.add(a.id);
      // Quien habla puede repetir el gesto (máx. 2) solo si su texto se está escribiendo; con el texto ya completo
      // (al volver con Anterior) lo hace una vez, como los demás.
      this.reproducir(inst, a, catalogo, nuevaLinea && esGesto, gesto.papel === 'habla' && this.escribiendo() ? 2 : 1);
    }
  }
  private lineaGestos: number | null | undefined = undefined;

  /**
   * Pasa a la animación con un fundido de ~0,5 s; si todavía no está descargada, la pide y sigue con la actual.
   * Los gestos se hacen `veces` veces y quedan en su último cuadro hasta el fundido al reposo (sin saltos).
   */
  private reproducir(inst: PersonajeCargado & { slot: number; clave: string; cuerpo: Cuerpo }, a: AnimacionCatalogo,
    catalogo: AnimacionCatalogo[], reiniciar = false, veces = 1): void {
    const c = inst.cuerpo;
    if (c.animacion === a.id && c.accion && (!reiniciar || c.accion.isRunning())) { c.pedida = null; return; }
    c.pedida = a.id;
    const clip = animaciones.clipListo(inst.vrm, a);
    if (!clip) {
      animaciones.base(a).then(() => {
        if (!this.destruido && c.pedida === a.id && this.instancias.get(inst.clave) === inst) this.reproducir(inst, a, catalogo, reiniciar, veces);
      }).catch(() => {
        if (this.destruido || c.pedida !== a.id || this.instancias.get(inst.clave) !== inst) return;
        // Respaldo: si no carga, su reposo; si el reposo tampoco, respiración por código (nunca la pose en T).
        const reposo = a.categoria === 'reposo' ? null
          : elegirVersion(catalogo, REPOSO, { slot: inst.slot, actual: null, ocupadas: new Set(), junto_al_borde: false });
        if (reposo) { this.reproducir(inst, reposo, catalogo); return; }
        c.pedida = null;
        c.accion?.fadeOut(FUNDIDO_S);
        c.accion = null;
        c.animacion = null;
      });
      return;
    }
    c.pedida = null;
    const nueva = c.mezclador.clipAction(clip);
    nueva.reset();
    const reposo = a.categoria === 'reposo';
    nueva.setLoop(THREE.LoopRepeat, reposo ? Infinity : veces);
    nueva.clampWhenFinished = !reposo;
    // Reposo a 0,8x (más lento con movimiento reducido), cada personaje desde un momento distinto para no ir a la par.
    nueva.timeScale = reposo ? (this.movimientoReducido ? 0.6 : 0.8) : 1;
    if (reposo) nueva.time = Math.random() * clip.duration;
    nueva.play();
    if (c.accion && c.accion !== nueva) c.accion.crossFadeTo(nueva, FUNDIDO_S, false);
    else nueva.fadeIn(FUNDIDO_S);
    this.marcarCambio();
    c.accion = nueva;
    c.animacion = a.id;
    c.esGesto = !reposo;
    c.tiempoGesto = 0;
  }

  /**
   * Ojos: quienes escuchan miran a quien habla; quien habla mira al personaje más cercano; si nadie habla,
   * al frente. El punto se mueve suave (~150 ms) y un poco hacia la cámara para que el giro sea natural.
   */
  private mirar(inst: { slot: number; vrm: PersonajeCargado['vrm']; cuerpo: Cuerpo }, hablante: number | null, dt: number): void {
    const cabeza = inst.vrm.humanoid.getNormalizedBoneNode('head');
    if (!inst.vrm.lookAt || !cabeza) return;
    const cabezaDe = (vrm: PersonajeCargado['vrm']) => vrm.humanoid.getNormalizedBoneNode('head')?.getWorldPosition(new THREE.Vector3()) ?? null;
    const otros = [...this.instancias.values()].filter(i => i.slot !== inst.slot && i.vrm.scene.visible);
    const x = inst.vrm.scene.position.x;
    let destino: THREE.Vector3 | null = null;
    if (hablante !== null && hablante !== inst.slot) {
      const h = otros.find(i => i.slot === hablante);
      destino = h ? cabezaDe(h.vrm) : null;
    } else if (hablante === inst.slot && otros.length) {
      const cercano = otros.reduce((m, i) => Math.abs(i.vrm.scene.position.x - x) < Math.abs(m.vrm.scene.position.x - x) ? i : m);
      destino = cabezaDe(cercano.vrm);
    }
    destino = destino ? destino.add(new THREE.Vector3(0, 0, 0.6)) : cabeza.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 3));
    const m = inst.cuerpo.mirada;
    if (m.position.lengthSq() === 0) m.position.copy(destino);
    else m.position.lerp(destino, this.movimientoReducido ? 1 : 1 - Math.exp(-dt / 0.15));
  }

  private esVisible(slot: number): boolean {
    const v = this.visibles();
    return !v || v.includes(slot);
  }

  private guardarMateriales(raiz: THREE.Object3D): MaterialGuardado[] {
    const lista: MaterialGuardado[] = [];
    const vistos = new Set<THREE.Material>();
    raiz.traverse(o => {
      const malla = o as THREE.Mesh;
      if (!malla.isMesh) return;
      for (const m of (Array.isArray(malla.material) ? malla.material : [malla.material]) as MaterialGuardado['mat'][]) {
        if (vistos.has(m)) continue;
        vistos.add(m);
        lista.push({ mat: m, color: m.color?.clone(), sombra: m.shadeColorFactor?.clone() });
      }
    });
    return lista;
  }

  /** Multiplica el color de los materiales (oscurecido de quien no habla y aparición desde la sombra). */
  private aplicarLuz(inst: { materiales: MaterialGuardado[]; luzAplicada: number }, luz: number): void {
    if (Math.abs(luz - inst.luzAplicada) <= 0.002) return;
    for (const g of inst.materiales) {
      if (g.color && g.mat.color) g.mat.color.copy(g.color).multiplyScalar(luz);
      if (g.sombra && g.mat.shadeColorFactor) g.mat.shadeColorFactor.copy(g.sombra).multiplyScalar(luz);
    }
    inst.luzAplicada = luz;
  }

  // ------------------------------------------------------------ arrastre (solo docente)

  arrastrar(evento: PointerEvent, slot: number): void {
    if (!this.modoEditor() || this.bloqueado()) return;
    evento.preventDefault();
    const caja = this.host.nativeElement.getBoundingClientRect();
    // Arrastre relativo (sin saltos al tomar al personaje): x lo mueve a los lados; y lo acerca (abajo)
    // o lo aleja (arriba) dentro del plano medio.
    const inicio = this.fichas().find(f => f.slot === slot)?.pos ?? { x: 39, y: Y_DEFECTO };
    const x0 = evento.clientX, y0 = evento.clientY;
    const alto = caja.width * 9 / 16;
    const mover = (e: PointerEvent) => {
      const x = Math.min(78, Math.max(0, inicio.x + ((e.clientX - x0) / caja.width) * 100));
      const y = Math.min(70, Math.max(0, inicio.y + ((e.clientY - y0) / alto) * 140));
      this.posicionesLocales.set(slot, { x, y });
      this.fichas.update(f => f.map(fi => fi.slot === slot ? { ...fi, pos: { x, y } } : fi));
      this.colocar();
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      const p = this.posicionesLocales.get(slot);
      this.posicionesLocales.delete(slot);
      if (p) this.mover.emit({ indice: slot, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }
}

