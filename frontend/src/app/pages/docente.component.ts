import { AfterViewInit, Component, DestroyRef, Directive, ElementRef, HostListener, computed, inject, signal, viewChild, input, output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { IconoComponent, NombreIcono } from '../shared/icono.component';
import { EditorTextoComponent } from '../shared/editor-texto.component';
import { Bloque, Caso, CasoResumen, Fila, Grupo, IntentoConsultado, OpcionJuego, Participacion, ParticipacionConsultada, Persona, PreguntaJuego, Sesion, SesionRealizada, mensajeError } from '../core/api.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import type { BloqueNovela, CasoNovela, PersonajeNovela } from '../shared/novela/escena-novela.component';
import { EscenaNovelaComponent } from '../shared/novela/escena-novela.component';
import type { Asignacion } from '../shared/novela/elenco';
import { FONDOS_MANUALES } from '../shared/novela/escena.service';
import { NovelaReproductorComponent } from '../shared/novela/novela-reproductor.component';
import { ResultadosNovela, calcularResultados } from '../shared/novela/resultados';
import { MusicaNovelaService } from '../shared/novela/musica-novela.service';
import { NgTemplateOutlet } from '@angular/common';
import { PaginacionTablaComponent, paginaDe, paginaValida } from '../shared/paginacion-tabla.component';

const enlaces = [
  { href: '/docente', texto: 'Inicio', exacto: true },
  { href: '/docente/casos', texto: 'Mis casos', exacto: true },
  { href: '/docente/grupos', texto: 'Grupos', exacto: true },
  { href: '/docente/programar', texto: 'Programar', exacto: true },
  { href: '/docente/seguimiento', texto: 'Reportes' },
  { href: '/docente/perfil', texto: 'Perfil' }
];

function opcionVacia(correcta = false) {
  return { texto: '', correcta, explicacion: '', fundamento: '' };
}
function preguntaVacia() {
  return { enunciado: '', pista: '', criterio: '', peso: 0, opciones: [opcionVacia(true), opcionVacia(false)] };
}
function horaCorta(valor: string | null | undefined) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function casoVacio(): Caso {
  return {
    nombre: '', desarrolloSituacional: '', contexto: '', tiempoEstimadoMin: 30, sensible: false, advertencia: '',
    bloques: [{ nombre: 'Escenario 1', contexto: '', preguntas: [preguntaVacia()] }],
    rubrica: [],
    personajes: [1, 2, 3, 4].map((n) => ({ nombre: `Persona ${n}`, descripcion: '', escenarios: [0] })),
    repartoRubrica: 'PONDERADA'
  };
}

@Component({
  selector: 'app-panel-docente',
  imports: [IconoComponent, MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Coordina casos, grupos y sesiones desde un solo lugar.">
      <div class="pd-inicio">
        <section class="pd-kpis" aria-label="Resumen">
          <article class="pd-kpi">
            <span class="pd-icono"><app-icono nombre="documento" [tamano]="20" /></span>
            <div class="pd-kpi-texto"><h2>Casos</h2><p><strong>{{ casos().length }}</strong><span>{{ publicados() }} publicados</span></p></div>
          </article>
          <article class="pd-kpi">
            <span class="pd-icono"><app-icono nombre="personas" [tamano]="20" /></span>
            <div class="pd-kpi-texto"><h2>Grupos a tu cargo</h2><p><strong>{{ grupos().length }}</strong><span>{{ estudiantesEnGrupos() === 1 ? '1 estudiante' : estudiantesEnGrupos() + ' estudiantes' }}</span></p></div>
          </article>
          <article class="pd-kpi">
            <span class="pd-icono"><app-icono nombre="calendario" [tamano]="20" /></span>
            <div class="pd-kpi-texto"><h2>Sesiones de hoy</h2><p><strong>{{ hoy().length }}</strong><span>{{ hoyEnCurso() }} en curso</span></p></div>
          </article>
        </section>
        @if (aviso()) { <p class="error">{{ aviso() }}</p> }

        <div class="pd-columnas">
          <section class="pd-tarjeta" aria-labelledby="pd-titulo-proximas">
            <div class="pd-cabeza">
              <h2 id="pd-titulo-proximas">Próximas sesiones</h2>
              <a class="pd-enlace" routerLink="/docente/programar">Ver todas <span aria-hidden="true">›</span></a>
            </div>
            @if (proximas().length) {
              <ul class="pd-lista">
                @for (sesion of proximas(); track sesion.id) {
                  <li><a class="pd-fila pd-sesion" routerLink="/docente/programar">
                    <span class="pd-fecha" aria-hidden="true"><b>{{ dia(sesion.inicio) }}</b><small>{{ mes(sesion.inicio) }}</small></span>
                    <span class="pd-sesion-cuerpo">
                      <span class="pd-texto"><strong [title]="sesion.caso">{{ sesion.caso }}</strong><small>{{ sesion.grupo }}</small></span>
                      <span class="pd-hora">{{ horaSesion(sesion.inicio) }}</span>
                    </span>
                    <span class="solo-lector">{{ cuando(sesion.inicio) }}</span>
                  </a></li>
                }
              </ul>
            } @else {
              <p class="pd-vacio">No tienes sesiones próximas <a class="pd-enlace" routerLink="/docente/programar">Programar <span aria-hidden="true">›</span></a></p>
            }
          </section>

          <section class="pd-tarjeta" aria-labelledby="pd-titulo-flujo">
            <div class="pd-cabeza"><h2 id="pd-titulo-flujo">Flujo de trabajo</h2></div>
            <ul class="pd-lista">
              @for (paso of pasos; track paso.titulo) {
                <li><a class="pd-fila pd-paso" [routerLink]="paso.enlace">
                  <span class="pd-icono"><app-icono [nombre]="paso.icono" [tamano]="20" /></span>
                  <span class="pd-texto"><strong>{{ paso.titulo }}</strong><small>{{ paso.frase }}</small></span>
                  <span class="pd-flecha" aria-hidden="true">›</span>
                </a></li>
              }
            </ul>
          </section>
        </div>
      </div>
    </app-marco-docente>
  `,
  styles: [`
    .pd-inicio { position: relative; z-index: 1; display: grid; gap: 20px; container-type: inline-size; min-width: 0; }
    .pd-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .pd-kpi { display: flex; align-items: center; gap: 14px; min-height: 72px; min-width: 0; box-sizing: border-box; padding: 14px 18px;
      background: #fff; border: 1px solid #e6edf8; border-radius: 18px; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .pd-icono { flex: none; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: #eef4ff; color: #1f5cf0; }
    .pd-icono app-icono { display: grid; }
    .pd-kpi-texto { min-width: 0; }
    .pd-kpi h2 { margin: 0; font-size: 12.5px; font-weight: 600; line-height: 1.3; color: #7a86a3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pd-kpi p { margin: 0; display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .pd-kpi strong { font-size: 24px; font-weight: 800; line-height: 1.15; color: var(--dl-tinta); }
    .pd-kpi p span { font-size: 12.5px; color: #7a86a3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .pd-columnas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: stretch; }
    .pd-tarjeta { min-width: 0; padding: 18px 18px 10px; background: #fff; border: 1px solid #e6edf8; border-radius: 18px;
      box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .pd-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
    .pd-cabeza h2 { margin: 0; font-size: 16px; font-weight: 800; color: var(--dl-tinta); }
    .pd-enlace { flex: none; color: #1f5cf0; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .pd-enlace:hover { text-decoration: underline; }
    .pd-lista { list-style: none; margin: 0; padding: 0; }
    .pd-lista li + li { border-top: 1px solid #f0f4fa; }
    .pd-fila { display: flex; align-items: center; gap: 14px; min-width: 0; padding: 12px 8px; margin: 0 -8px; border-radius: 12px;
      color: inherit; text-decoration: none; }
    .pd-fila:hover { background: #f8fbff; }
    .pd-fila:focus-visible, .pd-enlace:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }
    .pd-texto { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .pd-texto strong { font-size: 14px; color: var(--dl-tinta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pd-texto small { font-size: 12.5px; color: #7a86a3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pd-sesion-cuerpo { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
    .pd-sesion-cuerpo .pd-texto { flex: 1 1 150px; }
    .pd-sesion strong { font-weight: 600; }
    .pd-paso strong { font-weight: 700; }
    .pd-fecha { flex: none; width: 52px; height: 52px; display: grid; place-content: center; justify-items: center; border-radius: 14px; background: #f3f7fe; }
    .pd-fecha b { font-size: 18px; font-weight: 800; line-height: 1.1; color: var(--dl-tinta); }
    .pd-fecha small { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #1f5cf0; }
    .pd-hora { flex: none; padding: 5px 10px; border-radius: 999px; background: #eef4ff; color: #1747c2; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
    .pd-flecha { flex: none; font-size: 22px; line-height: 1; color: #b3c0da; }
    .pd-paso:hover .pd-flecha { color: #1f5cf0; }
    .pd-vacio { margin: 0; padding: 22px 0 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 13.5px; color: #6b7690; }

    @container (max-width: 640px) {
      .pd-kpis, .pd-columnas { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 767.98px) {
      .pd-kpis { grid-template-columns: minmax(0, 1fr); gap: 12px; }
      .pd-columnas { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .pd-tarjeta { padding: 16px 14px 8px; }
      .pd-sesion-cuerpo .pd-texto { flex-basis: 220px; }
      .pd-hora { padding: 3px 9px; }
      .pd-paso small { white-space: normal; }
    }
  `]
})
export class PanelDocenteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private busqueda = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  sesiones = signal<Sesion[]>([]);
  grupos = signal<Grupo[]>([]);
  aviso = signal('');
  readonly pasos: { titulo: string; frase: string; icono: NombreIcono; enlace: string }[] = [
    { titulo: 'Diseñar', frase: 'Crea un caso con su historia y sus decisiones', icono: 'documento', enlace: '/docente/casos/nuevo' },
    { titulo: 'Agrupar', frase: 'Abre grupos y matricula estudiantes', icono: 'personas', enlace: '/docente/grupos' },
    { titulo: 'Convocar', frase: 'Agenda un caso publicado con un grupo', icono: 'calendario', enlace: '/docente/programar' },
    { titulo: 'Seguir', frase: 'Bitácora en vivo y reportes', icono: 'grafica', enlace: '/docente/seguimiento' }
  ];
  constructor() { this.refrescar(); }
  refrescar() {
    this.http.get<CasoResumen[]>('/api/docente/casos').subscribe((dato) => this.casos.set(dato));
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => this.sesiones.set(dato));
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => this.grupos.set(dato));
  }
  moverSesion(id: number, verbo: 'iniciar' | 'finalizar') {
    this.aviso.set('');
    this.http.post(`/api/docente/sesiones/${id}/${verbo}`, {}).subscribe({
      next: () => this.refrescar(),
      error: (falla) => this.aviso.set(mensajeError(falla))
    });
  }
  nombre() {
    const completo = this.auth.usuario()?.nombre ?? '';
    return completo.trim().split(/\s+/)[0] || 'docente';
  }
  casosVisibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return this.casos().filter((caso) => !q || caso.nombre.toLowerCase().includes(q)).slice(0, 6);
  }
  publicados() {
    return this.casos().filter((caso) => caso.estado === 'PUBLICADO').length;
  }
  hoy() { return this.sesiones().filter((sesion) => this.mismoDia(sesion.inicio)); }
  /** Sesiones de hoy que están en curso (la línea de la tarjeta "Sesiones de hoy"). */
  hoyEnCurso() { return this.hoy().filter((sesion) => sesion.estado === 'EN_CURSO').length; }
  /** Estudiantes distintos matriculados en los grupos del docente. */
  estudiantesEnGrupos() { return new Set(this.grupos().flatMap((g) => (g.estudiantes ?? []).map((e) => e.id))).size; }
  etiquetaEstado(estado: string) {
    if (estado === 'EN_CURSO') return 'En curso';
    if (estado === 'FINALIZADO') return 'Finalizada';
    return 'Sin iniciar';
  }
  proximas() { return this.sesiones().filter((sesion) => sesion.estado !== 'FINALIZADO' && !this.mismoDia(sesion.inicio)).slice(0, 4); }
  hora(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      .replace(/\s*p\.\s*m\./i, '\u00a0p.m.')
      .replace(/\s*a\.\s*m\./i, '\u00a0a.m.');
  }
  cuando(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  /** Cuadrito de fecha de "Próximas sesiones": "25" y "NOV". */
  dia(iso: string) {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? '—' : String(fecha.getDate());
  }
  mes(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleString('es-CO', { month: 'short' }).replace('.', '').toUpperCase();
  }
  /** "5:26 p. m." */
  horaSesion(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s+/g, '\u00a0');
  }
  private mismoDia(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return false;
    const hoy = new Date();
    return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth() && fecha.getDate() === hoy.getDate();
  }
}

/** Paginación de Mis casos, Grupos y Programar: "1–6 de 14" y ‹ 1 2 3 ›. Solo pagina en el navegador. */
@Component({
  selector: 'app-paginacion-gp',
  imports: [IconoComponent],
  template: `
    @if (total() > 0) {
      <nav class="gp-paginacion" [class.simple]="simple()" [attr.aria-label]="'Paginación de ' + que()">
        <p class="gp-pag-texto">{{ prefijo() }}{{ desde() }}–{{ hasta() }} de {{ total() }}{{ sufijo() }}</p>
        @if (paginas() > 1) {
          <div class="gp-pag-botones">
            @if (flechas()) {
              <button type="button" class="gp-pag" [disabled]="pagina() === 1" (click)="cambiar.emit(pagina() - 1)"
                [attr.aria-label]="'Página anterior de ' + que()">
                <app-icono nombre="atras" [tamano]="18" />
              </button>
            }
            @for (n of numeros(); track n) {
              <button type="button" class="gp-pag" [class.actual]="n === pagina()" [attr.aria-current]="n === pagina() ? 'page' : null"
                [attr.aria-label]="'Página ' + n" (click)="cambiar.emit(n)">{{ n }}</button>
            }
            @if (flechas()) {
              <button type="button" class="gp-pag" [disabled]="pagina() === paginas()" (click)="cambiar.emit(pagina() + 1)"
                [attr.aria-label]="'Página siguiente de ' + que()">
                <app-icono nombre="flecha" [tamano]="18" />
              </button>
            }
          </div>
        }
      </nav>
    }
  `,
  styles: [`
    .gp-paginacion { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .gp-pag-texto { margin: 0; font-size: 13px; color: #6b7690; }
    .gp-pag-botones { display: flex; gap: 6px; }
    .gp-pag { width: 32px; height: 32px; display: inline-grid; place-items: center; border-radius: 8px; border: 1px solid #e6ecf6;
      background: #fff; color: #1a2744; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
    .gp-pag svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .gp-pag:hover:not(:disabled):not(.actual) { border-color: #9fb0d0; }
    .gp-pag.actual { background: var(--dl-degradado); border-color: var(--dl-azul-fuerte); color: #fff; }
    .gp-pag:disabled { opacity: .45; cursor: default; }
    .gp-pag:focus-visible { outline: 3px solid rgba(59,108,255,.35); outline-offset: 2px; }
    .simple .gp-pag-texto { font-size: 12.5px; color: #7a86a3; }
    .simple .gp-pag-botones { gap: 4px; }
    .simple .gp-pag { width: 30px; height: 30px; border-color: transparent; background: transparent; color: #4d5b7c; font-size: 13px; transform: none; }
    .simple .gp-pag:hover:not(.actual):not(:disabled) { border-color: transparent; background: #f3f6fc; }
    .simple .gp-pag svg { width: 13px; height: 13px; }
    .simple .gp-pag.actual { background: var(--gp-pag-activa, #fff); border-color: var(--gp-pag-activa-borde, #e3eaf6); color: #1f5cf0; }
  `]
})
export class PaginacionGpComponent {
  readonly total = input(0);
  readonly pagina = input(1);
  readonly porPagina = input(10);
  /** Qué se pagina (para los textos de accesibilidad): "grupos", "estudiantes"… */
  readonly que = input('resultados');
  readonly prefijo = input('');
  readonly sufijo = input('');
  /** Cuántos números de página se ven a la vez (en la columna angosta de grupos, 3). */
  readonly maxNumeros = input(5);
  /** Números sin cajas: la página activa en blanco con el número azul (Mis casos y Grupos). */
  readonly simple = input(false);
  readonly flechas = input(true);
  readonly cambiar = output<number>();
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  readonly desde = computed(() => this.total() ? (this.pagina() - 1) * this.porPagina() + 1 : 0);
  readonly hasta = computed(() => Math.min(this.total(), this.pagina() * this.porPagina()));
  /** Unos pocos números alrededor de la página actual. */
  readonly numeros = computed(() => {
    const total = this.paginas(), actual = this.pagina(), max = Math.max(1, this.maxNumeros());
    const inicio = Math.max(1, Math.min(actual - Math.floor(max / 2), total - max + 1));
    return Array.from({ length: Math.min(max, total) }, (_, i) => inicio + i);
  });
}

/** Página de una lista (desde 1). */
function paginar<T>(lista: T[], pagina: number, porPagina: number): T[] {
  return lista.slice((pagina - 1) * porPagina, pagina * porPagina);
}

/** Estilos que comparten Grupos y Programar (prefijo gp- para no chocar con los globales). */
const ESTILOS_GP = `
  .gp { display: grid; gap: 18px; min-width: 0; max-width: 100%; box-sizing: border-box; overflow: visible; }
  .gp-titulo { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 16px; min-width: 0; max-width: 100%; }
  .gp-titulo > div { min-width: 0; flex: 1 1 auto; }
  .gp-titulo h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: #1a2744; }
  .gp-titulo p { margin: 4px 0 0; font-size: 14px; color: #6b7894; }
  .gp-tarjeta { background: #fff; border: 1px solid #e6ecf6; border-radius: 14px; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
  .gp-btn { min-height: 36px; padding: 0 16px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; text-decoration: none; flex: 0 0 auto; }
  .gp-btn-oscuro { background: var(--dl-degradado); color: #fff; border: 1px solid var(--dl-azul-fuerte); font-weight: 700; }
  .gp-btn-oscuro:hover { filter: brightness(1.06); }
  .gp-btn-borde { background: #fff; color: var(--dl-azul); border: 1.5px solid var(--dl-azul); font-weight: 650; }
  .gp-btn-borde:hover { background: #f2f6ff; }
  .gp-btn-peligro { background: #fff; color: #b42318; border: 1px solid #f1c4bf; font-weight: 600; }
  .gp-btn-peligro:hover { background: #fff5f4; }
  .gp-btn-peligro-solido { background: #b42318; color: #fff; border: 1px solid #b42318; }
  .gp-btn-pildora { border-radius: 999px; }
  .gp-btn-chico { min-height: 36px; padding: 0 12px; font-size: 13px; }
  .gp-btn:focus-visible, .gp-tarjeta button:focus-visible, .gp-tarjeta a:focus-visible {
    outline: 3px solid rgba(59, 108, 255, .35); outline-offset: 2px; }
  .gp-campo { display: grid; gap: 6px; min-width: 0; }
  .gp-campo > span { font-size: 13px; font-weight: 650; color: #33415c; }
  .gp-campo input, .gp-campo select, .gp-campo textarea { width: 100%; box-sizing: border-box; min-height: 42px; padding: 0 14px;
    border: 1px solid #d5dbe7; border-radius: 12px; background: #fff; color: #1a2744; font: inherit; font-size: 14px; }
  .gp-campo textarea { min-height: 84px; padding: 12px 14px; resize: vertical; }
  .gp-campo input::placeholder, .gp-campo textarea::placeholder, .gp-buscar input::placeholder { color: #8a93a8; }
  .gp-campo input:focus, .gp-campo select:focus, .gp-campo textarea:focus, .gp-buscar input:focus {
    outline: none; border-color: #3b6cff; box-shadow: 0 0 0 3px rgba(59, 108, 255, .18); }
  .gp-ayuda { margin: 0; font-size: 12.5px; color: #6b7690; }
  .gp-buscar { position: relative; display: block; }
  .gp-buscar svg { position: absolute; left: 14px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%);
    fill: none; stroke: #6b7690; stroke-width: 1.8; stroke-linecap: round; pointer-events: none; }
  .gp-buscar input { width: 100%; box-sizing: border-box; min-height: 40px; padding: 0 14px 0 40px; border: 1px solid #e6ecf6;
    border-radius: 999px; background: #fff; color: #1a2744; font: inherit; font-size: 13px; }
  .gp-error { margin: 0; padding: 12px 16px; border-radius: 12px; background: #fff1f0; color: #9b1c12; border: 1px solid #f6cdc8; }
  .gp-ok { margin: 0; padding: 12px 16px; border-radius: 12px; background: #ecf8f1; color: #17603f; border: 1px solid #c6e9d5; }
  .gp-tabla-marco { border: 1px solid #e6ecf6; border-radius: 14px; overflow: hidden; background: #fff; }
  .gp-tabla-scroll { overflow-x: auto; }
  .gp-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
  .gp-tabla th { padding: 12px 16px; text-align: left; font-size: 12.5px; font-weight: 650;
    color: #6b778f; background: #fafbfe; border-bottom: 1px solid #edf1f8; white-space: nowrap; }
  .gp-tabla td { padding: 11px 16px; border-bottom: 1px solid #f0f3f9; color: var(--dl-tinta); vertical-align: middle; white-space: nowrap; }
  .gp-tabla tr:last-child td { border-bottom: 0; }
  .gp-tabla .gp-dc { text-align: right; white-space: nowrap; overflow-wrap: normal; width: 1%; }
  .gp-vacio { color: #6b7690; }
  .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

type FiltroCaso = 'TODOS' | 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';
const ETIQUETA_CASO: Record<string, string> = { BORRADOR: 'Borrador', PUBLICADO: 'Publicado', ARCHIVADO: 'Archivado' };

@Component({
  selector: 'app-casos',
  imports: [IconoComponent, MarcoDocenteComponent, RouterLink, FormsModule, PaginacionGpComponent],
  host: { '(document:click)': 'cerrarMenu()', '(document:keydown.escape)': 'cerrarMenu(true)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" [compacto]="true" descripcion="Diseña, publica y reabre el editor de cada caso.">
      @if (!puedeEditar()) {
        <p class="gp-error">La administración debe asignarte el permiso Editar para guardar o publicar casos.</p>
      }
      @if (error()) { <p class="gp-error" role="alert">{{ error() }}</p> }
      @if (ok()) { <p class="gp-ok" role="status">{{ ok() }}</p> }

      <div class="mc-contenido">
        <!-- Pestañas de estado a la izquierda; buscador y "+ Crear caso" a la derecha. -->
        <div class="mc-barra">
          <div class="mc-pestanas" role="group" aria-label="Filtrar por estado">
            @for (f of filtros; track f.valor) {
              <button type="button" class="mc-pestana" [class.activa]="filtroEstado() === f.valor" [attr.aria-pressed]="filtroEstado() === f.valor"
                (click)="filtrar(f.valor)">
                {{ f.texto }} <span class="mc-cuenta">{{ conteo(f.valor) }}</span>
              </button>
            }
          </div>
          <div class="mc-acciones">
            <label class="mc-buscar">
              <app-icono nombre="buscar" [tamano]="16" />
              <span class="solo-lector">Buscar caso por nombre</span>
              <input type="search" placeholder="Buscar" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
            </label>
            <a class="adm-boton mc-crear" routerLink="/docente/casos/nuevo"><app-icono nombre="mas" [tamano]="18" /> Crear caso</a>
          </div>
        </div>

        @if (!visibles().length) {
          <p class="mc-vacio">{{ cargando() ? 'Cargando casos…' : busqueda().trim() || filtro.texto().trim() ? 'Ningún caso coincide con la búsqueda.' : filtroEstado() === 'TODOS' ? 'Todavía no tienes casos.' : 'No hay casos en este estado.' }}</p>
        } @else {
          <!-- Clic en la fila: abre el editor; el "⋯" no. -->
          <ul class="mc-filas">
            @for (caso of paginaCasos(); track caso.id) {
              <li class="mc-fila" [attr.data-estado]="caso.estado" (click)="abrir(caso)">
                <div class="mc-fila-texto">
                  <a class="mc-nombre" [routerLink]="['/docente/casos', caso.id]" (click)="$event.stopPropagation()" [title]="caso.nombre">{{ caso.nombre }}</a>
                  <small>{{ caso.bloques }} {{ caso.bloques === 1 ? 'escenario' : 'escenarios' }} · {{ caso.preguntas }} {{ caso.preguntas === 1 ? 'pregunta' : 'preguntas' }} · {{ caso.tiempoEstimadoMin }} min</small>
                </div>
                <span class="mc-estado" [attr.data-estado]="caso.estado"><i aria-hidden="true"></i>{{ etiqueta(caso.estado) }}</span>
                <div class="mc-menu-ancla" (click)="$event.stopPropagation()">
                  <button type="button" class="mc-mas" [id]="'mc-mas-' + caso.id" aria-haspopup="menu"
                    [attr.aria-expanded]="menuAbierto() === caso.id" [attr.aria-label]="'Más acciones de ' + caso.nombre"
                    (click)="alternarMenu(caso.id, $event)">
                    <app-icono nombre="puntos" [tamano]="20" />
                  </button>
                  @if (menuAbierto() === caso.id) {
                    <div class="mc-menu" role="menu" [attr.aria-label]="'Acciones de ' + caso.nombre" (keydown)="teclaMenu($event)"
                      [style.top.px]="menuPos().top" [style.bottom.px]="menuPos().bottom" [style.right.px]="menuPos().right">
                      <a role="menuitem" [routerLink]="['/docente/casos', caso.id]">Abrir editor</a>
                      <button type="button" role="menuitem" (click)="duplicar(caso)">Duplicar</button>
                      @if (puedePublicar(caso)) { <button type="button" role="menuitem" (click)="transicion(caso, 'publicar')">Publicar</button> }
                      @if (puedeVolverBorrador(caso)) { <button type="button" role="menuitem" (click)="transicion(caso, 'despublicar')">Volver a borrador</button> }
                      @if (puedeArchivar(caso)) { <button type="button" role="menuitem" class="peligro" (click)="transicion(caso, 'archivar')">Archivar</button> }
                    </div>
                  }
                </div>
                <span class="mc-flecha" aria-hidden="true"><app-icono nombre="flecha" [tamano]="18" /></span>
              </li>
            }
          </ul>
          <app-paginacion-gp class="mc-paginacion" [total]="visibles().length" [pagina]="paginaActual()" [porPagina]="porPagina"
            [simple]="true" [flechas]="false" prefijo="Mostrando " que="casos" (cambiar)="pagina.set($event)" />
        }
      </div>
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    .mc-contenido { position: relative; z-index: 1; display: grid; gap: 8px; min-width: 0; }

    /* Barra: pestañas, buscador y "+ Crear caso" en una sola línea, con la línea fina debajo. */
    .mc-barra { display: flex; align-items: center; gap: 16px; min-width: 0; border-bottom: 1px solid #e3eaf6; }
    .mc-pestanas { align-self: stretch; display: flex; gap: 28px; min-width: 0; }
    .mc-pestana { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 -1px; padding: 0; border: 0; border-bottom: 2px solid transparent;
      background: none; color: #4d5b7c; font: inherit; font-size: 13.5px; font-weight: 600; white-space: nowrap; cursor: pointer; box-shadow: none; }
    .mc-pestana:hover, .mc-pestana:active { color: var(--dl-tinta); transform: none; }
    .mc-pestana.activa { color: var(--dl-tinta); border-bottom-color: #1f5cf0; }
    .mc-cuenta { min-width: 18px; padding: 1px 6px; box-sizing: border-box; border-radius: 999px; font-size: 11.5px; font-weight: 700;
      line-height: 16px; text-align: center; color: #9aa6c0; background: #edf1f8; }
    .mc-pestana.activa .mc-cuenta { color: #fff; background: #1f5cf0; }
    .mc-acciones { margin-left: auto; display: flex; align-items: center; gap: 20px; padding-bottom: 8px; flex: 0 0 auto; }
    .mc-buscar { display: flex; align-items: center; gap: 8px; width: 170px; height: 40px; color: #7a86a3; border-bottom: 1px solid transparent; }
    .mc-buscar:focus-within { border-bottom-color: #1f5cf0; }
    .mc-buscar svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .mc-barra .mc-buscar input[type="search"] { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; border-radius: 0; background: transparent;
      box-shadow: none; outline: none; font: inherit; font-size: 13.5px; color: var(--dl-tinta); }
    .mc-barra .mc-buscar input[type="search"]::placeholder { color: #7a86a3; }
    .mc-crear { flex: none; }

    /* Filas sin tarjeta: nombre y datos, estado, "⋯" y "›". */
    .mc-filas { list-style: none; margin: 0; padding: 0; }
    .mc-fila { display: grid; grid-template-columns: minmax(0, 1fr) 96px auto auto; grid-template-areas: "texto estado mas flecha";
      align-items: center; gap: 8px 12px; padding: 15px 8px 15px 6px; border-bottom: 1px solid #eaf0f8; border-radius: 12px; cursor: pointer;
      transition: background .12s ease; }
    .mc-fila:hover { background: #fff; }
    .mc-fila-texto { grid-area: texto; display: grid; gap: 3px; min-width: 0; }
    .mc-nombre { min-width: 0; font-size: 14.5px; font-weight: 700; line-height: 1.35; color: var(--dl-tinta); text-decoration: none;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mc-fila-texto small { font-size: 12.5px; color: #7a86a3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mc-estado { grid-area: estado; display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #5b6b8c; white-space: nowrap; }
    .mc-estado i { width: 7px; height: 7px; border-radius: 50%; flex: none; background: #9fb2d6; }
    .mc-estado[data-estado="PUBLICADO"] { color: #17683d; }
    .mc-estado[data-estado="PUBLICADO"] i { background: #22a55a; }
    .mc-flecha { grid-area: flecha; display: grid; place-items: center; color: #b3c0da; transition: color .12s ease; }
    .mc-flecha svg { width: 16px; height: 16px; }
    .mc-fila:hover .mc-flecha { color: #1f5cf0; }
    .mc-paginacion { display: block; padding-top: 14px; }
    .mc-nombre:focus-visible, .mc-mas:focus-visible, .mc-menu a:focus-visible, .mc-pestana:focus-visible, .mc-crear:focus-visible {
      outline: 3px solid #7aa7ff; outline-offset: 2px; border-radius: 6px; }

    .mc-menu-ancla { grid-area: mas; position: relative; }
    .mc-mas { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent;
      color: #8a97b4; cursor: pointer; box-shadow: none; }
    .mc-mas:hover, .mc-mas[aria-expanded="true"] { background: #e6eefc; color: var(--dl-tinta); transform: none; }
    /* Fijo a la ventana: no lo recorta el panel. */
    .mc-menu { position: fixed; z-index: 50; min-width: 180px; padding: 4px; display: grid; gap: 2px; cursor: default;
      background: #fff; border: 1px solid #e6ecf6; border-radius: 10px; box-shadow: 0 8px 20px rgba(16, 24, 40, .10); }
    .mc-menu a, .mc-menu button { min-height: 36px; display: flex; align-items: center; padding: 0 12px; text-align: left; border: 0;
      border-radius: 7px; background: transparent; color: var(--dl-tinta); font: inherit; font-size: 13.5px; font-weight: 600; text-decoration: none; cursor: pointer; }
    .mc-menu a:hover, .mc-menu button:hover, .mc-menu button:focus-visible { background: #f2f6ff; outline: none; }
    .mc-menu .peligro { color: #a4271b; }
    .mc-menu .peligro:hover { background: #fdf1f0; }
    .mc-vacio { margin: 0; padding: 36px 12px; text-align: center; color: #5b6782; border: 1px dashed #d6deec; border-radius: 14px; background: #fff; }
    @media (max-width: 767.98px) {
      /* Celular: pestañas deslizables con la línea fina; debajo, buscador y "+ Crear caso" a lo ancho. */
      .mc-barra { flex-direction: column; align-items: stretch; gap: 10px; border-bottom: 0; }
      .mc-pestanas { gap: 22px; height: 42px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; border-bottom: 1px solid #e3eaf6; }
      .mc-pestanas::-webkit-scrollbar { display: none; }
      .mc-pestana { flex: none; margin-bottom: 0; }
      .mc-acciones { margin-left: 0; flex-direction: column; align-items: stretch; gap: 10px; padding-bottom: 0; }
      .mc-buscar { width: 100%; border-bottom-color: #e3eaf6; }
      .mc-crear { width: 100%; }
      /* Fila: nombre (hasta 2 líneas) y datos; el estado en otra línea; "⋯" y "›" a la derecha. */
      .mc-fila { grid-template-columns: minmax(0, 1fr) auto auto; grid-template-areas: "texto mas flecha" "estado mas flecha";
        gap: 6px 4px; padding: 14px 4px 14px 6px; }
      .mc-nombre { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
      .mc-fila-texto small { white-space: normal; }
    }
  `]
})
export class CasosComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly filtro = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  cargando = signal(true);
  error = signal('');
  ok = signal('');
  /** Pestañas de estado, búsqueda y menú "⋯" (en el navegador, con lo que ya llegó del backend). */
  readonly filtros: { valor: FiltroCaso; texto: string }[] = [
    { valor: 'TODOS', texto: 'Todos' }, { valor: 'PUBLICADO', texto: 'Publicados' },
    { valor: 'BORRADOR', texto: 'Borradores' }, { valor: 'ARCHIVADO', texto: 'Archivados' }
  ];
  readonly porPagina = 7;
  pagina = signal(1);
  filtroEstado = signal<FiltroCaso>('TODOS');
  busqueda = signal('');
  menuAbierto = signal<number | null>(null);
  /** Posición del menú "⋯" (fijo a la ventana, para que la lista no lo recorte). */
  menuPos = signal<{ top: number | null; bottom: number | null; right: number }>({ top: null, bottom: null, right: 0 });
  /** "Todos" son publicados y borradores; los archivados solo salen en su pestaña. */
  private delEstado(c: CasoResumen, estado: FiltroCaso) { return estado === 'TODOS' ? c.estado !== 'ARCHIVADO' : c.estado === estado; }
  conteo(estado: FiltroCaso) { return this.casos().filter((c) => this.delEstado(c, estado)).length; }
  /** Pestaña y búsqueda por nombre; siempre los más recientes primero (el backend no envía fecha: el id más alto es el último creado). */
  readonly visibles = computed(() => {
    const q = (this.busqueda() + ' ' + this.filtro.texto()).trim().toLowerCase();
    const estado = this.filtroEstado();
    return this.casos()
      .filter((c) => this.delEstado(c, estado) && (!q || q.split(/\s+/).every((t) => c.nombre.toLowerCase().includes(t))))
      .sort((a, b) => b.id - a.id);
  });
  readonly paginaActual = computed(() => paginaValida(this.pagina(), this.visibles().length, this.porPagina));
  readonly paginaCasos = computed(() => paginaDe(this.visibles(), this.paginaActual(), this.porPagina));
  puedeEditar() { return this.auth.puede('EDITAR'); }
  constructor() { this.cargar(); }
  etiqueta(estado: string) { return ETIQUETA_CASO[estado] ?? estado; }
  filtrar(estado: FiltroCaso) { this.filtroEstado.set(estado); this.pagina.set(1); }
  /** Clic en la fila: abre el editor (el "⋯" y el nombre detienen el clic). */
  abrir(caso: CasoResumen) { this.router.navigate(['/docente/casos', caso.id]); }
  // Mismas reglas que los botones del editor.
  puedePublicar(c: CasoResumen) { return this.auth.puede('EDITAR') && (c.estado === 'BORRADOR' || c.estado === 'ARCHIVADO'); }
  puedeVolverBorrador(c: CasoResumen) { return this.auth.puede('EDITAR') && c.estado === 'PUBLICADO'; }
  puedeArchivar(c: CasoResumen) { return this.auth.puede('EDITAR') && c.estado === 'PUBLICADO'; }
  alternarMenu(id: number, evento?: MouseEvent) {
    const abrir = this.menuAbierto() !== id;
    if (abrir && evento) {
      // Abre hacia abajo, o hacia arriba si no cabe; alineado al borde derecho del botón.
      const b = (evento.currentTarget as HTMLElement).getBoundingClientRect();
      const abajo = innerHeight - b.bottom > 200;
      this.menuPos.set({ top: abajo ? b.bottom + 4 : null, bottom: abajo ? null : innerHeight - b.top + 4, right: innerWidth - b.right });
      // Al desplazar la página el menú se cerraría lejos de su botón: se cierra.
      document.addEventListener('scroll', () => this.menuAbierto.set(null), { capture: true, once: true });
    }
    this.menuAbierto.set(abrir ? id : null);
    if (abrir) setTimeout(() => document.querySelector<HTMLElement>('.mc-menu [role="menuitem"]')?.focus());
  }
  cerrarMenu(devolverFoco = false) {
    const id = this.menuAbierto();
    if (id === null) return;
    this.menuAbierto.set(null);
    if (devolverFoco) document.getElementById('mc-mas-' + id)?.focus();
  }
  teclaMenu(evento: KeyboardEvent) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    evento.preventDefault();
    const items = Array.from(document.querySelectorAll<HTMLElement>('.mc-menu [role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (evento.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  }
  /** Igual que "Duplicar" en el editor: crea la copia y abre su editor. */
  duplicar(caso: CasoResumen) {
    this.menuAbierto.set(null);
    this.http.post<Caso>(`/api/docente/casos/${caso.id}/duplicar`, {}).subscribe({
      next: (dato) => this.router.navigate(['/docente/casos', dato.id]),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  /** Publicar, volver a borrador o archivar: los mismos endpoints que el editor. */
  transicion(caso: CasoResumen, accion: 'publicar' | 'despublicar' | 'archivar') {
    this.menuAbierto.set(null);
    this.error.set('');
    this.http.post<Caso>(`/api/docente/casos/${caso.id}/${accion}`, {}).subscribe({
      next: () => {
        this.ok.set(accion === 'publicar' ? 'Caso publicado.' : accion === 'archivar' ? 'Caso archivado.' : 'El caso volvió a borrador.');
        this.cargar();
      },
      error: (falla) => { this.ok.set(''); this.error.set(mensajeError(falla)); }
    });
  }
  private cargar() {
    this.http.get<CasoResumen[]>('/api/docente/casos').subscribe({
      next: (dato) => {
        this.casos.set(dato);
        this.cargando.set(false);
      },
      error: (falla) => { this.cargando.set(false); this.error.set(mensajeError(falla)); }
    });
  }
}

/** movida: el docente la arrastró (si no, la escena reparte a los personajes sola). */
interface PersonaEscena { id: string; nombre: string; color: string; x: number; y: number; movida?: boolean; }
interface AyudaDescripcion { genero: string; edad: string; rol: string; }

/** Roles de las listas de ayuda: texto femenino y masculino que se escribe en la descripción. */
const ROLES_AYUDA = [
  { id: 'madre', f: 'madre', m: 'padre' }, { id: 'abuela', f: 'abuela', m: 'abuelo' }, { id: 'hija', f: 'hija', m: 'hijo' },
  { id: 'nina', f: 'niña', m: 'niño' }, { id: 'estudiante', f: 'la estudiante', m: 'el estudiante' },
  { id: 'docente', f: 'la docente', m: 'el docente' }, { id: 'medica', f: 'médica', m: 'médico' },
  { id: 'enfermera', f: 'enfermera', m: 'enfermero' }, { id: 'psicologa', f: 'psicóloga', m: 'psicólogo' },
  { id: 'trabajadora', f: 'trabajadora social', m: 'trabajador social' }, { id: 'policia', f: 'la policía', m: 'el policía' },
  { id: 'comisaria', f: 'comisaria de familia', m: 'comisario de familia' }, { id: 'vecina', f: 'vecina', m: 'vecino' }
];
/** Roles que ya implican un género (si no se eligió género en la lista). */
const GENERO_DEL_ROL: Record<string, string> = { madre: 'mujer' };

/** Caja de texto que empieza en una línea y crece con lo escrito. `edTope` limita el alto y luego hace scroll. */
@Directive({ selector: 'textarea[edCrece]' })
export class CreceDirective implements AfterViewInit {
  private readonly el = inject(ElementRef<HTMLTextAreaElement>);
  readonly edTope = input<string>('');

  ngAfterViewInit() {
    this.ajustar();
    queueMicrotask(() => this.ajustar());
    setTimeout(() => this.ajustar());
  }

  @HostListener('input')
  ajustar() {
    const nodo = this.el.nativeElement;
    const tope = Number(this.edTope()) || 0;
    nodo.style.height = 'auto';
    const alto = nodo.scrollHeight;
    nodo.style.height = `${tope > 0 ? Math.min(alto, tope) : alto}px`;
    nodo.style.overflowY = tope > 0 && alto > tope ? 'auto' : 'hidden';
  }
}

@Component({
  selector: 'app-editor-caso',
  host: { '(document:click)': 'menuAcciones.set(false)', '(document:keydown.escape)': 'menuAcciones.set(false)' },
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink, EditorTextoComponent, EscenaNovelaComponent,
    NovelaReproductorComponent, NgTemplateOutlet, CreceDirective],
  styles: [`
    .personaje-fila { display: grid; gap: 12px; }
    .ayudas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 0; }
    .ayudas select { min-width: 0; width: 100%; padding: 8px 10px; font: inherit; font-size: .85rem; border: 1px solid #e1e9f6; border-radius: 12px; background: #f8fbff; }
    .personaje-pie { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; }
    .aparece { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: .85rem; }
    .aparece .chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid var(--dl-borde, #cfd8ee); background: #fff; color: var(--dl-tinta, #0a1733); border-radius: 999px; cursor: pointer; font-weight: 650; }
    .entendido { font-size: .8rem; color: #5b6b8c; font-weight: 600; }
    .entendido.falta { color: #8b93a7; font-weight: 400; }
    .escena-controles { flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .acciones-editor { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .campo-cabeza { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .insertar { padding: 0 16px; height: 34px; font: inherit; font-size: 13px; border: 1.5px solid var(--dl-azul); border-radius: 999px; background: #fff; color: var(--dl-azul); cursor: pointer; font-weight: 650; display: inline-flex; align-items: center; box-shadow: none; }
    .form-dialogo { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; padding: 12px; border-radius: 16px; background: #fff; border: 1px solid var(--line, #e6ebf5); }
    .form-dialogo select, .form-dialogo input { padding: 8px 10px; font: inherit; border: 1px solid var(--line, #e6ebf5); border-radius: 12px; }
    .form-dialogo input { flex: 1 1 220px; min-width: 0; }
    .form-dialogo button { padding: 0 16px; height: 36px; font: inherit; font-size: 13px; border: 0; border-radius: 999px; background: var(--dl-degradado, #2563eb); color: #fff; cursor: pointer; font-weight: 700; box-shadow: none; }
    .form-dialogo button:last-child { background: #fff; color: var(--dl-azul); border: 1.5px solid var(--dl-azul); }
    .ayuda-dialogo { display: block; margin-top: 4px; font-size: .78rem; color: #6b7280; }
    /* Libreta del caso: fondo azul claro; la libreta trae sus pestañas (Música, Pantalla, Salir). */
    .modal-vista { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: #d8e5ff; color: #1c2541; }
    .modal-cuerpo { flex: 1; overflow: auto; padding: 18px 22px 22px; }
    .ed { min-width: 0; max-width: 100%; }
    .ed-barra {
      display: flex; align-items: center; justify-content: space-between; gap: 12px 16px;
      background: #fff; border: 1px solid #e6edf8; border-radius: 18px; padding: 14px 20px; min-width: 0;
    }
    .ed-barra-acciones { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .ed-barra-acciones > * { transform: none; }
    .ed-cuerpo { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 16px; align-items: start; min-width: 0; }
    .ed-pasos {
      display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 10px;
      background: #fff; border: 1px solid #e6edf8; border-radius: 18px; min-width: 0;
    }
    .tablero-caso .ed-pasos button {
      display: flex !important; align-items: center; justify-content: flex-start !important; gap: 10px;
      width: 100%; height: auto !important; min-height: 44px; padding: 8px 10px !important; margin: 0;
      border: 0 !important; border-radius: 12px !important; background: transparent !important; box-shadow: none !important;
      color: #1a2744 !important; font-size: 13.5px !important; font-weight: 700 !important; text-align: left; white-space: normal;
      transform: none !important;
    }
    .tablero-caso .ed-pasos button:hover { background: #f6f9ff !important; transform: none !important; }
    .tablero-caso .ed-pasos button.activa { background: #eef4ff !important; color: #1747c2 !important; border-color: transparent !important; }
    .ed-num {
      width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 50%;
      background: #eef2f9; color: #4d5b7c; font-size: 12px; font-weight: 800;
    }
    .ed-pasos button.activa .ed-num { background: #1f5cf0; color: #fff; }
    .ed-paso-nombre { min-width: 0; line-height: 1.25; }
    .ed-panel {
      background: #fff; border: 1px solid #e6edf8; border-radius: 18px; padding: 18px 20px 22px; min-width: 0;
    }
    .ed-panel .caso-vista { gap: 20px; }
    .ed-panel .caso-titulo { display: grid; gap: 4px; padding-bottom: 14px; margin: 0; border-bottom: 1px solid #f0f4fa; }
    .ed-panel .caso-titulo.ed-titulo-fila { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .ed-panel .caso-titulo h2 {
      margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.02em; text-transform: none; color: #1a2744;
    }
    .ed-panel .caso-titulo .sub, .ed-panel .sub { margin: 0; font-size: 14px; line-height: 1.45; color: #6b7894; }
    .ed-panel .caso-casilla {
      background: transparent; border: 0; border-radius: 0; box-shadow: none; padding: 0; gap: 14px; min-width: 0;
    }
    .ed-panel h3.ed-seccion {
      margin: 0 !important; font-size: 12px !important; font-weight: 700 !important; letter-spacing: .04em !important;
      text-transform: uppercase !important; color: #6b7894 !important;
    }
    .ed-bloque-titulo { font-size: 15px; font-weight: 700; color: #1a2744; line-height: 1.3; }
    .ed-lista { display: grid; gap: 12px; min-width: 0; }
    .ed-barra-paso { display: flex; justify-content: flex-end; }
    .ed-enlace {
      border: 0 !important; background: transparent !important; box-shadow: none !important;
      padding: 0 !important; height: auto !important; min-height: 0 !important; width: auto !important;
      color: #1f5cf0 !important; font: inherit; font-size: 13px !important; font-weight: 650 !important;
      cursor: pointer; white-space: nowrap;
    }
    .ed-enlace:hover { text-decoration: underline; transform: none !important; }
    .ed-fila-nombre { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 14px; }
    .ed-criterio-peso { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 14px; align-items: start; }
    .ed-par { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
    .ed-persona-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 14px; }
    .ed-panel .caso-etiqueta,
    .ed-panel label span {
      color: #4d5b7c !important; font-size: 12.5px !important; font-weight: 600 !important;
      text-transform: none !important; letter-spacing: 0 !important; line-height: 1.3;
    }
    .ed-panel .caso-campo input:not([type="checkbox"]):not([type="radio"]),
    .ed-panel .caso-campo select,
    .ed-panel .ayudas select,
    .ed-panel .caso-campo textarea,
    .ed-panel .editor-area {
      font-size: 14px !important; line-height: 1.45; color: #1a2744;
    }
    .ed-panel .caso-campo input:not([type="checkbox"]):not([type="radio"]),
    .ed-panel .caso-campo select,
    .ed-panel .ayudas select {
      height: 40px !important; background: #f8fbff !important; border: 1px solid #e1e9f6 !important;
      border-radius: 12px !important; box-shadow: none !important; padding: 0 12px !important; box-sizing: border-box;
    }
    .ed-panel .caso-campo textarea,
    .ed-panel textarea.ed-crece {
      background: #f8fbff !important; border: 1px solid #e1e9f6 !important; border-radius: 12px !important;
      box-shadow: none !important; box-sizing: border-box; width: 100%;
    }
    .ed-panel textarea.ed-crece {
      display: block; min-height: 40px !important; height: 40px; padding: 9px 12px !important;
      line-height: 20px !important; resize: none !important; overflow: hidden;
    }
    .ed-panel .editor { border: 1px solid #e1e9f6 !important; border-radius: 14px !important; box-shadow: none !important; overflow: hidden; background: #fff; }
    .ed-panel .editor-area {
      min-height: 104px !important; max-height: 320px; overflow: auto; padding: 12px 14px; line-height: 1.45;
    }
    .ed-panel .editor-bar { background: #f8fbff; }
    .ed-editor-bloque { display: grid; gap: 4px; min-width: 0; }
    .ed-editor-bloque .ayuda-dialogo { margin: 0 !important; }
    .ed-editor-plano {
      border: 1px solid #e1e9f6; border-radius: 14px; overflow: hidden; background: #fff; min-width: 0;
      display: flex; flex-direction: column;
    }
    .ed-editor-plano .editor-bar {
      display: flex; justify-content: flex-end; align-items: center; min-height: 36px; padding: 4px 8px;
      background: #f8fbff; border-bottom: 1px solid #e1e9f6;
    }
    .ed-panel .ed-editor-plano textarea.ed-crece {
      display: block; width: 100%; border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
      background: #fff !important; resize: none !important; min-height: 104px !important; height: auto; max-height: 320px;
      padding: 12px 14px !important; font-size: 14px !important; line-height: 1.45 !important;
    }
    .ed-panel .insertar {
      height: 28px !important; min-height: 28px !important; padding: 0 12px !important; border-radius: 999px !important;
      border: 1.5px solid #1f5cf0 !important; background: #fff !important; color: #1f5cf0 !important;
      box-shadow: none !important; font-size: 12px !important; font-weight: 700 !important;
    }
    .ed-panel .insertar:hover { background: #f2f6ff !important; transform: none !important; }
    .ed-sensible { background: #fff8ec; border: 1px solid #f6e3bf; border-radius: 12px; padding: 12px 14px; }
    .ed-quitar {
      display: inline-flex !important; align-items: center; gap: 6px;
      border: 0 !important; background: transparent !important; box-shadow: none !important;
      padding: 0 !important; height: auto !important; min-height: 0 !important; width: auto !important;
      color: #6b7894 !important; font: inherit; font-size: 13px !important; font-weight: 650 !important;
      cursor: pointer; white-space: nowrap;
    }
    .ed-quitar:hover { color: #4d5b7c !important; transform: none !important; }
    .ed-quitar svg { display: block; flex: none; }
    .ed-agregar {
      width: 100%; min-height: 48px; padding: 12px 16px;
      border: 1.5px dashed #1f5cf0 !important; border-radius: 14px !important; background: #f8fbff !important; color: #1747c2 !important;
      box-shadow: none !important; font: inherit; font-size: 14px !important; font-weight: 700 !important; cursor: pointer;
    }
    .ed-agregar:hover { background: #eef4ff !important; transform: none !important; }
    .ed-suave {
      display: inline-flex !important; align-items: center; justify-content: center;
      min-height: 36px; height: auto !important; width: auto !important; padding: 0 16px !important;
      border: 0 !important; border-radius: 999px !important; background: #eef4ff !important; color: #1747c2 !important;
      box-shadow: none !important; font: inherit; font-size: 13.5px !important; font-weight: 700 !important; cursor: pointer;
    }
    .ed-suave:hover { background: #e3edff !important; transform: none !important; }
    .ed-acordeon, .ed-panel .ed-persona, .ed-panel .ed-boceto {
      border: 1px solid #e6edf8; border-radius: 16px; background: #fff; min-width: 0;
    }
    .ed-panel .ed-persona, .ed-panel .ed-boceto { display: grid; gap: 14px; padding: 14px 16px; }
    .ed-acordeon-cabeza { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 12px; padding: 12px 14px; min-width: 0; }
    .ed-acordeon-toggle {
      flex: 1 1 200px; min-width: 0; display: flex; align-items: flex-start; gap: 8px;
      border: 0; background: transparent; box-shadow: none; padding: 0; margin: 0; height: auto; min-height: 0;
      text-align: left; cursor: pointer; color: inherit; font: inherit;
    }
    .ed-acordeon-toggle:hover { transform: none; }
    .ed-acordeon-textos { min-width: 0; display: grid; gap: 2px; flex: 1; }
    .ed-preview { font-size: 13px; color: #6b7894; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ed-acordeon-lado { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px 10px; margin-left: auto; max-width: 100%; }
    .ed-acordeon-cuerpo { display: grid; gap: 14px; padding: 0 14px 14px; min-width: 0; }
    .ed-chevron { width: 16px; height: 16px; flex: none; margin-top: 2px; color: #6b7894; transition: transform .15s ease; }
    .ed-chevron.abierto { transform: rotate(90deg); }
    .ed-chevron-abajo { transform: rotate(90deg); }
    .ed-chevron-abajo.abierto { transform: rotate(-90deg); }
    .ed-chip {
      display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px;
      background: #eef2f9; color: #4d5b7c; font-size: 12px; font-weight: 700; white-space: nowrap;
    }
    .ed-chip-alerta { background: #fff1e0; color: #b45309; }
    .ed-contexto { background: #f4f7fb; border-radius: 12px; padding: 10px 12px; min-width: 0; }
    .ed-contexto-btn {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
      border: 0; background: transparent; box-shadow: none; padding: 0; margin: 0; height: auto; min-height: 0;
      color: #4d5b7c; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; text-align: left;
    }
    .ed-contexto-btn:hover { transform: none; }
    .ed-contexto-cuerpo { margin-top: 8px; color: #3d4b68; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
    :host ::ng-deep .ed-contexto-cuerpo p,
    :host ::ng-deep .ed-contexto-cuerpo ul,
    :host ::ng-deep .ed-contexto-cuerpo ol { margin: 0 0 8px; }
    :host ::ng-deep .ed-contexto-cuerpo :last-child { margin-bottom: 0; }
    .ed-opciones { display: grid; gap: 12px; }
    .ed-panel .caso-subgrupo {
      display: grid; gap: 14px; padding: 12px 14px; border: 1px solid #e6edf8; border-radius: 16px;
      background: #fff; box-shadow: none; min-width: 0;
    }
    .ed-panel .caso-subgrupo.ed-correcta { background: #f6fcf8; border-color: #bfe8cf; }
    .ed-opcion-linea { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; align-items: start; }
    .ed-letra {
      width: 28px; height: 28px; margin-top: 24px; display: grid; place-items: center; border-radius: 50%;
      background: #eef2f9; color: #1a2744; font-size: 13px; font-weight: 800;
    }
    .ed-opcion-linea .check { margin-top: 26px; white-space: nowrap; }
    .ed-reparto-linea { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
    .ed-reparto {
      display: inline-flex; gap: 4px; padding: 4px; width: max-content; max-width: 100%;
      background: #f4f7fb; border-radius: 12px;
    }
    .ed-reparto button {
      height: 36px; min-height: 36px; padding: 0 16px; border: 0; border-radius: 10px;
      background: transparent; color: #4d5b7c; box-shadow: none; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .ed-reparto button.activa { background: #1f5cf0; color: #fff; }
    .ed-reparto button:hover { transform: none; }
    .ed-tabla { display: grid; min-width: 0; }
    .ed-tabla-cabeza, .ed-tabla-fila, .ed-tabla-total {
      display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.4fr) 120px; gap: 12px; align-items: center; min-width: 0;
    }
    .ed-tabla-cabeza {
      padding-bottom: 8px; color: #4d5b7c; font-size: 12.5px; font-weight: 600; letter-spacing: 0;
    }
    .ed-tabla-fila, .ed-tabla-total { padding: 12px 0; border-top: 1px solid #f0f4fa; }
    .ed-tabla-fila span, .ed-tabla-cabeza span { min-width: 0; overflow-wrap: anywhere; }
    .ed-tabla-fila .ed-criterio { color: #6b7894; font-size: 14px; }
    .ed-panel .ed-tabla-fila input {
      height: 40px !important; width: 120px !important; text-align: right; font-size: 14px !important;
      background: #f8fbff !important; border: 1px solid #e1e9f6 !important; border-radius: 12px !important;
      box-shadow: none !important; padding: 0 12px !important; box-sizing: border-box;
    }
    .ed-tabla-total strong { width: 120px !important; text-align: right; font-size: 14px; }
    .ed-tabla-total span { grid-column: 1 / 3; text-align: right; font-weight: 700; color: #1a2744; }
    .ed-tabla-total strong { font-weight: 800; }
    .ed-panel .ed-estado-actual {
      background: #f8fbff; border: 1px solid #e6edf8; border-radius: 16px; padding: 16px; gap: 12px;
    }
    .ed .ficha-estado-cabeza h3.ed-bloque-titulo {
      margin: 0; flex: 1 1 180px; font-size: 15px !important; font-weight: 700 !important;
      text-transform: none !important; letter-spacing: 0 !important; color: #1a2744;
    }
    .ed-panel .ficha-estado { border-top: 0; padding-top: 0; }
    @media (max-width: 1099.98px) {
      .ed-cuerpo { grid-template-columns: minmax(0, 1fr); }
      .ed-pasos { flex-direction: row; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .tablero-caso .ed-pasos button { width: auto; flex: 0 0 auto; }
      .ed-paso-nombre { white-space: nowrap; }
    }
    @media (max-width: 767.98px) {
      .ed-barra { flex-direction: column; align-items: stretch; }
      .ed-barra-acciones { display: grid; grid-template-columns: 1fr 1fr; }
      .ed-barra-acciones > * { width: 100% !important; min-width: 0; }
      .ed-fila-nombre, .ed-criterio-peso, .ed-par, .ed-opcion-linea, .ed-persona-grid, .ayudas,
      .ed-tabla-cabeza, .ed-tabla-fila, .ed-tabla-total { grid-template-columns: minmax(0, 1fr); }
      .ed-tabla-total span { grid-column: auto; text-align: left; }
      .ed-tabla-fila input, .ed-tabla-total strong { width: 120px !important; }
      .ed-letra, .ed-opcion-linea .check { margin-top: 0; }
      .ed-panel .resumen-cifras { grid-template-columns: minmax(0, 1fr); max-width: none; }
      .modal-cuerpo { padding: 8px; }
    }
  `],
  template: `
    <app-marco-docente [enlaces]="enlaces" [descripcion]="descripcionEditor()">
      <section class="tablero tablero-caso ed">
        <div class="ed-barra">
          <a class="adm-volver" routerLink="/docente/casos"><span aria-hidden="true">‹</span> Volver a mis casos</a>
          <div class="ed-barra-acciones">
            <button class="adm-boton-contorno" type="button" (click)="abrirVistaPrevia($any($event.currentTarget))">Vista previa</button>
            <button class="btn-suave" type="button" (click)="vistaPrevia.set(!vistaPrevia())">Previsualizar</button>
            @if (!bloqueado()) { <button class="btn-oscuro" type="button" (click)="guardar()">Guardar borrador</button> }
          </div>
        </div>
        @if (!puedeEditar()) {
          <p class="error">La administración debe asignarte el permiso Editar para guardar o publicar este caso.</p>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (ok()) { <p class="ok">{{ ok() }}</p> }
        <div class="ed-cuerpo">
        <div class="pasos ed-pasos">
          @for (paso of pasos; track paso.id; let i = $index) {
            <button type="button" [class.activa]="activo() === paso.id" (click)="irA(paso.id)">
              <span class="ed-num">{{ i + 1 }}</span>
              <span class="ed-paso-nombre">{{ paso.texto }}</span>
            </button>
          }
        </div>
        <div class="ed-panel">

        @if (activo() === 'estructura') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Información general</h2>
              <p class="sub">Nombre, desarrollo y contexto del caso.</p>
            </header>
            <section class="caso-casilla">
              <h3 class="ed-seccion">Datos del caso</h3>
              <div class="ed-fila-nombre">
                <label class="caso-campo">
                  <span class="caso-etiqueta">Nombre</span>
                  <input [(ngModel)]="caso.nombre" [disabled]="bloqueado()" />
                </label>
                <label class="caso-campo ed-tiempo">
                  <span class="caso-etiqueta">Tiempo estimado (min)</span>
                  <input type="number" [(ngModel)]="caso.tiempoEstimadoMin" [disabled]="bloqueado()" />
                </label>
              </div>
              <div class="caso-casilla-check ed-sensible">
                <label class="check"><input type="checkbox" [(ngModel)]="caso.sensible" [disabled]="bloqueado()" /> <span>Contenido sensible (el estudiante verá una advertencia)</span></label>
              </div>
              @if (caso.sensible) {
                <label class="caso-campo">
                  <span class="caso-etiqueta">Advertencia</span>
                  <textarea [(ngModel)]="caso.advertencia" [disabled]="bloqueado()" placeholder="Texto que verá el estudiante antes de entrar"></textarea>
                </label>
              }
            </section>
            <section class="caso-casilla">
              <h3 class="ed-seccion">Desarrollo situacional</h3>
              <div class="ed-editor-bloque">
                @if (insertando() === 'desarrollo') {
                  <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: 'desarrollo' }" />
                }
                <app-editor #editorDesarrollo [(valor)]="caso.desarrolloSituacional" [bloqueado]="bloqueado()">
                  @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertar('desarrollo')">Insertar diálogo</button> }
                </app-editor>
                <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
              </div>
            </section>
            <section class="caso-casilla">
              <h3 class="ed-seccion">Contexto</h3>
              <app-editor [(valor)]="caso.contexto" [bloqueado]="bloqueado()" />
            </section>
          </div>
        }

        @if (activo() === 'escenas') {
          <div class="caso-vista">
            <header class="caso-titulo ed-titulo-fila">
              <div>
                <h2>Escenas y contexto</h2>
                <p class="sub">Cada escena lleva su contexto. Las decisiones se arman en el siguiente paso.</p>
              </div>
              @if (caso.bloques.length) {
                <button type="button" class="ed-enlace" (click)="alternarTodasEscenas()">{{ todasEscenasAbiertas() ? 'Cerrar todo' : 'Abrir todo' }}</button>
              }
            </header>
            <div class="ed-lista">
              @for (bloque of caso.bloques; track $index) {
                <section class="ed-acordeon">
                  <div class="ed-acordeon-cabeza">
                    <button type="button" class="ed-acordeon-toggle" (click)="alternarEscena($index)" [attr.aria-expanded]="escenaAbierta($index)">
                      <svg class="ed-chevron" [class.abierto]="escenaAbierta($index)" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <span class="ed-acordeon-textos">
                        <span class="ed-bloque-titulo">{{ $index + 1 }} · {{ bloque.nombre || 'Escenario' }}</span>
                        @if (!escenaAbierta($index) && primeraLinea(bloque.contexto)) {
                          <span class="ed-preview">{{ primeraLinea(bloque.contexto) }}</span>
                        }
                      </span>
                    </button>
                    @if (!bloqueado()) {
                      <button class="ed-quitar" type="button" (click)="quitarBloque($index)">
                        <ng-container *ngTemplateOutlet="iconoBasura" /> Quitar escenario
                      </button>
                    }
                  </div>
                  @if (escenaAbierta($index)) {
                    <div class="ed-acordeon-cuerpo">
                      <label class="caso-campo">
                        <span class="caso-etiqueta">Nombre del escenario</span>
                        <input [(ngModel)]="bloque.nombre" [disabled]="bloqueado()" />
                      </label>
                      <div class="caso-campo">
                        <span class="caso-etiqueta">Contexto situacional</span>
                        <div class="ed-editor-bloque">
                          @if (insertando() === 'bloque-' + $index) {
                            <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: { bloque: $index } }" />
                          }
                          <app-editor #editorBloque [(valor)]="bloque.contexto" [bloqueado]="bloqueado()">
                            @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertarBloque($index, editorBloque)">Insertar diálogo</button> }
                          </app-editor>
                          <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
                        </div>
                      </div>
                    </div>
                  }
                </section>
              }
            </div>
            @if (!bloqueado()) {
              <button class="ed-agregar" type="button" (click)="agregarBloque()">Agregar escenario académico</button>
            }
          </div>
        }

        @if (activo() === 'preguntas') {
          <div class="caso-vista">
            @if (totalPreguntas()) {
              <div class="ed-barra-paso">
                <button type="button" class="ed-enlace" (click)="alternarTodasPreguntas()">{{ todasPreguntasAbiertas() ? 'Cerrar todo' : 'Abrir todo' }}</button>
              </div>
            }
            @for (bloque of caso.bloques; track $index; let b = $index) {
              <section class="caso-casilla">
                <h3 class="ed-seccion">Escenario {{ b + 1 }} · {{ bloque.nombre || 'Escenario' }}</h3>
                @if (primeraLinea(bloque.contexto)) {
                  <div class="ed-contexto">
                    <button type="button" class="ed-contexto-btn" (click)="alternarContexto(b)" [attr.aria-expanded]="contextoAbierto(b)">
                      <span>Ver contexto del escenario</span>
                      <svg class="ed-chevron ed-chevron-abajo" [class.abierto]="contextoAbierto(b)" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    @if (contextoAbierto(b)) {
                      <div class="ed-contexto-cuerpo" [innerHTML]="contextoHtml(bloque.contexto)"></div>
                    }
                  </div>
                }
                <div class="ed-lista">
                  @for (pregunta of bloque.preguntas; track $index; let p = $index) {
                    <section class="ed-acordeon">
                      <div class="ed-acordeon-cabeza">
                        <button type="button" class="ed-acordeon-toggle" (click)="alternarPregunta(b, p)" [attr.aria-expanded]="preguntaAbierta(b, p)">
                          <svg class="ed-chevron" [class.abierto]="preguntaAbierta(b, p)" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          <span class="ed-acordeon-textos">
                            <span class="ed-bloque-titulo">Pregunta {{ p + 1 }}</span>
                            @if (primeraLinea(pregunta.enunciado)) {
                              <span class="ed-preview">{{ primeraLinea(pregunta.enunciado) }}</span>
                            }
                          </span>
                        </button>
                        <div class="ed-acordeon-lado">
                          <span class="ed-chip">Peso {{ pesoCorto(pregunta.peso) }}</span>
                          <span class="ed-chip">{{ textoOpciones(pregunta.opciones.length) }}</span>
                          @if (sinCorrecta(pregunta)) { <span class="ed-chip ed-chip-alerta">Sin correcta</span> }
                          @if (!bloqueado()) {
                            <button class="ed-quitar" type="button" (click)="quitarPregunta(bloque, p)">
                              <ng-container *ngTemplateOutlet="iconoBasura" /> Quitar pregunta
                            </button>
                          }
                        </div>
                      </div>
                      @if (preguntaAbierta(b, p)) {
                        <div class="ed-acordeon-cuerpo">
                          <div class="caso-campo">
                            <span class="caso-etiqueta">Enunciado</span>
                            <app-editor [(valor)]="pregunta.enunciado" [bloqueado]="bloqueado()" />
                          </div>
                          <div class="ed-criterio-peso">
                            <label class="caso-campo">
                              <span class="caso-etiqueta">Criterio</span>
                              <textarea class="ed-crece" edCrece rows="1" [(ngModel)]="pregunta.criterio" [disabled]="bloqueado()"></textarea>
                            </label>
                            <label class="caso-campo">
                              <span class="caso-etiqueta">Peso</span>
                              <input type="number" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()" />
                            </label>
                          </div>
                          <label class="caso-campo">
                            <span class="caso-etiqueta">Herramienta (pista, opcional)</span>
                            <input [(ngModel)]="pregunta.pista" [disabled]="bloqueado()" />
                          </label>
                          <div class="ed-opciones">
                            @for (opcion of pregunta.opciones; track $index; let o = $index) {
                              <div class="caso-subgrupo" [class.ed-correcta]="opcion.correcta">
                                <div class="ed-opcion-linea">
                                  <span class="ed-letra" aria-hidden="true">{{ letraOpcion(o) }}</span>
                                  <label class="caso-campo">
                                    <span class="caso-etiqueta">Texto</span>
                                    <textarea class="ed-crece" edCrece rows="1" [(ngModel)]="opcion.texto" [disabled]="bloqueado()"></textarea>
                                  </label>
                                  <label class="check"><input type="checkbox" [checked]="opcion.correcta" [disabled]="bloqueado()" (change)="marcar(pregunta, o)" /> <span>Correcta</span></label>
                                </div>
                                <div class="ed-par">
                                  <label class="caso-campo">
                                    <span class="caso-etiqueta">Por qué</span>
                                    <textarea class="ed-crece" edCrece rows="1" [(ngModel)]="opcion.explicacion" [disabled]="bloqueado()"></textarea>
                                  </label>
                                  <label class="caso-campo">
                                    <span class="caso-etiqueta">Fundamento</span>
                                    <textarea class="ed-crece" edCrece rows="1" [(ngModel)]="opcion.fundamento" [disabled]="bloqueado()"></textarea>
                                  </label>
                                </div>
                              </div>
                            }
                          </div>
                          @if (!bloqueado()) {
                            <button class="ed-suave" type="button" (click)="pregunta.opciones.push(opcionVacia())">Agregar opción</button>
                          }
                        </div>
                      }
                    </section>
                  }
                </div>
                @if (!bloqueado()) {
                  <button class="ed-suave" type="button" (click)="agregarPregunta(bloque)">Agregar pregunta</button>
                }
              </section>
            }
          </div>
        }

        @if (activo() === 'rubrica') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Rúbrica</h2>
              <p class="sub">Cada pregunta tiene su criterio. Los pesos van de 0,0 a 5,0 y deben sumar 5,0.</p>
            </header>
            <section class="caso-casilla">
              <div class="ed-reparto-linea">
                <h3 class="ed-seccion">Reparto</h3>
                <div class="ed-reparto">
                  <button type="button" [class.activa]="caso.repartoRubrica !== 'EQUITATIVA'" [disabled]="bloqueado()" (click)="elegirReparto('PONDERADA')">Ponderada</button>
                  <button type="button" [class.activa]="caso.repartoRubrica === 'EQUITATIVA'" [disabled]="bloqueado()" (click)="elegirReparto('EQUITATIVA')">Equitativa</button>
                </div>
                <span class="sub">{{ caso.repartoRubrica === 'EQUITATIVA' ? 'El sistema reparte 5,0.' : 'Tú fijas cada peso.' }}</span>
              </div>
            </section>
            <section class="caso-casilla">
              <div class="ed-tabla">
                <div class="ed-tabla-cabeza">
                  <span>Escenario · Pregunta</span>
                  <span>Criterio</span>
                  <span>Peso</span>
                </div>
                @for (bloque of caso.bloques; track $index; let b = $index) {
                  @for (pregunta of bloque.preguntas; track $index; let p = $index) {
                    <div class="ed-tabla-fila">
                      <span>{{ bloque.nombre || 'Escenario' }} · Pregunta {{ p + 1 }}</span>
                      <span class="ed-criterio">{{ pregunta.criterio || 'Sin criterio' }}</span>
                      @if (caso.repartoRubrica === 'EQUITATIVA') {
                        <strong>{{ pregunta.peso || 0 }}</strong>
                      } @else {
                        <input type="number" min="0" max="5" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()"
                          [attr.aria-label]="'Peso de ' + (bloque.nombre || 'escenario') + ', pregunta ' + (p + 1)" />
                      }
                    </div>
                  }
                }
                <div class="ed-tabla-total">
                  <span>Suma actual</span>
                  <strong>{{ suma() }}</strong>
                </div>
              </div>
            </section>
          </div>
        }

        @if (activo() === 'escena') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Diseño de escena</h2>
              <p class="sub">Describe a cada personaje (por ejemplo «madre de 38 años») y el sistema elige un personaje 3D que encaje. Marca en qué escenarios aparece y arrástralo en la escena: a los lados, o hacia arriba y abajo para alejarlo o acercarlo. La posición es solo el boceto de tu vista.</p>
            </header>
            <section class="caso-casilla ed-boceto">
              <h3 class="ed-seccion">Boceto de escena</h3>
              <h3 class="ed-seccion">Escenario y fondo</h3>
              <div class="row escena-controles">
                <div class="fondos" role="group" aria-label="Escenario">
                  @for (bloque of casoEscena().bloques; track $index; let b = $index) {
                    <button type="button" [class.activa]="escenarioActivo() === b" (click)="escenarioActivo.set(b)">Escenario {{ b + 1 }}</button>
                  }
                </div>
                <div class="fondos" role="group" aria-label="Fondo (solo en tu vista)">
                  <button type="button" [class.activa]="!fondoManual()" (click)="elegirFondo(null)">Fondo automático</button>
                  @for (fondo of fondos; track fondo.id) {
                    <button type="button" [class.activa]="fondoManual() === fondo.id" (click)="elegirFondo(fondo.id)">{{ fondo.nombre }}</button>
                  }
                </div>
              </div>
              <!-- three.js y el motor de la novela se descargan solo al entrar a un caso (carga diferida). -->
              @defer (on immediate) {
                <app-escena-novela
                  [caso]="casoEscena()" [bloque]="bloqueEscena()" [personajes]="personajesEscena()"
                  [modoEditor]="true" [bloqueado]="bloqueado()" [fondoManual]="fondoManual()" [posiciones]="posicionesEscena()"
                  (elenco)="recibirElenco($event)" (mover)="moverPersona($event)" />
              } @placeholder {
                <div class="escena-espera" aria-hidden="true" style="width: 100%; aspect-ratio: 16 / 9; border-radius: 14px; background: linear-gradient(180deg, #d8e4ea, #b7c7cf);"></div>
              }
              @if (detectados()) { <p class="sub">{{ detectados() }}</p> }
            </section>
            <div class="ed-lista">
            @for (personaje of caso.personajes; track $index; let i = $index) {
              <section class="caso-casilla personaje-fila ed-persona">
                <h3 class="ed-bloque-titulo">{{ personaje.nombre || ('Persona ' + (i + 1)) }}</h3>
                <div class="ed-persona-grid">
                  <label class="caso-campo">
                    <span class="caso-etiqueta">Nombre</span>
                    <input [(ngModel)]="personaje.nombre" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)" />
                  </label>
                  <label class="caso-campo">
                    <span class="caso-etiqueta">Descripción</span>
                    <input [(ngModel)]="personaje.descripcion" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)"
                      placeholder="Ej.: madre de 38 años, trabaja en una panadería" [attr.aria-label]="'Descripción de ' + (personaje.nombre || 'Persona ' + (i + 1))" />
                  </label>
                </div>
                <div class="ayudas" role="group" [attr.aria-label]="'Ayudas para describir a ' + (personaje.nombre || 'Persona ' + (i + 1))">
                    <select [disabled]="bloqueado()" [value]="ayuda(i).genero" (change)="escribirAyuda(i, 'genero', $any($event.target).value)" aria-label="Género">
                      <option value="">Género…</option>
                      <option value="mujer">Mujer</option>
                      <option value="hombre">Hombre</option>
                    </select>
                    <select [disabled]="bloqueado()" [value]="ayuda(i).edad" (change)="escribirAyuda(i, 'edad', $any($event.target).value)" aria-label="Edad">
                      <option value="">Edad…</option>
                      @for (e of edades; track e) { <option [value]="e">{{ e }} años</option> }
                    </select>
                    <select [disabled]="bloqueado()" [value]="ayuda(i).rol" (change)="escribirAyuda(i, 'rol', $any($event.target).value)" aria-label="Rol">
                      <option value="">Rol…</option>
                      @for (r of roles; track r.id) { <option [value]="r.id">{{ ayuda(i).genero === 'hombre' ? r.m : r.f }}</option> }
                    </select>
                </div>
                <div class="caso-campo">
                  <span class="caso-etiqueta">Aparece en</span>
                  <div class="personaje-pie">
                    <div class="aparece" role="group" [attr.aria-label]="'Escenarios donde aparece ' + (personaje.nombre || 'Persona ' + (i + 1))">
                      @for (bloque of caso.bloques; track $index; let b = $index) {
                        <label class="chip"><input type="checkbox" [checked]="personaje.escenarios.includes(b)" [disabled]="bloqueado()"
                          (change)="alternarEscenario(i, b)" />{{ b + 1 }}</label>
                      }
                    </div>
                    <small class="entendido" [class.falta]="!etiquetas()[i]">{{ etiquetas()[i] || 'Sin descripción: no aparece en la escena' }}</small>
                  </div>
                </div>
              </section>
            }
            </div>
          </div>
        }

        @if (activo() === 'estado') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Estado del caso</h2>
              <p class="sub">Los cambios de estado (guardar, publicar, archivar) están en la barra de abajo, a la derecha.</p>
            </header>
            <section class="caso-casilla ficha-estado ed-estado-actual">
              <div class="ficha-estado-cabeza">
                <span class="ficha-estado-pill" [attr.data-estado]="caso.estado || 'NUEVO'">{{ etiquetaEstado() }}</span>
                <h3 class="ed-bloque-titulo">{{ caso.nombre || 'Sin nombre' }}</h3>
              </div>
              <p class="sub">{{ textoEstado() }}</p>
            </section>
            <section class="caso-casilla">
              <div class="resumen-cifras">
                <article><small>Escenarios</small><strong>{{ caso.bloques.length }}</strong></article>
                <article><small>Decisiones</small><strong>{{ totalPreguntas() }}</strong></article>
                <article><small>Tiempo</small><strong>{{ caso.tiempoEstimadoMin }} min</strong></article>
              </div>
            </section>
          </div>
        }
        @if (vistaPrevia()) {
          <div class="caso-vista">
            <header class="caso-titulo">
              <p class="kicker">Previsualización</p>
              <h2>{{ caso.nombre || 'Caso sin nombre' }}</h2>
            </header>
            <section class="caso-casilla">
              <div [innerHTML]="caso.desarrolloSituacional"></div>
              <div class="sub" [innerHTML]="caso.contexto"></div>
            </section>
          </div>
        }
        </div>
        </div>
        @if (caso.id || puedePublicar() || puedeVolverBorrador() || puedeArchivar()) {
        <div class="row acciones-caso">
          @if (caso.id) { <button class="btn-suave" type="button" (click)="duplicar()">Duplicar</button> }
          @if (puedePublicar()) { <button class="btn-oscuro" type="button" (click)="transicion('publicar')">Publicar</button> }
          @if (puedeVolverBorrador()) { <button class="btn-suave" type="button" (click)="transicion('despublicar')">Volver a borrador</button> }
          @if (puedeArchivar()) {
            <div class="adm-menu">
              <button type="button" class="adm-mas" aria-haspopup="menu" [attr.aria-expanded]="menuAcciones()" aria-label="Más acciones del caso"
                (click)="$event.stopPropagation(); menuAcciones.set(!menuAcciones())">⋯</button>
              @if (menuAcciones()) {
                <div class="adm-menu-lista" role="menu" aria-label="Más acciones del caso">
                  <button type="button" role="menuitem" (click)="menuAcciones.set(false); transicion('archivar')">Archivar</button>
                </div>
              }
            </div>
          }
        </div>
        }
      </section>

      <!-- Formulario de "Insertar diálogo" (desarrollo situacional o contexto de un escenario). -->
      <ng-template #iconoBasura>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </ng-template>

      <ng-template #formDialogo let-destino>
        <div class="form-dialogo" role="group" aria-label="Insertar diálogo">
          @if (hablantes().length) {
            <select [(ngModel)]="dialogoPersonaje" aria-label="Personaje que habla">
              @for (h of hablantes(); track h) { <option [value]="h">{{ h }}</option> }
            </select>
            <input [(ngModel)]="dialogoTexto" placeholder="Lo que dice" aria-label="Lo que dice"
              (keydown.enter)="$event.preventDefault(); insertarDialogo(destino)" />
            <button type="button" (click)="insertarDialogo(destino)" [disabled]="!dialogoPersonaje || !dialogoTexto.trim()">Insertar</button>
          } @else {
            <span class="sub">Primero describe a los personajes en «Diseño de escena».</span>
          }
          <button type="button" (click)="insertando.set(null)">Cancelar</button>
        </div>
      </ng-template>

      @if (vistaAbierta(); as vista) {
        <div class="modal-vista" role="dialog" aria-modal="true" aria-label="Vista previa del caso" (keydown.escape)="cerrarVistaPrevia()">
          <div class="modal-cuerpo">
            <!-- Los resultados se calculan aquí, con los datos del editor: no hay peticiones al backend. -->
            @defer (on immediate) {
              <app-novela-reproductor [caso]="vista" [personajes]="vista.personajes"
                [resultados]="resultadosVista()" [mostrarCerrar]="true"
                (finalizar)="resultadosVista.set(calcularResultados(vista, $event))" (reiniciar)="resultadosVista.set(null)"
                (cerrar)="cerrarVistaPrevia()" etiquetaSalir="Cerrar la vista previa" />
            } @placeholder {
              <div class="escena-espera" role="status" style="width: 100%; max-width: calc((100vh - 130px) * 16 / 9); margin: 0 auto; aspect-ratio: 16 / 9; border-radius: 14px; display: grid; place-items: center; background: rgba(15,20,28,.55); color: #fff; font-size: 1rem;">Preparando la escena…</div>
            }
          </div>
        </div>
      }
    </app-marco-docente>
  `
})
export class EditorCasoComponent {
  /**
   * Al entrar a un caso se descarga en segundo plano el motor de la novela (three.js), para que la vista previa
   * y el boceto abran sin esperar. En el panel y en las demás pantallas no se descarga.
   */
  private readonly precargaNovela = typeof window !== 'undefined' && setTimeout(() => {
    import('../shared/novela/novela-reproductor.component').catch(() => undefined);
  }, 1500);
  readonly musica = inject(MusicaNovelaService);
  // Si se sale del editor con la vista previa abierta, la música no sigue sonando.
  private readonly alSalir = inject(DestroyRef).onDestroy(() => this.musica.detener());
  enlaces = enlaces;
  pasos = [
    { id: 'estructura', texto: 'Información general' },
    { id: 'escenas', texto: 'Escenas y contexto' },
    { id: 'preguntas', texto: 'Decisiones y opciones' },
    { id: 'rubrica', texto: 'Rúbrica' },
    { id: 'escena', texto: 'Diseño de escena' },
    { id: 'estado', texto: 'Estado' }
  ];
  /** Fondos que el docente puede fijar a mano (solo cambian su vista). */
  fondos = FONDOS_MANUALES;
  edades = [8, 15, 22, 30, 38, 50, 66, 80];
  roles = ROLES_AYUDA;
  opcionVacia = opcionVacia;
  preguntaVacia = preguntaVacia;
  activo = signal('estructura');
  vistaPrevia = signal(false);
  /** Menú "⋯" de la barra de acciones (Archivar). */
  menuAcciones = signal(false);
  /** Qué bloques están abiertos. Solo ordena la pantalla: no se guarda con el caso. */
  private readonly escenasAbiertas = signal<ReadonlySet<number>>(new Set([0]));
  private readonly preguntasAbiertas = signal<ReadonlySet<string>>(new Set());
  private readonly contextosAbiertos = signal<ReadonlySet<number>>(new Set());
  private preguntasTocadas = false;
  descripcionEditor() {
    return this.caso.nombre
      ? `Editando «${this.caso.nombre}». Diseña la historia, las escenas y las decisiones del caso.`
      : 'Crea un caso: la historia, las escenas y las decisiones.';
  }
  caso: Caso = casoVacio();
  error = signal('');
  ok = signal('');
  /** null = fondo automático (el mismo que verá el estudiante). */
  fondoManual = signal<string | null>(null);
  escenarioActivo = signal(0);
  /** Copias del caso para la escena; se actualizan con 600 ms de espera al escribir. */
  casoEscena = signal<CasoNovela>({ nombre: '', bloques: [] });
  personajesEscena = signal<PersonajeNovela[]>([]);
  bloqueEscena = computed<BloqueNovela>(() => {
    const bloques = this.casoEscena().bloques;
    const indice = Math.min(this.escenarioActivo(), Math.max(0, bloques.length - 1));
    const b = bloques[indice];
    return { indice, nombre: b?.nombre || `Escenario ${indice + 1}`, contexto: b?.contexto ?? '' };
  });
  /** Solo las posiciones que el docente arrastró; las demás las reparte la escena según cuántos hay. */
  posicionesEscena = computed(() => this.personas().map(p => (p.movida ? { x: p.x, y: p.y } : null)));
  /** Lo que entendió el motor de cada personaje ("Madre · 38 años"), por índice. */
  etiquetas = signal<Record<number, string>>({});
  /** Aviso cuando no hay descripciones y el motor detecta personajes en el texto del caso. */
  detectados = signal('');
  // ---- Vista previa (no guarda nada ni llama al backend al elegir opciones)
  /** Copia del caso al abrir la vista previa (lo escrito en el editor, aunque no esté guardado). */
  vistaAbierta = signal<Caso | null>(null);
  /** Resultados de la vista previa (calculados en el navegador al pulsar "Finalizar"). */
  resultadosVista = signal<ResultadosNovela | null>(null);
  calcularResultados = calcularResultados;
  private botonVista?: HTMLElement;
  // ---- Insertar diálogo
  readonly ayudaDialogo = "Para que un personaje hable, escribe 'Nombre: lo que dice' o usa Insertar diálogo. Lo demás lo cuenta el narrador.";
  insertando = signal<string | null>(null);
  dialogoPersonaje = '';
  dialogoTexto = '';
  private editorDesarrollo = viewChild<EditorTextoComponent>('editorDesarrollo');
  private ayudas: Record<number, AyudaDescripcion> = {};
  private generado: Record<number, string> = {};
  private esperaEscena?: ReturnType<typeof setTimeout>;
  personas = signal<PersonaEscena[]>([
    { id: 'p1', nombre: 'Persona 1', color: '#3ee0ff', x: 8, y: 58 },
    { id: 'p2', nombre: 'Persona 2', color: '#ffba20', x: 30, y: 58 },
    { id: 'p3', nombre: 'Persona 3', color: '#00ff94', x: 52, y: 58 },
    { id: 'p4', nombre: 'Persona 4', color: '#c4b5fd', x: 74, y: 58 }
  ]);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private claveBoceto = 'dilema-boceto-nuevo';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.claveBoceto = `dilema-boceto-${id ?? 'nuevo'}`;
    const guardado = localStorage.getItem(this.claveBoceto);
    if (guardado) {
      try {
        // El "fondo" de bocetos anteriores era un degradado CSS: ya no se usa; ahora se guarda fondoManual.
        const boceto = JSON.parse(guardado) as { fondoManual?: string | null; personas?: PersonaEscena[] };
        if (boceto.fondoManual) this.fondoManual.set(boceto.fondoManual);
        if (Array.isArray(boceto.personas) && boceto.personas.length) this.personas.set(boceto.personas);
      } catch { localStorage.removeItem(this.claveBoceto); }
    }
    this.refrescarEscena();
    if (id) {
      this.http.get<Caso>(`/api/docente/casos/${id}`).subscribe({
        next: (dato) => {
          this.caso = this.recibir(dato);
          this.personas.update((lista) => lista.map((persona, indice) => ({
            ...persona,
            nombre: this.caso.personajes[indice]?.nombre || persona.nombre
          })));
          this.refrescarEscena();
        },
        error: (falla) => this.error.set(mensajeError(falla))
      });
    }
  }
  irA(paso: string) {
    this.activo.set(paso);
    // Los escenarios y textos se editan en otras pestañas: al entrar a la escena se toma la versión actual.
    if (paso === 'escena') this.refrescarEscena();
  }
  /** Copia el caso actual para la escena (la escena solo se entera de los cambios por estas copias). */
  refrescarEscena() {
    clearTimeout(this.esperaEscena);
    this.casoEscena.set({
      id: this.caso.id ?? null, nombre: this.caso.nombre,
      desarrolloSituacional: this.caso.desarrolloSituacional, contexto: this.caso.contexto,
      bloques: this.caso.bloques.map((b) => ({ nombre: b.nombre, contexto: b.contexto }))
    });
    this.personajesEscena.set((this.caso.personajes ?? []).map((p) => ({
      nombre: p.nombre ?? '', descripcion: p.descripcion ?? '', escenarios: [...(p.escenarios ?? [])]
    })));
  }
  /** Nombre o descripción cambiaron: el modelo se actualiza tras 600 ms sin escribir. */
  cambioPersonaje(indice: number) {
    this.sincronizarPersona(indice);
    clearTimeout(this.esperaEscena);
    this.esperaEscena = setTimeout(() => this.refrescarEscena(), 600);
  }
  alternarEscenario(indice: number, bloque: number) {
    const personaje = this.caso.personajes[indice];
    if (!personaje) return;
    const lista = new Set(personaje.escenarios ?? []);
    if (lista.has(bloque)) lista.delete(bloque); else lista.add(bloque);
    personaje.escenarios = [...lista].sort((a, b) => a - b);
    this.refrescarEscena();
  }
  ayuda(indice: number): AyudaDescripcion {
    return this.ayudas[indice] ??= { genero: '', edad: '', rol: '' };
  }
  /**
   * Las listas de género, edad y rol escriben una frase al inicio de la descripción (por ejemplo
   * "madre de 38 años"); lo que el docente escribió después se conserva.
   */
  escribirAyuda(indice: number, campo: keyof AyudaDescripcion, valor: string) {
    const personaje = this.caso.personajes[indice];
    if (!personaje) return;
    const ayuda = this.ayuda(indice);
    ayuda[campo] = valor;
    const genero = ayuda.genero || GENERO_DEL_ROL[ayuda.rol] || '';
    const rol = ROLES_AYUDA.find((r) => r.id === ayuda.rol);
    const quien = rol ? (genero === 'hombre' ? rol.m : rol.f) : (genero === 'hombre' ? 'hombre' : genero === 'mujer' ? 'mujer' : '');
    const frase = [quien, ayuda.edad ? `${quien ? 'de ' : ''}${ayuda.edad} años` : ''].filter(Boolean).join(' ');
    let resto = (personaje.descripcion ?? '').trim();
    const previo = this.generado[indice];
    if (previo && resto.startsWith(previo)) resto = resto.slice(previo.length).replace(/^[\s,;.]+/, '');
    personaje.descripcion = [frase, resto].filter(Boolean).join(', ');
    this.generado[indice] = frase;
    this.cambioPersonaje(indice);
  }
  recibirElenco(asignados: Asignacion[]) {
    const etiquetas: Record<number, string> = {};
    for (const a of asignados) if (a.personaje.indice >= 0) etiquetas[a.personaje.indice] = a.perfil.etiqueta;
    this.etiquetas.set(etiquetas);
    const detectados = asignados.filter((a) => a.personaje.detectado);
    this.detectados.set(detectados.length
      ? 'Aún no describes a ningún personaje. Con el texto del caso, el estudiante verá: '
        + detectados.map((a) => `${a.personaje.nombre} (${a.perfil.etiqueta})`).join(', ') + '.'
      : '');
  }
  abrirVistaPrevia(boton: HTMLElement) {
    this.botonVista = boton;
    this.vistaAbierta.set(structuredClone(this.caso));
    this.resultadosVista.set(null);
    this.musica.iniciar();
    document.body.style.overflow = 'hidden';
    // Foco en el reproductor para usarlo con teclado (se carga diferido: se reintenta hasta que aparece).
    const enfocar = (intentos: number) => {
      const r = document.querySelector<HTMLElement>('.modal-vista .reproductor');
      if (r) r.focus();
      else if (intentos > 0) setTimeout(() => enfocar(intentos - 1), 100);
    };
    setTimeout(() => enfocar(50), 0);
  }
  cerrarVistaPrevia() {
    this.musica.detener();
    this.vistaAbierta.set(null);
    document.body.style.overflow = '';
    this.botonVista?.focus();
  }
  /** Personajes que pueden hablar: los que tienen descripción. */
  hablantes() {
    return (this.caso.personajes ?? []).filter((p) => (p.descripcion ?? '').trim())
      .map((p, i) => (p.nombre ?? '').trim() || `Persona ${i + 1}`);
  }
  private editorBloqueActivo: EditorTextoComponent | null = null;
  abrirInsertar(destino: string) {
    this.insertando.set(this.insertando() === destino ? null : destino);
    this.dialogoTexto = '';
    if (!this.hablantes().includes(this.dialogoPersonaje)) this.dialogoPersonaje = this.hablantes()[0] ?? '';
  }
  abrirInsertarBloque(indice: number, editor: EditorTextoComponent) {
    this.editorBloqueActivo = editor;
    this.abrirInsertar('bloque-' + indice);
  }
  /** Inserta "Nombre: texto" en una línea nueva donde estaba el cursor. Se guarda en el mismo campo de siempre. */
  insertarDialogo(destino: 'desarrollo' | { bloque: number }) {
    const texto = this.dialogoTexto.trim();
    if (!this.dialogoPersonaje || !texto) return;
    const linea = `${this.dialogoPersonaje}: ${texto}`;
    if (destino === 'desarrollo') {
      this.editorDesarrollo()?.insertarLinea(linea);
    } else if (this.caso.bloques[destino.bloque]) {
      this.editorBloqueActivo?.insertarLinea(linea);
    }
    this.dialogoTexto = '';
    this.insertando.set(null);
  }
  moverPersona(evento: { indice: number; x: number; y: number }) {
    this.personas.update((lista) => lista.map((p, i) => i === evento.indice ? { ...p, x: evento.x, y: evento.y, movida: true } : p));
    this.guardarBoceto();
  }
  bloqueado() {
    return !this.auth.puede('EDITAR') || this.caso.estado === 'PUBLICADO' || this.caso.estado === 'ARCHIVADO';
  }
  puedeEditar() { return this.auth.puede('EDITAR'); }
  puedePublicar() {
    return !!this.caso.id && this.auth.puede('EDITAR') && (this.caso.estado === 'BORRADOR' || this.caso.estado === 'ARCHIVADO');
  }
  puedeVolverBorrador() { return !!this.caso.id && this.auth.puede('EDITAR') && this.caso.estado === 'PUBLICADO'; }
  puedeArchivar() { return !!this.caso.id && this.auth.puede('EDITAR') && this.caso.estado === 'PUBLICADO'; }
  totalPreguntas() {
    return this.caso.bloques.reduce((n, bloque) => n + (bloque.preguntas?.length || 0), 0);
  }
  etiquetaEstado() {
    if (this.caso.estado === 'PUBLICADO') return 'Publicado';
    if (this.caso.estado === 'ARCHIVADO') return 'Archivado';
    if (this.caso.estado === 'BORRADOR') return 'Borrador';
    return 'Sin guardar';
  }
  textoEstado() {
    if (this.caso.estado === 'PUBLICADO') {
      return 'El caso ya se puede asignar a grupos. Para editarlo, vuelve a borrador con el botón de abajo.';
    }
    if (this.caso.estado === 'ARCHIVADO') {
      return 'Está archivado y no se programa en grupos nuevos. Puedes publicarlo de nuevo cuando lo necesites.';
    }
    if (this.caso.estado === 'BORRADOR') {
      return 'Sigue siendo un borrador. Cuando esté listo, publícalo con los botones de la derecha, abajo.';
    }
    return 'Aún no se ha guardado. Usa Guardar borrador en la barra inferior.';
  }
  sincronizarPersona(indice: number) {
    const nombre = this.caso.personajes[indice]?.nombre;
    if (!nombre) return;
    this.personas.update((lista) => lista.map((persona, i) => i === indice ? { ...persona, nombre } : persona));
    this.guardarBoceto();
  }
  suma() {
    return Math.round(this.caso.bloques.reduce((total, bloque) => total + bloque.preguntas.reduce((peso, pregunta) => peso + Number(pregunta.peso || 0), 0), 0) * 10) / 10;
  }
  elegirReparto(modo: 'PONDERADA' | 'EQUITATIVA') {
    this.caso.repartoRubrica = modo;
    if (modo === 'EQUITATIVA') this.repartir();
  }
  repartir() {
    const preguntas = this.caso.bloques.flatMap((bloque) => bloque.preguntas);
    const cantidad = preguntas.length;
    if (!cantidad) return;
    const parte = Math.floor((5 / cantidad) * 10) / 10;
    let acumulado = 0;
    preguntas.forEach((pregunta, indice) => {
      const peso = indice === cantidad - 1 ? Math.round((5 - acumulado) * 10) / 10 : parte;
      acumulado = Math.round((acumulado + peso) * 10) / 10;
      pregunta.peso = peso;
    });
  }
  agregarBloque() {
    this.caso.bloques.push({ nombre: `Escenario académico ${this.caso.bloques.length + 1}`, contexto: '', preguntas: [preguntaVacia()] });
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
    const indice = this.caso.bloques.length - 1;
    const escenas = new Set(this.escenasAbiertas());
    escenas.add(indice);
    this.escenasAbiertas.set(escenas);
    if (this.preguntasTocadas) {
      const abiertas = new Set(this.preguntasAbiertas());
      abiertas.add(this.clavePregunta(indice, 0));
      this.preguntasAbiertas.set(abiertas);
    }
  }
  agregarPregunta(bloque: Bloque) {
    bloque.preguntas.push(preguntaVacia());
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
    const b = this.caso.bloques.indexOf(bloque);
    this.sembrarPreguntas();
    const abiertas = new Set(this.preguntasAbiertas());
    abiertas.add(this.clavePregunta(b, bloque.preguntas.length - 1));
    this.preguntasAbiertas.set(abiertas);
  }
  quitarBloque(indice: number) {
    this.caso.bloques.splice(indice, 1);
    const escenas = new Set<number>();
    for (const i of this.escenasAbiertas()) {
      if (i < indice) escenas.add(i);
      else if (i > indice) escenas.add(i - 1);
    }
    this.escenasAbiertas.set(escenas);
    if (this.preguntasTocadas) {
      const abiertas = new Set<string>();
      for (const clave of this.preguntasAbiertas()) {
        const [b, p] = clave.split('-').map(Number);
        if (b < indice) abiertas.add(clave);
        else if (b > indice) abiertas.add(this.clavePregunta(b - 1, p));
      }
      this.preguntasAbiertas.set(abiertas);
    }
    const contextos = new Set<number>();
    for (const i of this.contextosAbiertos()) {
      if (i < indice) contextos.add(i);
      else if (i > indice) contextos.add(i - 1);
    }
    this.contextosAbiertos.set(contextos);
  }
  quitarPregunta(bloque: Bloque, indice: number) {
    const b = this.caso.bloques.indexOf(bloque);
    bloque.preguntas.splice(indice, 1);
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
    if (!this.preguntasTocadas) return;
    const abiertas = new Set<string>();
    for (const clave of this.preguntasAbiertas()) {
      const [bloqueIndice, preguntaIndice] = clave.split('-').map(Number);
      if (bloqueIndice !== b) abiertas.add(clave);
      else if (preguntaIndice < indice) abiertas.add(clave);
      else if (preguntaIndice > indice) abiertas.add(this.clavePregunta(b, preguntaIndice - 1));
    }
    this.preguntasAbiertas.set(abiertas);
  }
  escenaAbierta(indice: number) { return this.escenasAbiertas().has(indice); }
  alternarEscena(indice: number) {
    const next = new Set(this.escenasAbiertas());
    if (next.has(indice)) next.delete(indice); else next.add(indice);
    this.escenasAbiertas.set(next);
  }
  todasEscenasAbiertas() {
    return this.caso.bloques.length > 0 && this.caso.bloques.every((_, i) => this.escenasAbiertas().has(i));
  }
  alternarTodasEscenas() {
    this.escenasAbiertas.set(this.todasEscenasAbiertas() ? new Set() : new Set(this.caso.bloques.map((_, i) => i)));
  }
  preguntaAbierta(bloque: number, pregunta: number) {
    if (!this.preguntasTocadas) return pregunta === 0;
    return this.preguntasAbiertas().has(this.clavePregunta(bloque, pregunta));
  }
  alternarPregunta(bloque: number, pregunta: number) {
    this.sembrarPreguntas();
    const next = new Set(this.preguntasAbiertas());
    const clave = this.clavePregunta(bloque, pregunta);
    if (next.has(clave)) next.delete(clave); else next.add(clave);
    this.preguntasAbiertas.set(next);
  }
  todasPreguntasAbiertas() {
    const total = this.totalPreguntas();
    if (!total) return false;
    if (!this.preguntasTocadas) return this.caso.bloques.every((bloque) => (bloque.preguntas?.length || 0) <= 1);
    return this.caso.bloques.every((bloque, b) => bloque.preguntas.every((_, p) => this.preguntasAbiertas().has(this.clavePregunta(b, p))));
  }
  alternarTodasPreguntas() {
    if (this.todasPreguntasAbiertas()) {
      this.preguntasTocadas = true;
      this.preguntasAbiertas.set(new Set());
      return;
    }
    const abiertas = new Set<string>();
    this.caso.bloques.forEach((bloque, b) => bloque.preguntas.forEach((_, p) => abiertas.add(this.clavePregunta(b, p))));
    this.preguntasTocadas = true;
    this.preguntasAbiertas.set(abiertas);
  }
  contextoAbierto(indice: number) { return this.contextosAbiertos().has(indice); }
  alternarContexto(indice: number) {
    const next = new Set(this.contextosAbiertos());
    if (next.has(indice)) next.delete(indice); else next.add(indice);
    this.contextosAbiertos.set(next);
  }
  /** Primera línea, sin etiquetas, para el resumen del acordeón. */
  primeraLinea(valor: string | null | undefined) {
    return (valor ?? '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
  /** El mismo contexto de siempre, listo para leerse con formato y sin etiquetas a la vista. */
  contextoHtml(valor: string | null | undefined) {
    const texto = valor ?? '';
    if (/<[a-z][\s\S]*>/i.test(texto)) return texto;
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }
  pesoCorto(peso: number | null | undefined) {
    const n = Number(peso || 0);
    return Number.isInteger(n) ? String(n) : n.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  }
  textoOpciones(cantidad: number) {
    return cantidad === 1 ? '1 opción' : `${cantidad} opciones`;
  }
  sinCorrecta(pregunta: { opciones: { correcta: boolean }[] }) {
    return !pregunta.opciones.some((opcion) => opcion.correcta);
  }
  letraOpcion(indice: number) {
    return String.fromCharCode(65 + indice);
  }
  private clavePregunta(bloque: number, pregunta: number) {
    return `${bloque}-${pregunta}`;
  }
  private sembrarPreguntas() {
    if (this.preguntasTocadas) return;
    const abiertas = new Set<string>();
    this.caso.bloques.forEach((bloque, b) => {
      if (bloque.preguntas?.length) abiertas.add(this.clavePregunta(b, 0));
    });
    this.preguntasAbiertas.set(abiertas);
    this.preguntasTocadas = true;
  }
  marcar(pregunta: { opciones: { correcta: boolean }[] }, indice: number) {
    pregunta.opciones.forEach((opcion, i) => opcion.correcta = i === indice);
  }
  elegirFondo(id: string | null) { this.fondoManual.set(id); this.guardarBoceto(); }
  guardar() {
    this.error.set('');
    this.caso.rubrica = this.caso.bloques.flatMap((bloque) => bloque.preguntas.map((pregunta) => ({
      nombre: pregunta.criterio || bloque.nombre,
      peso: Number(pregunta.peso || 0),
      descripcion: pregunta.enunciado
    })));
    const pedido = this.caso.id
      ? this.http.put<Caso>(`/api/docente/casos/${this.caso.id}`, this.caso)
      : this.http.post<Caso>('/api/docente/casos', this.caso);
    pedido.subscribe({
      next: (dato) => {
        this.caso = this.recibir(dato);
        this.ok.set('Borrador guardado.');
        if (!this.route.snapshot.paramMap.get('id')) this.router.navigate(['/docente/casos', dato.id]);
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  duplicar() {
    this.http.post<Caso>(`/api/docente/casos/${this.caso.id}/duplicar`, {}).subscribe({
      next: (dato) => this.router.navigate(['/docente/casos', dato.id]),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  transicion(accion: 'publicar' | 'despublicar' | 'archivar') {
    this.error.set('');
    this.http.post<Caso>(`/api/docente/casos/${this.caso.id}/${accion}`, {}).subscribe({
      next: (dato) => {
        this.caso = this.recibir(dato);
        this.ok.set(accion === 'publicar' ? 'Caso publicado.' : accion === 'archivar' ? 'Caso archivado.' : 'El caso volvió a borrador.');
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private recibir(dato: Caso) {
    dato.repartoRubrica ??= 'PONDERADA';
    dato.personajes ??= [];
    return dato;
  }
  private guardarBoceto() {
    localStorage.setItem(this.claveBoceto, JSON.stringify({ fondoManual: this.fondoManual(), personas: this.personas() }));
  }
}

@Component({
  selector: 'app-grupos',
  imports: [IconoComponent, MarcoDocenteComponent, FormsModule, PaginacionGpComponent],
  host: { '(document:click)': 'cerrarMenu()', '(document:keydown.escape)': 'cerrarMenu(true)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Elige un grupo para ver y asignar a sus estudiantes.">
      <section class="gp">
        @if (!puedeGestionar()) {
          <p class="gp-error">La administración debe asignarte el permiso de gestionar espacios académicos para crear grupos y asignar estudiantes.</p>
        }
        @if (error()) { <p class="gp-error" role="alert">{{ error() }}</p> }
        @if (nuevo()) {
          <form class="gp-tarjeta gp-crear" (ngSubmit)="crear()" aria-labelledby="titulo-crear-grupo">
            <h2 id="titulo-crear-grupo">Nuevo grupo</h2>
            <div class="gp-crear-campos">
              <label class="gp-campo"><span>Nombre</span><input name="nombre" [(ngModel)]="nombre" placeholder="Ej. Psicología Social" /></label>
              <label class="gp-campo"><span>Periodo</span><input name="espacio" [(ngModel)]="espacio" placeholder="2026-I" /></label>
              <div class="gp-crear-botones">
                <button class="gp-btn gp-btn-borde" type="button" (click)="nuevo.set(false)">Cancelar</button>
                <button class="gp-btn gp-btn-oscuro" type="submit">Crear grupo</button>
              </div>
            </div>
          </form>
        }

        <div class="gp-grupos">
          <section class="gp-panel gp-lista" aria-labelledby="titulo-mis-grupos">
            <div class="gp-lista-cabeza">
              <h2 id="titulo-mis-grupos">Mis grupos <span>{{ filtrados().length }}</span></h2>
              <button class="gp-enlace" type="button" (click)="alternarNuevo()" [attr.aria-expanded]="nuevo()"><span aria-hidden="true">+</span> Nuevo grupo</button>
            </div>
            <label class="gp-buscar-suave">
              <app-icono nombre="buscar" [tamano]="16" />
              <span class="solo-lector">Buscar grupo</span>
              <input type="search" placeholder="Buscar grupo" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
            </label>
            <ul class="gp-filas">
              @for (grupo of paginaGrupos(); track grupo.id) {
                <li class="gp-fila" [class.activa]="seleccionado() === grupo.id">
                  <button type="button" class="gp-fila-boton" (click)="elegirDeLista(grupo.id)" [attr.aria-current]="seleccionado() === grupo.id ? 'true' : null">
                    <strong>{{ grupo.nombre }}</strong>
                    <span>{{ grupo.espacioAcademico }} · {{ grupo.estudiantes.length }} {{ grupo.estudiantes.length === 1 ? 'estudiante' : 'estudiantes' }}</span>
                  </button>
                  <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                    <button type="button" class="gp-mas" [id]="'mas-' + grupo.id" aria-haspopup="menu"
                      [attr.aria-expanded]="menuAbierto() === grupo.id" [attr.aria-label]="'Opciones del grupo ' + grupo.nombre"
                      (click)="alternarMenu(grupo.id)">
                      <app-icono nombre="puntos" [tamano]="20" />
                    </button>
                    @if (menuAbierto() === grupo.id) {
                      <div class="gp-menu" role="menu" [attr.aria-label]="'Opciones del grupo ' + grupo.nombre" (keydown)="teclaMenu($event)">
                        <button type="button" role="menuitem" (click)="empezarEdicion(grupo)">Editar</button>
                        <button type="button" role="menuitem" class="peligro" (click)="pedirBorrado(grupo)">Eliminar</button>
                      </div>
                    }
                  </div>
                </li>
              } @empty {
                <li class="gp-vacio gp-lista-vacia">{{ busqueda() ? 'Ningún grupo coincide con la búsqueda.' : 'Todavía no tienes grupos.' }}</li>
              }
            </ul>
            @if (filtrados().length) {
              <div class="gp-pie">
                <app-paginacion-gp [total]="filtrados().length" [pagina]="pagina()" [porPagina]="6" [maxNumeros]="3" [simple]="true"
                  que="grupos" (cambiar)="pagina.set($event)" />
              </div>
            }
          </section>

          @if (actual(); as grupo) {
            <section class="gp-panel gp-detalle" id="gp-detalle" aria-labelledby="titulo-grupo">
              @if (editando() === grupo.id) {
                <form class="gp-editar" (ngSubmit)="guardarEdicion(grupo.id)" aria-label="Editar grupo">
                  <p class="gp-etiqueta">Editar grupo</p>
                  <div class="gp-crear-campos">
                    <label class="gp-campo"><span>Nombre</span><input name="nombreEdicion" [(ngModel)]="nombreEdicion" /></label>
                    <label class="gp-campo"><span>Periodo</span><input name="espacioEdicion" [(ngModel)]="espacioEdicion" /></label>
                    <div class="gp-crear-botones">
                      <button class="gp-btn gp-btn-borde gp-btn-pildora gp-btn-chico" type="button" (click)="cancelarEdicion()">Cancelar</button>
                      <button class="gp-btn gp-btn-oscuro gp-btn-pildora gp-btn-chico" type="submit">Guardar</button>
                    </div>
                  </div>
                </form>
              } @else {
                <div class="gp-detalle-cabeza">
                  <div class="gp-detalle-titulo">
                    <h2 id="titulo-grupo">{{ grupo.nombre }}</h2>
                    <p class="gp-chips">
                      <span class="gp-chip"><i aria-hidden="true"></i>Periodo {{ grupo.espacioAcademico }}</span>
                      <span class="gp-chip">{{ grupo.estudiantes.length }} {{ grupo.estudiantes.length === 1 ? 'estudiante' : 'estudiantes' }}</span>
                    </p>
                  </div>
                  <div class="gp-detalle-acciones">
                    @if (confirmarBorrar() === grupo.id) {
                      <span class="gp-confirmar" role="alert">¿Eliminar este grupo?</span>
                      <button class="gp-btn gp-btn-borde gp-btn-pildora gp-btn-chico" type="button" (click)="confirmarBorrar.set(null)">No</button>
                      <button class="gp-btn gp-btn-peligro-solido gp-btn-pildora gp-btn-chico" type="button" (click)="borrarGrupo(grupo.id)">Confirmar</button>
                    } @else {
                      <button class="gp-btn gp-btn-claro" type="button" (click)="empezarEdicion(grupo)">Editar grupo</button>
                      <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                        <button type="button" class="gp-mas" [id]="'mas-' + (-grupo.id)" aria-haspopup="menu"
                          [attr.aria-expanded]="menuAbierto() === -grupo.id" [attr.aria-label]="'Más acciones del grupo ' + grupo.nombre"
                          (click)="alternarMenu(-grupo.id)">
                          <app-icono nombre="puntos" [tamano]="20" />
                        </button>
                        @if (menuAbierto() === -grupo.id) {
                          <div class="gp-menu" role="menu" [attr.aria-label]="'Más acciones del grupo ' + grupo.nombre" (keydown)="teclaMenu($event)">
                            <button type="button" role="menuitem" class="peligro" (click)="pedirBorrado(grupo)">Eliminar grupo</button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="gp-est-barra">
                <h3>Estudiantes <span>{{ grupo.estudiantes.length }}</span></h3>
                <div class="gp-est-acciones">
                  <label class="gp-buscar-suave">
                    <app-icono nombre="buscar" [tamano]="16" />
                    <span class="solo-lector">Buscar en el grupo por nombre o correo</span>
                    <input type="search" placeholder="Buscar en el grupo" [ngModel]="busquedaEstudiante()"
                      (ngModelChange)="busquedaEstudiante.set($event); paginaEstudiantes.set(1)" />
                  </label>
                  @if (puedeGestionar()) {
                    <div class="gp-anadir-ancla" (click)="$event.stopPropagation()">
                      <button class="gp-btn gp-btn-oscuro gp-anadir" id="gp-anadir" type="button" aria-haspopup="dialog"
                        [attr.aria-expanded]="anadirAbierto()" (click)="alternarAnadir()">
                        <app-icono nombre="mas" [tamano]="16" /> Añadir estudiante
                      </button>
                      @if (anadirAbierto()) {
                        <div class="gp-anadir-fondo" aria-hidden="true" (click)="cerrarAnadir()"></div>
                        <form class="gp-anadir-panel" role="dialog" aria-labelledby="titulo-asignar" (ngSubmit)="agregar(grupo.id)">
                          <h3 id="titulo-asignar">Asignar al grupo</h3>
                          @if (error()) { <p class="gp-error">{{ error() }}</p> }
                          <label class="gp-campo"><span>Buscar</span>
                            <input name="buscarEstudiante" type="search" [ngModel]="busquedaAsignar()"
                              (ngModelChange)="busquedaAsignar.set($event)" placeholder="Nombre o correo" autocomplete="off" />
                          </label>
                          <label class="gp-campo"><span>Estudiante</span>
                            <select name="correoEstudiante" [ngModel]="correoAsignar()" (ngModelChange)="correoAsignar.set($event)">
                              <option value="">Elige una cuenta</option>
                              @for (estudiante of disponibles(); track estudiante.id) {
                                <option [value]="estudiante.email">{{ estudiante.nombre }} · {{ estudiante.email }}</option>
                              }
                            </select>
                          </label>
                          <button class="gp-btn gp-btn-oscuro" type="submit">Asignar</button>
                          <p class="gp-ayuda">La administración da de alta la cuenta. El código de acceso llega por correo al programar la sesión.</p>
                        </form>
                      }
                    </div>
                  }
                </div>
              </div>

              @if (!grupo.estudiantes.length) {
                <div class="gp-sin-estudiantes">
                  <p>Este grupo aún no tiene estudiantes</p>
                  @if (puedeGestionar()) {
                    <button class="gp-btn gp-btn-oscuro gp-anadir" type="button" (click)="$event.stopPropagation(); alternarAnadir()">
                      <app-icono nombre="mas" [tamano]="16" /> Añadir estudiante
                    </button>
                  }
                </div>
              } @else {
                <table class="gp-est-tabla">
                  <thead><tr><th scope="col">Estudiante</th><th scope="col">Correo</th><th scope="col"><span class="solo-lector">Acciones</span></th></tr></thead>
                  <tbody>
                      @for (estudiante of paginaEstudiantesLista(); track estudiante.id) {
                        <tr>
                          <td class="gp-est-nombre"><div class="gp-est-persona"><span class="gp-iniciales" aria-hidden="true">{{ iniciales(estudiante.nombre) }}</span><span class="gp-est-texto">{{ estudiante.nombre }}</span></div></td>
                          <td class="gp-est-correo">{{ estudiante.email }}</td>
                          <td class="gp-est-acc">
                            @if (puedeGestionar()) {
                              <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                                <button type="button" class="gp-mas" [id]="'mas-' + menuEstudiante(estudiante.id)" aria-haspopup="menu"
                                  [attr.aria-expanded]="menuAbierto() === menuEstudiante(estudiante.id)" [attr.aria-label]="'Más acciones para ' + estudiante.nombre"
                                  (click)="alternarMenu(menuEstudiante(estudiante.id))">
                                  <app-icono nombre="puntos" [tamano]="20" />
                                </button>
                                @if (menuAbierto() === menuEstudiante(estudiante.id)) {
                                  <div class="gp-menu gp-menu-lado" role="menu" [attr.aria-label]="'Acciones para ' + estudiante.nombre" (keydown)="teclaMenu($event)">
                                    <button type="button" role="menuitem" class="peligro" (click)="menuAbierto.set(null); retirar(grupo.id, estudiante.id)">Quitar del grupo</button>
                                  </div>
                                }
                              </div>
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr class="gp-est-vacio"><td colspan="3">Nadie coincide con la búsqueda.</td></tr>
                      }
                  </tbody>
                </table>
                @if (estudiantesFiltrados().length) {
                  <div class="gp-pie gp-pie-detalle">
                    <app-paginacion-gp [total]="estudiantesFiltrados().length" [pagina]="paginaEstudiantes()" [porPagina]="8" [simple]="true"
                      que="estudiantes" prefijo="Mostrando " (cambiar)="paginaEstudiantes.set($event)" />
                  </div>
                }
              }
            </section>
          } @else {
            <section class="gp-panel gp-detalle gp-detalle-vacio">
              <p>{{ grupos().length ? 'Elige un grupo para ver a sus estudiantes.' : 'Crea un grupo para empezar a asignar estudiantes.' }}</p>
            </section>
          }
        </div>
      </section>
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    .gp-crear { padding: 20px 22px; display: grid; gap: 14px; }
    .gp-crear h2 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .gp-crear-campos { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
    .gp-crear-botones { display: flex; gap: 8px; }

    /* Dos paneles blancos parejos: empiezan y terminan a la misma altura; el pie de cada uno queda abajo. */
    .gp-grupos { position: relative; z-index: 1; display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 24px; align-items: stretch; }
    .gp-panel { min-width: 0; min-height: 600px; display: flex; flex-direction: column; background: #fff; border: 1px solid #e6edf8;
      border-radius: 18px; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .gp-pie { margin-top: auto; border-top: 1px solid #eef2f9; }

    /* Buscadores grises sin borde, con la lupa dentro. */
    .gp-buscar-suave { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; box-sizing: border-box; border-radius: 999px;
      background: #f5f8fe; color: #7a86a3; }
    .gp-buscar-suave:focus-within { box-shadow: 0 0 0 2px rgba(31, 92, 240, .35); }
    .gp-buscar-suave svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .gp-panel .gp-buscar-suave input[type="search"] { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; border-radius: 0;
      background: transparent; box-shadow: none; outline: none; font: inherit; font-size: 13.5px; color: var(--dl-tinta); }
    .gp-panel .gp-buscar-suave input[type="search"]::placeholder { color: #7a86a3; }

    /* Panel izquierdo: Mis grupos. */
    .gp-lista { padding: 20px 14px 0; gap: 12px; }
    .gp-lista-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px; }
    .gp-lista-cabeza h2 { margin: 0; font-size: 15px; font-weight: 700; color: var(--dl-tinta); }
    .gp-lista-cabeza h2 span { font-weight: 500; color: #9aa6c0; }
    .gp-enlace { display: inline-flex; align-items: center; gap: 4px; padding: 4px 2px; border: 0; background: none; color: #1f5cf0;
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: none; white-space: nowrap; }
    .gp-enlace span { font-size: 16px; line-height: 1; }
    .gp-enlace:hover { text-decoration: underline; transform: none; }
    .gp-filas { list-style: none; margin: 0; padding: 0 0 12px; display: grid; gap: 2px; }
    .gp-fila { position: relative; display: flex; align-items: center; gap: 2px; border-radius: 10px; }
    .gp-fila:hover { background: #f7f9fe; }
    .gp-fila.activa { background: #eef4ff; }
    .gp-fila.activa::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 3px; background: #1f5cf0; }
    .gp-fila-boton { flex: 1; min-width: 0; display: grid; gap: 2px; text-align: left; padding: 9px 4px 9px 12px;
      border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; box-shadow: none; }
    .gp-fila-boton:hover, .gp-fila-boton:active { transform: none; }
    .gp-fila-boton strong { font-size: 14px; font-weight: 600; color: var(--dl-tinta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gp-fila-boton span { font-size: 12.5px; color: #7a86a3; }
    .gp-fila.activa .gp-fila-boton strong { color: #1747c2; font-weight: 700; }
    .gp-lista .gp-pie { margin: auto -14px 0; padding: 12px 18px 14px; }
    @media (hover: hover) and (min-width: 768px) {
      .gp-fila .gp-mas { opacity: 0; }
      .gp-fila:hover .gp-mas, .gp-fila:focus-within .gp-mas, .gp-fila .gp-mas[aria-expanded="true"] { opacity: 1; }
    }

    .gp-menu-ancla { position: relative; flex: none; }
    .gp-mas { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent;
      color: #8a96b2; cursor: pointer; box-shadow: none; }
    .gp-mas svg { width: 18px; height: 18px; fill: currentColor; }
    .gp-mas:hover, .gp-mas[aria-expanded="true"] { background: #f1f4fa; color: #0f1b3d; transform: none; }
    .gp-menu { position: absolute; right: 0; top: 44px; z-index: 20; min-width: 150px; padding: 6px; display: grid; gap: 2px;
      background: #fff; border: 1px solid #e6ebf5; border-radius: 12px; box-shadow: 0 12px 28px rgba(16, 24, 40, .14); }
    .gp-menu button { min-height: 40px; padding: 0 12px; text-align: left; border: 0; border-radius: 8px; background: transparent;
      color: #1a2744; font: inherit; font-size: 13px; cursor: pointer; }
    .gp-menu button:hover, .gp-menu button:focus-visible { background: #f1f4fa; outline: none; }
    .gp-menu .peligro { color: #a4271b; }
    .gp-menu-lado { top: 50%; right: calc(100% + 6px); transform: translateY(-50%); }
    .gp-detalle-acciones .gp-menu-ancla { display: inline-block; }
    .gp-lista-vacia { padding: 12px 4px; font-size: 14px; }

    /* Panel derecho: encabezado del grupo. */
    .gp-detalle-cabeza, .gp-editar { padding: 22px 26px; border-bottom: 1px solid #eef2f9; }
    .gp-detalle-cabeza { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 16px; }
    .gp-detalle-titulo { min-width: 0; }
    .gp-detalle h2 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: var(--dl-tinta); overflow-wrap: anywhere; }
    .gp-chips { margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .gp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: #f3f7fe;
      font-size: 12.5px; color: #4d5b7c; white-space: nowrap; }
    .gp-chip i { width: 6px; height: 6px; border-radius: 50%; background: #1f5cf0; }
    .gp-detalle-acciones { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .gp-btn.gp-btn-claro { min-height: 34px; padding: 0 14px; background: #fff; color: #1f5cf0; border: 1px solid #cddcf8; font-weight: 650; }
    .gp-btn.gp-btn-claro:hover { background: #f3f7ff; transform: none; }
    .gp-confirmar { font-size: 14px; color: #9b1c12; font-weight: 600; }
    .gp-editar { display: grid; gap: 10px; }
    .gp-etiqueta { margin: 0 0 4px; font-size: 13px; font-weight: 650; color: var(--dl-azul); }

    /* Barra de estudiantes: título, buscador y "+ Añadir estudiante" en una línea. */
    .gp-est-barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 26px; }
    .gp-est-barra h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--dl-tinta); }
    .gp-est-barra h3 span { font-weight: 500; color: #9aa6c0; }
    .gp-est-acciones { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .gp-est-acciones .gp-buscar-suave { width: 240px; }
    .gp-btn.gp-anadir { min-height: 38px; padding: 0 16px; gap: 6px; font-size: 13.5px; }
    .gp-anadir svg { width: 16px; height: 16px; }

    /* Panel desplegable de "+ Añadir estudiante" (en celular, hoja desde abajo). */
    .gp-anadir-ancla { position: relative; flex: none; }
    .gp-anadir-fondo { display: none; }
    .gp-anadir-panel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: 360px; box-sizing: border-box;
      display: grid; gap: 12px; padding: 18px; background: #fff; border: 1px solid #e6edf8; border-radius: 16px;
      box-shadow: 0 16px 40px rgba(16, 24, 40, .14); cursor: default; }
    .gp-anadir-panel h3 { margin: 0; font-size: 15px; font-weight: 700; color: var(--dl-tinta); }
    .gp-anadir-panel .gp-btn { min-height: 40px; }

    /* Tabla de estudiantes a lo ancho del panel, sin caja propia. */
    .gp-est-tabla { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
    .gp-est-tabla th { padding: 10px 26px; text-align: left; font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase;
      color: #8a96b2; background: #f8fbff; border-top: 1px solid #eef2f9; border-bottom: 1px solid #eef2f9; }
    .gp-est-tabla th:first-child { width: 48%; }
    .gp-est-tabla th:last-child { width: 72px; }
    .gp-est-tabla td { height: 60px; padding: 0 26px; border-bottom: 1px solid #f0f4fa; vertical-align: middle; }
    .gp-est-nombre { font-weight: 600; color: var(--dl-tinta); }
    .gp-est-persona { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .gp-est-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gp-iniciales { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #eaf1ff;
      color: #1747c2; font-size: 12.5px; font-weight: 700; letter-spacing: .02em; }
    .gp-est-correo { font-size: 13px; color: #4d5b7c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gp-est-acc { text-align: right; }
    .gp-est-tabla td.gp-est-acc { padding: 0 18px 0 0; }
    .gp-est-vacio td { height: 80px; text-align: center; color: #6b7690; }
    .gp-pie-detalle { padding: 14px 26px; }
    .gp-sin-estudiantes { flex: 1; display: grid; place-content: center; justify-items: center; gap: 14px; padding: 40px 20px;
      border-top: 1px solid #eef2f9; text-align: center; }
    .gp-sin-estudiantes p { margin: 0; font-size: 14.5px; color: #4d5b7c; }
    .gp-detalle-vacio { display: grid; place-content: center; text-align: center; padding: 40px 20px; }
    .gp-detalle-vacio p { margin: 0; color: #6b7690; }

    @media (max-width: 767.98px) {
      .gp-crear-campos { grid-template-columns: minmax(0, 1fr); }
      /* Un panel debajo del otro: primero Mis grupos y luego el grupo elegido. */
      .gp-grupos { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .gp-panel { min-height: 0; }
      .gp-detalle { scroll-margin-top: 12px; }
      .gp-detalle-cabeza { flex-direction: column; align-items: stretch; padding: 18px 16px; }
      .gp-editar { padding: 18px 16px; }
      .gp-est-barra { flex-direction: column; align-items: stretch; padding: 14px 16px; }
      .gp-est-acciones { flex-direction: column; align-items: stretch; }
      .gp-est-acciones .gp-buscar-suave { width: 100%; }
      .gp-btn.gp-anadir { width: 100%; }
      .gp-sin-estudiantes .gp-btn.gp-anadir { width: auto; }
      /* Estudiante en una fila: iniciales, nombre y debajo el correo; "⋯" a la derecha. */
      .gp-est-tabla, .gp-est-tabla tbody { display: block; }
      .gp-est-tabla thead { display: none; }
      .gp-est-tabla tr { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; grid-template-areas: "av nombre acc" "av correo acc";
        align-items: center; column-gap: 12px; row-gap: 2px; padding: 12px 8px 12px 16px; border-bottom: 1px solid #f0f4fa; }
      .gp-est-tabla td { height: auto; padding: 0; border: 0; }
      .gp-est-nombre, .gp-est-persona { display: contents; }
      .gp-iniciales { grid-area: av; }
      .gp-est-texto { grid-area: nombre; align-self: end; }
      .gp-est-correo { grid-area: correo; align-self: start; }
      .gp-est-tabla td.gp-est-acc { grid-area: acc; padding: 0; }
      .gp-est-tabla tr.gp-est-vacio { display: block; padding: 24px 16px; }
      .gp-pie-detalle { padding: 12px 16px; }
      /* "Añadir estudiante": hoja desde abajo con fondo oscuro. */
      .gp-anadir-fondo { display: block; position: fixed; inset: 0; z-index: 60; background: rgba(10, 23, 51, .4); }
      .gp-anadir-panel { position: fixed; top: auto; left: 0; right: 0; bottom: 0; z-index: 61; width: auto; max-height: 85dvh; overflow-y: auto;
        padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; }
    }
  `]
})
export class GruposComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  grupos = signal<Grupo[]>([]);
  seleccionado = signal<number | null>(null);
  nuevo = signal(false);
  actual = computed(() => this.grupos().find((g) => g.id === this.seleccionado()) ?? null);
  nombre = '';
  espacio = '';
  confirmarBorrar = signal<number | null>(null);
  editando = signal<number | null>(null);
  nombreEdicion = '';
  espacioEdicion = '';
  catalogo = signal<Persona[]>([]);
  busquedaAsignar = signal('');
  correoAsignar = signal('');
  /** Búsqueda, página y menú "⋯" (todo en el navegador, con lo que ya llegó del backend). */
  busqueda = signal('');
  pagina = signal(1);
  busquedaEstudiante = signal('');
  paginaEstudiantes = signal(1);
  menuAbierto = signal<number | null>(null);
  private auth = inject(AuthService);
  private filtro = inject(BusquedaService);
  error = signal('');
  readonly filtrados = computed(() => {
    const q = (this.busqueda() + ' ' + this.filtro.texto()).trim().toLowerCase();
    return this.grupos().filter((grupo) => !q || q.split(/\s+/).every((t) =>
      grupo.nombre.toLowerCase().includes(t) || grupo.espacioAcademico.toLowerCase().includes(t)));
  });
  readonly paginaGrupos = computed(() => paginar(this.filtrados(), this.pagina(), 6));
  readonly estudiantesFiltrados = computed(() => {
    const q = this.busquedaEstudiante().trim().toLowerCase();
    return (this.actual()?.estudiantes ?? []).filter((e) => !q || e.nombre.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
  });
  readonly paginaEstudiantesLista = computed(() => paginar(this.estudiantesFiltrados(), this.paginaEstudiantes(), 8));
  /** Id del menú "⋯" de un estudiante (negativo y lejos de los ids de grupo, que también usan el menú). */
  menuEstudiante(id: number) { return -1000000 - id; }
  readonly disponibles = computed(() => {
    const ya = new Set((this.actual()?.estudiantes ?? []).map((estudiante) => estudiante.email.toLowerCase()));
    const q = this.busquedaAsignar().trim().toLowerCase();
    return this.catalogo().filter((estudiante) => !ya.has(estudiante.email.toLowerCase())
      && (!q || estudiante.nombre.toLowerCase().includes(q) || estudiante.email.toLowerCase().includes(q)));
  });
  puedeGestionar() { return this.auth.puede('GESTIONAR_ESPACIOS_ACADEMICOS'); }
  constructor() {
    this.cargar();
    if (this.puedeGestionar()) this.cargarCatalogo();
  }
  alternarNuevo() { this.nuevo.set(!this.nuevo()); }
  /** Panel de "+ Añadir estudiante": el mismo formulario de asignar, desplegable. */
  anadirAbierto = signal(false);
  alternarAnadir() {
    const abrir = !this.anadirAbierto();
    this.menuAbierto.set(null);
    this.anadirAbierto.set(abrir);
    if (abrir) setTimeout(() => document.querySelector<HTMLElement>('.gp-anadir-panel input')?.focus());
  }
  cerrarAnadir(devolverFoco = false) {
    if (!this.anadirAbierto()) return;
    this.anadirAbierto.set(false);
    if (devolverFoco) document.getElementById('gp-anadir')?.focus();
  }
  /** "Estudiante de práctica" → "EP": primera letra del primer y del último nombre. */
  iniciales(nombre: string) {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }
  /** Elegir desde la lista; en celular la página baja sola hasta el panel del grupo. */
  elegirDeLista(id: number) {
    this.elegir(id);
    if (matchMedia('(max-width: 767.98px)').matches) {
      setTimeout(() => document.getElementById('gp-detalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }
  alternarMenu(id: number) {
    const abrir = this.menuAbierto() !== id;
    this.anadirAbierto.set(false);
    this.menuAbierto.set(abrir ? id : null);
    if (abrir) setTimeout(() => document.querySelector<HTMLElement>('.gp-menu [role="menuitem"]')?.focus());
  }
  /** Cierra el menú "⋯" y el panel de añadir (clic afuera o Escape); con Escape el foco vuelve a su botón. */
  cerrarMenu(devolverFoco = false) {
    this.cerrarAnadir(devolverFoco);
    const id = this.menuAbierto();
    if (id === null) return;
    this.menuAbierto.set(null);
    if (devolverFoco) document.getElementById('mas-' + id)?.focus();
  }
  /** Flechas arriba/abajo entre las opciones del menú. */
  teclaMenu(evento: KeyboardEvent) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    evento.preventDefault();
    const items = Array.from(document.querySelectorAll<HTMLElement>('.gp-menu [role="menuitem"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (evento.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  }
  pedirBorrado(grupo: Grupo) {
    this.menuAbierto.set(null);
    this.editando.set(null);
    this.elegir(grupo.id);
    this.confirmarBorrar.set(grupo.id);
  }
  crear() {
    this.http.post<Grupo>('/api/docente/grupos', { nombre: this.nombre, espacioAcademico: this.espacio }).subscribe({
      next: () => { this.nombre = ''; this.espacio = ''; this.nuevo.set(false); this.error.set(''); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  empezarEdicion(grupo: Grupo) {
    this.menuAbierto.set(null);
    this.confirmarBorrar.set(null);
    this.editando.set(grupo.id);
    this.nombreEdicion = grupo.nombre;
    this.espacioEdicion = grupo.espacioAcademico;
    this.elegir(grupo.id);
  }
  cancelarEdicion() { this.editando.set(null); }
  guardarEdicion(id: number) {
    this.http.put<Grupo>(`/api/docente/grupos/${id}`, { nombre: this.nombreEdicion, espacioAcademico: this.espacioEdicion }).subscribe({
      next: () => { this.editando.set(null); this.error.set(''); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  borrarGrupo(id: number) {
    this.http.delete(`/api/docente/grupos/${id}`).subscribe({
      next: () => { this.confirmarBorrar.set(null); this.editando.set(null); this.seleccionado.set(null); this.error.set(''); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  agregar(id: number) {
    const email = this.correoAsignar();
    if (!email) { this.error.set('Elige un estudiante dado de alta.'); return; }
    this.http.post(`/api/docente/grupos/${id}/estudiantes`, { nombre: '', email }).subscribe({
      next: () => { this.correoAsignar.set(''); this.busquedaAsignar.set(''); this.error.set(''); this.anadirAbierto.set(false); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  retirar(grupoId: number, estudianteId: number) {
    this.http.delete(`/api/docente/grupos/${grupoId}/estudiantes/${estudianteId}`).subscribe({ next: () => this.cargar() });
  }
  elegir(id: number) {
    if (this.seleccionado() !== id) {
      this.busquedaEstudiante.set('');
      this.busquedaAsignar.set('');
      this.correoAsignar.set('');
      this.paginaEstudiantes.set(1);
      this.anadirAbierto.set(false);
      if (this.confirmarBorrar() !== id) this.confirmarBorrar.set(null);
      if (this.editando() !== id) this.editando.set(null);
    }
    this.seleccionado.set(id);
  }
  private cargarCatalogo() {
    this.http.get<Persona[]>('/api/docente/estudiantes').subscribe({
      next: (dato) => this.catalogo.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private cargar() {
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => {
      this.grupos.set(dato);
      if (!dato.some((g) => g.id === this.seleccionado())) this.seleccionado.set(dato[0]?.id ?? null);
      const paginas = Math.max(1, Math.ceil(this.filtrados().length / 6));
      if (this.pagina() > paginas) this.pagina.set(paginas);
    });
  }
}

type FiltroSesion = 'TODAS' | 'SIN_INICIAR' | 'EN_CURSO' | 'FINALIZADO';

@Component({
  selector: 'app-programar',
  host: { '(document:click)': 'menuAbierto.set(null)', '(document:keydown.escape)': 'escape()' },
  imports: [IconoComponent, MarcoDocenteComponent, FormsModule, RouterLink, PaginacionGpComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Agenda un caso publicado con un grupo y abre la sesión cuando corresponda.">
      <section class="gp">
        @if (error() && !panelAbierto()) { <p class="gp-error" role="alert">{{ error() }}</p> }
        @if (ok() && !panelAbierto()) { <p class="gp-ok" role="status">{{ ok() }}</p> }

        @if (panelAbierto()) {
          <div class="pg-velo" aria-hidden="true" (click)="pedirCierre()"></div>
          <form class="pg-panel" role="dialog" aria-modal="true" aria-labelledby="titulo-programar" (click)="$event.stopPropagation()"
            (ngSubmit)="principal()" (input)="tocado = true" (change)="tocado = true">
            <header class="pg-panel-cabeza">
              <div>
                <h2 id="titulo-programar">{{ editandoId() ? 'Editar convocatoria' : 'Programar sesión' }}</h2>
                <p>Agenda un caso publicado con uno de tus grupos.</p>
              </div>
              <button type="button" class="pg-cerrar" aria-label="Cerrar" (click)="pedirCierre()">×</button>
            </header>

            <div class="pg-panel-cuerpo">
              @if (error()) { <p class="gp-error" role="alert">{{ error() }}</p> }
              @if (ok()) { <p class="gp-ok" role="status">{{ ok() }}</p> }
              <fieldset class="pg-seccion">
                <legend>Caso y grupo</legend>
                <label class="pg-campo"><span>Caso publicado</span>
                  <select name="casoId" [(ngModel)]="casoId">
                    @if (!publicados().length) { <option [ngValue]="0">No tienes casos publicados</option> }
                    @for (caso of publicados(); track caso.id) { <option [ngValue]="caso.id">{{ caso.nombre }}</option> }
                  </select>
                </label>
                <label class="pg-campo"><span>Grupo</span>
                  <select name="grupoId" [(ngModel)]="grupoId">
                    @for (grupo of grupos(); track grupo.id) { <option [ngValue]="grupo.id">{{ grupo.nombre }} · {{ grupo.espacioAcademico }}</option> }
                  </select>
                </label>
              </fieldset>

              <fieldset class="pg-seccion">
                <legend>Horario</legend>
                <div class="pg-dos">
                  <label class="pg-campo"><span>Inicio</span><input name="inicio" type="datetime-local" [(ngModel)]="inicio" /></label>
                  <label class="pg-campo"><span>Fin</span><input name="fin" type="datetime-local" [(ngModel)]="fin" /></label>
                </div>
                <div class="pg-dos">
                  <label class="pg-campo"><span>Tiempo máximo</span>
                    <span class="pg-unidad"><input name="tiempoMax" type="number" min="1" [(ngModel)]="tiempoMax" aria-describedby="ayuda-horario" /><i aria-hidden="true">min</i></span>
                  </label>
                  <label class="pg-campo"><span>Tolerancia de ingreso</span>
                    <span class="pg-unidad"><input name="tolerancia" type="number" min="0" [(ngModel)]="tolerancia" aria-describedby="ayuda-horario" /><i aria-hidden="true">min</i></span>
                  </label>
                </div>
                <p class="pg-ayuda" id="ayuda-horario">Máximo hasta {{ casoElegido()?.tiempoEstimadoMin ?? '—' }} min (lo que dura el caso). Pasada la tolerancia, nadie más puede iniciar.</p>
              </fieldset>

              <fieldset class="pg-seccion">
                <legend>Lugar y mensaje</legend>
                <label class="pg-campo"><span>Lugar (si aplica)</span><input name="lugar" [(ngModel)]="lugar" placeholder="Ej. Aula 302 o Virtual" /></label>
                <label class="pg-campo"><span>Mensaje para los estudiantes (opcional)</span>
                  <textarea name="mensaje" [(ngModel)]="mensaje" placeholder="Aparece en el correo y antes de iniciar."></textarea>
                </label>
                <p class="pg-nota">Cada estudiante recibe por correo la URL y su <strong>código de acceso</strong>. La sesión queda “Sin iniciar” hasta que la abras.</p>
              </fieldset>
            </div>

            <footer class="pg-panel-pie">
              @if (confirmarCierre()) {
                <p class="pg-confirmar" role="alert">Tienes cambios sin guardar. ¿Cerrar de todos modos?</p>
                <div class="pg-botones">
                  <button class="gp-btn gp-btn-borde" type="button" (click)="confirmarCierre.set(false)">Seguir editando</button>
                  <button class="gp-btn gp-btn-peligro-solido" type="button" (click)="cerrarPanel()">Cerrar sin guardar</button>
                </div>
              } @else {
                <button class="pg-limpiar" type="button" (click)="limpiar(); tocado = false">{{ editandoId() ? 'Cancelar edición' : 'Limpiar' }}</button>
                <div class="pg-botones">
                  <button class="gp-btn gp-btn-borde" type="button" (click)="borrador(); tocado = false">Guardar borrador</button>
                  <button class="gp-btn gp-btn-oscuro" type="submit">{{ editandoId() ? 'Guardar cambios' : 'Agendar y notificar' }}</button>
                </div>
              }
            </footer>
          </form>
        }

        <section class="pg-convocatorias" aria-labelledby="titulo-convocatorias">
          <div class="pg-conv-cabeza">
            <h2 id="titulo-convocatorias">Convocatorias <span>{{ sesiones().length }}</span></h2>
            <div class="pg-conv-herramientas">
              <label class="pg-buscar">
                <app-icono nombre="buscar" [tamano]="16" />
                <span class="solo-lector">Buscar convocatoria por caso o código</span>
                <input type="search" placeholder="Buscar caso o código" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
              </label>
              <button class="gp-btn gp-btn-oscuro pg-programar" id="pg-programar" type="button" (click)="abrirPanel()">
                <app-icono nombre="mas" [tamano]="16" /> Programar sesión
              </button>
            </div>
          </div>
          <div class="pg-pestanas" role="group" aria-label="Filtrar por estado">
            @for (f of filtros; track f.valor) {
              <button type="button" class="pg-pestana" [class.activa]="filtroEstado() === f.valor" [attr.aria-pressed]="filtroEstado() === f.valor"
                (click)="filtroEstado.set(f.valor); pagina.set(1)">{{ f.texto }} <span class="pg-cuenta">{{ conteo(f.valor) }}</span></button>
            }
          </div>
            <table class="pg-tabla">
              <thead><tr>
                <th scope="col" class="pg-c-caso">Caso · código</th><th scope="col" class="pg-c-grupo">Grupo</th><th scope="col" class="pg-c-inicio">Inicio</th>
                <th scope="col" class="pg-c-estado">Estado</th><th scope="col" class="pg-c-acciones">Acción</th>
              </tr></thead>
              <tbody>
                @for (sesion of paginaSesiones(); track sesion.id) {
                  @let cuando = fecha(sesion.inicio).split(' · ');
                  <tr>
                    <td class="pg-td-caso"><span class="pg-caso" [title]="sesion.caso">{{ sesion.caso }}</span><span class="pg-codigo">{{ sesion.codigo }}</span></td>
                    <td class="pg-td-grupo"><span [title]="sesion.grupo">{{ sesion.grupo }}</span></td>
                    <td class="pg-td-inicio"><span class="pg-dia">{{ cuando[0] }}</span><span class="pg-hora">{{ cuando[1] }}</span></td>
                    <td class="pg-td-estado"><span class="pg-estado" [attr.data-estado]="sesion.estado"><i aria-hidden="true"></i>{{ etiquetaEstadoSesion(sesion.estado) }}</span></td>
                    <td class="pg-td-acciones">
                      <div class="pg-acciones" (click)="$event.stopPropagation()">
                        @if (sesion.estado === 'SIN_INICIAR') {
                          <button class="pg-principal" type="button" (click)="accion(sesion.id, 'iniciar')"
                            [attr.aria-label]="'Iniciar la sesión ' + sesion.codigo">Iniciar</button>
                        } @else if (sesion.estado === 'EN_CURSO') {
                          <a class="pg-suave" routerLink="/docente/seguimiento" [attr.aria-label]="'Bitácora de la sesión ' + sesion.codigo">Bitácora <span aria-hidden="true">›</span></a>
                        } @else {
                          <a class="pg-suave" routerLink="/docente/seguimiento" [attr.aria-label]="'Reportes de la sesión ' + sesion.codigo">Ver reportes <span aria-hidden="true">›</span></a>
                        }
                        @if (sesion.estado === 'FINALIZADO') {
                          <span class="pg-mas-vacio" aria-hidden="true"></span>
                        } @else {
                          <button type="button" class="pg-mas" [id]="'pg-mas-' + sesion.id" aria-haspopup="menu"
                            [attr.aria-expanded]="menuAbierto() === sesion.id" [attr.aria-label]="'Más acciones de la sesión ' + sesion.codigo"
                            (click)="alternarMenu(sesion.id, $event)"><app-icono nombre="puntos" [tamano]="20" /></button>
                          @if (menuAbierto() === sesion.id) {
                            <div class="pg-menu" role="menu" [attr.aria-label]="'Acciones de la sesión ' + sesion.codigo"
                              [style.top.px]="menuPos().top" [style.bottom.px]="menuPos().bottom" [style.right.px]="menuPos().right">
                              @if (sesion.estado === 'SIN_INICIAR') {
                                <button type="button" role="menuitem" (click)="menuAbierto.set(null); cargarEdicion(sesion); abrirPanel()">Editar</button>
                              } @else {
                                <button type="button" role="menuitem" class="peligro" (click)="menuAbierto.set(null); accion(sesion.id, 'finalizar')">Finalizar</button>
                              }
                            </div>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr class="pg-vacio"><td colspan="5">{{ sesiones().length ? 'Ninguna convocatoria coincide con el filtro.' : 'Todavía no tienes convocatorias.' }}</td></tr>
                }
              </tbody>
            </table>
          @if (sesionesFiltradas().length) {
            <div class="pg-pie-lista">
              <app-paginacion-gp [total]="sesionesFiltradas().length" [pagina]="pagina()" [porPagina]="porPagina" [simple]="true"
                que="convocatorias" prefijo="Mostrando " (cambiar)="pagina.set($event)" />
            </div>
          }
        </section>
      </section>
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    /* Lista de convocatorias: un panel blanco a lo ancho. */
    .pg-convocatorias { position: relative; z-index: 1; min-width: 0; background: #fff; border: 1px solid #e6edf8; border-radius: 18px;
      box-shadow: 0 1px 2px rgba(16, 24, 40, .03); --gp-pag-activa: #eef4ff; --gp-pag-activa-borde: #eef4ff; }
    .pg-conv-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 18px 18px 6px; }
    .pg-conv-cabeza h2 { margin: 0; font-size: 17px; font-weight: 800; color: var(--dl-tinta); }
    .pg-conv-cabeza h2 span { font-weight: 500; color: #9aa6c0; }
    .pg-conv-herramientas { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .pg-buscar { display: flex; align-items: center; gap: 8px; width: 230px; height: 38px; padding: 0 14px; box-sizing: border-box; border-radius: 999px;
      background: #f5f8fe; color: #7a86a3; }
    .pg-buscar:focus-within { box-shadow: 0 0 0 2px rgba(31, 92, 240, .35); }
    .pg-buscar svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .pg-convocatorias .pg-buscar input[type="search"] { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; border-radius: 0;
      background: transparent; box-shadow: none; outline: none; font: inherit; font-size: 13px; color: var(--dl-tinta); }
    .pg-convocatorias .pg-buscar input[type="search"]::placeholder { color: #7a86a3; }
    .gp-btn.pg-programar { min-height: 38px; padding: 0 16px; gap: 6px; font-size: 13.5px; }
    .pg-programar svg { width: 16px; height: 16px; }

    /* Pestañas de texto subrayadas, con su número. */
    .pg-pestanas { display: flex; gap: 22px; padding: 0 18px; overflow-x: auto; scrollbar-width: none; }
    .pg-pestanas::-webkit-scrollbar { display: none; }
    .pg-pestana { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0; border: 0; border-bottom: 2px solid transparent;
      background: none; color: #4d5b7c; font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; box-shadow: none; }
    .pg-pestana:hover, .pg-pestana:active { color: var(--dl-tinta); transform: none; }
    .pg-pestana.activa { color: var(--dl-tinta); border-bottom-color: #1f5cf0; }
    .pg-cuenta { min-width: 18px; padding: 1px 6px; box-sizing: border-box; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 16px;
      text-align: center; color: #9aa6c0; background: #edf1f8; }
    .pg-pestana.activa .pg-cuenta { color: #fff; background: #1f5cf0; }
    .pg-pestana:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; border-radius: 4px; }

    /* Tabla dentro del panel, sin caja propia. */
    .pg-tabla { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
    .pg-tabla th { padding: 10px 18px; text-align: left; font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase;
      color: #8a96b2; background: #f8fbff; border-top: 1px solid #eef2f9; border-bottom: 1px solid #eef2f9; white-space: nowrap; }
    .pg-c-grupo { width: 18%; } .pg-c-inicio { width: 15%; } .pg-c-estado { width: 13%; } .pg-c-acciones { width: 200px; }
    .pg-tabla th.pg-c-acciones { text-align: right; }
    .pg-tabla td { height: 62px; padding: 0 18px; box-sizing: border-box; vertical-align: middle; border-bottom: 1px solid #f0f4fa; }
    .pg-td-caso > span, .pg-td-inicio > span { display: block; }
    .pg-caso { font-weight: 600; color: var(--dl-tinta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pg-codigo { margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; font-size: 12px; color: #8a96b2; }
    .pg-td-grupo { font-size: 13.5px; color: #4d5b7c; }
    .pg-td-grupo span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pg-dia { font-size: 13.5px; color: var(--dl-tinta); white-space: nowrap; }
    .pg-hora { margin-top: 2px; font-size: 12px; color: #8a96b2; white-space: nowrap; }
    .pg-estado { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #5b6b8c; white-space: nowrap; }
    .pg-estado i { width: 7px; height: 7px; border-radius: 50%; flex: none; background: #9fb2d6; }
    .pg-estado[data-estado="EN_CURSO"] { color: #1747c2; }
    .pg-estado[data-estado="EN_CURSO"] i { background: #2a7bff; box-shadow: 0 0 0 3px rgba(42, 123, 255, .18); }
    .pg-estado[data-estado="FINALIZADO"] { color: #17683d; }
    .pg-estado[data-estado="FINALIZADO"] i { background: #22a55a; }
    .pg-td-acciones { text-align: right; }
    .pg-vacio td { height: 90px; text-align: center; color: #6b7690; }
    .pg-pie-lista { padding: 14px 18px; }

    .pg-acciones { display: flex; flex-wrap: nowrap; align-items: center; justify-content: flex-end; gap: 6px; }
    .pg-principal, .pg-suave { min-height: 32px; display: inline-flex; align-items: center; gap: 4px; padding: 0 12px; border-radius: 999px;
      font: inherit; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; cursor: pointer; }
    .pg-principal { border: 0; background: var(--dl-degradado); color: #fff; }
    .pg-principal:hover { filter: brightness(1.06); }
    .pg-suave { padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: #1f5cf0; }
    .pg-suave:hover { background: #eef4ff; }
    .pg-mas, .pg-mas-vacio { flex: none; width: 34px; height: 34px; }
    .pg-mas { display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #8a96b2; cursor: pointer; box-shadow: none; }
    .pg-mas svg { width: 17px; height: 17px; fill: currentColor; }
    .pg-mas:hover, .pg-mas[aria-expanded="true"] { background: #eef2f9; }
    .pg-principal:focus-visible, .pg-suave:focus-visible, .pg-mas:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }
    /* Fijo a la ventana: la tabla que se desplaza de lado no lo recorta. */
    .pg-menu { position: fixed; z-index: 50; min-width: 160px; padding: 4px; display: grid; gap: 2px; text-align: left;
      background: #fff; border: 1px solid #e6ecf6; border-radius: 10px; box-shadow: 0 8px 20px rgba(16, 24, 40, .10); }
    .pg-menu button { min-height: 36px; display: flex; align-items: center; padding: 0 12px; border: 0; border-radius: 7px; background: transparent;
      color: var(--dl-tinta); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .pg-menu button:hover, .pg-menu button:focus-visible { background: #f2f6ff; outline: none; }
    .pg-menu .peligro { color: #a4271b; }
    .pg-menu .peligro:hover { background: #fdf1f0; }

    /* Formulario en panel lateral desde la derecha, con velo oscuro detrás. */
    .pg-velo { position: fixed; inset: 0; z-index: 1000; background: rgba(15, 27, 61, .28); animation: pg-aparecer .2s ease; }
    .pg-panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1001; width: 480px; max-width: 100%; box-sizing: border-box;
      display: flex; flex-direction: column; background: #fff; box-shadow: -12px 0 32px rgba(15, 27, 61, .12); animation: pg-entrar .24s ease-out; }
    @keyframes pg-aparecer { from { opacity: 0; } }
    @keyframes pg-entrar { from { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) { .pg-velo, .pg-panel { animation: none; } }
    .pg-panel-cabeza { flex: none; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px 16px;
      border-bottom: 1px solid #eef2f9; }
    .pg-panel-cabeza h2 { margin: 0; font-size: 18px; font-weight: 800; color: var(--dl-tinta); }
    .pg-panel-cabeza p { margin: 2px 0 0; font-size: 13px; color: #7a86a3; }
    .pg-cerrar { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 10px; background: #f3f6fc;
      color: #4d5b7c; font: inherit; font-size: 18px; line-height: 1; cursor: pointer; box-shadow: none; }
    .pg-cerrar:hover { background: #e8eef9; transform: none; }
    .pg-panel-cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 22px 18px; }
    .pg-panel-cuerpo > .gp-error, .pg-panel-cuerpo > .gp-ok { margin-top: 14px; }
    .pg-seccion { margin: 0; padding: 18px 0; border: 0; border-bottom: 1px solid #eef2f9; display: grid; gap: 12px; min-width: 0; }
    .pg-seccion:last-child { border-bottom: 0; }
    .pg-seccion legend { float: left; width: 100%; padding: 0; margin: 0 0 2px; font-size: 12px; font-weight: 700; letter-spacing: .06em;
      text-transform: uppercase; color: #8a96b2; }
    .pg-seccion legend + * { clear: both; }
    .pg-dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
    .pg-campo { display: grid; gap: 6px; min-width: 0; }
    .pg-campo > span:first-child { font-size: 12.5px; font-weight: 600; color: #4d5b7c; text-transform: none; letter-spacing: 0; }
    .pg-panel .pg-campo input:not([type="checkbox"]), .pg-panel .pg-campo select, .pg-panel .pg-campo textarea {
      width: 100%; min-width: 0; box-sizing: border-box; height: 40px; padding: 0 12px; border: 1px solid #e1e9f6; border-radius: 12px; background-color: #f8fbff;
      color: var(--dl-tinta); font: inherit; font-size: 13.5px; box-shadow: none; }
    .pg-panel .pg-campo input[type="datetime-local"] { padding: 0 8px 0 10px; font-size: 13px; }
    .pg-panel .pg-campo textarea { height: auto; min-height: 72px; padding: 10px 12px; resize: vertical; }
    .pg-panel .pg-campo input:focus, .pg-panel .pg-campo select:focus, .pg-panel .pg-campo textarea:focus {
      outline: none; border-color: #1f5cf0; box-shadow: 0 0 0 3px rgba(31, 92, 240, .15); background-color: #fff; }
    .pg-panel .pg-campo input::placeholder, .pg-panel .pg-campo textarea::placeholder { color: #9aa6c0; }
    .pg-unidad { position: relative; display: block; }
    .pg-panel .pg-unidad input:not([type="checkbox"]) { padding-right: 44px; -moz-appearance: textfield; }
    .pg-unidad input::-webkit-inner-spin-button, .pg-unidad input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .pg-unidad i { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 12.5px; color: #8a96b2; pointer-events: none; }
    .pg-ayuda { margin: 0; font-size: 12px; line-height: 1.45; color: #7a86a3; }
    .pg-nota { margin: 2px 0 0; padding: 10px 12px; border-radius: 12px; background: #f5f8fe; font-size: 12.5px; line-height: 1.45; color: #4d5b7c; }
    .pg-nota strong { color: var(--dl-tinta); }
    .pg-panel-pie { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 22px;
      border-top: 1px solid #eef2f9; background: #fff; }
    .pg-botones { display: flex; gap: 10px; }
    .pg-botones .gp-btn { min-height: 40px; padding: 0 18px; font-size: 13.5px; white-space: nowrap; }
    .pg-limpiar { padding: 8px 4px; border: 0; background: none; color: #33415c; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer;
      box-shadow: none; white-space: nowrap; }
    .pg-limpiar:hover { color: var(--dl-tinta); text-decoration: underline; transform: none; }
    .pg-confirmar { margin: 0; font-size: 13px; font-weight: 600; color: #9b1c12; }
    .pg-cerrar:focus-visible, .pg-limpiar:focus-visible, .pg-botones .gp-btn:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }

    @media (max-width: 767.98px) {
      /* Arriba de la lista: buscador y "+ Programar sesión" a lo ancho. */
      .pg-conv-cabeza { flex-direction: column; align-items: stretch; padding: 16px 14px 4px; }
      .pg-conv-herramientas { flex-direction: column; align-items: stretch; }
      .pg-buscar { width: 100%; }
      .pg-pestanas { padding: 0 14px; gap: 18px; }
      /* Cada convocatoria apilada: caso y código; grupo · fecha y hora; estado y acción. */
      .pg-tabla, .pg-tabla tbody { display: block; }
      .pg-tabla thead { display: none; }
      .pg-tabla tr { display: flex; flex-wrap: wrap; align-items: center; row-gap: 4px; padding: 12px 8px 10px 14px; border-top: 1px solid #f0f4fa; }
      .pg-tabla tr::after { content: ""; order: 4; flex-basis: 100%; height: 0; }
      .pg-tabla td { height: auto; padding: 0; border: 0; }
      .pg-td-caso { order: 1; flex-basis: 100%; padding-right: 6px !important; }
      .pg-caso { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
      .pg-td-grupo { order: 2; flex: 0 1 auto; min-width: 0; max-width: calc(100% - 160px); font-size: 13px; }
      .pg-td-inicio { order: 3; flex: none; padding-left: 5px !important; font-size: 13px; white-space: nowrap; }
      .pg-td-inicio::before { content: "· "; color: #8a96b2; }
      .pg-td-inicio > span { display: inline; }
      .pg-dia { font-size: 13px; color: #4d5b7c; }
      .pg-hora { margin: 0 0 0 4px; font-size: 13px; color: #8a96b2; }
      .pg-td-estado { order: 5; margin-top: 4px; }
      .pg-td-acciones { order: 6; margin: 4px 0 0 auto; }
      .pg-tabla tr.pg-vacio { display: block; padding: 24px 14px; text-align: center; }
      .pg-pie-lista { padding: 12px 14px; border-top: 1px solid #f0f4fa; }
      /* El formulario ocupa toda la pantalla, con los botones fijos abajo y un campo debajo del otro. */
      .pg-panel { width: 100%; }
      .pg-panel-cabeza { padding: 16px 16px 14px; }
      .pg-panel-cuerpo { padding: 4px 16px 16px; }
      .pg-dos { grid-template-columns: minmax(0, 1fr); }
      .pg-panel-pie { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
      .pg-limpiar { justify-self: start; padding: 4px 2px; }
      .pg-botones { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
      .pg-botones .gp-btn { padding: 0 10px; }
    }
  `]
})
export class ProgramarComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private filtro = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  grupos = signal<Grupo[]>([]);
  sesiones = signal<Sesion[]>([]);
  casoId = 0;
  grupoId = 0;
  inicio = '';
  fin = '';
  tiempoMax = 30;
  tolerancia = 15;
  lugar = '';
  mensaje = '';
  error = signal('');
  ok = signal('');
  editandoId = signal<number | null>(null);
  /** Filtros, búsqueda y página de la tabla de convocatorias (en el navegador). */
  readonly filtros: { valor: FiltroSesion; texto: string }[] = [
    { valor: 'TODAS', texto: 'Todas' }, { valor: 'SIN_INICIAR', texto: 'Sin iniciar' },
    { valor: 'EN_CURSO', texto: 'En curso' }, { valor: 'FINALIZADO', texto: 'Finalizadas' }
  ];
  filtroEstado = signal<FiltroSesion>('TODAS');
  busqueda = signal('');
  pagina = signal(1);
  /** Se vuelve a leer cuando cambia un campo del formulario (los campos no son señales). */
  readonly publicados = computed(() => this.casos().filter((c) => c.estado === 'PUBLICADO'));
  readonly sesionesFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const q = (this.busqueda() + ' ' + this.filtro.texto()).trim().toLowerCase();
    return this.sesiones().filter((s) => (estado === 'TODAS' || s.estado === estado)
      && (!q || q.split(/\s+/).every((t) => s.caso.toLowerCase().includes(t) || s.codigo.toLowerCase().includes(t) || s.grupo.toLowerCase().includes(t))));
  });
  readonly porPagina = 7;
  readonly paginaSesiones = computed(() => paginar(this.sesionesFiltradas(), this.pagina(), this.porPagina));
  conteo(estado: FiltroSesion) {
    return estado === 'TODAS' ? this.sesiones().length : this.sesiones().filter((s) => s.estado === estado).length;
  }
  /** Panel lateral con el formulario. "tocado": hay cambios sin guardar desde que se abrió. */
  panelAbierto = signal(false);
  confirmarCierre = signal(false);
  tocado = false;
  abrirPanel() {
    this.menuAbierto.set(null);
    this.confirmarCierre.set(false);
    this.tocado = false;
    this.error.set('');
    if (!this.editandoId()) this.ok.set('');
    this.panelAbierto.set(true);
    setTimeout(() => document.querySelector<HTMLElement>('.pg-panel select')?.focus());
  }
  /** ×, Esc o clic en el velo: si hay cambios sin guardar, pregunta antes de cerrar. */
  pedirCierre() {
    if (this.tocado && !this.confirmarCierre()) {
      this.confirmarCierre.set(true);
      setTimeout(() => document.querySelector<HTMLElement>('.pg-panel-pie .gp-btn')?.focus());
      return;
    }
    if (!this.tocado) this.cerrarPanel();
  }
  /** Cierra el panel. Si se descartan cambios o se termina una edición, el formulario vuelve al borrador guardado (o vacío). */
  cerrarPanel(restablecer = this.tocado || !!this.editandoId()) {
    this.panelAbierto.set(false);
    this.confirmarCierre.set(false);
    this.tocado = false;
    if (restablecer) {
      this.limpiar();
      this.cargarBorrador();
    }
    this.error.set('');
    setTimeout(() => document.getElementById('pg-programar')?.focus({ preventScroll: true }));
  }
  escape() {
    if (this.menuAbierto() !== null) this.cerrarMenu();
    else if (this.confirmarCierre()) this.confirmarCierre.set(false);
    else if (this.panelAbierto()) this.pedirCierre();
  }
  /** Aviso corto de éxito en la página: se quita solo. */
  private avisar(texto: string) {
    this.ok.set(texto);
    setTimeout(() => { if (this.ok() === texto) this.ok.set(''); }, 6000);
  }
  /** Menú "⋯" de cada convocatoria; fijo a la ventana para que la tabla no lo recorte. */
  menuAbierto = signal<number | null>(null);
  menuPos = signal<{ top: number | null; bottom: number | null; right: number }>({ top: null, bottom: null, right: 0 });
  alternarMenu(id: number, evento: MouseEvent) {
    const abrir = this.menuAbierto() !== id;
    if (abrir) {
      const b = (evento.currentTarget as HTMLElement).getBoundingClientRect();
      const abajo = innerHeight - b.bottom > 120;
      this.menuPos.set({ top: abajo ? b.bottom + 4 : null, bottom: abajo ? null : innerHeight - b.top + 4, right: innerWidth - b.right });
      document.addEventListener('scroll', () => this.menuAbierto.set(null), { capture: true, once: true });
      setTimeout(() => document.querySelector<HTMLElement>('.pg-menu [role="menuitem"]')?.focus());
    }
    this.menuAbierto.set(abrir ? id : null);
  }
  cerrarMenu() {
    const id = this.menuAbierto();
    if (id === null) return;
    this.menuAbierto.set(null);
    document.getElementById('pg-mas-' + id)?.focus();
  }
  constructor() {
    this.cargarBorrador();
    const caso = Number(this.route.snapshot.queryParamMap.get('caso') || 0);
    const grupo = Number(this.route.snapshot.queryParamMap.get('grupo') || 0);
    if (caso) this.casoId = caso;
    if (grupo) this.grupoId = grupo;
    if (caso || grupo) this.panelAbierto.set(true);
    this.cargar();
  }
  private cargarBorrador() {
    const guardado = localStorage.getItem('dilema-agenda');
    if (guardado) {
      try {
        const dato = JSON.parse(guardado);
        this.casoId = dato.casoId ?? 0;
        this.grupoId = dato.grupoId ?? 0;
        this.inicio = dato.inicio ?? '';
        this.fin = dato.fin ?? '';
        this.tiempoMax = dato.tiempoMax ?? 30;
        this.tolerancia = dato.tolerancia ?? 15;
        this.lugar = dato.lugar ?? '';
        this.mensaje = dato.mensaje ?? '';
      } catch { localStorage.removeItem('dilema-agenda'); }
    }
  }
  casoElegido() { return this.casos().find((c) => c.id === Number(this.casoId)) ?? null; }
  grupoElegido() { return this.grupos().find((g) => g.id === Number(this.grupoId)) ?? null; }
  /** "24 nov 2026 · 8:00 a. m." */
  fecha(valor: string) {
    const d = new Date(valor);
    if (!valor || Number.isNaN(d.getTime())) return valor || '—';
    const partes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
      .formatToParts(d).reduce<Record<string, string>>((r, p) => ({ ...r, [p.type]: p.value }), {});
    const mes = (partes['month'] ?? '').replace('.', '');
    const periodo = (partes['dayPeriod'] ?? '').replace(/\s+/g, ' ').trim();
    return `${partes['day']} ${mes} ${partes['year']} · ${partes['hour']}:${partes['minute']} ${periodo}`.trim();
  }
  etiquetaEstadoSesion(estado: string) {
    if (estado === 'EN_CURSO') return 'En curso';
    if (estado === 'SIN_INICIAR') return 'Sin iniciar';
    if (estado === 'FINALIZADO') return 'Finalizada';
    return estado;
  }
  /** Botón principal del formulario: agendar, o guardar los cambios si se está editando una convocatoria. */
  principal() {
    if (this.editandoId()) this.guardarEdicion(); else this.agendar();
  }
  /** "Limpiar": deja el formulario como recién abierto (o sale de la edición). No borra el borrador guardado. */
  limpiar() {
    this.editandoId.set(null);
    this.casoId = this.publicados()[0]?.id ?? 0;
    this.grupoId = this.grupos()[0]?.id ?? 0;
    this.inicio = '';
    this.fin = '';
    this.tiempoMax = 30;
    this.tolerancia = 15;
    this.lugar = '';
    this.mensaje = '';
    this.ok.set('');
    this.error.set('');
  }
  borrador() {
    localStorage.setItem('dilema-agenda', JSON.stringify({
      casoId: this.casoId, grupoId: this.grupoId, inicio: this.inicio, fin: this.fin,
      tiempoMax: this.tiempoMax, tolerancia: this.tolerancia, lugar: this.lugar, mensaje: this.mensaje
    }));
    this.ok.set('Borrador guardado en este navegador.');
    this.error.set('');
  }
  agendar() {
    this.http.post<Sesion>('/api/docente/sesiones', this.cuerpoAgenda()).subscribe({
      next: () => {
        localStorage.removeItem('dilema-agenda');
        this.cerrarPanel(true);
        this.avisar('Convocatoria registrada. Los estudiantes reciben el aviso sin que el código quede visible.');
        this.cargar();
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  cargarEdicion(sesion: Sesion) {
    this.editandoId.set(sesion.id);
    this.casoId = sesion.casoId;
    this.grupoId = sesion.grupoId;
    this.inicio = this.paraCampoFecha(sesion.inicio);
    this.fin = this.paraCampoFecha(sesion.fin);
    this.tiempoMax = sesion.tiempoMaxMin;
    this.tolerancia = sesion.toleranciaMin;
    this.lugar = sesion.lugar || '';
    this.mensaje = sesion.mensaje || '';
    this.ok.set('Estás editando la convocatoria ' + sesion.codigo + '.');
    this.error.set('');
  }
  guardarEdicion() {
    const id = this.editandoId();
    if (!id) return;
    this.http.put<Sesion>(`/api/docente/sesiones/${id}`, this.cuerpoAgenda()).subscribe({
      next: () => {
        this.editandoId.set(null);
        this.cerrarPanel(true);
        this.avisar('Convocatoria actualizada. Los estudiantes reciben el aviso del cambio.');
        this.cargar();
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  cancelarEdicion() {
    this.editandoId.set(null);
    this.ok.set('');
  }
  private cuerpoAgenda() {
    return {
      casoId: Number(this.casoId), grupoId: Number(this.grupoId), inicio: this.inicio, fin: this.fin,
      tiempoMaxMin: Number(this.tiempoMax), toleranciaMin: Number(this.tolerancia), lugar: this.lugar, mensaje: this.mensaje
    };
  }
  private paraCampoFecha(valor: string) {
    if (!valor) return '';
    return valor.length >= 16 ? valor.slice(0, 16) : valor;
  }
  accion(id: number, verbo: string) {
    this.http.post(`/api/docente/sesiones/${id}/${verbo}`, {}).subscribe({ next: () => this.cargar(), error: (falla) => this.error.set(mensajeError(falla)) });
  }
  private cargar() {
    this.http.get<CasoResumen[]>('/api/docente/casos').subscribe((dato) => {
      this.casos.set(dato);
      if (!dato.some((c) => c.id === Number(this.casoId))) this.casoId = dato.find((c) => c.estado === 'PUBLICADO')?.id ?? 0;
    });
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => {
      this.grupos.set(dato);
      if (!dato.some((g) => g.id === Number(this.grupoId))) this.grupoId = dato[0]?.id ?? 0;
    });
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => this.sesiones.set(dato));
  }
}

@Component({
  selector: 'app-seguimiento',
  host: { '(document:click)': 'exportarAbierto.set(false)', '(document:keydown.escape)': 'cerrarExportar()' },
  imports: [IconoComponent, MatButtonModule, MatCardModule, MarcoDocenteComponent, RouterLink, FormsModule, PaginacionTablaComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Bitácora en vivo y consulta de sesiones ya realizadas.">
      <div class="rp-pagina">
        <div class="rp-barra">
          <label class="rp-caso">
            <span class="rp-caso-etiqueta">Caso</span>
            <select class="rp-caso-select" [(ngModel)]="sesionId" (ngModelChange)="ver($event)" aria-label="Convocatoria">
              @for (sesion of sesionesVista(); track sesion.id) {
                <option [ngValue]="sesion.id">{{ sesion.caso }} · {{ sesion.grupo }}</option>
              }
            </select>
            <svg class="rp-caso-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </label>
          <div class="rp-vista" role="group" aria-label="Qué convocatorias ver">
            <button type="button" [class.activa]="vista === 'todas'" [attr.aria-pressed]="vista === 'todas'"
              (click)="vista = 'todas'; cambiarVista()">Todas las convocatorias</button>
            <button type="button" [class.activa]="vista === 'realizadas'" [attr.aria-pressed]="vista === 'realizadas'"
              (click)="vista = 'realizadas'; cambiarVista()">Solo realizadas</button>
          </div>
          <div class="rp-exportar" (click)="$event.stopPropagation()">
            <button type="button" class="rp-exportar-boton" id="rp-exportar" aria-haspopup="menu" [attr.aria-expanded]="exportarAbierto()"
              [disabled]="!sesionId" (click)="alternarExportar()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
              Exportar
              <svg class="rp-exportar-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            @if (exportarAbierto()) {
              <div class="rp-menu" role="menu" aria-label="Exportar reporte">
                <button type="button" role="menuitem" (click)="exportar('csv')">CSV</button>
                <button type="button" role="menuitem" (click)="exportar('pdf')">PDF</button>
                <button type="button" role="menuitem" (click)="exportar('xlsx')">Excel</button>
              </div>
            }
          </div>
        </div>
        @if (aviso()) { <p class="error">{{ aviso() }}</p> }

        <section class="rp-resumen" aria-label="Resumen del grupo">
          <article class="rp-cifra">
            <h2>Promedio del grupo</h2>
            <p><strong>{{ promedio() }}</strong><span>/ 5,0</span></p>
          </article>
          <article class="rp-cifra">
            <h2>Completaron</h2>
            <p><strong>{{ finalizados() }}</strong><span>de {{ filas().length }}</span></p>
          </article>
          <article class="rp-cifra">
            <h2>Pendientes</h2>
            <p><strong>{{ filas().length - finalizados() }}</strong></p>
          </article>
          <article class="rp-cifra rp-cifra-niveles">
            <h2>Niveles</h2>
            <div class="rp-barra-niveles" role="img"
              [attr.aria-label]="'Superior ' + conteo('Superior') + ', Alto ' + conteo('Alto') + ', Básico ' + conteo('Básico') + ', Bajo ' + conteo('Bajo')">
              @for (n of niveles; track n) {
                @if (conteo(n)) { <span [attr.data-nivel]="n" [style.flex-grow]="conteo(n)"></span> }
              }
            </div>
            <ul class="rp-leyenda">
              @for (n of niveles; track n) {
                <li><i [attr.data-nivel]="n" aria-hidden="true"></i>{{ n }} <b>{{ conteo(n) }}</b></li>
              }
            </ul>
          </article>
        </section>

        <section class="rp-panel" aria-labelledby="rp-titulo-estudiantes">
          <div class="rp-panel-cabeza">
            <h2 id="rp-titulo-estudiantes">Estudiantes <span>{{ filas().length }}</span></h2>
            <label class="rp-buscar">
              <app-icono nombre="buscar" [tamano]="16" />
              <span class="solo-lector">Buscar estudiante</span>
              <input type="search" [(ngModel)]="busqueda" (ngModelChange)="pagina.set(1)" placeholder="Buscar estudiante" />
            </label>
          </div>
          @if (!filas().length) {
            <p class="rp-vacio">Aún no hay resultados para este caso</p>
          } @else {
            <table class="rp-tabla">
              <thead>
                <tr><th scope="col">Estudiante</th><th scope="col" class="rp-c-estado">Estado</th><th scope="col" class="rp-c-puntaje">Puntaje</th>
                  <th scope="col" class="rp-c-nivel">Nivel</th><th scope="col" class="rp-c-consulta">Consulta</th></tr>
              </thead>
              <tbody>
                @for (fila of filasPagina(); track fila.email) {
                  @let nivelFila = nivel(fila.nota);
                  <tr>
                    <td class="rp-td-persona">
                      <span class="rp-iniciales" aria-hidden="true">{{ iniciales(fila.estudiante) }}</span>
                      <span class="rp-persona"><strong [title]="fila.estudiante">{{ fila.estudiante }}</strong><small [title]="fila.email">{{ fila.email }}</small></span>
                    </td>
                    <td class="rp-td-estado"><span class="rp-estado" [attr.data-estado]="fila.estado"><i aria-hidden="true"></i>{{ etiquetaFila(fila.estado) }}</span></td>
                    <td class="rp-td-puntaje">
                      @if (fila.nota != null) {
                        <span class="rp-puntaje"><b>{{ fila.nota.toFixed(1) }}</b><span class="solo-lector"> de 5,0</span>
                          <span class="rp-puntaje-barra" aria-hidden="true"><i [attr.data-nivel]="nivelFila" [style.width.%]="fila.nota / 5 * 100"></i></span></span>
                      } @else { <span class="rp-tenue" aria-label="Sin puntaje">—</span> }
                    </td>
                    <td class="rp-td-nivel">
                      @if (fila.nota != null) { <span class="rp-nivel"><i [attr.data-nivel]="nivelFila" aria-hidden="true"></i>{{ nivelFila }}</span> }
                      @else { <span class="rp-tenue">Sin nivel aún</span> }
                    </td>
                    <td class="rp-td-consulta">
                      <div class="rp-consulta">
                        @if (fila.repeticionAutorizada) { <span class="rp-tenue">Repetición autorizada</span> }
                        @if (intentosDe(fila); as lista) {
                          @if (lista.length) {
                            @if (lista.length > 1) {
                              <select class="rp-intento" (change)="abrirIntento($event)" [attr.aria-label]="'Otros intentos de ' + fila.estudiante">
                                <option value="" selected disabled>{{ lista.length }} intentos</option>
                                @for (intento of lista; track intento.id) {
                                  <option [value]="intento.id">Intento {{ intento.numeroIntento }} · {{ etiquetaFila(intento.estado) }}</option>
                                }
                              </select>
                            }
                            <a class="rp-enlace" [routerLink]="['/docente/seguimiento', lista[lista.length - 1].id]">Último intento <span aria-hidden="true">›</span></a>
                          } @else if (fila.participacionId) {
                            <a class="rp-enlace" [routerLink]="['/docente/seguimiento', fila.participacionId]">Ver respuestas <span aria-hidden="true">›</span></a>
                          } @else {
                            <span class="rp-tenue">Sin intentos</span>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                } @empty { <tr class="rp-sin-coincidencias"><td colspan="5">Ningún estudiante coincide con la búsqueda.</td></tr> }
              </tbody>
            </table>
            <div class="rp-pie">
              <app-paginacion-tabla [total]="visibles().length" [pagina]="paginaActual()" (cambiar)="pagina.set($event)" />
            </div>
          }
        </section>
      </div>
    </app-marco-docente>
  `,
  styles: [`
    .rp-pagina { position: relative; z-index: 1; display: grid; gap: 16px; min-width: 0; }

    /* Barra de filtros en una línea. */
    .rp-barra { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .rp-caso { position: relative; flex: 0 1 460px; min-width: 0; height: 42px; box-sizing: border-box; display: flex; align-items: center; gap: 10px;
      padding: 0 12px 0 14px; background: #fff; border: 1px solid #e1e9f6; border-radius: 12px; }
    .rp-caso:focus-within { border-color: #1f5cf0; box-shadow: 0 0 0 3px rgba(31, 92, 240, .15); }
    .rp-caso-etiqueta { flex: none; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #8a96b2; }
    .rp-caso select.rp-caso-select { flex: 1; min-width: 0; width: auto; height: 100%; padding: 0 24px 0 0; margin: 0; border: 0; border-radius: 0;
      background: transparent; box-shadow: none; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer;
      font: inherit; font-size: 14px; font-weight: 600; color: var(--dl-tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rp-caso-flecha { position: absolute; right: 12px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); pointer-events: none;
      fill: none; stroke: #4d5b7c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .rp-vista { flex: none; display: flex; gap: 2px; padding: 3px; background: #fff; border: 1px solid #e1e9f6; border-radius: 12px; }
    .rp-vista button { height: 34px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: #4d5b7c; box-shadow: none;
      font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; }
    .rp-vista button:hover { color: var(--dl-tinta); transform: none; }
    .rp-vista button.activa { background: #eef4ff; color: #1747c2; }
    .rp-exportar { position: relative; flex: none; margin-left: auto; }
    .rp-exportar-boton { height: 42px; display: inline-flex; align-items: center; gap: 8px; padding: 0 14px; background: #fff; border: 1px solid #e1e9f6;
      border-radius: 12px; color: #1f5cf0; box-shadow: none; font: inherit; font-size: 13.5px; font-weight: 700; white-space: nowrap; cursor: pointer; }
    .rp-exportar-boton:hover:not(:disabled) { background: #f5f8fe; transform: none; }
    .rp-exportar-boton:disabled { opacity: .5; cursor: default; }
    .rp-exportar-boton svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .rp-exportar-boton .rp-exportar-flecha { width: 14px; height: 14px; }
    .rp-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 150px; padding: 6px; display: grid; background: #fff;
      border: 1px solid #e3eaf6; border-radius: 12px; box-shadow: 0 12px 28px rgba(15, 27, 61, .12); }
    .rp-menu button { padding: 9px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--dl-tinta); box-shadow: none; text-align: left;
      font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .rp-menu button:hover, .rp-menu button:focus-visible { background: #eef4ff; color: #1747c2; transform: none; outline: none; }
    .rp-vista button:focus-visible, .rp-exportar-boton:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }

    /* Resumen del grupo: 4 tarjetas pequeñas. */
    .rp-resumen { display: grid; grid-template-columns: .8fr .8fr .8fr 1.6fr; gap: 14px; }
    .rp-cifra { min-width: 0; padding: 14px 18px; background: #fff; border: 1px solid #e6edf8; border-radius: 16px; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .rp-cifra h2 { margin: 0 0 4px; font-size: 12.5px; font-weight: 600; color: #7a86a3; }
    .rp-cifra p { margin: 0; display: flex; align-items: baseline; gap: 6px; }
    .rp-cifra strong { font-size: 24px; font-weight: 800; line-height: 1.15; color: var(--dl-tinta); }
    .rp-cifra p span { font-size: 12.5px; color: #8a96b2; }
    .rp-barra-niveles { display: flex; gap: 2px; height: 10px; margin: 8px 0 8px; border-radius: 999px; overflow: hidden; background: #eef2f9; }
    .rp-barra-niveles span { flex: 1 1 0; min-width: 6px; }
    .rp-leyenda { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: #4d5b7c; }
    .rp-leyenda li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .rp-leyenda b { color: var(--dl-tinta); font-weight: 800; }
    [data-nivel="Superior"] { --nivel: #22a55a; } [data-nivel="Alto"] { --nivel: #2a7bff; }
    [data-nivel="Básico"] { --nivel: #f0a020; } [data-nivel="Bajo"] { --nivel: #e5484d; }
    .rp-barra-niveles span, .rp-puntaje-barra i { background: var(--nivel, #c9d3e6); }
    .rp-leyenda i, .rp-nivel i { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--nivel, #c9d3e6); }

    /* Tabla de estudiantes. */
    .rp-panel { min-width: 0; background: #fff; border: 1px solid #e6edf8; border-radius: 18px; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .rp-panel-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; }
    .rp-panel-cabeza h2 { margin: 0; font-size: 16px; font-weight: 800; color: var(--dl-tinta); }
    .rp-panel-cabeza h2 span { font-weight: 500; color: #9aa6c0; }
    .rp-buscar { display: flex; align-items: center; gap: 8px; width: 240px; max-width: 100%; height: 38px; padding: 0 14px; box-sizing: border-box;
      border-radius: 999px; background: #f5f8fe; color: #7a86a3; }
    .rp-buscar:focus-within { box-shadow: 0 0 0 2px rgba(31, 92, 240, .35); }
    .rp-buscar svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .rp-panel .rp-buscar input[type="search"] { flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; border-radius: 0; background: transparent;
      box-shadow: none; outline: none; font: inherit; font-size: 13px; color: var(--dl-tinta); }
    .rp-panel .rp-buscar input[type="search"]::placeholder { color: #7a86a3; }
    .rp-tabla { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
    .rp-tabla th { padding: 10px 18px; text-align: left; font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: #8a96b2;
      background: #f8fbff; border-top: 1px solid #eef2f9; border-bottom: 1px solid #eef2f9; white-space: nowrap; }
    .rp-c-estado { width: 15%; } .rp-c-puntaje { width: 22%; } .rp-c-nivel { width: 14%; } .rp-c-consulta { width: 260px; }
    .rp-tabla th.rp-c-consulta { text-align: right; }
    .rp-tabla td { height: 62px; padding: 0 18px; box-sizing: border-box; vertical-align: middle; border-bottom: 1px solid #f0f4fa; }
    .rp-tabla tbody tr:last-child td { border-bottom: 0; }
    .rp-td-persona > * { vertical-align: middle; }
    .rp-iniciales { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: #eaf1ff; color: #1747c2;
      font-size: 12.5px; font-weight: 800; flex: none; margin-right: 12px; }
    .rp-persona { display: inline-grid; gap: 1px; max-width: calc(100% - 52px); }
    .rp-persona strong { font-size: 14px; font-weight: 600; color: var(--dl-tinta); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rp-persona small { font-size: 12px; color: #8a96b2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rp-estado { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #5b6b8c; white-space: nowrap; }
    .rp-estado i { width: 7px; height: 7px; border-radius: 50%; flex: none; background: #9fb2d6; }
    .rp-estado[data-estado="FINALIZADA"] { color: #17683d; } .rp-estado[data-estado="FINALIZADA"] i { background: #22a55a; }
    .rp-estado[data-estado="EN_CURSO"] { color: #1747c2; } .rp-estado[data-estado="EN_CURSO"] i { background: #2a7bff; }
    .rp-puntaje { display: flex; align-items: center; gap: 12px; }
    .rp-puntaje b { min-width: 26px; font-size: 14px; font-weight: 700; color: var(--dl-tinta); }
    .rp-puntaje-barra { flex: 0 1 120px; height: 6px; border-radius: 999px; background: #eef2f9; overflow: hidden; }
    .rp-puntaje-barra i { display: block; height: 100%; border-radius: 999px; }
    .rp-nivel { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--dl-tinta); white-space: nowrap; }
    .rp-tenue { font-size: 13px; color: #a7b2c8; white-space: nowrap; }
    .rp-consulta { display: flex; align-items: center; justify-content: flex-end; gap: 4px 10px; }
    .rp-enlace { font-size: 14px; font-weight: 700; color: #1f5cf0; text-decoration: none; white-space: nowrap; }
    .rp-enlace:hover { text-decoration: underline; }
    .rp-enlace:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; border-radius: 4px; }
    .rp-intento { max-width: 120px; height: 30px; font-size: 12.5px; }
    .rp-sin-coincidencias td { height: 80px; text-align: center; color: #6b7690; }
    .rp-vacio { margin: 0; padding: 48px 18px 56px; border-top: 1px solid #eef2f9; text-align: center; font-size: 14px; color: #6b7690; }
    .rp-pie { padding: 12px 18px; border-top: 1px solid #f0f4fa; }

    @media (max-width: 1100px) {
      .rp-barra { flex-wrap: wrap; }
      .rp-caso { flex: 1 1 320px; }
    }
    @media (max-width: 767.98px) {
      .rp-barra { flex-direction: column; align-items: stretch; gap: 10px; }
      .rp-caso { flex: none; width: 100%; }
      .rp-vista button { flex: 1; }
      .rp-exportar { margin-left: 0; }
      .rp-exportar-boton { width: 100%; justify-content: center; }
      .rp-menu { left: 0; right: 0; }
      .rp-resumen { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .rp-cifra-niveles { grid-column: 1 / -1; }
      .rp-panel-cabeza { flex-direction: column; align-items: stretch; padding: 14px; }
      .rp-buscar { width: 100%; }
      /* Sin tabla: persona y consulta arriba; estado, puntaje y nivel debajo. */
      .rp-tabla, .rp-tabla tbody { display: block; }
      .rp-tabla thead { display: none; }
      .rp-tabla tr { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 12px 14px; border-top: 1px solid #f0f4fa; }
      .rp-tabla tr::after { content: ""; order: 3; flex-basis: 100%; height: 0; margin-top: -8px; }
      .rp-tabla td { height: auto; padding: 0; border: 0; }
      .rp-tabla td.rp-td-persona { order: 1; flex: 1 1 190px; min-width: 0; display: flex; align-items: center; gap: 12px; }
      .rp-iniciales { margin-right: 0; }
      .rp-persona { display: grid; min-width: 0; max-width: none; }
      .rp-td-consulta { order: 2; flex: none; max-width: 100%; margin-left: auto; }
      .rp-td-estado { order: 4; padding-left: 48px !important; }
      .rp-td-puntaje { order: 5; }
      .rp-puntaje-barra { flex-basis: 60px; width: 60px; }
      .rp-td-nivel { order: 6; }
      .rp-tabla tr.rp-sin-coincidencias { display: block; text-align: center; }
      .rp-pie { padding: 12px 14px; }
    }
  `]
})
export class SeguimientoComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private router = inject(Router);
  private filtro = inject(BusquedaService);
  sesiones = signal<Sesion[]>([]);
  realizadas = signal<SesionRealizada[]>([]);
  filas = signal<Fila[]>([]);
  intentos = signal<IntentoConsultado[]>([]);
  sesionId = 0;
  vista: 'todas' | 'realizadas' = 'todas';
  busqueda = '';
  aviso = signal('');
  pagina = signal(1);
  paginaActual() { return paginaValida(this.pagina(), this.visibles().length); }
  filasPagina() { return paginaDe(this.visibles(), this.paginaActual()); }
  constructor() {
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => {
      this.sesiones.set(dato);
      if (dato[0] && this.vista === 'todas') this.ver(dato[0].id);
    });
    this.http.get<SesionRealizada[]>('/api/docente/seguimiento/sesiones').subscribe((dato) => this.realizadas.set(dato));
  }
  sesionesVista() {
    if (this.vista === 'realizadas') return this.realizadas();
    return this.sesiones();
  }
  cambiarVista() {
    const lista = this.sesionesVista();
    if (lista[0]) this.ver(lista[0].id);
    else { this.sesionId = 0; this.filas.set([]); this.intentos.set([]); }
  }
  ver(id: number) {
    this.sesionId = Number(id);
    this.pagina.set(1);
    this.aviso.set('');
    this.http.get<Fila[]>(`/api/docente/sesiones/${this.sesionId}/seguimiento`).subscribe((dato) => this.filas.set(dato));
    this.http.get<IntentoConsultado[]>(`/api/docente/seguimiento/sesiones/${this.sesionId}/participaciones`).subscribe({
      next: (dato) => this.intentos.set(dato),
      error: (falla) => {
        this.intentos.set([]);
        const texto = mensajeError(falla);
        if (!/no tiene participaciones/i.test(texto)) this.aviso.set(texto);
      }
    });
  }
  intentosDe(fila: Fila) {
    return this.intentos()
      .filter((intento) => intento.estudiante === fila.estudiante)
      .sort((a, b) => a.numeroIntento - b.numeroIntento);
  }
  abrirIntento(evento: Event) {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (valor) this.router.navigate(['/docente/seguimiento', valor]);
  }
  visibles() {
    const textos = [this.busqueda, this.filtro.texto()].map((texto) => texto.trim().toLowerCase()).filter(Boolean);
    return this.filas().filter((fila) => textos.every((q) => fila.estudiante.toLowerCase().includes(q) || fila.email.toLowerCase().includes(q)));
  }
  etiquetaFila(estado: string) {
    if (estado === 'FINALIZADA') return 'Finalizado';
    if (estado === 'AUSENTE') return 'Ausente';
    if (estado === 'EN_CURSO') return 'En curso';
    if (estado === 'SIN_INICIAR') return 'Sin iniciar';
    return estado;
  }
  nivel(nota: number | null) {
    if (nota == null) return '—';
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4) return 'Alto';
    if (nota >= 3) return 'Básico';
    return 'Bajo';
  }
  finalizados() { return this.filas().filter((f) => f.estado === 'FINALIZADA' || f.estado === 'AUSENTE').length; }
  promedio() {
    const notas = this.filas().map((f) => f.nota).filter((n): n is number => n != null);
    if (!notas.length) return '—';
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
  }
  conteo(nivel: string) { return this.filas().filter((f) => this.nivel(f.nota) === nivel).length; }
  readonly niveles = ['Superior', 'Alto', 'Básico', 'Bajo'];
  iniciales(nombre: string) {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '?';
    return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }
  /** Menú "Exportar": CSV, PDF y Excel. */
  exportarAbierto = signal(false);
  alternarExportar() {
    const abrir = !this.exportarAbierto();
    this.exportarAbierto.set(abrir);
    if (abrir) setTimeout(() => document.querySelector<HTMLElement>('.rp-menu [role="menuitem"]')?.focus());
  }
  cerrarExportar() {
    if (!this.exportarAbierto()) return;
    this.exportarAbierto.set(false);
    document.getElementById('rp-exportar')?.focus();
  }
  exportar(formato: 'csv' | 'pdf' | 'xlsx') {
    this.exportarAbierto.set(false);
    this.descargar(formato);
  }
  descargar(formato: 'csv' | 'pdf' | 'xlsx') {
    this.bajar(`/api/docente/sesiones/${this.sesionId}/reporte`, `reporte-${this.sesionId}.${formato}`, { formato });
  }
  private bajar(url: string, nombre: string, params?: Record<string, string>) {
    this.http.get(url, { params, responseType: 'blob' }).subscribe((archivo) => {
      const href = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = href;
      enlace.download = nombre;
      enlace.click();
      URL.revokeObjectURL(href);
    });
  }
}

@Component({
  selector: 'app-detalle-participacion',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Respuestas del intento y valoración del docente.">
      <a class="adm-volver" routerLink="/docente/seguimiento"><span aria-hidden="true">‹</span> Volver a reportes</a>
      @if (dato(); as actual) {
        <section class="informe-caso">
          <article class="tarjeta stack informe-ficha">
            <div class="informe-ficha-cabeza">
              <div>
                <span class="aviso-canal" [attr.data-estado]="actual.estado">{{ etiquetaEstado(actual.estado) }}</span>
                @if (consulta(); as extra) { <small class="informe-intento">Intento {{ extra.numeroIntento }}</small> }
                <h2 class="informe-titulo">{{ actual.caso }}</h2>
                <p class="sub">{{ actual.estudiante }}</p>
              </div>
            </div>
            <div class="resumen-cifras informe-cifras">
              <article><small>Calificación</small><strong>{{ actual.nota ?? '—' }} <em>/ 5,0</em></strong></article>
              <article><small>Nivel</small><strong>{{ nivel(actual.nota) }}</strong></article>
              @if (actual.aciertos !== null) {
                <article><small>Aciertos</small><strong>{{ actual.aciertos }} <em>/ {{ actual.total }}</em></strong></article>
                <article><small>Fallos</small><strong>{{ actual.errores }}</strong></article>
              }
            </div>
          </article>
          <h2>Respuestas del intento</h2>
          @for (pregunta of actual.preguntas; track pregunta.id) {
            <article class="tarjeta stack informe-pregunta">
              <div class="convoca-meta">
                <span class="aviso-canal">{{ pregunta.bloque }}</span>
                <small>{{ pregunta.criterio }}@if (pregunta.puntaje != null) { · {{ pregunta.puntaje }} pts }</small>
              </div>
              <h3>{{ pregunta.enunciado }}</h3>
              <div class="informe-opciones">
                @for (opcion of pregunta.opciones; track opcion.id) {
                  @if (pregunta.seleccionId === opcion.id || opcion.correcta) {
                    <div class="informe-opcion" [class.bien]="opcion.correcta" [class.mal]="pregunta.seleccionId === opcion.id && opcion.correcta === false">
                      <strong>{{ etiquetaOpcion(pregunta, opcion) }}</strong>
                      <p>{{ opcion.texto }}</p>
                      @if (opcion.explicacion) { <p class="sub">{{ opcion.explicacion }}</p> }
                      @if (opcion.fundamento) { <p class="sub">{{ opcion.fundamento }}</p> }
                    </div>
                  }
                }
              </div>
            </article>
          }
          <article class="tarjeta stack informe-valoracion">
            <h2>Valoración del docente</h2>
            <label class="field"><span>Comentario para el estudiante</span>
              <textarea [(ngModel)]="texto" [disabled]="actual.estado !== 'FINALIZADA'" rows="4"></textarea>
            </label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            @if (ok()) { <p class="ok">{{ ok() }}</p> }
            @if (actual.repeticionAutorizada) { <p class="ok">Ya hay un intento adicional autorizado.</p> }
            <div class="caso-acciones">
              <button class="btn-oscuro" type="button" [disabled]="actual.estado !== 'FINALIZADA'" (click)="valorar(actual.id)">Guardar valoración</button>
              @if (!actual.repeticionAutorizada) {
                <button class="btn-suave" type="button" [disabled]="actual.estado !== 'FINALIZADA'" (click)="repetir(actual.id)">Autorizar repetición</button>
              }
            </div>
          </article>
        </section>
      }
    </app-marco-docente>
  `
})
export class DetalleParticipacionComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  dato = signal<Participacion | null>(null);
  consulta = signal<ParticipacionConsultada | null>(null);
  texto = '';
  error = signal('');
  ok = signal('');
  constructor() { this.cargar(); }
  etiquetaEstado(estado: string) {
    if (estado === 'FINALIZADA') return 'Finalizado';
    if (estado === 'AUSENTE') return 'Ausente';
    if (estado === 'EN_CURSO') return 'En curso';
    return estado;
  }
  nivel(nota: number | null) {
    if (nota == null) return '—';
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4) return 'Alto';
    if (nota >= 3) return 'Básico';
    return 'Bajo';
  }
  etiquetaOpcion(pregunta: PreguntaJuego, opcion: OpcionJuego) {
    if (opcion.correcta) return 'Respuesta adecuada';
    if (pregunta.seleccionId === opcion.id) return 'Elección del estudiante';
    return 'Opción';
  }
  valorar(id: number) {
    this.http.post(`/api/docente/participaciones/${id}/retroalimentacion`, { texto: this.texto }).subscribe({
      next: () => { this.ok.set('Valoración registrada. El estudiante recibe el aviso.'); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  repetir(id: number) {
    this.http.post(`/api/docente/participaciones/${id}/repeticion`, {}).subscribe({
      next: () => { this.ok.set('Repetición autorizada para un intento adicional.'); this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private cargar() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Participacion>(`/api/participaciones/${id}`).subscribe({
      next: (dato) => { this.dato.set(dato); this.texto = dato.retroalimentacion ?? ''; },
      error: (falla) => this.error.set(mensajeError(falla))
    });
    this.http.get<ParticipacionConsultada>(`/api/docente/seguimiento/participaciones/${id}`).subscribe({
      next: (dato) => this.consulta.set(dato),
      error: () => this.consulta.set(null)
    });
  }
}
