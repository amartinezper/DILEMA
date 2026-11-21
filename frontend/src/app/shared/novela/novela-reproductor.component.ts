import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild
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
      aria-label="Novela del caso. Usa Enter o Espacio para avanzar.">
      <div class="lienzo" [style.max-width]="anchoMaximo()" (click)="clicEscena($event)">
        <app-escena-novela
          [caso]="casoEscena()" [bloque]="bloqueActual()" [personajes]="personajes()"
          [presentes]="reparto()" [visibles]="visibles()" [hablante]="hablante()" [boca]="boca()" [emociones]="emociones()"
          [titulo]="nombreHablante()" [texto]="textoVisible()" [mostrarDialogo]="conDialogo()" />

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
                <app-resultados-novela [resultados]="r" [textoCerrar]="mostrarCerrar() ? 'Cerrar' : null"
                  (reiniciar)="volverAEmpezar()" (cerrar)="cerrar.emit()" />
              </div>
            } @else {
              <div class="portada">
                <h2>Fin del caso</h2>
                <button type="button" (click)="volverAEmpezar(); $event.stopPropagation()">Volver a empezar</button>
              </div>
            }
          }
          @case ('pregunta') {
            @if (preguntaActual(); as q) {
              <section class="pregunta" (click)="$event.stopPropagation()" aria-label="Pregunta">
                <div class="enunciado" [innerHTML]="q.enunciado"></div>
                @if (q.pista) { <p class="pista"><b>Pista:</b> {{ q.pista }}</p> }
                <div class="opciones" role="group" aria-label="Opciones">
                  @for (o of q.opciones; track $index; let i = $index) {
                    <button type="button" class="opcion" [attr.aria-pressed]="elegida() === i"
                      [class.elegida]="elegida() === i" (click)="elegir(i)">
                      <span>{{ o.texto }}</span>
                    </button>
                  }
                </div>
              </section>
            }
          }
        }
      </div>

      <div class="controles" [class.oculto]="paso()?.tipo === 'fin' && !!resultados()">
        <button type="button" (click)="anterior()" [disabled]="indice() === 0">Anterior</button>
        <button type="button" class="principal" (click)="avanzar()" [disabled]="!pasos().length || paso()?.tipo === 'fin'">
          {{ escribiendo() ? 'Completar' : esUltimaPregunta() ? 'Finalizar' : 'Siguiente' }}</button>
        <button type="button" (click)="historialAbierto.set(!historialAbierto())" [attr.aria-expanded]="historialAbierto()">Historial</button>
        <span class="avance" aria-hidden="true">{{ indice() + 1 }} / {{ pasos().length }}</span>
      </div>

      @if (historialAbierto()) {
        <section class="historial" aria-label="Historial">
          <div class="historial-cabeza"><h3>Historial</h3>
            <button type="button" (click)="historialAbierto.set(false)">Cerrar</button></div>
          @for (h of historial(); track $index) {
            <p>@if (h.nombre) {<b>{{ h.nombre }}:</b> }{{ h.texto }}</p>
          } @empty { <p class="vacio">Todavía no hay nada.</p> }
        </section>
      }

      <div class="solo-lector" aria-live="polite">{{ anuncio() }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .reproductor { display: grid; gap: 10px; outline: none; position: relative; }
    .reproductor:focus-visible { box-shadow: 0 0 0 3px #9fe3d9; border-radius: 14px; }
    .lienzo { position: relative; width: 100%; margin: 0 auto; cursor: pointer; user-select: none; }
    .velo, .portada, .letrero { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; border-radius: 14px; }
    .velo { background: rgba(15,20,28,.55); color: #fff; font-size: 1rem; }
    .portada { background: linear-gradient(180deg, rgba(15,20,28,.15), rgba(15,20,28,.7)); color: #fff; gap: 10px; padding: 16px; }
    .portada h2 { margin: 0; font-size: clamp(1.3rem, 4vw, 2.4rem); text-shadow: 0 2px 10px rgba(0,0,0,.5); }
    .portada p { margin: 0; opacity: .9; }
    .portada button { justify-self: center; padding: 8px 16px; border-radius: 8px; border: 0; background: #2f6f68; color: #fff; font: inherit; cursor: pointer; }
    .letrero span { padding: 10px 22px; border-radius: 10px; background: rgba(15,20,28,.78); color: #fff;
      font-size: clamp(1rem, 3vw, 1.6rem); font-weight: 600; }
    .letrero.animado span { animation: letrero 1.8s ease both; }
    @keyframes letrero { 0% { opacity: 0; transform: translateY(6px); } 20%, 80% { opacity: 1; transform: none; } 100% { opacity: .85; } }
    .pregunta { position: absolute; left: 3%; right: 3%; bottom: 3%; max-height: 72%; overflow: auto; cursor: default;
      padding: 14px 16px; border-radius: 12px; background: rgba(250,250,250,.97); color: #1d2430; box-shadow: 0 6px 24px rgba(0,0,0,.3); }
    .enunciado { font-weight: 600; margin-bottom: 8px; }
    .enunciado :first-child { margin-top: 0; }
    .pista { margin: 0 0 8px; font-size: .9rem; color: #4b5563; }
    .opciones { display: grid; gap: 6px; }
    .opcion { display: flex; justify-content: space-between; gap: 10px; text-align: left; padding: 9px 12px; border-radius: 8px;
      border: 1px solid #c9d1cf; background: #fff; font: inherit; cursor: pointer; }
    .opcion:hover { border-color: #2f6f68; }
    .opcion.elegida { border-color: #2f6f68; background: #e3f1ee; box-shadow: inset 0 0 0 1px #2f6f68; }
    /* Resultados: sobre el último fondo, casi opaco (el fondo apenas se intuye) y con desplazamiento propio. */
    .resultados { position: absolute; inset: 0; overflow: auto; cursor: default; border-radius: 14px;
      background: rgba(13,19,30,.94); backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .controles.oculto { display: none; }
    .controles { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; }
    .controles button { padding: 7px 12px; border-radius: 8px; border: 1px solid #c9d1cf; background: #fff;
      color: #1d2430; font: inherit; cursor: pointer; }
    .controles button:disabled { opacity: .45; cursor: default; }
    .controles .principal { background: #2f6f68; color: #fff; border-color: #2f6f68; min-width: 110px; }
    .historial button { padding: 4px 10px; border-radius: 6px; border: 1px solid #c9d1cf; background: #fff; color: #1d2430; font: inherit; cursor: pointer; }
    .avance { font-size: .8rem; color: #6b7280; font-variant-numeric: tabular-nums; }
    .historial { position: absolute; top: 0; right: 0; bottom: 52px; width: min(380px, 92%); overflow: auto; z-index: 2;
      padding: 12px 14px; border-radius: 12px; background: #fff; color: #1d2430; box-shadow: 0 8px 28px rgba(0,0,0,.3); }
    .historial-cabeza { display: flex; justify-content: space-between; align-items: center; }
    .historial h3 { margin: 0 0 6px; font-size: 1rem; }
    .historial p { margin: 6px 0; font-size: .9rem; line-height: 1.4; }
    .historial .vacio { color: #6b7280; }
    .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
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

  readonly opcion = output<OpcionElegida>();
  /** Se pulsó "Finalizar" en la última pregunta: opciones elegidas ("escenario:pregunta" → índice). */
  readonly finalizar = output<Record<string, number>>();
  /** "Volver a empezar" desde los resultados. */
  readonly reiniciar = output<void>();
  readonly cerrar = output<void>();

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
  readonly anuncio = signal('');
  private readonly elegidas = signal<Record<string, number>>({});
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
    return p?.tipo === 'pregunta' ? this.elegidas()[`${p.bloqueIndice}:${p.preguntaIndice}`] ?? null : null;
  });
  /** La pregunta actual es la última: el botón principal dice "Finalizar". */
  readonly esUltimaPregunta = computed(() => {
    const p = this.paso();
    return p?.tipo === 'pregunta' && !this.pasos().slice(this.indice() + 1).some(x => x.tipo === 'pregunta');
  });
  readonly historial = computed(() => this.pasos().slice(0, this.indice() + 1)
    .filter(p => p.tipo === 'narracion' || p.tipo === 'dialogo')
    .map(p => p.tipo === 'dialogo' ? { nombre: this.nombres().get(p.personaje) ?? '', texto: p.texto } : { nombre: '', texto: p.tipo === 'narracion' ? p.texto : '' }));

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
        const i = desde === null ? 0 : pasos.findIndex(p => p.tipo === 'transicion' && p.bloqueIndice === desde);
        this.ir(Math.max(0, i));
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.temporizador);
    clearTimeout(this.autoAvance);
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
    this.pasos.set(todos.filter(p => p.tipo !== 'entrada'));
  }

  // ------------------------------------------------------------ navegación

  ir(i: number, completo = false): void {
    const pasos = this.pasos();
    if (!pasos.length) return;
    clearTimeout(this.autoAvance);
    this.indice.set(Math.min(Math.max(0, i), pasos.length - 1));
    const p = this.paso()!;
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
    this.ir(this.indice() + 1);
  }

  /** "Finalizar": pasa a la pantalla final y avisa las opciones elegidas. */
  finalizarCaso(): void {
    const fin = this.pasos().findIndex(p => p.tipo === 'fin');
    this.ir(fin >= 0 ? fin : this.pasos().length - 1);
    this.finalizar.emit({ ...this.elegidas() });
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
    // Al volver se muestra el texto completo (ya se leyó); la transición se salta hacia atrás.
    let i = this.indice() - 1;
    if (this.pasos()[i]?.tipo === 'transicion' && i > 0) i--;
    this.ir(i, true);
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
