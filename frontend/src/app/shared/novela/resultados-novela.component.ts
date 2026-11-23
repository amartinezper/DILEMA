import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FilaResultado, ResultadosNovela, nivelDeNota, resumenPorCriterio } from './resultados';

type Filtro = 'todas' | 'aciertos' | 'fallos' | 'sin';
type Fila = FilaResultado & { clave: string; enunciadoTexto: string };

/**
 * Pantalla de resultados al terminar el caso: nota, aciertos/fallos, desempeño por criterio y la revisión
 * de cada respuesta (plegable). Solo muestra lo que recibe: no calcula si una opción es correcta.
 */
@Component({
  selector: 'app-resultados-novela',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = resultados();
    <div class="rn-columna">
      <header>
        @if (r.caso) { <p class="rn-eyebrow">{{ r.caso }}</p> }
        <h2>Resultados</h2>
        <p class="rn-sub">Finalizaste el caso. Revisa tu desempeño y la retroalimentación de cada decisión.</p>
      </header>

      <div class="rn-resumen">
        <div class="rn-tarjeta rn-nota">
          <div class="rn-nota-fila">
            <p class="rn-cifra-nota"><strong>{{ coma(r.nota) }}</strong><span>/ 5,0</span></p>
            <span class="rn-nivel" [class]="'rn-nivel rn-' + nivel()">Nivel {{ nivel() }}</span>
          </div>
          <div class="rn-barra" role="img" [attr.aria-label]="'Nota ' + coma(r.nota) + ' de 5,0'">
            <i [style.width.%]="r.nota / 5 * 100"></i></div>
          <p class="rn-pie">Nota calculada con la rúbrica del caso.</p>
        </div>
        <div class="rn-tarjeta rn-cuenta">
          <span class="rn-icono rn-ok" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>
          <strong>{{ r.aciertos }}</strong><span>Aciertos</span>
        </div>
        <div class="rn-tarjeta rn-cuenta">
          <span class="rn-icono rn-mal" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></span>
          <strong>{{ r.fallos }}</strong><span>Fallos</span>
        </div>
        <div class="rn-tarjeta rn-cuenta">
          <span class="rn-icono rn-sin" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4.5 8h7"/></svg></span>
          <strong>{{ r.sinResponder }}</strong><span>Sin responder</span>
        </div>
      </div>

      @if (criterios().length) {
        <section class="rn-tarjeta rn-criterios" aria-labelledby="titulo-criterios">
          <h3 id="titulo-criterios">Desempeño por criterio</h3>
          @for (c of criterios(); track c.criterio) {
            <div class="rn-criterio">
              <span class="rn-nombre-criterio">{{ c.criterio }}</span>
              <div class="rn-barra" aria-hidden="true">
                <i [style.width.%]="c.puntos / c.peso * 100" [class.rn-parcial]="c.puntos < c.peso"></i></div>
              <span class="rn-puntaje">{{ coma(c.puntos) }} / {{ coma(c.peso) }}</span>
            </div>
          }
        </section>
      }

      <div class="rn-revision-cabeza">
        <h3>Revisión de tus respuestas</h3>
        <div class="rn-filtros" role="group" aria-label="Filtrar respuestas">
          <button type="button" [attr.aria-pressed]="filtro() === 'todas'" (click)="filtro.set('todas')">Todas ({{ r.preguntas.length }})</button>
          <button type="button" [attr.aria-pressed]="filtro() === 'aciertos'" (click)="filtro.set('aciertos')">Aciertos ({{ r.aciertos }})</button>
          <button type="button" [attr.aria-pressed]="filtro() === 'fallos'" (click)="filtro.set('fallos')">Fallos ({{ r.fallos }})</button>
          @if (r.sinResponder) {
            <button type="button" [attr.aria-pressed]="filtro() === 'sin'" (click)="filtro.set('sin')">Sin responder ({{ r.sinResponder }})</button>
          }
        </div>
      </div>

      @for (g of grupos(); track g.numero) {
        <h4 class="rn-escena">Escena {{ g.numero }} · {{ g.nombre }}</h4>
        <ul class="rn-lista">
          @for (f of g.filas; track f.clave) {
            @let abierta = abiertas().has(f.clave);
            <li class="rn-tarjeta rn-fila" [class.rn-abierta]="abierta">
              <button type="button" class="rn-fila-cabeza" [attr.aria-expanded]="abierta" [attr.aria-controls]="'detalle-' + f.clave"
                (click)="alternar(f.clave)">
                <span class="rn-icono" [class.rn-ok]="f.acierto === true" [class.rn-mal]="f.acierto === false" [class.rn-sin]="f.acierto === null">
                  @switch (f.acierto) {
                    @case (true) { <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg><span class="rn-solo-lector">Acierto</span> }
                    @case (false) { <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg><span class="rn-solo-lector">Fallo</span> }
                    @default { <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8h7"/></svg><span class="rn-solo-lector">Sin responder</span> }
                  }
                </span>
                <span class="rn-textos">
                  <small>Pregunta {{ f.numeroPregunta }}@if (f.criterio) { · {{ f.criterio }} }</small>
                  <span class="rn-enunciado">{{ f.enunciadoTexto }}</span>
                </span>
                @if (f.peso > 0) { <span class="rn-puntaje">{{ coma(f.puntos) }} / {{ coma(f.peso) }}</span> }
                <svg class="rn-flecha" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>
              </button>
              @if (abierta) {
                <div class="rn-detalle" [id]="'detalle-' + f.clave">
                  <p class="rn-etiqueta">Tu respuesta</p>
                  <p class="rn-respuesta" [class.rn-vacia]="!f.elegida">{{ f.elegida ?? 'No respondiste esta pregunta.' }}</p>
                  @if (f.acierto !== true && f.correcta) {
                    <div class="rn-correcta">
                      <p class="rn-etiqueta">Respuesta correcta</p>
                      <p>{{ f.correcta }}</p>
                      @if (f.acierto === null && f.explicacionCorrecta) { <p class="rn-explica">{{ f.explicacionCorrecta }}</p> }
                    </div>
                  }
                  @if (f.acierto !== null && f.explicacionElegida) {
                    <p class="rn-etiqueta">Por qué</p>
                    <p>{{ f.explicacionElegida }}</p>
                  }
                  @if (f.acierto === false && f.explicacionCorrecta) {
                    <p class="rn-etiqueta">Por qué la correcta</p>
                    <p>{{ f.explicacionCorrecta }}</p>
                  }
                  @let fundamento = f.acierto === true ? f.fundamentoElegida : f.fundamentoCorrecta;
                  @if (fundamento) { <p class="rn-fundamento"><b>Fundamento:</b> {{ fundamento }}</p> }
                </div>
              }
            </li>
          }
        </ul>
      } @empty {
        <p class="rn-vacio">No hay respuestas en este filtro.</p>
      }

      <section class="rn-tarjeta rn-comentario" aria-label="Comentario del docente">
        <span class="rn-icono rn-globo" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 12.5l.8-2.4A5 5 0 1 1 6 12.3z"/></svg></span>
        <div>
          <h3>Comentario de tu docente</h3>
          <p>{{ r.retroalimentacion || 'Tu docente aún no ha dejado un comentario general. Aparecerá aquí cuando lo haga.' }}</p>
        </div>
      </section>

      <div class="rn-acciones">
        @if (textoReiniciar()) { <button type="button" (click)="reiniciar.emit()">{{ textoReiniciar() }}</button> }
        @if (textoCerrar()) { <button type="button" class="rn-principal" (click)="cerrar.emit()">{{ textoCerrar() }}</button> }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; color: #e8edf3; font-size: .95rem; line-height: 1.45;
      --fondo-tarjeta: #172234; --borde: rgba(255,255,255,.07); --acento: #7fd8c6; --falla: #f2a25c; --tenue: #9aa8b8; }
    .rn-columna { max-width: 960px; margin: 0 auto; padding: clamp(18px, 4vw, 40px) clamp(14px, 3vw, 24px) 32px; display: grid; gap: 16px; }
    :host-context(.resultados-estudiante) .rn-columna { max-width: none; }
    header { display: grid; gap: 4px; }
    .rn-eyebrow { margin: 0; font-size: .75rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--tenue); }
    h2 { margin: 0; font-size: clamp(1.6rem, 3.4vw, 2.1rem); font-weight: 800; color: #fff; }
    .rn-sub { margin: 0; color: #c3ccd7; }
    h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #fff; }
    .rn-tarjeta { background: var(--fondo-tarjeta); border: 1px solid var(--borde); border-radius: 14px; }

    .rn-resumen { display: grid; grid-template-columns: minmax(0, 2.2fr) repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rn-nota { padding: 20px 22px; background: #15302e; border-color: #2a5c55; display: grid; gap: 12px; align-content: center; }
    .rn-nota-fila { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
    .rn-cifra-nota { margin: 0; display: flex; align-items: baseline; gap: 8px; }
    .rn-cifra-nota strong { font-size: clamp(2.4rem, 6vw, 3.6rem); line-height: 1; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
    .rn-cifra-nota span { color: #c3ccd7; font-weight: 600; }
    .rn-nivel { padding: 3px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600; background: var(--acento); color: #0d2a26; white-space: nowrap; }
    .rn-nivel.rn-medio { background: #f3d27a; color: #3a2a05; }
    .rn-nivel.rn-bajo { background: var(--falla); color: #3a1a05; }
    .rn-nota .rn-pie { margin: 0; font-size: .85rem; color: #c3ccd7; }
    .rn-barra { height: 6px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
    .rn-barra i { display: block; height: 100%; border-radius: inherit; background: var(--acento); }
    .rn-barra i.rn-parcial { background: var(--falla); }
    .rn-cuenta { padding: 16px 18px; display: grid; align-content: space-between; gap: 18px; }
    .rn-cuenta strong { font-size: 1.8rem; line-height: 1; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }
    .rn-cuenta > span:last-child { margin-top: -14px; font-size: .85rem; color: #c3ccd7; }

    .rn-icono { display: inline-grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 50%; background: rgba(255,255,255,.08); }
    .rn-icono svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .rn-icono.rn-ok { background: rgba(127,216,198,.14); color: var(--acento); }
    .rn-icono.rn-mal { background: rgba(242,162,92,.16); color: var(--falla); }
    .rn-icono.rn-sin { color: var(--tenue); }

    .rn-criterios { padding: 20px 22px; display: grid; gap: 12px; }
    .rn-criterio { display: grid; grid-template-columns: minmax(120px, 30%) 1fr auto; gap: 16px; align-items: center; }
    .rn-nombre-criterio { color: #dfe5ec; }
    .rn-puntaje { font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; white-space: nowrap; }

    .rn-revision-cabeza { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; }
    .rn-filtros { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; border-radius: 999px; background: var(--fondo-tarjeta); border: 1px solid var(--borde); }
    .rn-filtros button { padding: 6px 14px; border: 0; border-radius: 999px; background: transparent; color: #dfe5ec; font: inherit; font-size: .85rem; font-weight: 600; cursor: pointer; }
    .rn-filtros button[aria-pressed="true"] { background: #f4f6f8; color: #111a2b; }
    .rn-filtros button:focus-visible, .rn-fila-cabeza:focus-visible, .rn-acciones button:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }

    .rn-escena { margin: 6px 0 -4px; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tenue); }
    .rn-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .rn-fila-cabeza { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px 20px; border: 0; background: none; color: inherit;
      font: inherit; text-align: left; cursor: pointer; border-radius: 14px; }
    .rn-textos { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .rn-textos small { font-size: .78rem; color: var(--tenue); }
    .rn-textos .rn-enunciado { font-weight: 700; color: #fff; }
    .rn-flecha { width: 16px; height: 16px; flex: none; fill: none; stroke: #c3ccd7; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform .15s; }
    .rn-abierta .rn-flecha { transform: rotate(180deg); }
    .rn-detalle { padding: 0 20px 18px 64px; display: grid; gap: 4px; }
    .rn-detalle p { margin: 0; }
    .rn-etiqueta { margin-top: 8px !important; font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #c3ccd7; }
    .rn-respuesta.rn-vacia { color: var(--tenue); font-style: italic; }
    .rn-correcta { margin-top: 8px; padding: 4px 16px 12px; border-radius: 10px; background: #1d2b40; border: 1px solid rgba(255,255,255,.09); }
    .rn-correcta .rn-etiqueta { color: var(--acento); }
    .rn-correcta .rn-explica { margin-top: 6px; color: #c3ccd7; }
    .rn-fundamento { margin-top: 10px !important; font-size: .82rem; color: var(--tenue); }
    .rn-fundamento b { color: #dfe5ec; }
    .rn-vacio { color: var(--tenue); margin: 0; }

    .rn-comentario { padding: 18px 22px; display: flex; gap: 14px; align-items: flex-start; margin-top: 6px; }
    .rn-comentario p { margin: 2px 0 0; color: #c3ccd7; }
    .rn-icono.rn-globo { color: #c3ccd7; }

    .rn-acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 8px; }
    .rn-acciones button { padding: 10px 24px; border-radius: 999px; border: 1px solid rgba(255,255,255,.25); background: transparent;
      color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
    .rn-acciones button:hover { background: rgba(255,255,255,.06); }
    .rn-acciones .rn-principal { background: #f4f6f8; color: #111a2b; border-color: #f4f6f8; }
    .rn-acciones .rn-principal:hover { background: #fff; }
    .rn-solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 720px) {
      .rn-resumen { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .rn-nota { grid-column: 1 / -1; }
      .rn-criterio { grid-template-columns: 1fr auto; gap: 6px 12px; }
      .rn-criterio .rn-barra { grid-column: 1 / -1; grid-row: 2; }
      .rn-detalle { padding-left: 20px; }
      .rn-fila-cabeza { padding: 12px 14px; gap: 10px; }
    }
  `]
})
export class ResultadosNovelaComponent {
  readonly resultados = input.required<ResultadosNovela>();
  /** Texto del botón secundario ("Volver a empezar"); vacío = sin botón. */
  readonly textoReiniciar = input<string | null>('Volver a empezar');
  /** Texto del botón principal ("Cerrar", "Volver al panel"); vacío = sin botón. */
  readonly textoCerrar = input<string | null>(null);
  readonly reiniciar = output<void>();
  readonly cerrar = output<void>();

  readonly filtro = signal<Filtro>('todas');
  /** Preguntas desplegadas (por clave "escenario:pregunta"). */
  readonly abiertas = signal<Set<string>>(new Set());

  readonly nivel = computed(() => nivelDeNota(this.resultados().nota));
  readonly criterios = computed(() => resumenPorCriterio(this.resultados().preguntas));

  private readonly filas = computed((): Fila[] => this.resultados().preguntas.map(f => ({
    ...f, clave: `${f.numeroEscenario}-${f.numeroPregunta}`, enunciadoTexto: textoPlano(f.enunciado)
  })));

  readonly grupos = computed(() => {
    const filtro = this.filtro();
    const pasa = (f: FilaResultado) => filtro === 'todas' || (filtro === 'aciertos' ? f.acierto === true
      : filtro === 'fallos' ? f.acierto === false : f.acierto === null);
    const grupos: { numero: number; nombre: string; filas: Fila[] }[] = [];
    for (const f of this.filas().filter(pasa)) {
      let g = grupos.find(x => x.numero === f.numeroEscenario);
      if (!g) grupos.push(g = { numero: f.numeroEscenario, nombre: f.escenario, filas: [] });
      g.filas.push(f);
    }
    return grupos;
  });

  constructor() {
    // Al llegar resultados nuevos: se despliegan los fallos (lo que más interesa revisar) y se muestra "Todas".
    effect(() => {
      const filas = this.filas();
      this.filtro.set('todas');
      this.abiertas.set(new Set(filas.filter(f => f.acierto === false).map(f => f.clave)));
    });
  }

  alternar(clave: string): void {
    const s = new Set(this.abiertas());
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    this.abiertas.set(s);
  }

  /** Número con coma decimal (4,3 · 0,8 · 1,6). */
  coma(n: number): string {
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  }
}

/** El enunciado viene en HTML del editor; en la lista se muestra como texto. */
function textoPlano(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // DOMParser crea un documento inerte: no carga imágenes ni ejecuta atributos del HTML.
  const d = new DOMParser().parseFromString(html, 'text/html');
  return (d.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
