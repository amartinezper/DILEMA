import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild
} from '@angular/core';
import { Visema } from './cara-vrm';
import { Asignacion, ElencoService } from './elenco.service';
import { EscenaService } from './escena.service';
import {
  BloqueNovela, CasoNovela, EmocionNovela, EscenaNovelaComponent, PersonajeNovela, slotDe
} from './escena-novela.component';
import { animaciones } from './animaciones-vrm';
import { elegirGestos } from './gestos';
import { Paso, PersonajeGuion, armarGuion, normalizar } from './guion';
import { EfectosNovelaService } from './efectos-novela.service';
import { MusicaNovelaService } from './musica-novela.service';
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
      [class.pantalla-completa]="pantallaCompleta()" [class.capa]="modoPantalla() === 'capa'" [class.girada]="girada()"
      [class.animado]="!movimientoReducido"
      [style.--pc-ancho]="pantallaAncho() + 'px'" [style.--pc-alto]="pantallaAlto() + 'px'"
      aria-label="Novela del caso. Usa Enter o Espacio para avanzar.">

      <!-- Libreta del caso: todo lo de alrededor de la escena (la escena 3D y su cuadro de diálogo no cambian). -->
      <div class="libreta" [class.velada]="!!preguntaActual() || !!finEscena()">
        <span class="anillos" aria-hidden="true">@for (a of anillos; track a) { <i></i> }</span>

        <nav class="pestanas" aria-label="Opciones del caso">
          @if (musica.disponible()) {
            <button type="button" class="pestana musica" [class.apagada]="!musica.activa()" [attr.aria-pressed]="musica.activa()"
              [attr.aria-label]="musica.activa() ? 'Silenciar música' : 'Activar música'" (click)="musica.alternar()">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path class="parlante" d="M3 7.5h3l4.5-3.5v12L6 12.5H3z" />
                @if (musica.activa()) { <path d="M13.5 7.2a4 4 0 0 1 0 5.6" /> } @else { <path d="M13.5 7.5l5 5M18.5 7.5l-5 5" /> }
              </svg>
              Música
            </button>
          }
          <button type="button" class="pestana pantalla" (click)="alternarPantalla()" [attr.aria-pressed]="pantallaCompleta()"
            aria-label="Ver el caso en pantalla completa">Pantalla</button>
          @if (mostrarSalir()) {
            <button type="button" class="pestana salir" (click)="cerrar.emit()" [attr.aria-label]="etiquetaSalir()">Salir</button>
          }
        </nav>

        <header class="cabeza">
          <p class="rotulo">Caso</p>
          <h2 class="titulo-caso">{{ caso().nombre }}</h2>
          @if (tiempoRestante() != null) {
            <strong class="reloj-libreta" [class.urgente]="tiempoRestante()! <= 60" role="timer"
              [attr.aria-label]="'Tiempo restante ' + reloj()">{{ reloj() }}</strong>
          }
        </header>

        <aside class="recorrido" aria-label="Mi recorrido">
          <button type="button" class="recorrido-boton" (click)="recorridoAbierto.set(!recorridoAbierto())"
            [attr.aria-expanded]="recorridoAbierto()">Mi recorrido <span aria-hidden="true">▾</span></button>
          <h3 class="recorrido-titulo">Mi recorrido</h3>
          <ul class="recorrido-lista" [class.abierta]="recorridoAbierto()">
            @for (r of recorrido(); track r.clave) {
              <li [class]="'paso-recorrido ' + r.estado" [attr.aria-current]="r.estado === 'actual' ? 'step' : null">
                <span class="casilla" aria-hidden="true">
                  @if (r.estado === 'hecho') { <svg viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.6" /></svg> }
                </span>
                <span class="item-texto">{{ r.texto }}</span>
                @if (r.estado === 'hecho') { <span class="solo-lector">(hecho)</span> }
              </li>
            }
          </ul>
          <p class="contador" [attr.aria-label]="'Línea ' + (indice() + 1) + ' de ' + pasos().length">{{ contador() }}</p>
        </aside>

        <figure class="foto">
          <span class="cinta cinta-izq" aria-hidden="true"></span>
          <span class="cinta cinta-der" aria-hidden="true"></span>
          <div class="lienzo" [style.max-width]="anchoMaximo()" (click)="clicEscena($event)">
            <app-escena-novela
              [caso]="casoEscena()" [bloque]="bloqueActual()" [personajes]="personajes()"
              [presentes]="reparto()" [visibles]="visibles()" [hablante]="hablante()" [boca]="boca()" [emociones]="emociones()" [gestos]="gestos()" [paso]="indice()" [escribiendo]="escribiendo()" [pausado]="escenaTapada()"
              [titulo]="nombreHablante()" [texto]="textoVisible()" [mostrarDialogo]="conDialogo()" />

            <!-- Solo en pantalla completa: reloj, música, historial y salir de pantalla completa. -->
            <div class="sobre-escena" (click)="$event.stopPropagation()">
              @if (tiempoRestante() != null) {
                <strong class="reloj" [class.urgente]="tiempoRestante()! <= 60" [attr.aria-label]="'Tiempo restante ' + reloj()">{{ reloj() }}</strong>
              }
              @if (musica.disponible()) {
                <button type="button" class="icono" (click)="musica.alternar()" [attr.aria-pressed]="musica.activa()"
                  [attr.aria-label]="musica.activa() ? 'Silenciar música' : 'Activar música'">
                  <svg viewBox="0 0 20 20" aria-hidden="true" class="parlante">
                    <path d="M3 7.5h3l4.5-3.5v12L6 12.5H3z" />
                    @if (musica.activa()) {
                      <path class="trazo" d="M13.5 7.2a4 4 0 0 1 0 5.6M15.8 5a7 7 0 0 1 0 10" />
                    } @else {
                      <path class="trazo" d="M13.5 7.5l5 5M18.5 7.5l-5 5" />
                    }
                  </svg>
                </button>
              }
              <button type="button" class="icono" [attr.aria-pressed]="historialAbierto()" aria-label="Historial"
                (click)="historialAbierto.set(!historialAbierto())">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="linea"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
              </button>
              <button type="button" class="icono" (click)="alternarPantalla()" [attr.aria-pressed]="pantallaCompleta()"
                aria-label="Salir de pantalla completa">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v2H5v4H3V3h6zm12 0v6h-2V5h-4V3h6zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z"/></svg>
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
          <figcaption class="pie-foto">{{ pieFoto() }}</figcaption>
        </figure>

        @if (avisoAnotado() && paso()?.tipo !== 'fin') {
          <div class="nota-adhesiva" role="status">
            <span class="cinta cinta-nota" aria-hidden="true"></span>
            <strong>¡Anotado!</strong>
            <p>Tu decisión quedó en la libreta.<br />La historia continúa.</p>
          </div>
        }

        <div class="pie-libreta" [class.oculto]="paso()?.tipo === 'fin' && !!resultados()">
          <div class="redondos">
            <button type="button" class="redondo historial-boton" [class.activo]="historialAbierto()"
              (click)="historialAbierto.set(!historialAbierto())" [attr.aria-expanded]="historialAbierto()" aria-label="Historial" title="Historial">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
            </button>
            <button type="button" class="redondo efectos" [class.apagado]="!efectos.activos()" (click)="efectos.alternar()"
              [attr.aria-pressed]="efectos.activos()" [attr.aria-label]="efectos.activos() ? 'Efectos de sonido activados' : 'Efectos de sonido apagados'"
              title="Efectos">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                @if (!efectos.activos()) { <path class="tachado" d="M3 3l18 18" /> }
              </svg>
            </button>
          </div>
          <div class="fichas">
            <button type="button" class="ficha atras" (click)="atras()" [disabled]="destinoAtras() === null">‹ Atrás</button>
            <button type="button" class="ficha seguir" (click)="seguir()" [disabled]="!pasos().length || paso()?.tipo === 'fin'">
              {{ paso()?.tipo === 'portada' ? 'Empezar' : 'Seguir leyendo' }} ›</button>
          </div>
        </div>
      </div>

      <!-- ¡Momento de decidir!: fichas de cartulina; elegir nunca muestra si la opción es correcta. -->
      @if (!finEscena() && preguntaActual(); as q) {
        <div class="velo-libreta" (click)="$event.stopPropagation()">
          <section class="decidir" role="group" [attr.aria-label]="'Momento de decidir, decisión ' + numeroDecision() + ' de ' + totalDecisiones()">
            <p class="decidir-rotulo">¡Momento de decidir! · {{ numeroDecision() }} de {{ totalDecisiones() }}</p>
            <div class="decidir-enunciado" [innerHTML]="q.enunciado"></div>
            @if (q.pista) { <p class="decidir-pista">{{ q.pista }}</p> }
            <div class="cartulinas" role="group" aria-label="Opciones">
              @for (o of q.opciones; track $index; let i = $index) {
                <button type="button" class="cartulina" [class.elegida]="elegida() === i" [attr.aria-pressed]="elegida() === i"
                  [style.--giro]="giros[i % giros.length]" (click)="elegirOpcion(i)">
                  <span class="cinta cinta-cartulina" aria-hidden="true"></span>
                  <span class="numero">{{ i + 1 }}.</span>
                  <span class="texto">{{ o.texto }}</span>
                  @if (elegida() === i) { <span class="sello sello-decision" aria-hidden="true">Mi decisión</span> }
                </button>
              }
            </div>
            <div class="decidir-acciones">
              <button type="button" class="ficha seguir anotar" (click)="anotar()" [disabled]="elegida() === null">Anotar mi decisión ✓</button>
              <span class="atajo-teclado">o usa {{ atajos(q.opciones.length) }} y Enter</span>
            </div>
            <div class="decidir-extra">
              @if (modoEstudiante()) {
                @if (tieneNarracion()) { <button type="button" (click)="releer()">Ver narración otra vez</button> }
                <button type="button" (click)="deshacer.emit()">Deshacer última respuesta</button>
              }
            </div>
          </section>
        </div>
      }

      <!-- Fin de escena: hoja con el sello "Completada". -->
      @if (finEscena(); as f) {
        <div class="velo-libreta" (click)="$event.stopPropagation()">
          <section class="hoja-fin" role="dialog" [attr.aria-label]="'Escena ' + f.numero + ' lista'">
            <span class="sello sello-completada" aria-hidden="true">Completada</span>
            <h3>Escena {{ f.numero }} lista</h3>
            <p>{{ f.ultima ? 'Tus decisiones quedaron anotadas. Ahora verás los resultados del caso.' : 'Tus decisiones quedaron anotadas. Verás los resultados al final del caso.' }}</p>
            <button type="button" class="ficha seguir" (click)="pasarPagina()">{{ f.ultima ? 'Ver resultados' : 'Pasar la página' }} ›</button>
          </section>
        </div>
      }

      <div class="solo-lector" aria-live="polite">{{ anuncio() }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    /*
     * Libreta del caso: hoja de cuaderno (renglones azules, margen rojo y anillos), pestañas arriba, la escena como
     * foto pegada con cinta, "Mi recorrido" a la izquierda y fichas de cartulina abajo. Caveat para lo escrito a
     * mano y Plus Jakarta Sans para leer.
     */
    .reproductor {
      --tinta: #1f3fb0; --tinta-suave: #5b6b94; --rojo: #c0294f; --azul: #2f6df6; --azul-hover: #2459d8;
      --papel: #fdfcf8; --renglon: #dfe7f7; --margen: #f2a7b6; --cinta-azul: rgba(124, 163, 255, .5); --cinta-amarilla: rgba(246, 214, 140, .85);
      --mano: 'Caveat', 'Segoe Print', cursive; --letra: 'Plus Jakarta Sans', Inter, 'Segoe UI', sans-serif;
      position: relative; outline: none; font-family: var(--letra); color: #1c2541;
    }
    .reproductor:focus-visible .libreta { box-shadow: 0 0 0 3px #9db8ff, 0 18px 40px rgba(30, 60, 140, .16); }
    .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    .libreta {
      position: relative; max-width: 1180px; margin: 22px auto 0; box-sizing: border-box;
      display: grid; grid-template-columns: 150px minmax(0, 1fr); grid-template-rows: auto auto auto;
      grid-template-areas: "recorrido cabeza" "recorrido foto" "recorrido pie";
      column-gap: 28px; padding: 26px 46px 22px 124px; border-radius: 22px; border: 1px solid #e3e9f6;
      background:
        linear-gradient(90deg, transparent 95px, var(--margen) 95px, var(--margen) 97px, transparent 97px),
        repeating-linear-gradient(180deg, transparent 0 31px, var(--renglon) 31px 32px),
        var(--papel);
      box-shadow: 0 18px 40px rgba(30, 60, 140, .16);
      transition: filter .25s ease;
    }
    .libreta.velada { filter: blur(2px); }
    .anillos { position: absolute; left: 34px; top: 52px; bottom: 40px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
    .anillos i { display: block; width: 30px; height: 11px; border-radius: 999px; background: linear-gradient(180deg, #c4cee2, #9eaccb);
      box-shadow: inset 0 -1px 0 rgba(0,0,0,.12), 0 1px 0 rgba(255,255,255,.8); }

    /* Pestañas pegadas al borde de arriba de la hoja. */
    .pestanas { position: absolute; top: -22px; right: 58px; display: flex; gap: 6px; z-index: 3; }
    .pestana { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px 10px; border: 0; border-radius: 10px 10px 0 0;
      font: 700 1.2rem/1 var(--mano); cursor: pointer; transition: transform .15s ease; }
    .pestana:hover { transform: translateY(-2px); }
    .pestana:focus-visible { outline: 2px solid var(--tinta); outline-offset: 2px; }
    .pestana svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
    .pestana svg .parlante { fill: currentColor; stroke: none; }
    .pestana.musica { background: var(--azul); color: #fff; }
    .pestana.musica.apagada { background: #dbe6ff; color: var(--tinta); }
    .pestana.pantalla { background: #fde7a6; color: #8a5a00; }
    .pestana.salir { background: #ffd3dc; color: var(--rojo); }

    .cabeza { grid-area: cabeza; position: relative; padding-right: 90px; }
    .rotulo { margin: 0 0 2px; font: 700 11px/1.2 var(--letra); letter-spacing: .14em; text-transform: uppercase; color: #6b7590; }
    .titulo-caso { margin: 0; font: 700 clamp(1.6rem, 2.6vw, 2.3rem)/1.15 var(--mano); color: var(--tinta); }
    .reloj-libreta { position: absolute; right: 0; top: 6px; font: 700 1.5rem/1 var(--mano); color: var(--tinta);
      font-variant-numeric: tabular-nums; transform: rotate(2deg); }
    .reloj-libreta::before { content: '⏱ '; font-size: 1.1rem; }
    .reloj-libreta.urgente { color: var(--rojo); }

    /* Mi recorrido: escenarios y decisiones reales del caso. */
    .recorrido { grid-area: recorrido; padding-top: 92px; position: relative; }
    .recorrido-titulo { margin: 0 0 10px; font: 700 1.35rem/1.2 var(--mano); color: var(--tinta); }
    .recorrido-boton { display: none; }
    .recorrido-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .paso-recorrido { display: flex; align-items: center; gap: 8px; font: 600 1.25rem/1.3 var(--mano); color: #9aa3b8; }
    .casilla { flex: 0 0 auto; width: 15px; height: 15px; border-radius: 3px; border: 1.5px solid #b9c2d6; background: #fff; display: grid; place-items: center; }
    .casilla svg { width: 13px; height: 13px; fill: none; stroke: var(--tinta); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .paso-recorrido.hecho { color: var(--tinta); }
    .paso-recorrido.hecho .item-texto { text-decoration: line-through; text-decoration-thickness: 1.5px; }
    .paso-recorrido.hecho .casilla { border-color: var(--tinta-suave); }
    .paso-recorrido.actual { color: var(--tinta); }
    .paso-recorrido.actual .casilla { border-color: var(--azul); background: #e6eeff; box-shadow: 0 0 0 2px rgba(47, 109, 246, .15); }
    .contador { margin: 18px 0 0; font: 600 1.25rem/1 var(--mano); color: var(--tinta-suave); letter-spacing: .06em; font-variant-numeric: tabular-nums; }

    /* La escena como foto pegada con cinta. */
    /* La foto (escena 16:9 + pie) cabe en el alto de la ventana: el resto de la libreta ocupa unos 360 px. */
    .foto { grid-area: foto; position: relative; margin: -6px 0 0; padding: 12px 12px 0; background: #fff; transform: rotate(-1.4deg);
      box-shadow: 0 2px 4px rgba(20, 40, 90, .08), 0 18px 34px rgba(20, 40, 90, .18); justify-self: center; box-sizing: border-box;
      width: min(100%, max(380px, calc((100dvh - 360px) * 16 / 9 + 24px))); }
    .lienzo { position: relative; width: 100%; margin: 0 auto; cursor: pointer; user-select: none; }
    .pie-foto { margin: 0; padding: 8px 4px 12px; font: 600 1.35rem/1.2 var(--mano); color: var(--tinta); }
    .cinta { position: absolute; width: 110px; height: 30px; background: var(--cinta-azul); z-index: 2; pointer-events: none;
      box-shadow: 0 1px 2px rgba(30, 60, 140, .08); }
    .cinta-izq { left: -38px; top: -6px; transform: rotate(-32deg); }
    .cinta-der { right: -38px; top: -6px; transform: rotate(32deg); }

    /* Pie de la hoja: historial y efectos a la izquierda; fichas Atrás y Seguir leyendo a la derecha. */
    .pie-libreta { grid-area: pie; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-top: -16px; position: relative; z-index: 2; }
    .pie-libreta.oculto { visibility: hidden; }
    .redondos { display: flex; align-items: center; gap: 10px; padding-top: 34px; }
    .redondo { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: var(--tinta);
      background: #fff; border: 1.5px dashed #9fb1d6; transition: transform .15s ease, background .15s ease; }
    .redondo:hover { transform: rotate(-6deg); }
    .redondo.activo { background: #e6eeff; border-style: solid; }
    .redondo.efectos { background: #e6eeff; border: 1.5px solid #9db8ff; }
    .redondo.efectos.apagado { background: #fff; border-style: dashed; color: #8a94ad; }
    .redondo svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    .redondo svg .tachado { stroke: var(--rojo); }
    .redondo:focus-visible, .ficha:focus-visible { outline: 3px solid #9db8ff; outline-offset: 3px; }
    .fichas { display: flex; align-items: flex-start; gap: 14px; }
    .ficha { position: relative; border: 0; cursor: pointer; font: 700 1.6rem/1 var(--mano); padding: 16px 26px 14px;
      box-shadow: 0 8px 18px rgba(20, 40, 90, .18); transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
    .ficha::before { content: ''; position: absolute; top: -9px; left: 50%; width: 46px; height: 16px; transform: translateX(-50%) rotate(-2deg); }
    .ficha.atras { background: #fff; color: var(--tinta); transform: rotate(-2deg); margin-top: 8px; }
    .ficha.atras::before { background: var(--cinta-azul); }
    .ficha.seguir { background: var(--azul); color: #fff; transform: rotate(1.5deg); padding: 20px 34px 18px; }
    .ficha.seguir::before { background: var(--cinta-amarilla); }
    .ficha:hover:not(:disabled) { transform: rotate(0) translateY(-2px); box-shadow: 0 12px 24px rgba(20, 40, 90, .22); }
    .ficha.seguir:hover:not(:disabled) { background: var(--azul-hover); }
    .ficha:disabled { opacity: .45; cursor: default; }

    /* Aviso: nota adhesiva amarilla. */
    .nota-adhesiva { position: absolute; top: 70px; right: 54px; z-index: 4; width: 200px; padding: 16px 18px 18px;
      background: linear-gradient(180deg, #fff3ad, #ffeb94); color: #3b3b2e; transform: rotate(-2.5deg);
      box-shadow: 0 10px 22px rgba(90, 70, 0, .2); }
    .nota-adhesiva strong { display: block; font: 700 1.7rem/1.1 var(--mano); color: var(--tinta); }
    .nota-adhesiva p { margin: 6px 0 0; font: 600 1.15rem/1.25 var(--mano); }
    .cinta-nota { width: 64px; height: 18px; top: -10px; left: 50%; transform: translateX(-50%) rotate(-3deg); background: rgba(255, 255, 255, .7); }

    /* Velo azul claro sobre la libreta (pregunta y fin de escena). */
    .velo-libreta { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
      overflow: auto; border-radius: 22px; background: rgba(214, 228, 255, .78); cursor: default; }
    .decidir { width: min(980px, 100%); display: grid; justify-items: center; gap: 14px; }
    .decidir-rotulo { margin: 0; font: 700 1.45rem/1 var(--mano); color: var(--rojo); transform: rotate(-2deg); }
    .decidir-enunciado { font: 800 clamp(1.25rem, 2.1vw, 1.75rem)/1.25 var(--letra); color: #16213e; text-align: center; max-width: 900px; }
    /* El enunciado llega como HTML: sus párrafos toman la letra grande de la pregunta. */
    :host ::ng-deep .decidir-enunciado :is(p, div, span, strong, em) { font: inherit; color: inherit; }
    :host ::ng-deep .decidir-enunciado > :first-child { margin-top: 0; }
    :host ::ng-deep .decidir-enunciado > :last-child { margin-bottom: 0; }
    .decidir-pista { margin: -4px 0 0; font: 600 1.2rem/1.2 var(--mano); color: var(--tinta-suave); }
    .cartulinas { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; align-items: start; margin-top: 6px; }
    .cartulina { position: relative; min-height: 196px; padding: 26px 18px 34px 52px; text-align: left; cursor: pointer; border: 3px solid transparent;
      background:
        linear-gradient(90deg, transparent 34px, var(--margen) 34px, var(--margen) 36px, transparent 36px),
        repeating-linear-gradient(180deg, transparent 0 27px, var(--renglon) 27px 28px),
        var(--papel);
      box-shadow: 0 10px 22px rgba(20, 40, 90, .16); transform: rotate(var(--giro, 0deg)); transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      font: 500 .98rem/28px var(--letra); color: #2a3350; }
    .cartulina:hover { transform: rotate(0) translateY(-4px); box-shadow: 0 16px 30px rgba(20, 40, 90, .2); }
    .cartulina.elegida { border-color: var(--azul); }
    .cartulina:focus-visible { outline: 3px solid #9db8ff; outline-offset: 3px; }
    .cartulina .numero { position: absolute; left: 12px; top: 26px; font: 700 1.5rem/1 var(--mano); color: var(--rojo); }
    .cartulina .texto { display: block; padding-top: 10px; }
    .cinta-cartulina { width: 74px; height: 22px; top: -10px; left: 50%; transform: translateX(-50%) rotate(-1deg); }
    .sello { display: inline-block; font: 800 .78rem/1 var(--letra); letter-spacing: .1em; text-transform: uppercase; border-radius: 8px; }
    .sello-decision { position: absolute; right: 10px; bottom: 10px; padding: 5px 8px; color: var(--azul); border: 2px solid var(--azul);
      background: rgba(255, 255, 255, .85); transform: rotate(-12deg); }
    .decidir-acciones { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; justify-content: center; }
    .atajo-teclado { font: 600 1.15rem/1 var(--mano); color: #4d5674; }
    .decidir-extra { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
    .decidir-extra button { border: 0; background: none; padding: 4px 6px; cursor: pointer; font: 600 1.2rem/1 var(--mano); color: var(--tinta);
      text-decoration: underline; text-decoration-color: rgba(31, 63, 176, .35); text-underline-offset: 4px; }

    .hoja-fin { position: relative; width: min(460px, 100%); padding: 34px 40px 40px; text-align: center; display: grid; justify-items: center; gap: 10px;
      background: repeating-linear-gradient(180deg, transparent 0 21px, var(--renglon) 21px 22px), var(--papel);
      box-shadow: 0 18px 40px rgba(20, 40, 90, .22); transform: rotate(-1deg); }
    .sello-completada { padding: 8px 18px; font-size: 1.3rem; color: #1f9a4f; border: 3px solid #1f9a4f; border-radius: 10px; transform: rotate(-8deg); margin-bottom: 4px; }
    .hoja-fin h3 { margin: 0; font: 700 2.3rem/1.1 var(--mano); color: var(--tinta); }
    .hoja-fin p { margin: 0 0 12px; font: 500 .92rem/1.5 var(--letra); color: #4d5674; max-width: 340px; }

    /* Animaciones (sin ellas con "reducir movimiento"). */
    .animado .velo-libreta { animation: aparecer .22s ease both; }
    .animado .decidir, .animado .hoja-fin { animation: subir .3s ease both; }
    .animado .nota-adhesiva { animation: pegar .38s cubic-bezier(.2, .9, .3, 1.3) both; }
    .animado .sello-decision { animation: sellar-decision .28s ease-out both; }
    .animado .sello-completada { animation: sellar-completada .36s ease-out .12s both; }
    @keyframes aparecer { from { opacity: 0; } }
    @keyframes subir { from { opacity: 0; transform: translateY(14px); } }
    @keyframes pegar { from { opacity: 0; transform: rotate(-9deg) translateY(-14px) scale(.92); } }
    @keyframes sellar-decision { from { opacity: 0; transform: rotate(-12deg) scale(1.9); } }
    @keyframes sellar-completada { from { opacity: 0; transform: rotate(-8deg) scale(1.8); } }
    @media (prefers-reduced-motion: reduce) {
      .ficha, .cartulina, .redondo, .pestana, .libreta { transition: none; }
    }

    /* ---- Lo que va dentro de la foto (escena): igual que antes. */
    .sobre-escena { display: none; position: absolute; top: 12px; right: 12px; z-index: 5; align-items: center; gap: 8px; }
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
    .icono svg.linea { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .icono:hover, .icono[aria-pressed="true"] { background: #1e3a5f; }
    .icono svg.parlante { fill: currentColor; }
    .icono svg .trazo { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
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
    .resultados { position: absolute; inset: 0; z-index: 2; overflow: auto; cursor: default; border-radius: 14px;
      background: rgba(13,19,30,.94); backdrop-filter: blur(3px); overscroll-behavior: contain; }
    .historial {
      position: absolute; top: 12px; right: 12px; bottom: 12px; width: min(340px, 88%); z-index: 4; display: grid;
      grid-template-rows: auto minmax(0, 1fr); overflow: hidden; border-radius: 16px; cursor: default;
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

    /* ---- Celular vertical: libreta simplificada (sin anillos, recorrido en un botón, foto a todo el ancho). */
    @media (max-width: 720px) {
      .reproductor:not(.pantalla-completa) .libreta {
        grid-template-columns: minmax(0, 1fr); grid-template-areas: "cabeza" "recorrido" "foto" "pie";
        margin-top: 26px; padding: 18px 12px 14px; border-radius: 18px; column-gap: 0;
        background: repeating-linear-gradient(180deg, transparent 0 31px, var(--renglon) 31px 32px), var(--papel);
      }
      .reproductor:not(.pantalla-completa) .anillos { display: none; }
      .pestanas { right: 14px; top: -20px; gap: 4px; }
      .pestana { padding: 6px 11px 8px; font-size: 1.05rem; }
      .cabeza { padding-right: 64px; }
      .titulo-caso { font-size: 1.5rem; }
      .reloj-libreta { font-size: 1.25rem; }
      .recorrido { padding-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 10px; z-index: 6; }
      .recorrido-titulo { display: none; }
      .recorrido-boton { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 4px 14px; border-radius: 999px;
        border: 1.5px dashed #9fb1d6; background: #fff; cursor: pointer; font: 700 1.25rem/1 var(--mano); color: var(--tinta); }
      .recorrido-lista { display: none; position: absolute; top: calc(100% + 6px); left: 0; min-width: 210px; padding: 14px 16px;
        background: var(--papel); box-shadow: 0 14px 30px rgba(20, 40, 90, .22); border: 1px solid #e3e9f6; border-radius: 12px; }
      .recorrido-lista.abierta { display: grid; }
      .contador { margin: 0; }
      .foto { margin: 10px 0 0; padding: 6px 6px 0; transform: none; width: 100%; box-sizing: border-box; }
      .lienzo { width: 100%; min-width: 0; }
      .cinta { width: 70px; height: 20px; }
      .cinta-izq { left: -18px; top: -6px; } .cinta-der { right: -18px; top: -6px; }
      .pie-foto { font-size: 1.15rem; padding: 6px 2px 8px; }
      .pie-libreta { flex-direction: column-reverse; align-items: stretch; margin-top: 14px; gap: 10px; }
      .redondos { padding-top: 0; }
      .fichas { display: grid; grid-template-columns: 1fr 1.6fr; gap: 12px; }
      .ficha { min-height: 58px; font-size: 1.5rem; padding: 12px 10px; }
      .ficha.seguir { padding: 12px 10px; }
      .ficha.atras { margin-top: 0; }
      .nota-adhesiva { top: 112px; right: 10px; width: 170px; padding: 12px 14px 14px; }
      /* En celular la pregunta y el fin de escena cubren toda la pantalla y se desplazan si no caben. */
      .reproductor:not(.pantalla-completa) .velo-libreta { position: fixed; inset: 0; z-index: 1500; padding: 18px 12px 28px;
        place-items: start center; border-radius: 0; background: rgba(214, 228, 255, .9); }
      .cartulinas { grid-template-columns: minmax(0, 1fr); gap: 14px; }
      .cartulina { min-height: 0; padding: 22px 14px 30px 48px; transform: none; }
      .hoja-fin { padding: 28px 22px 30px; }
      .historial { left: 8px; right: 8px; width: auto; top: 8px; bottom: 8px; }
    }

    /*
     * Pantalla completa (horizontal): se oculta la libreta y solo quedan la escena y dos fichas pequeñas flotantes.
     * Con pantalla completa real (Android/escritorio) el reproductor ocupa la pantalla; sin ella (iPhone) es una
     * "capa" fija del tamaño de la ventana y, si el celular está vertical, se gira 90°. La escena queda en 16:9
     * dentro del espacio libre (container queries: 100cqw/100cqh = espacio libre).
     * --seg-*: márgenes seguros (notch y barra inferior) ya orientados según el giro.
     */
    .reproductor.pantalla-completa {
      --seg-arriba: env(safe-area-inset-top, 0px); --seg-derecha: env(safe-area-inset-right, 0px);
      --seg-abajo: env(safe-area-inset-bottom, 0px); --seg-izquierda: env(safe-area-inset-left, 0px);
      --borde: 6px;
      --escena-ancho: min(100cqw, 100cqh * 16 / 9); --escena-alto: min(100cqh, 100cqw * 9 / 16);
      position: fixed; inset: 0; z-index: 2000; width: 100%; height: 100%; margin: 0;
      box-sizing: border-box; display: grid; place-items: center;
      padding: max(var(--borde), var(--seg-arriba)) max(var(--borde), var(--seg-derecha))
        max(var(--borde), var(--seg-abajo)) max(var(--borde), var(--seg-izquierda));
      background: #000; border-radius: 0; container-type: size; overscroll-behavior: contain; touch-action: manipulation;
    }
    .reproductor.capa { inset: auto; top: 0; left: 0; width: var(--pc-ancho); height: var(--pc-alto); }
    .reproductor.capa.girada {
      width: var(--pc-alto); height: var(--pc-ancho);
      transform-origin: top left; transform: translateX(var(--pc-ancho)) rotate(90deg);
      --seg-arriba: env(safe-area-inset-right, 0px); --seg-derecha: env(safe-area-inset-bottom, 0px);
      --seg-abajo: env(safe-area-inset-left, 0px); --seg-izquierda: env(safe-area-inset-top, 0px);
    }
    .reproductor.pantalla-completa .libreta { display: contents; }
    .reproductor.pantalla-completa :is(.anillos, .pestanas, .cabeza, .recorrido, .cinta-izq, .cinta-der, .pie-foto, .redondos, .nota-adhesiva) { display: none; }
    .reproductor.pantalla-completa .foto { margin: 0; padding: 0; transform: none; box-shadow: none; background: none; width: auto; }
    .reproductor.pantalla-completa .lienzo { width: var(--escena-ancho); min-width: 0; max-width: none !important; margin: 0; }
    .reproductor.pantalla-completa .sobre-escena { display: flex; top: 8px; right: 8px; gap: 6px; }
    .reproductor.pantalla-completa .icono { width: 36px; height: 36px; border-radius: 10px; }
    .reproductor.pantalla-completa .reloj { padding: 6px 10px; font-size: 13px; }
    /* Atrás y Seguir: dos fichas pequeñas flotantes, abajo a la derecha de la escena. */
    .reproductor.pantalla-completa .pie-libreta { position: absolute; z-index: 6; margin: 0;
      right: calc(max(var(--borde), var(--seg-derecha)) + (100cqw - var(--escena-ancho)) / 2 + 10px);
      bottom: calc(max(var(--borde), var(--seg-abajo)) + (100cqh - var(--escena-alto)) / 2 + 12px); }
    /* Caben en la columna que el cuadro de diálogo deja libre a la derecha (112 px). */
    .reproductor.pantalla-completa .fichas { display: flex; flex-direction: column; align-items: stretch; gap: 8px; width: 112px; }
    .reproductor.pantalla-completa .ficha { min-height: 0; font-size: 1rem; padding: 8px 4px 7px; opacity: .95; white-space: nowrap; }
    .reproductor.pantalla-completa .ficha.seguir { padding: 8px 4px 7px; }
    .reproductor.pantalla-completa .ficha::before { width: 30px; height: 10px; top: -6px; }
    .reproductor.pantalla-completa .ficha.atras { margin: 0; }
    .reproductor.pantalla-completa .historial { right: 8px; top: 52px; bottom: 8px; width: min(340px, 50%); left: auto; border-radius: 12px; }
    .reproductor.pantalla-completa .velo-libreta { border-radius: 0; padding: 12px; place-items: start center; }
    .reproductor.pantalla-completa .cartulinas { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .reproductor.pantalla-completa .cartulina { min-height: 0; padding: 18px 12px 28px 44px; font-size: .88rem; line-height: 24px; }
    .reproductor.pantalla-completa .decidir { gap: 8px; }
    .reproductor.pantalla-completa .decidir-enunciado { font-size: 1.15rem; }
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
  /** Pestaña "Salir" de la libreta (emite `cerrar`) y su etiqueta para lectores de pantalla. */
  readonly mostrarSalir = input(true);
  readonly etiquetaSalir = input('Salir del caso');

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
  /** Cómo se agrandó: pantalla completa real del navegador o capa fija (iPhone). */
  readonly modoPantalla = signal<'nativa' | 'capa' | null>(null);
  /** Capa con el celular vertical: la escena se gira 90° para verse horizontal. */
  readonly girada = signal(false);
  readonly pantallaAncho = signal(0);
  readonly pantallaAlto = signal(0);
  readonly musica = inject(MusicaNovelaService);
  readonly efectos = inject(EfectosNovelaService);
  /** Anillos de la libreta y la inclinación de cada ficha de cartulina. */
  readonly anillos = Array.from({ length: 8 }, (_, i) => i);
  readonly giros = ['-1.4deg', '1.3deg', '-0.9deg', '1.6deg', '-1.2deg'];
  /** Celular: la lista de "Mi recorrido" se abre con su botón. */
  readonly recorridoAbierto = signal(false);
  /** Hoja "Escena N lista" después de anotar la última decisión de un escenario. */
  readonly finEscena = signal<{ numero: number; ultima: boolean } | null>(null);
  /** Nota adhesiva "¡Anotado!" (unos segundos después de anotar). */
  readonly avisoAnotado = signal(false);
  private temporizadorAviso?: ReturnType<typeof setTimeout>;
  private readonly escena = viewChild(EscenaNovelaComponent);
  private entradaHistorial = false;
  private viewportOriginal: string | null = null;
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
  /** Gesto del cuerpo de cada personaje en este paso (gestos.ts: hablar, asentir, llanto, rabia…). */
  readonly gestos = computed(() => {
    const p = this.paso();
    return p ? this.gestosDe(p) : null;
  });
  /**
   * La escena queda tapada y no hace falta dibujarla: resultados al final, o el historial en celular
   * (en computador ocupa solo un lado y los personajes siguen a la vista).
   */
  readonly escenaTapada = computed(() => this.paso()?.tipo === 'fin'
    || (this.historialAbierto() && typeof window !== 'undefined' && window.innerWidth <= 720));

  private gestosDe(p: Paso) {
    return elegirGestos({
      tipo: p.tipo === 'dialogo' || p.tipo === 'narracion' ? p.tipo : 'otro',
      presentes: p.escena.presentes,
      hablante: p.tipo === 'dialogo' ? p.personaje : null,
      emocionFrase: p.tipo === 'dialogo' && p.emocion ? { emocion: p.emocion, nivel: p.nivel } : null,
      emociones: p.escena.emociones,
      reacciones: p.tipo === 'narracion' ? p.reacciones : [],
      texto: p.tipo === 'dialogo' || p.tipo === 'narracion' ? p.texto : ''
    }, this.movimientoReducido);
  }
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
  /** Contador real de líneas con dos cifras ("06 / 67"). */
  readonly contador = computed(() => {
    const dos = (n: number) => String(n).padStart(2, '0');
    const total = this.pasos().length;
    return total ? `${dos(this.indice() + 1)} / ${dos(total)}` : '';
  });
  /** Pie de la foto: escenario actual ("Escena 1 · Cafetería de la universidad"). */
  readonly pieFoto = computed(() => {
    const p = this.paso();
    if (!p || p.escena.escenario < 0) return p?.tipo === 'portada' ? 'Portada del caso' : 'Presentación del caso';
    const b = this.caso().bloques[p.escena.escenario];
    return `Escena ${p.escena.escenario + 1}${b?.nombre?.trim() ? ' · ' + b.nombre.trim() : ''}`;
  });
  /** Número de la decisión actual en todo el caso y cuántas hay ("1 de 3"). */
  readonly totalDecisiones = computed(() => this.pasos().filter(p => p.tipo === 'pregunta').length);
  readonly numeroDecision = computed(() => {
    const i = this.indice();
    return this.pasos().slice(0, i + 1).filter(p => p.tipo === 'pregunta').length;
  });
  /**
   * "Mi recorrido": cada escenario del caso y, de los ya alcanzados, sus decisiones. Hecho: el escenario ya se
   * leyó (o se pasó) y la decisión ya se anotó; actual: donde va; pendiente: lo que falta. Nunca dice si una
   * decisión fue correcta.
   */
  readonly recorrido = computed(() => {
    type Item = { clave: string; texto: string; estado: 'hecho' | 'actual' | 'pendiente' };
    const p = this.paso();
    const pasos = this.pasos();
    const elegidas = this.selecciones();
    const fin = p?.tipo === 'fin';
    const actual = p?.escena.escenario ?? -1;
    const items: Item[] = [];
    let numero = 0;
    this.caso().bloques.forEach((b, i) => {
      let estado: Item['estado'] = 'pendiente';
      if (fin || i < actual || (i === actual && p?.tipo === 'pregunta')) estado = 'hecho';
      else if (i === actual) estado = 'actual';
      items.push({ clave: `e${i}`, texto: `Escena ${i + 1}`, estado });
      for (const q of pasos) {
        if (q.tipo !== 'pregunta' || q.bloqueIndice !== i) continue;
        numero++;
        if (!fin && i > actual) continue;
        const respondida = elegidas[`${q.bloqueIndice}:${q.preguntaIndice}`] != null && p !== q;
        const esta = p === q;
        items.push({ clave: `d${i}:${q.preguntaIndice}`, texto: `Decisión ${numero}`, estado: respondida ? 'hecho' : esta ? 'actual' : 'pendiente' });
      }
    });
    return items;
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
    if (typeof window !== 'undefined') {
      // Pantalla completa real cerrada por el navegador (Esc, gesto de atrás en Android…): vuelve a la vista normal.
      const alCambiarNativa = () => {
        if (this.modoPantalla() === 'nativa' && document.fullscreenElement !== this.raiz()?.nativeElement) this.salirPantalla();
      };
      // Gesto o botón "atrás" con la escena agrandada: solo sale de pantalla completa (la página no cambia).
      const alVolver = () => {
        if (!this.entradaHistorial) return;
        this.entradaHistorial = false;
        this.salirPantalla();
      };
      // Capa (iPhone): al girar el celular o cambiar el tamaño, se recalcula si va girada y se reajusta la escena.
      const alRedimensionar = () => { if (this.modoPantalla() === 'capa') this.medirPantalla(); };
      document.addEventListener('fullscreenchange', alCambiarNativa);
      window.addEventListener('popstate', alVolver);
      window.addEventListener('resize', alRedimensionar);
      window.addEventListener('orientationchange', alRedimensionar);
      inject(DestroyRef).onDestroy(() => {
        document.removeEventListener('fullscreenchange', alCambiarNativa);
        window.removeEventListener('popstate', alVolver);
        window.removeEventListener('resize', alRedimensionar);
        window.removeEventListener('orientationchange', alRedimensionar);
      });
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizadorAviso);
    clearInterval(this.temporizador);
    clearTimeout(this.autoAvance);
    // Al cerrar el caso con la escena agrandada se deshace todo, sin tocar el historial (la página ya navega).
    this.entradaHistorial = false;
    if (this.pantallaCompleta()) this.salirPantalla();
  }

  alternarPantalla(): void {
    if (this.pantallaCompleta()) this.salirPantalla();
    else void this.entrarPantalla();
  }

  /**
   * Agrandar. Si el navegador deja (Android, escritorio): pantalla completa real del reproductor y orientación
   * horizontal bloqueada. Si no (iPhone/Safari): capa fija que cubre la pantalla y, en vertical, gira la escena 90°.
   * El avance, el reloj y la música no cambian: es el mismo reproductor con otra presentación.
   */
  async entrarPantalla(): Promise<void> {
    const el = this.raiz().nativeElement;
    this.pantallaCompleta.set(true);
    // Marca la página: oculta el menú ☰ y lo demás que es fijo (ver styles.css, "novela-agrandada").
    document.documentElement.classList.add('novela-agrandada');
    this.cubrirNotch(true);
    this.empujarHistorial();
    if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        this.modoPantalla.set('nativa');
        const orientacion = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        await orientacion?.lock?.('landscape').catch(() => undefined);
        this.reajustarEscena();
        el.focus({ preventScroll: true });
        return;
      } catch {
        // El navegador no la dio (permiso o iPhone): se usa la capa.
      }
    }
    this.modoPantalla.set('capa');
    document.documentElement.style.overflow = 'hidden';
    this.medirPantalla();
    el.focus({ preventScroll: true });
  }

  /** Vuelve a la vista normal (botón, Esc, gesto de atrás o fin de la pantalla completa real). */
  salirPantalla(): void {
    if (!this.pantallaCompleta()) return;
    const el = this.raiz()?.nativeElement;
    if (this.modoPantalla() === 'nativa') {
      try { (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.(); } catch { /* sin bloqueo */ }
      if (el && document.fullscreenElement === el) document.exitFullscreen?.().catch(() => undefined);
    }
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('novela-agrandada');
    this.modoPantalla.set(null);
    this.girada.set(false);
    this.pantallaCompleta.set(false);
    this.cubrirNotch(false);
    // Si se salió con el botón, se quita la entrada que se agregó al historial para el gesto de atrás.
    if (this.entradaHistorial) {
      this.entradaHistorial = false;
      history.back();
    }
    this.reajustarEscena();
  }

  /** Capa: tamaño de la ventana y si el celular está vertical (entonces la escena se gira). */
  private medirPantalla(): void {
    const ancho = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const alto = Math.round(window.visualViewport?.height ?? window.innerHeight);
    this.pantallaAncho.set(ancho);
    this.pantallaAlto.set(alto);
    this.girada.set(alto > ancho);
    this.reajustarEscena();
  }

  /** Recalcula el lienzo 3D cuando ya se aplicó el nuevo tamaño (al entrar, al salir y al girar). */
  private reajustarEscena(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => this.escena()?.reajustar()));
  }

  /** Entrada en el historial para que el gesto de "atrás" cierre la pantalla completa y no la página. */
  private empujarHistorial(): void {
    if (this.entradaHistorial) return;
    history.pushState({ ...(history.state ?? {}), novelaPantalla: true }, '');
    this.entradaHistorial = true;
  }

  /** viewport-fit=cover solo mientras la escena está agrandada, para que env(safe-area-inset-*) tenga valor. */
  private cubrirNotch(cubrir: boolean): void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    if (cubrir) {
      this.viewportOriginal ??= meta.content;
      if (!/viewport-fit/.test(meta.content)) meta.content = `${meta.content}, viewport-fit=cover`;
    } else if (this.viewportOriginal !== null) {
      meta.content = this.viewportOriginal;
      this.viewportOriginal = null;
    }
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
    this.finEscena.set(null);
    this.indice.set(Math.min(Math.max(0, i), pasos.length - 1));
    const p = this.paso()!;
    // Al salir del escenario cuya narración se volvió a ver, la próxima vez se vuelve a saltar.
    if (this.releyendo() !== null && p.escena.escenario !== this.releyendo()) this.releyendo.set(null);
    this.precargarAnimaciones(p.escena.escenario);
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

  /**
   * Si está escribiendo, completa la frase; si ya terminó, pasa al siguiente paso. En una pregunta, avanzar es
   * anotar la decisión elegida (ver anotar()).
   */
  avanzar(): void {
    if (this.escribiendo()) { this.terminarTexto(this.textoCompleto()); return; }
    if (this.finEscena()) { this.pasarPagina(); return; }
    if (this.paso()?.tipo === 'pregunta') { this.anotar(); return; }
    this.siguientePaso();
  }

  /** Ficha "Seguir leyendo" (y clic en la escena, Enter o →): con su sonido suave. */
  seguir(): void {
    if (this.paso()?.tipo === 'fin') return;
    this.efectos.sonar('avanzar');
    this.avanzar();
  }

  /** Ficha "Atrás" (y ←). */
  atras(): void {
    if (this.destinoAtras() === null) return;
    this.efectos.sonar('avanzar');
    this.anterior();
  }

  /** Elige una ficha de cartulina: queda marcada "Mi decisión" (nunca se dice si es correcta). */
  elegirOpcion(i: number): void {
    if (this.paso()?.tipo !== 'pregunta') return;
    this.efectos.sonar('elegir');
    this.elegir(i);
  }

  /**
   * "Anotar mi decisión": si quedan preguntas en el escenario, pasa a la siguiente con la nota "¡Anotado!"; si
   * era la última del escenario, muestra la hoja "Escena N lista" (y, si era la última del caso, lleva a los
   * resultados al pasar la página).
   */
  anotar(): void {
    const p = this.paso();
    if (p?.tipo !== 'pregunta' || this.elegida() === null) return;
    this.efectos.sonar('anotar');
    const siguiente = this.pasos()[this.indice() + 1];
    const quedanEnEscenario = siguiente?.tipo === 'pregunta' && siguiente.bloqueIndice === p.bloqueIndice;
    if (quedanEnEscenario) { this.siguientePaso(); this.mostrarAviso(); return; }
    this.finEscena.set({ numero: p.bloqueIndice + 1, ultima: this.esUltimaPregunta() });
    this.anuncio.set(`Escena ${p.bloqueIndice + 1} lista. Tus decisiones quedaron anotadas.`);
  }

  /** "Pasar la página" (o "Ver resultados" en la última escena). */
  pasarPagina(): void {
    const f = this.finEscena();
    if (!f) return;
    this.finEscena.set(null);
    this.efectos.sonar('avanzar');
    if (f.ultima) { this.finalizarCaso(); return; }
    this.siguientePaso();
    this.mostrarAviso();
  }

  private mostrarAviso(): void {
    clearTimeout(this.temporizadorAviso);
    this.avisoAnotado.set(true);
    this.temporizadorAviso = setTimeout(() => this.avisoAnotado.set(false), 4000);
  }

  /** "1, 2, 3" para el atajo de teclado de las fichas. */
  atajos(n: number): string {
    const lista = Array.from({ length: Math.min(n, 9) }, (_, i) => String(i + 1));
    return lista.join(', ');
  }

  private siguientePaso(): void {
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
    if ((evento.target as HTMLElement).closest('button, a, select, input, .historial')) return;
    if (this.paso()?.tipo === 'pregunta' || this.paso()?.tipo === 'fin' || this.finEscena()) return;   // se avanza con las fichas
    this.seguir();
  }

  tecla(evento: KeyboardEvent): void {
    const objetivo = evento.target as HTMLElement;
    const enControl = !!objetivo.closest('button, a, select, input, textarea');
    const pregunta = this.paso()?.tipo === 'pregunta' ? this.preguntaActual() : null;
    // Fichas de la pregunta: 1, 2, 3… eligen y Enter anota.
    if (pregunta && !this.finEscena() && /^[1-9]$/.test(evento.key) && Number(evento.key) <= pregunta.opciones.length) {
      evento.preventDefault(); this.elegirOpcion(Number(evento.key) - 1); return;
    }
    if ((evento.key === ' ' || evento.key === 'Enter') && !enControl) {
      evento.preventDefault();
      if (this.finEscena()) this.pasarPagina();
      else if (pregunta) { if (evento.key === 'Enter') this.anotar(); }
      else this.seguir();
    } else if (evento.key === 'ArrowRight' && !enControl && !pregunta) {
      evento.preventDefault(); this.seguir();
    } else if (evento.key === 'ArrowLeft' && !enControl) {
      evento.preventDefault(); this.atras();
    } else if (evento.key === 'Escape' && this.pantallaCompleta() && !document.fullscreenElement) {
      this.salirPantalla();
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

  private animacionesPrecargadas = new Set<number>();
  /** Precarga en segundo plano las animaciones que usarán este escenario y el siguiente (y siempre el reposo). */
  private precargarAnimaciones(escenario: number): void {
    for (const n of [escenario, escenario + 1]) {
      if (this.animacionesPrecargadas.has(n)) continue;
      this.animacionesPrecargadas.add(n);
      const categorias = new Set<string>(['reposo']);
      for (const q of this.pasos()) {
        if (q.escena.escenario !== n) continue;
        for (const g of Object.values(this.gestosDe(q))) categorias.add(g.categoria);
      }
      animaciones.precargar(categorias);
    }
  }

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
