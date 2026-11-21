import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild
} from '@angular/core';
import { Visema } from './cara-vrm';
import { Asignacion, ElencoService } from './elenco.service';
import { EscenaService } from './escena.service';
import {
  BloqueNovela, CasoNovela, EmocionNovela, EscenaNovelaComponent, PersonajeNovela, slotDe
} from './escena-novela.component';
import { Paso, PersonajeGuion, armarGuion, normalizar } from './guion';
import { ResultadosNovela } from './resultados';
import { ResultadosNovelaComponent } from './resultados-novela.component';

export interface OpcionReproductor {
  id?: number;
  texto: string;
  /** El reproductor no lo usa ni lo muestra durante el caso (solo sirve para calcular la vista previa). */
  correcta?: boolean | null;
  explicacion?: string | null;
  fundamento?: string | null;
}
export interface PreguntaReproductor { id?: number; enunciado: string; pista?: string | null; opciones: OpcionReproductor[]; }
export interface CasoReproductor extends CasoNovela {
  bloques: { nombre: string; contexto: string; preguntas: PreguntaReproductor[] }[];
}
export interface OpcionElegida { bloque: number; pregunta: number; opcion: number; }

/** Velocidad fija del texto (docente y estudiante). */
const CARACTERES_POR_SEGUNDO = 35;
/** La transición de escenario avanza sola después de este tiempo (ms). */
const DURACION_TRANSICION = 1800;

/** Visema según la letra que acaba de aparecer; boca cerrada en espacios y signos. */
function visemaDe(letra: string, anterior: Visema | null): Visema | null {
  const l = normalizar(letra);
  if (l === 'a') return 'aa';
  if (l === 'e') return 'ee';
  if (l === 'i' || l === 'y') return 'ih';
  if (l === 'o') return 'oh';
  if (l === 'u') return 'ou';
  if (/[a-zñ]/.test(l)) return anterior;   // consonante: la boca sigue como estaba
  return null;
}

/**
 * Reproductor de la novela visual: arma el guion del caso (guion.ts) y lo recorre sobre
 * <app-escena-novela>, con texto de máquina de escribir, bocas, emociones, entradas, transiciones y
 * preguntas. Solo avisa qué opción se eligió (evento `opcion`): durante el caso no califica ni dice si es
 * correcta. Al terminar la última pregunta, "Finalizar" emite `finalizar` y muestra los `resultados` que le
 * entreguen (calculados por la vista previa del docente o devueltos por el backend para el estudiante).
 */
@Component({
  selector: 'app-novela-reproductor',
  imports: [EscenaNovelaComponent, ResultadosNovelaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reproductor" #raiz tabindex="0" (keydown)="tecla($event)"
      [class.pantalla-completa]="pantallaCompleta()"
      aria-label="Novela del caso. Usa Enter o Espacio para avanzar.">
      <div class="lienzo" [style.max-width]="anchoMaximo()" (click)="clicEscena($event)">
        <app-escena-novela
          [caso]="casoEscena()" [bloque]="bloqueActual()" [personajes]="personajes()"
          [presentes]="reparto()" [visibles]="visibles()" [hablante]="hablante()" [boca]="boca()" [emociones]="emociones()"
          [titulo]="nombreHablante()" [texto]="textoVisible()" [mostrarDialogo]="conDialogo()" />

        <div class="sobre-escena" (click)="$event.stopPropagation()">
          <!-- Fuera de pantalla completa el reloj va en la barra de la página; aquí solo en pantalla completa. -->
          @if (tiempoRestante() != null && pantallaCompleta()) {
            <strong class="reloj" [class.urgente]="tiempoRestante()! <= 60" [attr.aria-label]="'Tiempo restante ' + reloj()">{{ reloj() }}</strong>
          }
          <button type="button" class="icono" (click)="alternarPantalla()"
            [attr.aria-pressed]="pantallaCompleta()"
            [attr.aria-label]="pantallaCompleta() ? 'Salir de pantalla completa' : 'Ver el caso en pantalla completa'">
            @if (pantallaCompleta()) {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v2H5v4H3V3h6zm12 0v6h-2V5h-4V3h6zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z"/></svg>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h8v2H5v6H3V3zm10 0h8v8h-2V5h-6V3zM3 13h2v6h6v2H3v-8zm16 0h2v8h-8v-2h6v-6z"/></svg>
            }
          </button>
        </div>

        @if (!pasos().length) { <div class="velo">Preparando la escena…</div> }

        @switch (paso()?.tipo) {
          @case ('portada') {
            <div class="portada">
              <h2>{{ tituloPaso() }}</h2>
              <p>Toca la escena o pulsa Enter para empezar</p>
            </div>
          }
          @case ('transicion') {
            <div class="letrero" [class.animado]="!movimientoReducido"><span>{{ tituloPaso() }}</span></div>
          }
          @case ('fin') {
            @if (resultados(); as r) {
              <div class="resultados" (click)="$event.stopPropagation()">
                <app-resultados-novela [resultados]="r"
                  [textoCerrar]="mostrarCerrar() ? (modoEstudiante() ? 'Volver al panel' : 'Cerrar') : null"
                  [textoReiniciar]="modoEstudiante() ? null : 'Volver a empezar'"
                  (reiniciar)="volverAEmpezar()" (cerrar)="cerrar.emit()" />
              </div>
            } @else {
              <div class="portada">
                <h2>{{ textoFin() }}</h2>
                @if (textoVolver()) {
                  <button type="button" (click)="volverAEmpezar(); $event.stopPropagation()">{{ textoVolver() }}</button>
                }
              </div>
            }
          }
          @case ('pregunta') {
            @if (preguntaActual(); as q) {
              <section class="pregunta" (click)="$event.stopPropagation()" aria-label="Pregunta">
                <p class="marca">Decisión</p>
                <div class="enunciado" [innerHTML]="q.enunciado"></div>
                @if (q.pista) { <p class="pista">{{ q.pista }}</p> }
                <div class="opciones" role="group" aria-label="Opciones">
                  @for (o of q.opciones; track $index; let i = $index) {
                    <button type="button" class="opcion" [attr.aria-pressed]="elegida() === i"
                      [class.elegida]="elegida() === i" (click)="elegir(i)">
                      <span class="clave">{{ 'ABCDEFGHIJ'.charAt(i) }}</span>
                      <span class="texto">{{ o.texto }}</span>
                    </button>
                  }
                </div>
                @if (modoEstudiante()) {
                  <div class="acciones-pregunta">
                    @if (tieneNarracion()) {
                      <button type="button" (click)="releer()">Ver narración otra vez</button>
                    }
                    <button type="button" (click)="deshacer.emit()">Deshacer última respuesta</button>
                  </div>
                }
              </section>
            }
          }
        }

        @if (historialAbierto()) {
          <aside class="historial" aria-label="Historial" (click)="$event.stopPropagation()">
            <div class="historial-cabeza">
              <div>
                <p>Recorrido</p>
                <h3>Historial</h3>
              </div>
              <button type="button" class="cerrar" (click)="historialAbierto.set(false)" aria-label="Cerrar historial">×</button>
            </div>
            <ol class="historial-lista">
              @for (h of historial(); track $index) {
                <li [class]="'entrada ' + h.clase">
                  <button type="button" (click)="ir(h.indice, true)">
                    @if (h.clase === 'habla') {
                      <span class="avatar" aria-hidden="true">{{ h.inicial }}</span>
                    }
                    <span class="cuerpo">
                      @if (h.nombre) { <strong>{{ h.nombre }}</strong> }
                      <span>{{ h.texto }}</span>
                    </span>
                  </button>
                </li>
              } @empty {
                <li class="vacio">Aún no hay diálogos. Avanza la escena para ver el recorrido aquí.</li>
              }
            </ol>
          </aside>
        }
      </div>

      <div class="controles" [class.oculto]="paso()?.tipo === 'fin' && !!resultados()">
        <button type="button" (click)="anterior()" [disabled]="destinoAtras() === null">Anterior</button>
        <button type="button" class="principal" (click)="avanzar()" [disabled]="!pasos().length || paso()?.tipo === 'fin'">
          {{ escribiendo() ? 'Completar' : esUltimaPregunta() ? 'Finalizar' : 'Siguiente' }}</button>
        <button type="button" [class.activo]="historialAbierto()"
          (click)="historialAbierto.set(!historialAbierto())" [attr.aria-expanded]="historialAbierto()">Historial</button>
        <span class="avance" aria-hidden="true">{{ indice() + 1 }} / {{ pasos().length }}</span>
      </div>

      <div class="solo-lector" aria-live="polite">{{ anuncio() }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .reproductor { display: grid; gap: 10px; outline: none; position: relative; }
    .reproductor:focus-visible { box-shadow: 0 0 0 3px #9fe3d9; border-radius: 14px; }
    .lienzo { position: relative; width: 100%; margin: 0 auto; cursor: pointer; user-select: none; }
    .sobre-escena {
      position: absolute; top: 12px; right: 12px; z-index: 5; display: flex; align-items: center; gap: 8px;
    }
    .reloj {
      font-variant-numeric: tabular-nums; min-width: 4.4rem; text-align: center; padding: 7px 12px;
      border-radius: 999px; background: rgba(11, 18, 32, .78); color: #f4f7fb; font-size: 14px; font-weight: 700;
      letter-spacing: .06em; box-shadow: 0 8px 20px rgba(0,0,0,.28); backdrop-filter: blur(8px);
    }
    .reloj.urgente { background: rgba(153, 27, 27, .88); color: #fff; }
    .icono {
      width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 12px; cursor: pointer;
      background: rgba(11, 18, 32, .78); color: #f4f7fb; box-shadow: 0 8px 20px rgba(0,0,0,.28); backdrop-filter: blur(8px);
    }
    .icono svg { width: 18px; height: 18px; fill: currentColor; }
    .icono:hover, .icono[aria-pressed="true"] { background: #1e3a5f; }
    .velo, .portada, .letrero { position: absolute; inset: 0; z-index: 1; display: grid; place-content: center; text-align: center; border-radius: 14px; pointer-events: none; }
    .portada button { pointer-events: auto; }
    .velo { background: rgba(15,20,28,.55); color: #fff; font-size: 1rem; }
    .portada { background: linear-gradient(180deg, rgba(15,20,28,.15), rgba(15,20,28,.7)); color: #fff; gap: 10px; padding: 16px; }
    .portada h2 { margin: 0; font-size: clamp(1.3rem, 4vw, 2.4rem); text-shadow: 0 2px 10px rgba(0,0,0,.5); }
    .portada p { margin: 0; opacity: .9; }
    .portada button { justify-self: center; padding: 8px 16px; border-radius: 8px; border: 0; background: #2f6f68; color: #fff; font: inherit; cursor: pointer; }
    .letrero span { padding: 10px 22px; border-radius: 10px; background: rgba(15,20,28,.78); color: #fff;
      font-size: clamp(1rem, 3vw, 1.6rem); font-weight: 600; }
    .letrero.animado span { animation: letrero 1.8s ease both; }
    @keyframes letrero { 0% { opacity: 0; transform: translateY(6px); } 20%, 80% { opacity: 1; transform: none; } 100% { opacity: .85; } }
    .pregunta { position: absolute; left: 3%; right: 3%; bottom: 3%; z-index: 2; max-height: 72%; overflow: auto; cursor: default;
      padding: 16px 16px 14px; border-radius: 18px; color: #f4f7fb;
      background: linear-gradient(180deg, rgba(10, 23, 51, .92), rgba(12, 22, 40, .88));
      border: 1px solid rgba(159, 227, 217, .22); box-shadow: 0 18px 40px rgba(5, 10, 22, .45); backdrop-filter: blur(16px); }
    .marca { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #9fe3d9; }
    .enunciado { font-weight: 650; margin-bottom: 8px; color: #fff; font-size: 1.02rem; line-height: 1.35; }
    .enunciado :first-child { margin-top: 0; }
    .pista { margin: 0 0 12px; font-size: .86rem; color: #c5d4f0; }
    .pista::before { content: 'Pista · '; font-weight: 700; color: #9fe3d9; }
    .opciones { display: grid; gap: 8px; }
    .opcion { display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px 12px; border-radius: 12px;
      border: 1px solid rgba(197, 212, 238, .18); background: rgba(232, 238, 252, .08); color: #eef2f8; font: inherit; cursor: pointer; }
    .opcion:hover { border-color: rgba(159, 227, 217, .55); background: rgba(47, 111, 104, .28); }
    .opcion.elegida { border-color: #9fe3d9; background: rgba(47, 111, 104, .5); box-shadow: inset 0 0 0 1px #9fe3d9; }
    .clave {
      flex: 0 0 auto; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px;
      background: #16325c; color: #9fe3d9; font-size: 12px; font-weight: 800;
    }
    .opcion.elegida .clave { background: #9fe3d9; color: #0a1733; }
    .texto { min-width: 0; line-height: 1.35; }
    .acciones-pregunta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .acciones-pregunta button { padding: 7px 14px; border-radius: 10px; border: 1px solid rgba(197, 212, 238, .28);
      background: transparent; color: #dfe7f3; font: inherit; font-size: .88rem; cursor: pointer; }
    .acciones-pregunta button:hover { border-color: #9fe3d9; color: #fff; }
    .acciones-pregunta button:focus-visible { outline: 2px solid #9fe3d9; outline-offset: 2px; }
    .resultados { position: absolute; inset: 0; z-index: 2; overflow: auto; cursor: default; border-radius: 14px;
      background: rgba(13,19,30,.94); backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .controles.oculto { display: none; }
    .controles {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;
      padding: 8px; border-radius: 16px; width: fit-content; margin: 0 auto;
      background: rgba(10, 23, 51, .88); border: 1px solid rgba(159, 227, 217, .18);
      box-shadow: 0 10px 24px rgba(5, 10, 22, .22);
    }
    .controles button {
      padding: 8px 16px; border-radius: 12px; border: 1px solid rgba(197, 212, 238, .2);
      background: rgba(232, 238, 252, .08); color: #eef2f8; font: inherit; font-weight: 650; cursor: pointer;
    }
    .controles button:hover:not(:disabled) { border-color: rgba(159, 227, 217, .5); background: rgba(47, 111, 104, .28); }
    .controles button:disabled { opacity: .38; cursor: default; }
    .controles .principal {
      background: #2f6f68; color: #fff; border-color: #3d8a81; min-width: 118px;
      box-shadow: 0 6px 16px rgba(47, 111, 104, .35);
    }
    .controles .principal:hover:not(:disabled) { background: #3a8880; border-color: #9fe3d9; }
    .controles .activo { background: #16325c; color: #9fe3d9; border-color: #9fe3d9; }
    .avance {
      font-size: .8rem; font-weight: 700; color: #9fe3d9; font-variant-numeric: tabular-nums;
      padding: 6px 10px; letter-spacing: .04em;
    }
    .historial {
      position: absolute; top: 58px; right: 12px; bottom: 12px; width: min(340px, 88%); z-index: 4; display: grid;
      grid-template-rows: auto minmax(0, 1fr); overflow: hidden; border-radius: 16px;
      background: linear-gradient(180deg, rgba(12, 18, 32, .94), rgba(16, 24, 40, .9)); color: #eef2f8;
      box-shadow: 0 16px 40px rgba(0,0,0,.4); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.08);
    }
    .historial-cabeza { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      padding: 16px 16px 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
    .historial-cabeza p { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #93a0b8; }
    .historial h3 { margin: 2px 0 0; font-size: 1.05rem; }
    .historial .cerrar {
      width: 32px; height: 32px; border: 0; border-radius: 10px; background: rgba(255,255,255,.08); color: #fff;
      font: 700 1.2rem/1 inherit; cursor: pointer;
    }
    .historial-lista { list-style: none; margin: 0; padding: 12px; overflow: auto; display: grid; gap: 8px; align-content: start; }
    .historial .vacio { color: #93a0b8; font-size: .9rem; line-height: 1.45; padding: 12px 8px; }
    .entrada button {
      width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 10px 12px;
      border: 0; border-radius: 14px; background: rgba(255,255,255,.06); color: inherit; font: inherit; cursor: pointer;
    }
    .entrada button:hover { background: rgba(255,255,255,.12); }
    .entrada.narra button { background: transparent; padding: 8px 10px; }
    .entrada.pregunta button { background: rgba(47, 111, 104, .28); }
    .avatar {
      flex: 0 0 auto; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%;
      background: #2f6f68; color: #fff; font-size: 12px; font-weight: 700;
    }
    .cuerpo { display: grid; gap: 2px; min-width: 0; }
    .cuerpo strong { font-size: 12px; color: #9fe3d9; }
    .cuerpo span { font-size: .88rem; line-height: 1.4; color: #e8eef6; }
    .entrada.narra .cuerpo span { font-style: italic; color: #c5cedd; }
    .entrada.pregunta .cuerpo strong { color: #d7efe9; }
    .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .reproductor.pantalla-completa {
      position: fixed; inset: 0; z-index: 80; height: 100%; width: 100%;
      box-sizing: border-box; padding: 16px 18px 14px; gap: 12px;
      grid-template-rows: minmax(0, 1fr) auto; background: #0b1220; border-radius: 0;
    }
    .reproductor:fullscreen,
    .reproductor:-webkit-full-screen {
      height: 100%; width: 100%; box-sizing: border-box; padding: 16px 18px 14px; gap: 12px;
      grid-template-rows: minmax(0, 1fr) auto; background: #0b1220;
    }
    .reproductor.pantalla-completa .lienzo,
    .reproductor:fullscreen .lienzo,
    .reproductor:-webkit-full-screen .lienzo {
      height: 100%; max-width: none !important; min-height: 0;
    }
    .reproductor.pantalla-completa app-escena-novela,
    .reproductor:fullscreen app-escena-novela,
    .reproductor:-webkit-full-screen app-escena-novela { display: block; height: 100%; }
    .reproductor.pantalla-completa .historial,
    .reproductor:fullscreen .historial { border-radius: 0 12px 12px 0; }
    @media (max-width: 768px) {
      .pregunta { left: 2%; right: 2%; bottom: 2%; max-height: 78%; padding: 12px; }
      .opcion { min-height: 44px; align-items: center; }
      .controles button { min-height: 44px; padding: 10px 14px; }
      .historial { left: 8px; right: 8px; width: auto; top: 54px; bottom: 8px; }
      .sobre-escena { top: 8px; right: 8px; }
    }
  `]
})
export class NovelaReproductorComponent implements OnDestroy {
  readonly caso = input.required<CasoReproductor>();
  readonly personajes = input<PersonajeNovela[] | null>(null);
  /** Dónde empezar: null = portada; n = escenario n (su transición). */
  readonly empezarEn = input<number | null>(null);
  /**
   * Resultados para la pantalla final (después de "Finalizar"). Los calcula la vista previa del docente o
   * los devuelve el backend para el estudiante; el reproductor nunca los calcula.
   */
  readonly resultados = input<ResultadosNovela | null>(null);
  /** Muestra el botón "Cerrar" en la pantalla de resultados (vista previa). */
  readonly mostrarCerrar = input(false);
  /** Ancho máximo de la escena (CSS), por ejemplo para que quepa en pantalla completa. */
  readonly anchoMaximo = input<string | null>(null);
  /** Segundos restantes de la sesión (estudiante). Si llega, el reloj se muestra junto a pantalla completa. */
  readonly tiempoRestante = input<number | null>(null);
  /**
   * Qué parte del guion se recorre: todo (vista previa del docente), solo portada y presentación (briefing del
   * estudiante, antes de que corra el reloj) o solo los escenarios (simulación del estudiante).
   */
  readonly tramo = input<'completo' | 'presentacion' | 'escenarios'>('completo');
  /**
   * Respuestas guardadas afuera (las del backend para el estudiante): "escenario:pregunta" → índice de la opción.
   * Si llega, manda sobre las que el reproductor recuerda por su cuenta.
   */
  readonly seleccion = input<Record<string, number> | null>(null);
  /**
   * Simulación del estudiante: muestra "Deshacer última respuesta" y, al volver a un escenario que ya tiene
   * respuestas, va directo a la pregunta (con "Ver narración otra vez").
   */
  readonly modoEstudiante = input(false);
  /** Pantalla final sin resultados: título y botón (vacío = sin botón). */
  readonly textoFin = input('Fin del caso');
  readonly textoVolver = input<string | null>('Volver a empezar');

  readonly opcion = output<OpcionElegida>();
  /** Se pulsó "Finalizar" en la última pregunta: opciones elegidas ("escenario:pregunta" → índice). */
  readonly finalizar = output<Record<string, number>>();
  /** "Volver a empezar" desde los resultados. */
  readonly reiniciar = output<void>();
  readonly cerrar = output<void>();
  /** "Deshacer última respuesta" (estudiante): lo resuelve el backend. */
  readonly deshacer = output<void>();

  private readonly elencoSrv = inject(ElencoService);
  private readonly escenaSrv = inject(EscenaService);
  private readonly raiz = viewChild.required<ElementRef<HTMLElement>>('raiz');

  readonly movimientoReducido = typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  private readonly asignados = signal<Asignacion[] | null>(null);
  /** Pasos que se muestran (las entradas se ven como fundido del personaje en el paso siguiente). */
  readonly pasos = signal<Paso[]>([]);
  /** Reparto (orden en escena) de cada tramo: -1 = presentación, n = escenario n. */
  private repartos = new Map<number, number[]>();
  readonly indice = signal(0);
  readonly paso = computed<Paso | undefined>(() => this.pasos()[this.indice()]);
  readonly textoVisible = signal('');
  readonly escribiendo = signal(false);
  readonly historialAbierto = signal(false);
  readonly pantallaCompleta = signal(false);
  readonly anuncio = signal('');
  private readonly elegidas = signal<Record<string, number>>({});
  /** Respuestas vigentes: las de afuera (backend) si llegan; si no, las que se eligieron aquí. */
  readonly selecciones = computed(() => this.seleccion() ?? this.elegidas());
  /** Escenarios con al menos una respuesta. */
  private readonly respondidos = computed(() => new Set(Object.keys(this.selecciones()).map(k => Number(k.split(':')[0]))));
  /** Escenario cuya narración se está viendo otra vez (no se salta hasta salir de él). */
  private readonly releyendo = signal<number | null>(null);
  private readonly visemaActual = signal<Visema | null>(null);
  private temporizador?: ReturnType<typeof setInterval>;
  private autoAvance?: ReturnType<typeof setTimeout>;
  private precargados = new Set<number>();

  readonly casoEscena = computed<CasoNovela>(() => {
    const c = this.caso();
    return { id: c.id, nombre: c.nombre, desarrolloSituacional: c.desarrolloSituacional, contexto: c.contexto,
      bloques: c.bloques.map(b => ({ nombre: b.nombre, contexto: b.contexto })) };
  });
  private readonly nombres = computed(() => {
    const m = new Map<number, string>();
    (this.asignados() ?? []).forEach((a, orden) => m.set(slotDe(a, orden), a.personaje.nombre));
    return m;
  });
  readonly bloqueActual = computed<BloqueNovela>(() => {
    const i = this.paso()?.escena.bloque ?? 0;
    const b = this.caso().bloques[i];
    return { indice: i, nombre: b?.nombre ?? '', contexto: b?.contexto ?? '' };
  });
  readonly reparto = computed(() => {
    const p = this.paso();
    return p ? this.repartos.get(p.escena.escenario) ?? [] : [];
  });
  /** En la pantalla final no hay personajes: solo el fondo del último escenario, oscurecido. */
  readonly visibles = computed(() => this.paso()?.tipo === 'fin' ? [] : this.paso()?.escena.presentes ?? []);
  readonly hablante = computed(() => { const p = this.paso(); return p?.tipo === 'dialogo' ? p.personaje : null; });
  readonly nombreHablante = computed(() => { const h = this.hablante(); return h === null ? '' : this.nombres().get(h) ?? ''; });
  readonly conDialogo = computed(() => { const t = this.paso()?.tipo; return t === 'narracion' || t === 'dialogo'; });
  readonly emociones = computed(() => {
    const e = this.paso()?.escena.emociones ?? {};
    const r: Record<number, EmocionNovela> = {};
    for (const [id, v] of Object.entries(e)) r[Number(id)] = { emocion: v.emocion, nivel: v.nivel };
    return r;
  });
  readonly boca = computed(() => {
    const h = this.hablante();
    return h === null ? null : { personaje: h, visema: this.escribiendo() ? this.visemaActual() : null };
  });
  readonly tituloPaso = computed(() => {
    const p = this.paso();
    return p?.tipo === 'portada' || p?.tipo === 'transicion' ? p.titulo : '';
  });
  readonly preguntaActual = computed<PreguntaReproductor | null>(() => {
    const p = this.paso();
    return p?.tipo === 'pregunta' ? this.caso().bloques[p.bloqueIndice]?.preguntas?.[p.preguntaIndice] ?? null : null;
  });
  readonly elegida = computed(() => {
    const p = this.paso();
    return p?.tipo === 'pregunta' ? this.selecciones()[`${p.bloqueIndice}:${p.preguntaIndice}`] ?? null : null;
  });
  /** El escenario de la pregunta actual tiene narración (transición y contexto) para volver a verla. */
  readonly tieneNarracion = computed(() => {
    const p = this.paso();
    return p?.tipo === 'pregunta' && this.pasos().some(x => x.tipo === 'transicion' && x.bloqueIndice === p.bloqueIndice);
  });
  /** A dónde lleva "Anterior" (null = no hay a dónde). */
  readonly destinoAtras = computed(() => {
    let i = this.indice() - 1;
    const pasos = this.pasos();
    if (pasos[i]?.tipo === 'transicion' && i > 0) i--;
    if (i < 0) return null;
    if (!this.modoEstudiante()) return i;
    // Escenario ya respondido: se salta su narración hasta la pregunta anterior (la narración sigue en "Ver narración otra vez").
    while (i >= 0 && this.saltable(pasos[i])) i--;
    return i >= 0 ? i : null;
  });
  /** La pregunta actual es la última: el botón principal dice "Finalizar". */
  readonly esUltimaPregunta = computed(() => {
    const p = this.paso();
    return p?.tipo === 'pregunta' && !this.pasos().slice(this.indice() + 1).some(x => x.tipo === 'pregunta');
  });
  readonly reloj = computed(() => {
    const segundos = this.tiempoRestante();
    if (segundos == null) return '';
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });
  readonly historial = computed(() => {
    type Entrada = { indice: number; clase: 'habla' | 'narra' | 'pregunta'; nombre: string; inicial: string; texto: string };
    const nombres = this.nombres();
    const caso = this.caso();
    const elegidas = this.selecciones();
    const lista: Entrada[] = [];
    this.pasos().slice(0, this.indice() + 1).forEach((p, indice) => {
      if (p.tipo === 'dialogo') {
        const nombre = nombres.get(p.personaje) ?? '';
        lista.push({ indice, clase: 'habla', nombre, inicial: (nombre[0] ?? '?').toUpperCase(), texto: p.texto });
      } else if (p.tipo === 'narracion') {
        lista.push({ indice, clase: 'narra', nombre: '', inicial: '', texto: p.texto });
      } else if (p.tipo === 'pregunta') {
        const q = caso.bloques[p.bloqueIndice]?.preguntas?.[p.preguntaIndice];
        const i = elegidas[`${p.bloqueIndice}:${p.preguntaIndice}`];
        const opcion = i != null ? q?.opciones[i]?.texto : null;
        lista.push({
          indice, clase: 'pregunta', nombre: 'Decisión', inicial: 'D',
          texto: opcion ? `Elegiste: ${opcion}` : (q?.enunciado ?? 'Pregunta').replace(/<[^>]*>/g, ' ').trim()
        });
      }
    });
    return lista;
  });

  constructor() {
    // Elenco (perfiles) → guion.
    effect(() => {
      const caso = this.casoEscena(), personajes = this.personajes();
      untracked(() => {
        this.elencoSrv.asignar(caso.id, personajes, caso)
          .then(a => this.asignados.set(a))
          .catch(() => this.asignados.set([]));
      });
    });
    effect(() => {
      const asignados = this.asignados(), caso = this.caso();
      if (!asignados) return;
      untracked(() => this.armar(caso, asignados));
    });
    // Los resultados llegan después de "Finalizar": se anuncian a los lectores de pantalla.
    effect(() => {
      const r = this.resultados();
      if (r && untracked(() => this.paso()?.tipo) === 'fin') {
        untracked(() => this.anuncio.set(`Resultados: nota ${this.coma(r.nota)} sobre 5. ${r.aciertos} aciertos, ${r.fallos} fallos y ${r.sinResponder} sin responder.`));
      }
    });
    // Empezar desde (portada o escenario n).
    effect(() => {
      const desde = this.empezarEn(), pasos = this.pasos();
      if (!pasos.length) return;
      untracked(() => {
        let i = desde === null ? 0 : pasos.findIndex(p => p.tipo === 'transicion' && p.bloqueIndice === desde);
        if (desde !== null && this.modoEstudiante() && this.respondidos().has(desde)) {
          i = pasos.findIndex(p => p.tipo === 'pregunta' && p.bloqueIndice === desde);
        }
        this.ir(Math.max(0, i));
      });
    });
    if (typeof document !== 'undefined') {
      const alCambiar = () => {
        const el = this.raiz()?.nativeElement;
        this.pantallaCompleta.set(!!el && document.fullscreenElement === el);
      };
      document.addEventListener('fullscreenchange', alCambiar);
      inject(DestroyRef).onDestroy(() => document.removeEventListener('fullscreenchange', alCambiar));
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.temporizador);
    clearTimeout(this.autoAvance);
    if (typeof document !== 'undefined' && document.fullscreenElement === this.raiz()?.nativeElement) {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }

  alternarPantalla(): void {
    const el = this.raiz().nativeElement;
    if (document.fullscreenElement === el || this.pantallaCompleta()) {
      document.exitFullscreen?.().catch(() => undefined);
      this.pantallaCompleta.set(false);
      return;
    }
    this.pantallaCompleta.set(true);
    el.requestFullscreen?.()?.catch(() => undefined);
  }

  /** Lleva el foco al reproductor (para usarlo con teclado). */
  enfocar(): void {
    this.raiz().nativeElement.focus();
  }

  private armar(caso: CasoReproductor, asignados: Asignacion[]): void {
    const personajes: PersonajeGuion[] = asignados.map((a, orden) => ({
      id: slotDe(a, orden), nombre: a.personaje.nombre, rol: a.perfil.rol, genero: a.perfil.genero,
      etiqueta: a.perfil.etiqueta, escenarios: a.personaje.escenarios
    }));
    const todos = armarGuion(caso, personajes);
    // Reparto de cada tramo en el orden en que aparecen (así no se reacomodan cuando alguien entra).
    this.repartos = new Map();
    for (const p of todos) {
      const lista = this.repartos.get(p.escena.escenario) ?? [];
      for (const id of p.escena.presentes) if (!lista.includes(id)) lista.push(id);
      this.repartos.set(p.escena.escenario, lista);
    }
    let visibles = todos.filter(p => p.tipo !== 'entrada');
    const tramo = this.tramo();
    if (tramo === 'presentacion') {
      // Briefing: portada y presentación; el final queda sobre el último fondo de la presentación.
      const presentacion = visibles.filter(p => p.escena.escenario === -1 && p.tipo !== 'fin');
      const fin = visibles.find(p => p.tipo === 'fin');
      const ultimo = presentacion[presentacion.length - 1];
      visibles = fin && ultimo ? [...presentacion, { ...fin, escena: ultimo.escena }] : presentacion;
    } else if (tramo === 'escenarios') {
      // Simulación: sin portada ni presentación (ya se vieron en el briefing).
      visibles = visibles.filter(p => p.escena.escenario !== -1);
    }
    this.pasos.set(visibles);
  }

  /** Paso de narración de un escenario ya respondido que el estudiante no está volviendo a ver. */
  private saltable(p: Paso | undefined): boolean {
    if (!p || !(p.tipo === 'transicion' || p.tipo === 'narracion' || p.tipo === 'dialogo')) return false;
    const b = p.escena.escenario;
    return b >= 0 && this.respondidos().has(b) && this.releyendo() !== b;
  }

  /** "Ver narración otra vez": vuelve a la transición del escenario de la pregunta actual. */
  releer(): void {
    const p = this.paso();
    if (p?.tipo !== 'pregunta') return;
    const i = this.pasos().findIndex(x => x.tipo === 'transicion' && x.bloqueIndice === p.bloqueIndice);
    if (i < 0) return;
    this.releyendo.set(p.bloqueIndice);
    this.ir(i);
    this.enfocar();
  }

  /** Vuelve a la última pregunta (por ejemplo, si el backend no pudo finalizar). */
  volverAUltimaPregunta(): void {
    const pasos = this.pasos();
    for (let i = pasos.length - 1; i >= 0; i--) if (pasos[i].tipo === 'pregunta') { this.ir(i); return; }
  }

  /** Muestra la pantalla final (por ejemplo, cuando se acabó el tiempo). */
  irAlFin(): void {
    const fin = this.pasos().findIndex(p => p.tipo === 'fin');
    if (fin >= 0) this.ir(fin);
  }

  // ------------------------------------------------------------ navegación

  ir(i: number, completo = false): void {
    const pasos = this.pasos();
    if (!pasos.length) return;
    clearTimeout(this.autoAvance);
    this.indice.set(Math.min(Math.max(0, i), pasos.length - 1));
    const p = this.paso()!;
    // Al salir del escenario cuya narración se volvió a ver, la próxima vez se vuelve a saltar.
    if (this.releyendo() !== null && p.escena.escenario !== this.releyendo()) this.releyendo.set(null);
    this.precargarSiguiente(p.escena.escenario);
    if (p.tipo === 'narracion' || p.tipo === 'dialogo') {
      const nombre = p.tipo === 'dialogo' ? this.nombres().get(p.personaje) : '';
      this.anuncio.set(nombre ? `${nombre}: ${p.texto}` : p.texto);
      if (completo || this.movimientoReducido) this.terminarTexto(p.texto);
      else this.escribir(p.texto, 0);
      return;
    }
    this.detenerTexto();
    this.textoVisible.set('');
    if (p.tipo === 'portada') this.anuncio.set(`${p.titulo}. Pulsa Enter para empezar.`);
    if (p.tipo === 'transicion') {
      this.anuncio.set(p.titulo);
      this.autoAvance = setTimeout(() => { if (this.paso() === p) this.ir(this.indice() + 1); }, DURACION_TRANSICION);
    }
    if (p.tipo === 'pregunta') this.anuncio.set('Pregunta: ' + (this.preguntaActual()?.enunciado ?? '').replace(/<[^>]*>/g, ' '));
    if (p.tipo === 'fin') {
      const r = this.resultados();
      this.anuncio.set(r ? `Resultados: nota ${this.coma(r.nota)} sobre 5. ${r.aciertos} aciertos, ${r.fallos} fallos y ${r.sinResponder} sin responder.` : 'Fin del caso.');
    }
  }

  /** Si está escribiendo, completa la frase; si ya terminó, pasa al siguiente paso. */
  avanzar(): void {
    if (this.escribiendo()) { this.terminarTexto(this.textoCompleto()); return; }
    if (this.paso()?.tipo === 'fin') return;
    if (this.esUltimaPregunta()) { this.finalizarCaso(); return; }
    let i = this.indice() + 1;
    // Estudiante: un escenario que ya tiene respuestas se abre directo en su pregunta.
    if (this.modoEstudiante()) while (i < this.pasos().length - 1 && this.saltable(this.pasos()[i])) i++;
    this.ir(i);
  }

  /** "Finalizar": pasa a la pantalla final y avisa las opciones elegidas. */
  finalizarCaso(): void {
    const fin = this.pasos().findIndex(p => p.tipo === 'fin');
    this.ir(fin >= 0 ? fin : this.pasos().length - 1);
    this.finalizar.emit({ ...this.selecciones() });
  }

  volverAEmpezar(): void {
    this.elegidas.set({});
    this.reiniciar.emit();
    this.ir(0);
    this.enfocar();
  }

  /** Nota con coma decimal (3,5). */
  coma(n: number): string {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  }

  anterior(): void {
    // Al volver se muestra el texto completo (ya se leyó); la transición se salta hacia atrás y, para el
    // estudiante, también la narración de los escenarios que ya respondió.
    const i = this.destinoAtras();
    if (i !== null) this.ir(i, true);
  }


  elegir(opcion: number): void {
    const p = this.paso();
    if (p?.tipo !== 'pregunta') return;
    this.elegidas.update(e => ({ ...e, [`${p.bloqueIndice}:${p.preguntaIndice}`]: opcion }));
    this.opcion.emit({ bloque: p.bloqueIndice, pregunta: p.preguntaIndice, opcion });
  }

  clicEscena(evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('button, a, select, input, .pregunta')) return;
    if (this.paso()?.tipo === 'pregunta' || this.paso()?.tipo === 'fin') return;   // se avanza con los botones
    this.avanzar();
  }

  tecla(evento: KeyboardEvent): void {
    const objetivo = evento.target as HTMLElement;
    const enControl = !!objetivo.closest('button, a, select, input, textarea');
    if ((evento.key === ' ' || evento.key === 'Enter') && !enControl) {
      evento.preventDefault();
      if (this.paso()?.tipo !== 'pregunta') this.avanzar();
    } else if (evento.key === 'ArrowRight' && !enControl) {
      evento.preventDefault(); this.avanzar();
    } else if (evento.key === 'ArrowLeft' && !enControl) {
      evento.preventDefault(); this.anterior();
    } else if (evento.key === 'Escape' && this.pantallaCompleta() && !document.fullscreenElement) {
      this.pantallaCompleta.set(false);
    }
  }

  // ------------------------------------------------------------ texto

  private textoCompleto(): string {
    const p = this.paso();
    return p?.tipo === 'narracion' || p?.tipo === 'dialogo' ? p.texto : '';
  }

  /** Máquina de escribir (~35 caracteres por segundo); mueve la boca de quien habla según las vocales. */
  private escribir(texto: string, desde: number): void {
    this.detenerTexto();
    let n = desde;
    this.textoVisible.set(texto.slice(0, n));
    this.escribiendo.set(true);
    const cps = CARACTERES_POR_SEGUNDO;
    this.temporizador = setInterval(() => {
      n++;
      this.textoVisible.set(texto.slice(0, n));
      this.visemaActual.set(visemaDe(texto[n - 1] ?? ' ', this.visemaActual()));
      if (n >= texto.length) this.terminarTexto(texto);
    }, 1000 / cps);
  }

  private terminarTexto(texto: string): void {
    this.detenerTexto();
    this.textoVisible.set(texto);
  }

  private detenerTexto(): void {
    clearInterval(this.temporizador);
    this.escribiendo.set(false);
    this.visemaActual.set(null);
  }

  // ------------------------------------------------------------ precarga

  /** Precarga personajes y fondo del siguiente escenario. */
  private precargarSiguiente(escenario: number): void {
    const siguiente = escenario + 1;
    const caso = this.caso();
    if (siguiente >= caso.bloques.length || this.precargados.has(siguiente)) return;
    this.precargados.add(siguiente);
    this.elencoSrv.precargar(caso.id, this.personajes(), caso, siguiente).catch(() => undefined);
    const b = caso.bloques[siguiente];
    this.escenaSrv.elegir(caso, { indice: siguiente, nombre: b.nombre, contexto: b.contexto })
      .then(f => { const img = new Image(); img.src = f.ruta; })
      .catch(() => undefined);
  }
}
