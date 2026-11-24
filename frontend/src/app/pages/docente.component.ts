import { Component, DestroyRef, computed, inject, signal, viewChild, input, output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { EditorTextoComponent } from '../shared/editor-texto.component';
import { Bloque, Caso, CasoResumen, Fila, Grupo, IntentoConsultado, OpcionJuego, Participacion, ParticipacionConsultada, Persona, PreguntaJuego, Sesion, SesionRealizada, mensajeError } from '../core/api.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { BloqueNovela, CasoNovela, EscenaNovelaComponent, PersonajeNovela } from '../shared/novela/escena-novela.component';
import { Asignacion } from '../shared/novela/elenco.service';
import { FONDOS_MANUALES } from '../shared/novela/escena.service';
import { NovelaReproductorComponent } from '../shared/novela/novela-reproductor.component';
import { ResultadosNovela, calcularResultados } from '../shared/novela/resultados';
import { MusicaNovelaService } from '../shared/novela/musica-novela.service';
import { NgTemplateOutlet } from '@angular/common';
import { PaginacionTablaComponent, paginaDe, paginaValida } from '../shared/paginacion-tabla.component';

const enlaces = [
  { href: '/docente', texto: 'Inicio', exacto: true },
  { href: '/docente/casos', texto: 'Mis Casos', exacto: true },
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
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Coordina casos, grupos y sesiones desde un solo lugar.">
      <section class="adm-kpis" aria-label="Resumen">
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg></span>
          <div><small>Casos</small><strong>{{ casos().length }}</strong><span>{{ publicados() }} publicados</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg></span>
          <div><small>Grupos</small><strong>{{ grupos().length }}</strong><span>espacios a tu cargo</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg></span>
          <div><small>Hoy</small><strong>{{ hoy().length }}</strong><span>{{ enCurso().length }} en curso</span></div>
        </article>
      </section>
      @if (aviso()) { <p class="error">{{ aviso() }}</p> }

      <section class="adm-dos">
        <div class="adm-columna">
        <article class="adm-tarjeta">
          <div class="adm-cabeza">
            <h2>Agenda de hoy</h2>
            <a class="adm-enlace" routerLink="/docente/programar">Programar <span aria-hidden="true">›</span></a>
          </div>
          <ul class="adm-lista">
            @for (sesion of hoy(); track sesion.id) {
              <li class="adm-fila">
                <span class="adm-hora">{{ hora(sesion.inicio) }}</span>
                <span class="adm-fila-texto"><strong>{{ sesion.caso }}</strong><small>{{ sesion.grupo }} · código {{ sesion.codigo }}</small></span>
                <span class="adm-estado-pill" [attr.data-estado]="sesion.estado">{{ etiquetaEstado(sesion.estado) }}</span>
                <span class="adm-fila-acciones">
                  @if (sesion.estado === 'SIN_INICIAR') {
                    <button class="adm-boton adm-boton-chico" type="button" (click)="moverSesion(sesion.id, 'iniciar')">Iniciar</button>
                  }
                  @if (sesion.estado === 'EN_CURSO') {
                    <button class="adm-boton-contorno adm-boton-chico" type="button" (click)="moverSesion(sesion.id, 'finalizar')">Finalizar</button>
                    <a class="adm-enlace" routerLink="/docente/seguimiento">Bitácora <span aria-hidden="true">›</span></a>
                  }
                  @if (sesion.estado === 'FINALIZADO') {
                    <a class="adm-enlace" routerLink="/docente/seguimiento">Ver reporte <span aria-hidden="true">›</span></a>
                  }
                </span>
              </li>
            } @empty {
              <li class="adm-vacio">No hay sesiones hoy. Convoca un grupo cuando el caso esté listo.</li>
            }
          </ul>
        </article>

          <article class="adm-tarjeta">
            <div class="adm-cabeza"><h2>Flujo de trabajo</h2></div>
            <ul class="adm-lista">
              <li><a class="adm-fila" routerLink="/docente/casos/nuevo">
                <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg></span>
                <span class="adm-fila-texto"><strong>Diseñar</strong><small>Crea un caso con su historia y sus decisiones</small></span>
                <span class="adm-flecha" aria-hidden="true">›</span></a></li>
              <li><a class="adm-fila" routerLink="/docente/grupos">
                <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg></span>
                <span class="adm-fila-texto"><strong>Agrupar</strong><small>Abre grupos y matricula estudiantes</small></span>
                <span class="adm-flecha" aria-hidden="true">›</span></a></li>
              <li><a class="adm-fila" routerLink="/docente/programar">
                <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg></span>
                <span class="adm-fila-texto"><strong>Convocar</strong><small>Agenda un caso publicado con un grupo</small></span>
                <span class="adm-flecha" aria-hidden="true">›</span></a></li>
              <li><a class="adm-fila" routerLink="/docente/seguimiento">
                <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/></svg></span>
                <span class="adm-fila-texto"><strong>Seguir</strong><small>Bitácora en vivo y reportes</small></span>
                <span class="adm-flecha" aria-hidden="true">›</span></a></li>
            </ul>
          </article>
        </div>

        <div class="adm-columna">
          <article class="adm-tarjeta">
            <div class="adm-cabeza">
              <h2>Próximas</h2>
              <a class="adm-enlace" routerLink="/docente/programar">Ver todas <span aria-hidden="true">›</span></a>
            </div>
            <ul class="adm-lista">
              @for (sesion of proximas(); track sesion.id) {
                <li class="adm-fila">
                  <span class="adm-fila-texto"><strong>{{ sesion.caso }}</strong><small>{{ cuando(sesion.inicio) }} · {{ sesion.grupo }}</small></span>
                </li>
              } @empty {
                <li class="adm-vacio">No hay sesiones por delante.</li>
              }
            </ul>
          </article>
        </div>
      </section>
    </app-marco-docente>
  `
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
  enCurso() {
    return this.sesiones().filter((sesion) => sesion.estado === 'EN_CURSO');
  }
  hoy() { return this.sesiones().filter((sesion) => this.mismoDia(sesion.inicio)); }
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
  template: `
    @if (total() > 0) {
      <nav class="gp-paginacion" [attr.aria-label]="'Paginación de ' + que()">
        <p class="gp-pag-texto">{{ prefijo() }}{{ desde() }}–{{ hasta() }} de {{ total() }}{{ sufijo() }}</p>
        @if (paginas() > 1) {
          <div class="gp-pag-botones">
            <button type="button" class="gp-pag" [disabled]="pagina() === 1" (click)="cambiar.emit(pagina() - 1)"
              [attr.aria-label]="'Página anterior de ' + que()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
            </button>
            @for (n of numeros(); track n) {
              <button type="button" class="gp-pag" [class.actual]="n === pagina()" [attr.aria-current]="n === pagina() ? 'page' : null"
                [attr.aria-label]="'Página ' + n" (click)="cambiar.emit(n)">{{ n }}</button>
            }
            <button type="button" class="gp-pag" [disabled]="pagina() === paginas()" (click)="cambiar.emit(pagina() + 1)"
              [attr.aria-label]="'Página siguiente de ' + que()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
            </button>
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
    .gp-pag.actual { background: #0a1733; border-color: #0a1733; color: #fff; }
    .gp-pag:disabled { opacity: .45; cursor: default; }
    .gp-pag:focus-visible { outline: 3px solid rgba(59,108,255,.35); outline-offset: 2px; }
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
  .gp-btn-oscuro { background: #2563eb; color: #fff; border: 1px solid #2563eb; font-weight: 700; }
  .gp-btn-oscuro:hover { background: #1d4fd0; border-color: #1d4fd0; }
  .gp-btn-borde { background: #fff; color: #1d5bdc; border: 1.5px solid #1d5bdc; font-weight: 650; }
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
  .gp-tabla td { padding: 11px 16px; border-bottom: 1px solid #f0f3f9; color: #13213f; vertical-align: middle; white-space: nowrap; }
  .gp-tabla tr:last-child td { border-bottom: 0; }
  .gp-tabla .gp-dc { text-align: right; white-space: nowrap; overflow-wrap: normal; width: 1%; }
  .gp-vacio { color: #6b7690; }
  .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

type FiltroCaso = 'TODOS' | 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';
type OrdenCaso = 'recientes' | 'nombre' | 'estado';
const ETIQUETA_CASO: Record<string, string> = { BORRADOR: 'Borrador', PUBLICADO: 'Publicado', ARCHIVADO: 'Archivado' };

function leerVistaCasos(): 'tarjetas' | 'lista' {
  try { return sessionStorage.getItem('dilema-vista-casos') === 'lista' ? 'lista' : 'tarjetas'; } catch { return 'tarjetas'; }
}

@Component({
  selector: 'app-casos',
  imports: [MarcoDocenteComponent, RouterLink, FormsModule, PaginacionGpComponent, NgTemplateOutlet],
  host: { '(document:click)': 'cerrarMenu()', '(document:keydown.escape)': 'cerrarMenu(true)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Diseña, publica y reabre el editor de cada caso.">
      @if (!puedeEditar()) {
        <p class="gp-error">La administración debe asignarte el permiso Editar para guardar o publicar casos.</p>
      }
      @if (error()) { <p class="gp-error" role="alert">{{ error() }}</p> }
      @if (ok()) { <p class="gp-ok" role="status">{{ ok() }}</p> }

      <div class="adm-herramientas mc-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar por estado">
          @for (f of filtros; track f.valor) {
            <button type="button" class="adm-filtro" [class.activo]="filtroEstado() === f.valor" [attr.aria-pressed]="filtroEstado() === f.valor"
              (click)="filtrar(f.valor)">{{ f.texto }} <span>({{ cuenta(f.valor) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar caso</span>
            <input type="search" placeholder="Buscar caso" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
          </label>
          <label class="adm-orden">
            <span class="solo-lector">Ordenar</span>
            <select [ngModel]="orden()" (ngModelChange)="orden.set($event); pagina.set(1)">
              <option value="recientes">Más recientes</option>
              <option value="nombre">Nombre A–Z</option>
              <option value="estado">Estado</option>
            </select>
          </label>
          <div class="mc-vistas" role="group" aria-label="Vista">
            <button type="button" [class.activa]="vista() === 'tarjetas'" [attr.aria-pressed]="vista() === 'tarjetas'" aria-label="Ver como tarjetas"
              title="Tarjetas" (click)="cambiarVista('tarjetas')">
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>
            </button>
            <button type="button" [class.activa]="vista() === 'lista'" [attr.aria-pressed]="vista() === 'lista'" aria-label="Ver como lista"
              title="Lista" (click)="cambiarVista('lista')">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4h7.5M6 8h7.5M6 12h7.5"/><path d="M2.6 4h.01M2.6 8h.01M2.6 12h.01"/></svg>
            </button>
          </div>
          <a class="adm-boton" routerLink="/docente/casos/nuevo"><span aria-hidden="true">+</span> Crear caso</a>
        </div>
      </div>

      <ng-template #menuCaso let-caso>
        <div class="mc-menu-ancla" (click)="$event.stopPropagation()">
          <button type="button" class="mc-mas" [id]="'mc-mas-' + caso.id" aria-haspopup="menu"
            [attr.aria-expanded]="menuAbierto() === caso.id" [attr.aria-label]="'Más acciones de ' + caso.nombre"
            (click)="alternarMenu(caso.id, $event)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
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
      </ng-template>

      @if (!paginaCasos().length) {
        <p class="mc-vacio">{{ cargando() ? 'Cargando casos…' : busqueda().trim() || filtro.texto().trim() ? 'Ningún caso coincide con la búsqueda.' : filtroEstado() === 'TODOS' ? 'Todavía no tienes casos.' : 'No hay casos en este estado.' }}</p>
      } @else if (vista() === 'tarjetas') {
        <ul class="mc-rejilla" aria-label="Casos">
          @for (caso of paginaCasos(); track caso.id) {
            <li class="mc-caso" [class.archivado]="caso.estado === 'ARCHIVADO'">
              <div class="mc-cabeza">
                <span class="mc-estado" [attr.data-estado]="caso.estado">{{ etiqueta(caso.estado) }}</span>
                <ng-container *ngTemplateOutlet="menuCaso; context: { $implicit: caso }" />
              </div>
              <h3 [title]="caso.nombre">{{ caso.nombre }}</h3>
              <p class="mc-meta">
                <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.6"/><path d="m2.6 11.4 3.4-3.2 2.6 2.3 1.8-1.6 3 2.6"/></svg>{{ caso.bloques }} {{ caso.bloques === 1 ? 'escenario' : 'escenarios' }}</span>
                <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.8 1.8 0 0 1 3.5.5c0 1.2-1.8 1.5-1.8 2.6"/><path d="M8 11.4h.01"/></svg>{{ caso.preguntas }} {{ caso.preguntas === 1 ? 'pregunta' : 'preguntas' }}</span>
                <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/></svg>{{ caso.tiempoEstimadoMin }} min</span>
              </p>
              <div class="mc-pie">
                <a class="mc-abrir" [routerLink]="['/docente/casos', caso.id]" [attr.aria-label]="'Abrir editor de ' + caso.nombre">Abrir editor</a>
              </div>
            </li>
          }
        </ul>
      } @else {
        <article class="adm-tarjeta adm-tabla-tarjeta">
          <div class="adm-tabla-caja">
            <table class="adm-tabla">
              <thead>
                <tr><th scope="col">Caso</th><th scope="col">Estado</th><th scope="col">Duración</th><th scope="col" class="derecha">Acciones</th></tr>
              </thead>
              <tbody>
                @for (caso of paginaCasos(); track caso.id) {
                  <tr [class.mc-fila-archivada]="caso.estado === 'ARCHIVADO'">
                    <td><div class="adm-celda-doble"><strong>{{ caso.nombre }}</strong>
                      <small>{{ caso.bloques }} {{ caso.bloques === 1 ? 'escenario' : 'escenarios' }} · {{ caso.preguntas }} {{ caso.preguntas === 1 ? 'pregunta' : 'preguntas' }}</small></div></td>
                    <td><span class="mc-estado" [attr.data-estado]="caso.estado">{{ etiqueta(caso.estado) }}</span></td>
                    <td class="gris">{{ caso.tiempoEstimadoMin }} min</td>
                    <td class="derecha">
                      <div class="mc-acciones">
                        <a class="mc-abrir" [routerLink]="['/docente/casos', caso.id]" [attr.aria-label]="'Abrir editor de ' + caso.nombre">Abrir editor</a>
                        <ng-container *ngTemplateOutlet="menuCaso; context: { $implicit: caso }" />
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      }
      <app-paginacion-gp [total]="filtrados().length" [pagina]="pagina()" [porPagina]="porPagina()" que="casos" prefijo="Mostrando "
        (cambiar)="pagina.set($event)" />
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    .mc-herramientas { flex-wrap: wrap; row-gap: 10px; }
    .mc-herramientas .adm-buscar { width: clamp(170px, 15vw, 240px); }
    .mc-vistas { display: inline-flex; gap: 2px; padding: 3px; border-radius: 12px; background: #e8edf6; }
    .mc-vistas button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px;
      background: transparent; color: #5b6782; cursor: pointer; }
    .mc-vistas button.activa { background: #fff; color: #13213f; box-shadow: 0 1px 2px rgba(16, 24, 40, .08); }
    .mc-vistas svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; }
    .mc-vistas button:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 1px; }

    .mc-rejilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .mc-caso { display: flex; flex-direction: column; gap: 12px; padding: 16px 20px 18px;
      border: 1px solid #e6ecf6; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(16, 24, 40, .03); }
    .mc-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 34px; }
    .mc-estado { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 600; white-space: nowrap; color: #6b7489; }
    .mc-estado::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .mc-estado[data-estado="PUBLICADO"] { color: #16803c; }
    .mc-estado[data-estado="BORRADOR"] { color: #1d5bdc; }
    .mc-estado[data-estado="ARCHIVADO"] { color: #6b7489; }
    .mc-caso h3 { margin: 0; height: 2.6em; font-size: 16px; font-weight: 700; line-height: 1.3; color: #13213f;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mc-meta { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; font-size: 13px; color: #5b6782; }
    .mc-meta span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .mc-meta svg { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
    .mc-pie { margin-top: auto; padding-top: 14px; border-top: 1px solid #eef2f8; }
    .mc-abrir { min-height: 36px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 10px;
      background: #eef4ff; color: #1d5bdc; font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .mc-abrir:hover { background: #e1ebff; }
    .mc-abrir:focus-visible, .mc-mas:focus-visible, .mc-menu a:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }
    .mc-caso.archivado { background: #fbfcfe; }
    .mc-caso.archivado h3 { color: #6b7489; }
    .mc-fila-archivada strong { color: #6b7489; }

    .mc-acciones { display: inline-flex; align-items: center; gap: 6px; }
    .mc-menu-ancla { position: relative; }
    .mc-mas { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent;
      color: #33415c; cursor: pointer; }
    .mc-mas svg { width: 17px; height: 17px; fill: currentColor; }
    .mc-mas:hover, .mc-mas[aria-expanded="true"] { background: #eef2f9; }
    /* Fijo a la ventana: no lo recorta la tabla que se desplaza de lado. */
    .mc-menu { position: fixed; z-index: 50; min-width: 180px; padding: 4px; display: grid; gap: 2px;
      background: #fff; border: 1px solid #e6ecf6; border-radius: 10px; box-shadow: 0 8px 20px rgba(16, 24, 40, .10); }
    .mc-menu a, .mc-menu button { min-height: 36px; display: flex; align-items: center; padding: 0 12px; text-align: left; border: 0;
      border-radius: 7px; background: transparent; color: #13213f; font: inherit; font-size: 13.5px; font-weight: 600; text-decoration: none; cursor: pointer; }
    .mc-menu a:hover, .mc-menu button:hover, .mc-menu button:focus-visible { background: #f2f6ff; outline: none; }
    .mc-menu .peligro { color: #a4271b; }
    .mc-menu .peligro:hover { background: #fdf1f0; }
    .mc-vacio { margin: 0; padding: 36px 12px; text-align: center; color: #5b6782; border: 1px dashed #d6deec; border-radius: 14px; background: #fff; }
    @media (max-width: 1200px) { .mc-rejilla { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px) {
      .mc-rejilla { grid-template-columns: minmax(0, 1fr); }
      .mc-herramientas .adm-buscar { width: 100%; }
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
  /** Filtro, búsqueda, orden, página y menú "⋯" (en el navegador, con lo que ya llegó del backend). */
  readonly filtros: { valor: FiltroCaso; texto: string }[] = [
    { valor: 'TODOS', texto: 'Todos' }, { valor: 'BORRADOR', texto: 'Borradores' },
    { valor: 'PUBLICADO', texto: 'Publicados' }, { valor: 'ARCHIVADO', texto: 'Archivados' }
  ];
  filtroEstado = signal<FiltroCaso>('TODOS');
  busqueda = signal('');
  orden = signal<OrdenCaso>('recientes');
  pagina = signal(1);
  menuAbierto = signal<number | null>(null);
  /** Posición del menú "⋯" (fijo a la ventana, para que la tabla no lo recorte). */
  menuPos = signal<{ top: number | null; bottom: number | null; right: number }>({ top: null, bottom: null, right: 0 });
  /** Tarjetas o lista; se recuerda mientras el docente navega (sesión del navegador). */
  vista = signal<'tarjetas' | 'lista'>(leerVistaCasos());
  readonly porPagina = computed(() => this.vista() === 'lista' ? 8 : 9);
  readonly filtrados = computed(() => {
    const estado = this.filtroEstado();
    const q = (this.busqueda() + ' ' + this.filtro.texto()).trim().toLowerCase();
    const lista = this.casos().filter((c) => (estado === 'TODOS' || c.estado === estado)
      && (!q || q.split(/\s+/).every((t) => c.nombre.toLowerCase().includes(t) || (ETIQUETA_CASO[c.estado] ?? c.estado).toLowerCase().includes(t))));
    const rango: Record<string, number> = { PUBLICADO: 0, BORRADOR: 1, ARCHIVADO: 2 };
    const porNombre = (a: CasoResumen, b: CasoResumen) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    // "Más recientes": el backend no envía fecha; el id más alto es el último creado.
    if (this.orden() === 'nombre') return [...lista].sort(porNombre);
    if (this.orden() === 'estado') return [...lista].sort((a, b) => (rango[a.estado] ?? 9) - (rango[b.estado] ?? 9) || porNombre(a, b));
    return [...lista].sort((a, b) => b.id - a.id);
  });
  readonly paginaCasos = computed(() => paginar(this.filtrados(), this.pagina(), this.porPagina()));
  cambiarVista(vista: 'tarjetas' | 'lista') {
    this.vista.set(vista);
    this.pagina.set(1);
    this.menuAbierto.set(null);
    try { sessionStorage.setItem('dilema-vista-casos', vista); } catch { /* sin almacenamiento: solo dura esta pantalla */ }
  }
  puedeEditar() { return this.auth.puede('EDITAR'); }
  constructor() { this.cargar(); }
  etiqueta(estado: string) { return ETIQUETA_CASO[estado] ?? estado; }
  cuenta(estado: FiltroCaso) { return estado === 'TODOS' ? this.casos().length : this.casos().filter((c) => c.estado === estado).length; }
  filtrar(estado: FiltroCaso) { this.filtroEstado.set(estado); this.pagina.set(1); }
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
        const paginas = Math.max(1, Math.ceil(this.filtrados().length / this.porPagina()));
        if (this.pagina() > paginas) this.pagina.set(paginas);
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

@Component({
  selector: 'app-editor-caso',
  host: { '(document:click)': 'menuAcciones.set(false)', '(document:keydown.escape)': 'menuAcciones.set(false)' },
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink, EditorTextoComponent, EscenaNovelaComponent,
    NovelaReproductorComponent, NgTemplateOutlet],
  styles: [`
    .personaje-fila { display: grid; gap: 12px; }
    .ayudas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .ayudas select { flex: 1 1 110px; min-width: 0; padding: 8px 10px; font: inherit; font-size: .85rem; border: 1px solid var(--line, #e6ebf5); border-radius: 12px; background: white; }
    .personaje-pie { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; }
    .aparece { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: .85rem; }
    .aparece .chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid var(--navy-line, #cfd8ee); background: #fff; color: #0a1733; border-radius: 999px; cursor: pointer; font-weight: 650; }
    .entendido { font-size: .8rem; color: #5b6b8c; font-weight: 600; }
    .entendido.falta { color: #8b93a7; font-weight: 400; }
    .escena-controles { flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .acciones-editor { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .campo-cabeza { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .insertar { padding: 0 16px; height: 34px; font: inherit; font-size: 13px; border: 1.5px solid #1d5bdc; border-radius: 999px; background: #fff; color: #1d5bdc; cursor: pointer; font-weight: 650; display: inline-flex; align-items: center; box-shadow: none; }
    .form-dialogo { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; padding: 12px; border-radius: 16px; background: #fff; border: 1px solid var(--line, #e6ebf5); }
    .form-dialogo select, .form-dialogo input { padding: 8px 10px; font: inherit; border: 1px solid var(--line, #e6ebf5); border-radius: 12px; }
    .form-dialogo input { flex: 1 1 220px; min-width: 0; }
    .form-dialogo button { padding: 0 16px; height: 36px; font: inherit; font-size: 13px; border: 0; border-radius: 999px; background: #2563eb; color: #fff; cursor: pointer; font-weight: 700; box-shadow: none; }
    .form-dialogo button:last-child { background: #fff; color: #1d5bdc; border: 1.5px solid #1d5bdc; }
    .ayuda-dialogo { display: block; margin-top: 4px; font-size: .78rem; color: #6b7280; }
    .modal-vista { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: #0f141c; color: #f3f3f3; }
    .modal-cabeza { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px 16px; background: #0a1733; }
    .modal-cabeza .cerrar, .modal-cabeza .musica { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      border-radius: 999px; border: 1px solid #cfd8ee; background: #fff; color: #0a1733; font: inherit; font-weight: 650; line-height: 1.5; cursor: pointer; }
    /* "Música" va a la izquierda de "Cerrar", los dos pegados a la derecha. */
    .modal-cabeza .musica + .cerrar { margin-left: 0; }
    .modal-cabeza .musica svg { width: 1.15em; height: 1.15em; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .modal-cabeza .musica .parlante { fill: currentColor; }
    .modal-cabeza .cerrar:focus-visible, .modal-cabeza .musica:focus-visible { outline: 2px solid #9fe3d9; outline-offset: 2px; }
    .modal-cuerpo { flex: 1; overflow: auto; padding: 12px 16px; }
    @media (max-width: 768px) {
      .pasos { display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .pasos button { flex: 0 0 auto; }
      .modal-cuerpo { padding: 8px; }
    }
  `],
  template: `
    <app-marco-docente [enlaces]="enlaces" [descripcion]="descripcionEditor()">
      <section class="tablero tablero-caso">
        <div class="adm-herramientas">
          <a class="adm-volver" routerLink="/docente/casos"><span aria-hidden="true">‹</span> Volver a mis casos</a>
          <div class="adm-barra">
            <button class="adm-boton-contorno" type="button" (click)="abrirVistaPrevia($any($event.currentTarget))">Vista previa</button>
          </div>
        </div>
        <div class="pasos">
          @for (paso of pasos; track paso.id) {
            <button type="button" [class.activa]="activo() === paso.id" (click)="irA(paso.id)">{{ paso.texto }}</button>
          }
        </div>
        @if (!puedeEditar()) {
          <p class="error">La administración debe asignarte el permiso Editar para guardar o publicar este caso.</p>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (ok()) { <p class="ok">{{ ok() }}</p> }

        @if (activo() === 'estructura') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Información general</h2>
              <p class="sub">Nombre, desarrollo y contexto del caso.</p>
            </header>
            <section class="caso-casilla">
              <h3>Datos del caso</h3>
              <label class="caso-campo">
                <span class="caso-etiqueta">Nombre</span>
                <input [(ngModel)]="caso.nombre" [disabled]="bloqueado()" />
              </label>
              <label class="caso-campo">
                <span class="caso-etiqueta">Tiempo estimado (min)</span>
                <input type="number" [(ngModel)]="caso.tiempoEstimadoMin" [disabled]="bloqueado()" />
              </label>
              <div class="caso-casilla-check">
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
              <div class="campo-cabeza">
                <h3>Desarrollo situacional</h3>
                @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertar('desarrollo')">Insertar diálogo</button> }
              </div>
              @if (insertando() === 'desarrollo') {
                <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: 'desarrollo' }" />
              }
              <app-editor #editorDesarrollo [(valor)]="caso.desarrolloSituacional" [bloqueado]="bloqueado()" />
              <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
            </section>
            <section class="caso-casilla">
              <h3>Contexto</h3>
              <app-editor [(valor)]="caso.contexto" [bloqueado]="bloqueado()" />
            </section>
          </div>
        }

        @if (activo() === 'escenas') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Escenas y contexto</h2>
              <p class="sub">Cada escena lleva su contexto. Las decisiones se arman en el siguiente paso.</p>
            </header>
            @for (bloque of caso.bloques; track $index) {
              <section class="caso-casilla">
                <h3>Escenario {{ $index + 1 }}</h3>
                <label class="caso-campo">
                  <span class="caso-etiqueta">Nombre del escenario</span>
                  <input [(ngModel)]="bloque.nombre" [disabled]="bloqueado()" />
                </label>
                <div class="caso-campo">
                  <div class="campo-cabeza">
                    <span class="caso-etiqueta">Contexto situacional</span>
                    @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertar('bloque-' + $index)">Insertar diálogo</button> }
                  </div>
                  @if (insertando() === 'bloque-' + $index) {
                    <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: { bloque: $index, area: ctx } }" />
                  }
                  <textarea #ctx [(ngModel)]="bloque.contexto" [disabled]="bloqueado()"
                    [attr.aria-label]="'Contexto situacional del escenario ' + ($index + 1)"></textarea>
                  <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
                </div>
                @if (!bloqueado()) {
                  <div class="caso-acciones">
                    <button class="btn-suave" type="button" (click)="caso.bloques.splice($index, 1)">Quitar escenario</button>
                  </div>
                }
              </section>
            }
            @if (!bloqueado()) {
              <div class="caso-acciones">
                <button class="btn-oscuro" type="button" (click)="agregarBloque()">Agregar escenario académico</button>
              </div>
            }
          </div>
        }

        @if (activo() === 'preguntas') {
          <div class="caso-vista">
            @for (bloque of caso.bloques; track $index) {
              <header class="caso-titulo">
                <h2>{{ bloque.nombre || 'Escenario' }}</h2>
                <p class="sub">{{ bloque.contexto }}</p>
              </header>
              @for (pregunta of bloque.preguntas; track $index; let p = $index) {
                <section class="caso-casilla">
                  <h3>Pregunta {{ p + 1 }}</h3>
                  <div class="caso-campo">
                    <span class="caso-etiqueta">Enunciado</span>
                    <app-editor [(valor)]="pregunta.enunciado" [bloqueado]="bloqueado()" />
                  </div>
                  <label class="caso-campo">
                    <span class="caso-etiqueta">Herramienta (pista, opcional)</span>
                    <input [(ngModel)]="pregunta.pista" [disabled]="bloqueado()" />
                  </label>
                  <div class="grid-2">
                    <label class="caso-campo">
                      <span class="caso-etiqueta">Criterio</span>
                      <input [(ngModel)]="pregunta.criterio" [disabled]="bloqueado()" />
                    </label>
                    <label class="caso-campo">
                      <span class="caso-etiqueta">Peso</span>
                      <input type="number" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()" />
                    </label>
                  </div>
                  @for (opcion of pregunta.opciones; track $index; let o = $index) {
                    <div class="caso-subgrupo">
                      <h3>Opción {{ o + 1 }}</h3>
                      <label class="caso-campo">
                        <span class="caso-etiqueta">Texto</span>
                        <input [(ngModel)]="opcion.texto" [disabled]="bloqueado()" />
                      </label>
                      <label class="check"><input type="checkbox" [checked]="opcion.correcta" [disabled]="bloqueado()" (change)="marcar(pregunta, o)" /> <span>Correcta</span></label>
                      <label class="caso-campo">
                        <span class="caso-etiqueta">Por qué</span>
                        <input [(ngModel)]="opcion.explicacion" [disabled]="bloqueado()" />
                      </label>
                      <label class="caso-campo">
                        <span class="caso-etiqueta">Fundamento</span>
                        <input [(ngModel)]="opcion.fundamento" [disabled]="bloqueado()" />
                      </label>
                    </div>
                  }
                  @if (!bloqueado()) {
                    <div class="caso-acciones">
                      <button class="btn-oscuro" type="button" (click)="pregunta.opciones.push(opcionVacia())">Agregar opción</button>
                      <button class="btn-suave" type="button" (click)="quitarPregunta(bloque, p)">Quitar pregunta</button>
                    </div>
                  }
                </section>
              }
              @if (!bloqueado()) {
                <div class="caso-acciones">
                  <button class="btn-oscuro" type="button" (click)="agregarPregunta(bloque)">Agregar pregunta</button>
                </div>
              }
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
              <h3>Reparto</h3>
              <div class="caso-acciones">
                <button class="btn-oscuro" type="button" [disabled]="bloqueado()" (click)="elegirReparto('PONDERADA')">Ponderada</button>
                <button class="btn-oscuro" type="button" [disabled]="bloqueado()" (click)="elegirReparto('EQUITATIVA')">Equitativa</button>
                <span class="sub">{{ caso.repartoRubrica === 'EQUITATIVA' ? 'El sistema reparte 5,0.' : 'Tú fijas cada peso.' }}</span>
              </div>
              @for (bloque of caso.bloques; track $index) {
                @for (pregunta of bloque.preguntas; track $index) {
                  <label class="caso-campo">
                    <span class="caso-etiqueta">{{ bloque.nombre }} · {{ pregunta.criterio || 'Sin criterio' }}</span>
                    @if (caso.repartoRubrica === 'EQUITATIVA') {
                      <strong>{{ pregunta.peso || 0 }}</strong>
                    } @else {
                      <input type="number" min="0" max="5" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()" />
                    }
                  </label>
                }
              }
              <p>Suma actual: {{ suma() }}</p>
            </section>
          </div>
        }

        @if (activo() === 'escena') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Diseño de escena</h2>
              <p class="sub">Describe a cada personaje (por ejemplo «madre de 38 años») y el sistema elige un personaje 3D que encaje. Marca en qué escenarios aparece y arrástralo en la escena: a los lados, o hacia arriba y abajo para alejarlo o acercarlo. La posición es solo el boceto de tu vista.</p>
            </header>
            @for (personaje of caso.personajes; track $index; let i = $index) {
              <section class="caso-casilla personaje-fila">
                <h3>{{ personaje.nombre || ('Persona ' + (i + 1)) }}</h3>
                <label class="caso-campo">
                  <span class="caso-etiqueta">Nombre</span>
                  <input [(ngModel)]="personaje.nombre" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)" />
                </label>
                <div class="caso-campo">
                  <span class="caso-etiqueta">Descripción</span>
                  <input [(ngModel)]="personaje.descripcion" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)"
                    placeholder="Ej.: madre de 38 años, trabaja en una panadería" [attr.aria-label]="'Descripción de ' + (personaje.nombre || 'Persona ' + (i + 1))" />
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
            <section class="caso-casilla">
              <h3>Escenario y fondo</h3>
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
            </section>
            <section class="caso-casilla">
              <h3>Boceto de escena</h3>
              <app-escena-novela
                [caso]="casoEscena()" [bloque]="bloqueEscena()" [personajes]="personajesEscena()"
                [modoEditor]="true" [bloqueado]="bloqueado()" [fondoManual]="fondoManual()" [posiciones]="posicionesEscena()"
                (elenco)="recibirElenco($event)" (mover)="moverPersona($event)" />
              @if (detectados()) { <p class="sub">{{ detectados() }}</p> }
            </section>
          </div>
        }

        @if (activo() === 'estado') {
          <div class="caso-vista">
            <header class="caso-titulo">
              <h2>Estado del caso</h2>
              <p class="sub">Los cambios de estado (guardar, publicar, archivar) están en la barra de abajo, a la derecha.</p>
            </header>
            <section class="caso-casilla ficha-estado">
              <div class="ficha-estado-cabeza">
                <span class="ficha-estado-pill" [attr.data-estado]="caso.estado || 'NUEVO'">{{ etiquetaEstado() }}</span>
                <h3>{{ caso.nombre || 'Sin nombre' }}</h3>
              </div>
              <p class="sub">{{ textoEstado() }}</p>
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
        <div class="row acciones-caso">
          @if (!bloqueado()) { <button class="btn-oscuro" type="button" (click)="guardar()">Guardar borrador</button> }
          <button class="btn-suave" type="button" (click)="vistaPrevia.set(!vistaPrevia())">Previsualizar</button>
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
      </section>

      <!-- Formulario de "Insertar diálogo" (desarrollo situacional o contexto de un escenario). -->
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
          <header class="modal-cabeza">
            @if (musica.disponible()) {
              <button type="button" class="musica" [attr.aria-pressed]="musica.activa()"
                [attr.aria-label]="musica.activa() ? 'Silenciar música' : 'Activar música'" (click)="musica.alternar()">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path class="parlante" d="M3 7.5h3l4.5-3.5v12L6 12.5H3z" />
                  @if (musica.activa()) {
                    <path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.8 5a7 7 0 0 1 0 10" />
                  } @else {
                    <path d="M13.5 7.5l5 5M18.5 7.5l-5 5" />
                  }
                </svg>
                <span>Música</span>
              </button>
            }
            <button type="button" class="cerrar" (click)="cerrarVistaPrevia()">Cerrar</button>
          </header>
          <div class="modal-cuerpo">
            <!-- Los resultados se calculan aquí, con los datos del editor: no hay peticiones al backend. -->
            <app-novela-reproductor [caso]="vista" [personajes]="vista.personajes"
              [resultados]="resultadosVista()" [mostrarCerrar]="true"
              (finalizar)="resultadosVista.set(calcularResultados(vista, $event))" (reiniciar)="resultadosVista.set(null)"
              (cerrar)="cerrarVistaPrevia()" anchoMaximo="calc((100vh - 130px) * 16 / 9)" />
          </div>
        </div>
      }
    </app-marco-docente>
  `
})
export class EditorCasoComponent {
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
    // Foco en el reproductor para usarlo con teclado.
    setTimeout(() => document.querySelector<HTMLElement>('.modal-vista .reproductor')?.focus(), 0);
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
  abrirInsertar(destino: string) {
    this.insertando.set(this.insertando() === destino ? null : destino);
    this.dialogoTexto = '';
    if (!this.hablantes().includes(this.dialogoPersonaje)) this.dialogoPersonaje = this.hablantes()[0] ?? '';
  }
  /** Inserta "Nombre: texto" en una línea nueva donde estaba el cursor. Se guarda en el mismo campo de siempre. */
  insertarDialogo(destino: 'desarrollo' | { bloque: number; area: HTMLTextAreaElement }) {
    const texto = this.dialogoTexto.trim();
    if (!this.dialogoPersonaje || !texto) return;
    const linea = `${this.dialogoPersonaje}: ${texto}`;
    if (destino === 'desarrollo') {
      this.editorDesarrollo()?.insertarLinea(linea);
    } else {
      const bloque = this.caso.bloques[destino.bloque];
      if (!bloque) return;
      const valor = bloque.contexto ?? '';
      const pos = Math.min(destino.area.selectionStart ?? valor.length, valor.length);
      const antes = valor.slice(0, pos), despues = valor.slice(pos);
      const prefijo = antes && !antes.endsWith('\n') ? '\n' : '';
      const sufijo = despues && !despues.startsWith('\n') ? '\n' : '';
      bloque.contexto = antes + prefijo + linea + sufijo + despues;
      const cursor = (antes + prefijo + linea).length;
      setTimeout(() => { destino.area.focus(); destino.area.setSelectionRange(cursor, cursor); });
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
  }
  agregarPregunta(bloque: Bloque) {
    bloque.preguntas.push(preguntaVacia());
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
  }
  quitarPregunta(bloque: Bloque, indice: number) {
    bloque.preguntas.splice(indice, 1);
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
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
  imports: [MarcoDocenteComponent, FormsModule, PaginacionGpComponent],
  host: { '(document:click)': 'cerrarMenu()', '(document:keydown.escape)': 'cerrarMenu(true)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Elige un grupo para ver y asignar a sus estudiantes.">
      <section class="gp">
        <div class="adm-herramientas">
          <p class="adm-resumen">{{ filtrados().length }} {{ filtrados().length === 1 ? 'grupo' : 'grupos' }}</p>
          <div class="adm-barra">
            <label class="adm-buscar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
              <span class="solo-lector">Buscar grupo</span>
              <input type="search" placeholder="Buscar grupo" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
            </label>
            <button class="adm-boton" type="button" (click)="alternarNuevo()" [attr.aria-expanded]="nuevo()"><span aria-hidden="true">+</span> Nuevo grupo</button>
          </div>
        </div>
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
          <section class="gp-tarjeta gp-lista" aria-labelledby="titulo-mis-grupos">
            <div class="gp-lista-cabeza">
              <h2 id="titulo-mis-grupos">Mis grupos</h2>
            </div>
            <ul class="gp-filas">
              @for (grupo of paginaGrupos(); track grupo.id) {
                <li class="gp-fila" [class.activa]="seleccionado() === grupo.id">
                  <button type="button" class="gp-fila-boton" (click)="elegir(grupo.id)" [attr.aria-current]="seleccionado() === grupo.id ? 'true' : null">
                    <strong>{{ grupo.nombre }}</strong>
                    <span>{{ grupo.espacioAcademico }} · {{ grupo.estudiantes.length }} {{ grupo.estudiantes.length === 1 ? 'estudiante' : 'estudiantes' }}</span>
                  </button>
                  <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                    <button type="button" class="gp-mas" [id]="'mas-' + grupo.id" aria-haspopup="menu"
                      [attr.aria-expanded]="menuAbierto() === grupo.id" [attr.aria-label]="'Opciones del grupo ' + grupo.nombre"
                      (click)="alternarMenu(grupo.id)">
                      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
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
            <app-paginacion-gp [total]="filtrados().length" [pagina]="pagina()" [porPagina]="6" [maxNumeros]="3" que="grupos" (cambiar)="pagina.set($event)" />
          </section>

          @if (actual(); as grupo) {
            <section class="gp-tarjeta gp-detalle" aria-labelledby="titulo-grupo">
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
                  <div>
                    <p class="gp-etiqueta">Grupo seleccionado</p>
                    <h2 id="titulo-grupo">{{ grupo.nombre }}</h2>
                    <p class="gp-periodo">Periodo {{ grupo.espacioAcademico }}</p>
                  </div>
                  <div class="gp-detalle-acciones">
                    @if (confirmarBorrar() === grupo.id) {
                      <span class="gp-confirmar" role="alert">¿Eliminar este grupo?</span>
                      <button class="gp-btn gp-btn-borde gp-btn-pildora gp-btn-chico" type="button" (click)="confirmarBorrar.set(null)">No</button>
                      <button class="gp-btn gp-btn-peligro-solido gp-btn-pildora gp-btn-chico" type="button" (click)="borrarGrupo(grupo.id)">Confirmar</button>
                    } @else {
                      <button class="gp-btn gp-btn-borde gp-btn-pildora gp-btn-chico" type="button" (click)="empezarEdicion(grupo)">Editar grupo</button>
                      <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                        <button type="button" class="gp-mas" [id]="'mas-' + (-grupo.id)" aria-haspopup="menu"
                          [attr.aria-expanded]="menuAbierto() === -grupo.id" [attr.aria-label]="'Más acciones del grupo ' + grupo.nombre"
                          (click)="alternarMenu(-grupo.id)">
                          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
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

              @if (puedeGestionar()) {
                <form class="gp-matricular" (ngSubmit)="agregar(grupo.id)" aria-labelledby="titulo-asignar">
                  <h3 id="titulo-asignar">Asignar al grupo</h3>
                  <div class="gp-matricular-fila">
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
                  </div>
                  <p class="gp-ayuda">La administración da de alta la cuenta. El código de acceso llega por correo al programar la sesión.</p>
                </form>
              }

              <div class="gp-estudiantes-cabeza">
                <h3>Estudiantes matriculados <span>({{ grupo.estudiantes.length }})</span></h3>
                <label class="gp-buscar">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
                  <span class="solo-lector">Buscar estudiante por nombre o correo</span>
                  <input type="search" placeholder="Buscar por nombre o correo" [ngModel]="busquedaEstudiante()"
                    (ngModelChange)="busquedaEstudiante.set($event); paginaEstudiantes.set(1)" />
                </label>
              </div>
              <div class="gp-tabla-marco">
                <div class="gp-tabla-scroll">
                  <table class="gp-tabla">
                    <thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col" class="gp-dc">Acciones</th></tr></thead>
                    <tbody>
                      @for (estudiante of paginaEstudiantesLista(); track estudiante.id) {
                        <tr>
                          <td class="gp-nombre">{{ estudiante.nombre }}</td>
                          <td class="gp-correo">{{ estudiante.email }}</td>
                          <td class="gp-dc">
                            @if (puedeGestionar()) {
                              <div class="gp-menu-ancla" (click)="$event.stopPropagation()">
                                <button type="button" class="gp-mas" [id]="'mas-' + menuEstudiante(estudiante.id)" aria-haspopup="menu"
                                  [attr.aria-expanded]="menuAbierto() === menuEstudiante(estudiante.id)" [attr.aria-label]="'Más acciones para ' + estudiante.nombre"
                                  (click)="alternarMenu(menuEstudiante(estudiante.id))">
                                  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
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
                        <tr><td colspan="3" class="gp-vacio">{{ busquedaEstudiante() ? 'Nadie coincide con la búsqueda.' : 'Este grupo no tiene estudiantes matriculados.' }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              <app-paginacion-gp [total]="estudiantesFiltrados().length" [pagina]="paginaEstudiantes()" [porPagina]="8"
                que="estudiantes" prefijo="Mostrando " (cambiar)="paginaEstudiantes.set($event)" />
            </section>
          }
        </div>
      </section>
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    .gp-nuevo {
      min-height: 36px; padding: 0 16px; flex: 0 0 auto;
      box-shadow: none; border: 3px solid rgba(255, 255, 255, .92) !important;
    }
    .gp-nuevo svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    .gp-crear { padding: 20px 22px; display: grid; gap: 14px; }
    .gp-crear h2 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .gp-crear-campos { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
    .gp-crear-botones { display: flex; gap: 8px; }
    .gp-grupos { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 22px; align-items: start; }
    .gp-lista { padding: 22px 22px 18px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .gp-lista-cabeza { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .gp-lista-cabeza h2 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .gp-lista-cabeza span { font-size: 13px; color: #6b7690; }
    .gp-filas { list-style: none; margin: 0; padding: 0 0 12px; display: grid; gap: 6px; border-bottom: 1px solid #edf1f7; }
    .gp-fila { position: relative; display: flex; align-items: center; gap: 6px; }
    .gp-fila-boton { flex: 1; min-width: 0; min-height: 56px; display: grid; gap: 2px; text-align: left; padding: 9px 14px;
      border: 1px solid transparent; border-radius: 12px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .gp-fila-boton strong { font-size: 14px; font-weight: 600; color: #0f1b3d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gp-fila-boton span { font-size: 13px; color: #5b6680; }
    .gp-fila-boton:hover { background: #f6f8fc; }
    .gp-fila.activa .gp-fila-boton { background: #eaf1ff; border-color: #bccff7; }
    .gp-menu-ancla { position: relative; flex: none; }
    .gp-mas { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent;
      color: #5b6680; cursor: pointer; }
    .gp-mas svg { width: 18px; height: 18px; fill: currentColor; }
    .gp-mas:hover, .gp-mas[aria-expanded="true"] { background: #f1f4fa; color: #0f1b3d; }
    .gp-menu { position: absolute; right: 0; top: 44px; z-index: 20; min-width: 150px; padding: 6px; display: grid; gap: 2px;
      background: #fff; border: 1px solid #e6ebf5; border-radius: 12px; box-shadow: 0 12px 28px rgba(16, 24, 40, .14); }
    .gp-menu button { min-height: 40px; padding: 0 12px; text-align: left; border: 0; border-radius: 8px; background: transparent;
      color: #1a2744; font: inherit; font-size: 13px; cursor: pointer; }
    .gp-menu button:hover, .gp-menu button:focus-visible { background: #f1f4fa; outline: none; }
    .gp-menu .peligro { color: #a4271b; }
    .gp-menu-lado { top: 50%; right: calc(100% + 6px); transform: translateY(-50%); }
    .gp-detalle-acciones .gp-menu-ancla { display: inline-block; }
    .gp-lista-vacia { padding: 12px 4px; font-size: 14px; }
    .gp-detalle { position: sticky; top: 16px; padding: 26px 28px 22px; display: grid; gap: 22px; }
    .gp-detalle-cabeza { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 16px; }
    .gp-etiqueta { margin: 0 0 4px; font-size: 13px; font-weight: 650; color: #1d5bdc; }
    .gp-detalle h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: #13213f; }
    .gp-periodo { margin: 4px 0 0; font-size: 14.5px; color: #5b6680; }
    .gp-detalle-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .gp-confirmar { font-size: 14px; color: #9b1c12; font-weight: 600; }
    .gp-editar { display: grid; gap: 10px; }
    .gp-matricular { display: grid; gap: 12px; padding: 20px 20px 16px; border-radius: 18px; background: #f6f8fc; border: 1px solid #e6ebf5; }
    .gp-matricular h3 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .gp-matricular-fila { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) auto; gap: 12px; align-items: end; }
    .gp-matricular-fila .gp-btn { min-height: 48px; }
    .gp-estudiantes-cabeza { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; }
    .gp-estudiantes-cabeza h3 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .gp-estudiantes-cabeza h3 span { font-weight: 500; color: #6b7690; }
    .gp-estudiantes-cabeza .gp-buscar { width: min(290px, 100%); }
    .gp-nombre { font-weight: 600; }
    .gp-correo { color: #3d4a66; }
    .gp-quitar { min-height: 40px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: #b42318;
      font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .gp-quitar:hover { background: #fff1f0; }
    @media (max-width: 1100px) {
      .gp-grupos { grid-template-columns: minmax(0, 1fr); }
      .gp-detalle { position: static; }
    }
    @media (max-width: 720px) {
      .gp-matricular-fila, .gp-crear-campos { grid-template-columns: minmax(0, 1fr); }
      .gp-detalle { padding: 20px 16px; }
      .gp-lista { padding: 18px 14px; }
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
  alternarMenu(id: number) {
    const abrir = this.menuAbierto() !== id;
    this.menuAbierto.set(abrir ? id : null);
    if (abrir) setTimeout(() => document.querySelector<HTMLElement>('.gp-menu [role="menuitem"]')?.focus());
  }
  /** Cierra el menú "⋯" (clic afuera o Escape); con Escape el foco vuelve a su botón. */
  cerrarMenu(devolverFoco = false) {
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
      next: () => { this.correoAsignar.set(''); this.busquedaAsignar.set(''); this.error.set(''); this.cargar(); },
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
  host: { '(document:click)': 'menuAbierto.set(null)', '(document:keydown.escape)': 'cerrarMenu()' },
  imports: [MarcoDocenteComponent, FormsModule, RouterLink, PaginacionGpComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Agenda un caso publicado con un grupo y abre la sesión cuando corresponda.">
      <section class="gp">
        @if (error()) { <p class="gp-error" role="alert">{{ error() }}</p> }
        @if (ok()) { <p class="gp-ok" role="status">{{ ok() }}</p> }

        <div class="pg-arriba">
          <form class="gp-tarjeta pg-form" (ngSubmit)="principal()" aria-label="Programar una sesión">
            <fieldset class="pg-seccion">
              <legend><span class="pg-num" aria-hidden="true">1</span> Caso y grupo</legend>
              <div class="pg-dos">
                <label class="gp-campo"><span>Caso publicado</span>
                  <select name="casoId" [(ngModel)]="casoId">
                    @if (!publicados().length) { <option [ngValue]="0">No tienes casos publicados</option> }
                    @for (caso of publicados(); track caso.id) { <option [ngValue]="caso.id">{{ caso.nombre }}</option> }
                  </select>
                </label>
                <label class="gp-campo"><span>Grupo</span>
                  <select name="grupoId" [(ngModel)]="grupoId">
                    @for (grupo of grupos(); track grupo.id) { <option [ngValue]="grupo.id">{{ grupo.nombre }} · {{ grupo.espacioAcademico }}</option> }
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset class="pg-seccion">
              <legend><span class="pg-num" aria-hidden="true">2</span> Horario</legend>
              <div class="pg-dos">
                <label class="gp-campo"><span>Inicio</span><input name="inicio" type="datetime-local" [(ngModel)]="inicio" /></label>
                <label class="gp-campo"><span>Fin</span><input name="fin" type="datetime-local" [(ngModel)]="fin" /></label>
              </div>
              <div class="pg-dos">
                <div class="pg-con-ayuda">
                  <label class="gp-campo"><span>Tiempo máximo (min)</span>
                    <input name="tiempoMax" type="number" min="1" [(ngModel)]="tiempoMax" aria-describedby="ayuda-tiempo" />
                  </label>
                  <p class="gp-ayuda" id="ayuda-tiempo">No puede superar el tiempo estimado del caso.</p>
                </div>
                <div class="pg-con-ayuda">
                  <label class="gp-campo"><span>Tolerancia de ingreso (min)</span>
                    <input name="tolerancia" type="number" min="0" [(ngModel)]="tolerancia" aria-describedby="ayuda-tolerancia" />
                  </label>
                  <p class="gp-ayuda" id="ayuda-tolerancia">Después de este tiempo nadie puede iniciar.</p>
                </div>
              </div>
            </fieldset>

            <fieldset class="pg-seccion">
              <legend><span class="pg-num" aria-hidden="true">3</span> Lugar y mensaje</legend>
              <label class="gp-campo"><span>Lugar (si aplica)</span><input name="lugar" [(ngModel)]="lugar" placeholder="Ej. Aula 302 o Virtual" /></label>
              <label class="gp-campo"><span>Mensaje para los estudiantes</span>
                <textarea name="mensaje" [(ngModel)]="mensaje" placeholder="Opcional. Aparece en el correo y en la pantalla antes de iniciar."></textarea>
              </label>
            </fieldset>

            <div class="pg-pie">
              <p class="gp-ayuda">Al agendar, cada estudiante recibe por correo la URL y su código de acceso.
                <button type="button" class="pg-enlace" (click)="borrador()">Guardar borrador</button></p>
              <div class="pg-botones">
                <button class="gp-btn gp-btn-borde gp-btn-pildora" type="button" (click)="limpiar()">{{ editandoId() ? 'Cancelar edición' : 'Limpiar' }}</button>
                <button class="gp-btn gp-btn-oscuro gp-btn-pildora" type="submit">{{ editandoId() ? 'Guardar cambios' : 'Agendar y notificar' }}</button>
              </div>
            </div>
          </form>

          <aside class="gp-tarjeta pg-resumen" aria-labelledby="titulo-resumen">
            <div class="pg-resumen-cabeza">
              <h2 id="titulo-resumen">Resumen</h2>
              <span class="pg-chip">{{ editandoId() ? 'Editando' : 'Por agendar' }}</span>
            </div>
            <p class="pg-resumen-caso">{{ casoElegido()?.nombre ?? 'Sin caso seleccionado' }}</p>
            <dl class="pg-datos">
              <div><dt>Grupo</dt><dd>{{ grupoElegido()?.nombre ?? '—' }}</dd></div>
              <div><dt>Lugar</dt><dd>{{ lugar || 'Virtual' }}</dd></div>
              <div><dt>Inicio</dt><dd>{{ inicio ? fecha(inicio) : '—' }}</dd></div>
              <div><dt>Fin</dt><dd>{{ fin ? fecha(fin) : '—' }}</dd></div>
            </dl>
            <div class="pg-cifras">
              <div><small>Máx.</small><strong>{{ tiempoMax || '—' }} min</strong></div>
              <div><small>Ingreso</small><strong>{{ tolerancia }} min</strong></div>
              <div><small>Estimado</small><strong>{{ casoElegido()?.tiempoEstimadoMin ?? '—' }} min</strong></div>
            </div>
            <p class="pg-resumen-nota">La sesión queda “Sin iniciar” hasta que la abras. Si no la cierras, el sistema la finaliza un día después de la fecha de fin.</p>
          </aside>
        </div>

        <h2 class="adm-seccion-titulo" id="titulo-convocatorias">Convocatorias <span>({{ sesiones().length }})</span></h2>
        <div class="adm-herramientas">
          <div class="adm-filtros" role="group" aria-label="Filtrar por estado">
            @for (f of filtros; track f.valor) {
              <button type="button" class="adm-filtro" [class.activo]="filtroEstado() === f.valor" [attr.aria-pressed]="filtroEstado() === f.valor"
                (click)="filtroEstado.set(f.valor); pagina.set(1)">{{ f.texto }}</button>
            }
          </div>
          <div class="adm-barra">
            <label class="adm-buscar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
              <span class="solo-lector">Buscar convocatoria por caso o código</span>
              <input type="search" placeholder="Buscar caso o código" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); pagina.set(1)" />
            </label>
            <button class="adm-boton" type="button" (click)="irAlFormulario()"><span aria-hidden="true">+</span> Programar sesión</button>
          </div>
        </div>
        <section class="gp-tarjeta pg-convocatorias" aria-labelledby="titulo-convocatorias">
          <div class="adm-tabla-caja">
            <table class="adm-tabla pg-tabla">
              <colgroup>
                <col class="pg-c-codigo" /><col class="pg-c-caso" /><col class="pg-c-grupo" /><col class="pg-c-inicio" />
                <col class="pg-c-estado" /><col class="pg-c-acciones" />
              </colgroup>
              <thead><tr>
                <th scope="col">Código</th><th scope="col">Caso</th><th scope="col">Grupo</th><th scope="col">Inicio</th>
                <th scope="col">Estado</th><th scope="col" class="derecha">Acciones</th>
              </tr></thead>
              <tbody>
                @for (sesion of paginaSesiones(); track sesion.id) {
                  <tr>
                    <td class="pg-codigo">{{ sesion.codigo }}</td>
                    <td><span class="pg-corte" [title]="sesion.caso">{{ sesion.caso }}</span></td>
                    <td class="gris"><span class="pg-corte" [title]="sesion.grupo">{{ sesion.grupo }}</span></td>
                    <td class="gris">{{ fecha(sesion.inicio) }}</td>
                    <td><span class="adm-estado-pill" [attr.data-estado]="sesion.estado">{{ etiquetaEstadoSesion(sesion.estado) }}</span></td>
                    <td class="derecha">
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
                            (click)="alternarMenu(sesion.id, $event)"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg></button>
                          @if (menuAbierto() === sesion.id) {
                            <div class="pg-menu" role="menu" [attr.aria-label]="'Acciones de la sesión ' + sesion.codigo"
                              [style.top.px]="menuPos().top" [style.bottom.px]="menuPos().bottom" [style.right.px]="menuPos().right">
                              @if (sesion.estado === 'SIN_INICIAR') {
                                <button type="button" role="menuitem" (click)="menuAbierto.set(null); cargarEdicion(sesion); irAlFormulario()">Editar</button>
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
                  <tr><td colspan="6" class="adm-vacio">{{ sesiones().length ? 'Ninguna convocatoria coincide con el filtro.' : 'Todavía no tienes convocatorias.' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion-gp [total]="sesionesFiltradas().length" [pagina]="pagina()" [porPagina]="8"
            que="convocatorias" prefijo="Mostrando " (cambiar)="pagina.set($event)" />
        </section>
      </section>
    </app-marco-docente>
  `,
  styles: [ESTILOS_GP + `
    .pg-arriba { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 22px; align-items: start; }
    .pg-form { padding: 10px 28px 24px; display: grid; }
    .pg-seccion { margin: 0; padding: 22px 0; border: 0; border-bottom: 1px solid #edf1f7; display: grid; gap: 14px; min-width: 0; }
    .pg-seccion legend { float: left; width: 100%; padding: 0; margin: 0 0 4px; display: flex; align-items: center; gap: 12px;
      font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .pg-seccion legend + * { clear: both; }
    .pg-num { width: 28px; height: 28px; display: inline-grid; place-items: center; border-radius: 50%; background: #e8eefc;
      color: #2f5bd3; font-size: 13px; font-weight: 800; }
    .pg-dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
    .pg-con-ayuda { display: grid; gap: 6px; align-content: start; }
    .pg-pie { padding-top: 22px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; }
    .pg-pie > .gp-ayuda { max-width: 380px; line-height: 1.45; }
    .pg-enlace { margin-left: 4px; padding: 0; border: 0; background: none; color: #2f5bd3; font: inherit; font-weight: 600;
      text-decoration: underline; cursor: pointer; }
    .pg-enlace:focus-visible { outline: 3px solid rgba(59, 108, 255, .35); outline-offset: 2px; border-radius: 4px; }
    .pg-botones { display: flex; gap: 10px; }
    .pg-botones .gp-btn { min-height: 36px; padding: 0 16px; }
    .pg-resumen { position: sticky; top: 16px; padding: 22px 22px 20px; display: grid; gap: 14px; }
    .pg-resumen-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pg-resumen-cabeza h2 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .pg-chip { padding: 4px 10px; border-radius: 999px; background: #eef1f6; color: #3d4a66; font-size: 12.5px; font-weight: 650; }
    .pg-resumen-caso { margin: 0; font-size: 15px; font-weight: 600; color: #3d4a66; }
    .pg-datos { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
    .pg-datos dt { font-size: 12.5px; font-weight: 650; color: #5b6680; }
    .pg-datos dd { margin: 2px 0 0; font-size: 14px; color: #0f1b3d; overflow-wrap: anywhere; }
    .pg-cifras { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-bottom: 16px; border-bottom: 1px solid #edf1f7; }
    .pg-cifras div { display: grid; gap: 2px; justify-items: center; padding: 10px 4px; border: 1px solid #e6ebf5; border-radius: 12px; background: #f8fafd; }
    .pg-cifras small { font-size: 12px; font-weight: 650; color: #5b6680; }
    .pg-cifras strong { font-size: 17px; font-weight: 800; color: #0f1b3d; white-space: nowrap; }
    .pg-resumen-nota { margin: 0; font-size: 13px; line-height: 1.5; color: #5b6680; }
    .pg-convocatorias { padding: 0 0 14px; display: grid; gap: 14px; overflow: hidden; }
    .pg-convocatorias app-paginacion-gp { padding: 0 16px; }
    .pg-conv-cabeza { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; }
    .pg-conv-cabeza h2 { margin: 0; font-size: 16px; font-weight: 650; color: #0f1b3d; }
    .pg-conv-cabeza h2 span { font-weight: 500; color: #6b7690; font-size: 14px; }
    .pg-conv-herramientas { display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: 400px; max-width: 100%; flex: 0 0 auto; }
    .pg-filtros { display: flex; width: 100%; gap: 2px; padding: 4px; border-radius: 999px; background: #f1f4fa; box-sizing: border-box; }
    .pg-filtros button { flex: 1 1 0; min-width: 0; min-height: 36px; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: #1a2744;
      font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
    .pg-filtros button[aria-pressed="true"] { background: #0a1733; color: #fff; font-weight: 700; }
    .pg-filtros button:focus-visible { outline: 3px solid rgba(59, 108, 255, .35); outline-offset: 1px; }
    .pg-buscar { width: 100%; }
    /* Más específico que la regla global de .adm-tabla (min-width 760px): el caso nunca se queda sin ancho. */
    .pg-convocatorias .adm-tabla.pg-tabla { table-layout: fixed; min-width: 1100px; }
    .pg-c-codigo { width: 130px; } .pg-c-grupo { width: 200px; } .pg-c-inicio { width: 190px; }
    .pg-c-estado { width: 120px; } .pg-c-acciones { width: 190px; }
    .pg-tabla td { height: 64px; box-sizing: border-box; vertical-align: middle; }
    .pg-codigo { font-weight: 700; color: #13213f; }
    .pg-corte { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      white-space: normal; overflow-wrap: normal; word-break: normal; line-height: 1.35; }
    .pg-acciones { display: flex; flex-wrap: nowrap; align-items: center; justify-content: flex-end; gap: 6px; }
    .pg-principal, .pg-suave { min-height: 34px; display: inline-flex; align-items: center; gap: 4px; padding: 0 14px; border-radius: 10px;
      font: inherit; font-size: 13.5px; font-weight: 700; text-decoration: none; white-space: nowrap; cursor: pointer; }
    .pg-principal { border: 0; background: #2563eb; color: #fff; }
    .pg-principal:hover { background: #1d4fd0; }
    .pg-suave { border: 0; background: #eef4ff; color: #1d5bdc; }
    .pg-suave:hover { background: #e1ebff; }
    .pg-mas, .pg-mas-vacio { flex: none; width: 34px; height: 34px; }
    .pg-mas { display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #33415c; cursor: pointer; }
    .pg-mas svg { width: 17px; height: 17px; fill: currentColor; }
    .pg-mas:hover, .pg-mas[aria-expanded="true"] { background: #eef2f9; }
    .pg-principal:focus-visible, .pg-suave:focus-visible, .pg-mas:focus-visible { outline: 3px solid #7aa7ff; outline-offset: 2px; }
    /* Fijo a la ventana: la tabla que se desplaza de lado no lo recorta. */
    .pg-menu { position: fixed; z-index: 50; min-width: 160px; padding: 4px; display: grid; gap: 2px; text-align: left;
      background: #fff; border: 1px solid #e6ecf6; border-radius: 10px; box-shadow: 0 8px 20px rgba(16, 24, 40, .10); }
    .pg-menu button { min-height: 36px; display: flex; align-items: center; padding: 0 12px; border: 0; border-radius: 7px; background: transparent;
      color: #13213f; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .pg-menu button:hover, .pg-menu button:focus-visible { background: #f2f6ff; outline: none; }
    .pg-menu .peligro { color: #a4271b; }
    .pg-menu .peligro:hover { background: #fdf1f0; }
    .pg-tenue { color: #5b6680; }
    .pg-fecha { white-space: nowrap; }
    .pg-estado { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap;
      background: #eef1f6; color: #3d4a66; }
    .pg-estado[data-estado="EN_CURSO"] { background: #e6efff; color: #2753c9; }
    .pg-estado[data-estado="FINALIZADO"] { background: #e3f5ea; color: #1b6f45; }
    @media (max-width: 1100px) {
      .pg-arriba { grid-template-columns: minmax(0, 1fr); }
      .pg-resumen { position: static; }
    }
    @media (max-width: 720px) {
      .pg-dos { grid-template-columns: minmax(0, 1fr); }
      .pg-form { padding: 6px 16px 18px; }
      .pg-convocatorias { padding: 0 0 12px; }
      .pg-conv-cabeza { flex-direction: column; align-items: stretch; }
      .pg-conv-herramientas { width: 100%; }
      .pg-botones { width: 100%; }
      .pg-botones .gp-btn { flex: 1; }
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
  readonly paginaSesiones = computed(() => paginar(this.sesionesFiltradas(), this.pagina(), 8));
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
  /** "+ Programar sesión" y "Editar": lleva al formulario (la página se desplaza dentro de su marco). */
  irAlFormulario() {
    setTimeout(() => {
      const formulario = document.querySelector<HTMLElement>('.pg-form');
      formulario?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formulario?.querySelector<HTMLElement>('select')?.focus({ preventScroll: true });
    });
  }
  constructor() {
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
    const grupo = Number(this.route.snapshot.queryParamMap.get('grupo') || 0);
    if (grupo) this.grupoId = grupo;
    this.cargar();
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
        this.ok.set('Convocatoria registrada. Los estudiantes reciben el aviso sin que el código quede visible.');
        this.error.set('');
        localStorage.removeItem('dilema-agenda');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  guardarEdicion() {
    const id = this.editandoId();
    if (!id) return;
    this.http.put<Sesion>(`/api/docente/sesiones/${id}`, this.cuerpoAgenda()).subscribe({
      next: () => {
        this.ok.set('Convocatoria actualizada. Los estudiantes reciben el aviso del cambio.');
        this.error.set('');
        this.editandoId.set(null);
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
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, RouterLink, FormsModule, PaginacionTablaComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" descripcion="Bitácora en vivo y consulta de sesiones ya realizadas.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Qué convocatorias ver">
          <button type="button" class="adm-filtro" [class.activo]="vista === 'todas'" [attr.aria-pressed]="vista === 'todas'"
            (click)="vista = 'todas'; cambiarVista()">Todas las convocatorias</button>
          <button type="button" class="adm-filtro" [class.activo]="vista === 'realizadas'" [attr.aria-pressed]="vista === 'realizadas'"
            (click)="vista = 'realizadas'; cambiarVista()">Solo realizadas</button>
        </div>
        <div class="adm-barra">
          <label class="adm-orden">
            <span class="solo-lector">Convocatoria</span>
            <select class="adm-selector-ancho" [(ngModel)]="sesionId" (ngModelChange)="ver($event)">
              @for (sesion of sesionesVista(); track sesion.id) {
                <option [ngValue]="sesion.id">{{ sesion.caso }} · {{ sesion.grupo }}</option>
              }
            </select>
          </label>
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar estudiante</span>
            <input type="search" [(ngModel)]="busqueda" (ngModelChange)="pagina.set(1)" placeholder="Buscar estudiante" />
          </label>
        </div>
      </div>
      @if (aviso()) { <p class="error">{{ aviso() }}</p> }

      <div class="rp-cuerpo">
        <article class="adm-tarjeta adm-tabla-tarjeta">
          <div class="adm-tabla-caja">
            <table class="adm-tabla">
              <thead>
                <tr><th scope="col">Estudiante</th><th scope="col">Estado</th><th scope="col">Puntaje</th><th scope="col">Nivel</th><th scope="col" class="derecha">Consulta</th></tr>
              </thead>
              <tbody>
                @for (fila of filasPagina(); track fila.email) {
                  <tr>
                    <td><div class="adm-celda-doble"><strong>{{ fila.estudiante }}</strong><small>{{ fila.email }}</small></div></td>
                    <td><span class="adm-estado-pill" [attr.data-estado]="fila.estado">{{ etiquetaFila(fila.estado) }}</span></td>
                    <td>{{ fila.nota ?? '—' }} / 5,0</td>
                    <td class="gris">{{ nivel(fila.nota) }}</td>
                    <td class="derecha">
                      <div class="adm-acciones-celda">
                        @if (fila.repeticionAutorizada) { <span class="gris">Repetición autorizada</span> }
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
                            <a class="adm-enlace" [routerLink]="['/docente/seguimiento', lista[lista.length - 1].id]">Último intento <span aria-hidden="true">›</span></a>
                          } @else if (fila.participacionId) {
                            <a class="adm-enlace" [routerLink]="['/docente/seguimiento', fila.participacionId]">Ver respuestas <span aria-hidden="true">›</span></a>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                } @empty { <tr><td colspan="5" class="adm-vacio">No hay estudiantes en esta convocatoria.</td></tr> }
              </tbody>
            </table>
          </div>
          <app-paginacion-tabla [total]="visibles().length" [pagina]="paginaActual()" (cambiar)="pagina.set($event)" />
        </article>

        <aside class="adm-tarjeta rp-ficha" aria-label="Ficha de cohorte">
          <h2>Ficha de cohorte</h2>
          <div class="adm-cifras">
            <div><small>Promedio</small><strong>{{ promedio() }}</strong></div>
            <div><small>Hechos</small><strong>{{ finalizados() }}/{{ filas().length }}</strong></div>
            <div><small>Pendientes</small><strong>{{ filas().length - finalizados() }}</strong></div>
          </div>
          <div class="rp-niveles">
            <span><small>Superior</small>{{ conteo('Superior') }}</span>
            <span><small>Alto</small>{{ conteo('Alto') }}</span>
            <span><small>Básico</small>{{ conteo('Básico') }}</span>
            <span><small>Bajo</small>{{ conteo('Bajo') }}</span>
          </div>
          <div class="adm-acciones-fila" role="group" aria-label="Exportar reporte">
            <button class="adm-boton-contorno adm-boton-chico" type="button" (click)="descargar('csv')">CSV</button>
            <button class="adm-boton-contorno adm-boton-chico" type="button" (click)="descargar('pdf')">PDF</button>
            <button class="adm-boton-contorno adm-boton-chico" type="button" (click)="descargar('xlsx')">Excel</button>
          </div>
        </aside>
      </div>
    </app-marco-docente>
  `
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
