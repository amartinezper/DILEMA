import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { forkJoin } from 'rxjs';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { MarcoEstudianteComponent } from '../shared/marco-estudiante.component';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { Aviso, OpcionJuego, PanelEstudiante, Participacion, PersonajeCaso, PreguntaJuego, Sesion, mensajeError } from '../core/api.service';
import type { CasoReproductor, OpcionElegida } from '../shared/novela/novela-reproductor.component';
import { NovelaReproductorComponent } from '../shared/novela/novela-reproductor.component';
import { MusicaNovelaService } from '../shared/novela/musica-novela.service';
import { ResultadosNovelaComponent } from '../shared/novela/resultados-novela.component';
import { resultadosDeParticipacion } from '../shared/novela/resultados';
import { EscenaService } from '../shared/novela/escena.service';
import { PaginacionTablaComponent, paginaDe, paginaValida } from '../shared/paginacion-tabla.component';
import { IconoComponent } from '../shared/icono.component';

const enlaces = [
  { href: '/estudiante', texto: 'Casos asignados', exacto: true },
  { href: '/estudiante/avisos', texto: 'Notificaciones', exacto: true }
];

/** Escena neutra del banco si no se puede leer escenas.json. */
const FONDO_NEUTRO = '/escenas/oficina-institucional/1-dia.webp';

/** Id de la sesión con la que entró el estudiante (lo guarda AuthService al ingresar). */
function sesionDelIngreso(): number | null {
  try {
    const valor = Number(localStorage.getItem('dilema-sesion'));
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Sesión destacada: la del ingreso si sigue en el panel; si no, la que está en curso (primero las que el
 * estudiante aún puede resolver, y entre ellas la que cierra antes); si no, la pendiente más próxima; y si
 * no, la más reciente.
 */
function elegirDestacado(lista: Sesion[], deIngreso: number | null, ahora: number): Sesion | null {
  if (!lista.length) return null;
  const delIngreso = deIngreso == null ? undefined : lista.find((s) => s.id === deIngreso);
  if (delIngreso) return delIngreso;
  const t = (iso: string) => { const v = Date.parse(iso); return Number.isNaN(v) ? 0 : v; };
  const porResolver = (s: Sesion) => s.repeticionAutorizada || !s.participacionEstado || s.participacionEstado === 'EN_CURSO';
  const enCurso = lista.filter((s) => s.estado === 'EN_CURSO')
    .sort((a, b) => Number(porResolver(b)) - Number(porResolver(a)) || t(a.fin) - t(b.fin));
  if (enCurso.length) return enCurso[0];
  const pendientes = lista.filter((s) => s.estado === 'SIN_INICIAR');
  const proxima = pendientes.filter((s) => t(s.inicio) >= ahora).sort((a, b) => t(a.inicio) - t(b.inicio))[0]
    ?? pendientes.sort((a, b) => t(b.inicio) - t(a.inicio))[0];
  if (proxima) return proxima;
  return [...lista].sort((a, b) => t(b.inicio) - t(a.inicio))[0];
}

/** Texto sin HTML ni entidades, con los bloques separados por espacios. */
function textoPlano(html: string): string {
  const conEspacios = (html ?? '').replace(/<\/(p|li|h\d|div|blockquote)>|<br\s*\/?>/gi, ' ');
  const texto = new DOMParser().parseFromString(conEspacios, 'text/html').body.textContent ?? '';
  return texto.replace(/\s+/g, ' ').trim();
}

/** Inicio del desarrollo situacional: frases completas hasta unos `max` caracteres, terminado en "…". */
function resumenDesarrollo(html: string, max = 200): string {
  const texto = textoPlano(html);
  if (texto.length <= max) return texto;
  let resumen = '';
  for (const frase of texto.match(/[^.!?…]+[.!?…]+["»”')]*\s*/g) ?? []) {
    if ((resumen + frase).trim().length > max) break;
    resumen += frase;
  }
  resumen = resumen.trim();
  if (!resumen) {
    // La primera frase ya pasa del límite: se corta en la última palabra completa.
    const corte = texto.slice(0, max);
    resumen = corte.slice(0, Math.max(corte.lastIndexOf(' '), 1)).replace(/[\s,;:–—-]+$/, '');
  }
  return `${resumen} …`;
}

type FiltroDilema = 'todos' | 'pendientes' | 'en_curso' | 'finalizados';

@Component({
  selector: 'app-panel-estudiante',
  imports: [RouterLink, MarcoEstudianteComponent, PaginacionTablaComponent, IconoComponent],
  template: `
    <app-marco-estudiante [activa]="seccion()" [sinLeer]="sinLeer()" [descripcion]="descripcionSeccion()">
        @if (error()) { <p class="error">{{ error() }}</p> }

        @if (seccion() === 'inicio') {
          <section class="dl-kpis" aria-label="Resumen">
            <article class="dl-kpi">
              <span class="dl-kpi-icono"><app-icono nombre="birrete" [tamano]="28" /></span>
              <div><h2>Dilemas resueltos</h2><strong>{{ resueltos() }}</strong><span>de {{ asignados() }} asignados</span></div>
            </article>
            <article class="dl-kpi">
              <span class="dl-kpi-icono"><app-icono nombre="trofeo" [tamano]="28" /></span>
              <div><h2>Tu puntaje</h2><strong>{{ promedio() }}</strong><span><app-icono class="dl-kpi-estrella" nombre="estrella" [tamano]="14" /> Promedio sobre 5.0</span></div>
            </article>
            <article class="dl-kpi">
              <span class="dl-kpi-icono"><app-icono nombre="check" [tamano]="28" /></span>
              <div><h2>Pendientes</h2><strong>{{ pendientes() }}</strong><span>{{ enCurso() === 1 ? '1 en curso' : enCurso() + ' en curso' }}</span></div>
            </article>
          </section>

          <section class="inicio-fila">
            <article class="inicio-destacado">
              <div class="destacado-texto">
                <p class="chip-estrella"><app-icono nombre="estrella" [tamano]="18" /> Dilema destacado</p>
                @if (destacado(); as caso) {
                  <h2>{{ caso.caso }}</h2>
                  @if (caso.sensible) {
                    <p class="destacado-sensible" role="note">⚠ {{ (caso.advertencia || '').trim() || 'Este caso trata temas sensibles.' }}</p>
                  }
                  @if (textoDestacado()) { <p class="destacado-resumen">{{ textoDestacado() }}</p> }
                  @if (caso.repeticionAutorizada || caso.participacionEstado === 'EN_CURSO' || !caso.participacionEstado) {
                    <button class="btn-resolver" type="button" (click)="iniciarCaso(caso)">{{ caso.participacionEstado === 'EN_CURSO' ? 'Continuar' : 'Comenzar' }} <app-icono nombre="flecha" [tamano]="20" /></button>
                  } @else if (caso.participacionEstado === 'FINALIZADA' && caso.participacionId) {
                    <a class="btn-resolver" [routerLink]="['/estudiante/participacion', caso.participacionId]">Ver resultados <app-icono nombre="flecha" [tamano]="20" /></a>
                  } @else if (caso.estado === 'SIN_INICIAR') {
                    <p class="sub claro">Esperando a que el docente inicie la sesión.</p>
                  } @else if (caso.estado === 'FINALIZADO' && !caso.participacionId) {
                    <p class="sub claro">No participaste. Ausencia 0,0.</p>
                  } @else {
                    <button class="btn-resolver" type="button" (click)="iniciarCaso(caso)">Comenzar <app-icono nombre="flecha" [tamano]="20" /></button>
                  }
                } @else if (panel()) {
                  <h2>Aún no tienes casos asignados</h2>
                  <p class="destacado-resumen">Cuando tu docente te convoque a una sesión, el caso aparecerá aquí.</p>
                }
              </div>
              <figure class="destacado-figura">
                @if (fondoDestacado(); as fondo) {
                  <img [src]="fondo.ruta" [alt]="altDestacado()" />
                  @if (fondo.escenario) {
                    <figcaption class="letrero-escena"><app-icono nombre="play" [tamano]="20" /> <span>Escena 1 · {{ fondo.escenario }}</span></figcaption>
                  }
                }
              </figure>
            </article>

            <article class="inicio-progreso">
              <h3>Tu progreso</h3>
              <div class="dl-aro" role="img" [attr.aria-label]="'Progreso: ' + progresoGeneral() + '% (' + resueltos() + ' de ' + asignados() + ' dilemas resueltos)'">
                <svg viewBox="0 0 140 140" aria-hidden="true">
                  <defs>
                    <linearGradient id="dl-aro-azul" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stop-color="#1a73ff"/><stop offset="1" stop-color="#0b50d8"/>
                    </linearGradient>
                  </defs>
                  <circle cx="70" cy="70" r="58" fill="none" stroke="#e3edff" stroke-width="14"/>
                  @if (progresoGeneral() > 0) {
                    <circle cx="70" cy="70" r="58" fill="none" stroke="url(#dl-aro-azul)" stroke-width="14" stroke-linecap="round"
                      pathLength="100" [attr.stroke-dasharray]="progresoGeneral() + ' 100'" transform="rotate(-90 70 70)"/>
                  }
                </svg>
                <span>{{ progresoGeneral() }}%</span>
              </div>
              <p class="nivel"><app-icono nombre="sube" [tamano]="18" /> {{ nivel() }}</p>
              <div class="dl-progreso-tip">
                <app-icono class="dl-progreso-trofeo" nombre="trofeo" [tamano]="22" />
                <p>Revisa tus resultados y sigue con los demás casos en Mis dilemas.</p>
                <a class="dl-progreso-ir" [routerLink]="['/estudiante']" [queryParams]="{ vista: 'dilemas' }" aria-label="Ir a Mis dilemas">
                  <app-icono nombre="flecha" [tamano]="20" />
                </a>
              </div>
            </article>
          </section>
        }

        @if (seccion() === 'dilemas') {
          <div class="adm-herramientas">
            <div class="adm-filtros" role="group" aria-label="Filtrar dilemas">
              @for (f of filtrosDilemas; track f.id) {
                <button type="button" class="adm-filtro" [class.activo]="filtroDilemas() === f.id" [attr.aria-pressed]="filtroDilemas() === f.id"
                  (click)="filtroDilemas.set(f.id); paginaDilemas.set(1)">{{ f.texto }} <span>({{ cuantosDilemas(f.id) }})</span></button>
              }
            </div>
            <div class="adm-barra">
              <label class="adm-buscar">
                <app-icono nombre="buscar" [tamano]="20" />
                <span class="solo-lector">Buscar dilema</span>
                <input type="search" placeholder="Buscar caso o grupo" [value]="busquedaDilemas()" (input)="busquedaDilemas.set(valorCampo($event)); paginaDilemas.set(1)" />
              </label>
              <label class="adm-orden">
                <span class="solo-lector">Ordenar</span>
                <select [value]="ordenDilemas()" (change)="ordenDilemas.set(valorCampo($event)); paginaDilemas.set(1)">
                  <option value="recientes">Más recientes</option>
                  <option value="nombre">Nombre A–Z</option>
                </select>
              </label>
            </div>
          </div>
          <article class="adm-tarjeta adm-tabla-tarjeta">
            <div class="adm-tabla-caja">
              <table class="adm-tabla">
                <thead>
                  <tr><th scope="col">Caso</th><th scope="col">Estado</th><th scope="col">Avance</th><th scope="col">Puntaje</th><th scope="col" class="derecha">Acción</th></tr>
                </thead>
                <tbody>
                  @for (sesion of dilemasPagina(); track sesion.id) {
                    <tr>
                      <td><div class="adm-celda-doble"><strong>{{ sesion.caso }}</strong><small>{{ sesion.grupo }} · {{ sesion.espacio }}</small></div></td>
                      <td><span class="adm-estado-pill" [attr.data-estado]="sesion.participacionEstado ?? 'PENDIENTE'">{{ etiqueta(sesion) }}</span></td>
                      <td><span class="adm-avance"><span class="adm-avance-barra"><i [style.width.%]="barra(sesion)"></i></span>{{ barra(sesion) }}%</span></td>
                      <td>{{ sesion.nota != null ? sesion.nota + ' / 5,0' : '—' }}</td>
                      <td class="derecha">
                        @if (sesion.repeticionAutorizada || sesion.participacionEstado === 'EN_CURSO' || !sesion.participacionEstado) {
                          <button class="adm-enlace" type="button" (click)="iniciarCaso(sesion)">Ingresar al caso <span aria-hidden="true">›</span></button>
                        } @else if (sesion.participacionEstado === 'FINALIZADA' && sesion.participacionId) {
                          <a class="adm-enlace" [routerLink]="['/estudiante/participacion', sesion.participacionId]">Ver resultados <span aria-hidden="true">›</span></a>
                        } @else if (sesion.estado === 'SIN_INICIAR') {
                          <span class="gris">Esperando inicio</span>
                        } @else if (sesion.estado === 'FINALIZADO' && !sesion.participacionId) {
                          <span class="gris">No participaste</span>
                        } @else {
                          <button class="adm-enlace" type="button" (click)="iniciarCaso(sesion)">Ingresar al caso <span aria-hidden="true">›</span></button>
                        }
                      </td>
                    </tr>
                  } @empty { <tr><td colspan="5" class="adm-vacio">No hay casos en esta vista.</td></tr> }
                </tbody>
              </table>
            </div>
            <app-paginacion-tabla [total]="dilemasFiltrados().length" [pagina]="paginaDilemasActual()" (cambiar)="paginaDilemas.set($event)" />
          </article>
        }

        @if (seccion() === 'avisos') {
          <div class="adm-herramientas">
            <div class="adm-filtros" role="group" aria-label="Filtrar avisos">
              <button type="button" class="adm-filtro" [class.activo]="!soloNoLeidos()" [attr.aria-pressed]="!soloNoLeidos()"
                (click)="soloNoLeidos.set(false); paginaAvisos.set(1)">Todos <span>({{ avisos().length }})</span></button>
              <button type="button" class="adm-filtro" [class.activo]="soloNoLeidos()" [attr.aria-pressed]="soloNoLeidos()"
                (click)="soloNoLeidos.set(true); paginaAvisos.set(1)">Sin leer <span>({{ sinLeer() }})</span></button>
            </div>
            <div class="adm-barra">
              <label class="adm-fecha">
                <span class="solo-lector">Fecha</span>
                <input type="date" [value]="diaFiltro()" (input)="diaFiltro.set(valorFecha($event)); paginaAvisos.set(1)" />
              </label>
              @if (sinLeer()) {
                <button class="adm-boton-contorno" type="button" (click)="marcarAvisos()">Marcar como leídos</button>
              }
            </div>
          </div>
          <article class="adm-tarjeta adm-tabla-tarjeta">
            <div class="adm-tabla-caja">
              <table class="adm-tabla">
                <thead>
                  <tr><th scope="col">Fecha</th><th scope="col">Canal</th><th scope="col">Aviso</th><th scope="col">Estado</th></tr>
                </thead>
                <tbody>
                  @for (aviso of avisosPagina(); track aviso.id) {
                    <tr>
                      <td class="gris">{{ fechaAviso(aviso.fecha) }}</td>
                      <td class="gris">{{ canalAviso(aviso.canal) }}</td>
                      <td class="adm-celda-texto"><div class="adm-celda-doble"><strong>{{ aviso.titulo }}</strong><small>{{ aviso.cuerpo }}</small></div></td>
                      <td><span class="adm-estado-pill" [attr.data-estado]="aviso.leida ? 'LEIDO' : 'SIN_LEER'">{{ aviso.leida ? 'Leído' : 'Sin leer' }}</span></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="adm-vacio">{{ avisos().length ? 'No hay avisos con ese criterio.' : 'No hay avisos todavía.' }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-paginacion-tabla [total]="avisosVisibles().length" [pagina]="paginaAvisosActual()" (cambiar)="paginaAvisos.set($event)" />
          </article>
        }

        @if (seccion() === 'perfil') {
          <article class="adm-tarjeta adm-perfil">
            <span class="adm-iniciales adm-iniciales-grande" aria-hidden="true">{{ iniciales() }}</span>
            <div>
              <h2>{{ nombreCompleto() }}</h2>
              <p class="adm-dato">{{ auth.usuario()?.email }}</p>
              <p class="adm-dato">Estudiante</p>
            </div>
          </article>
          <section class="adm-dos">
            <article class="adm-tarjeta">
              <div class="adm-cabeza"><h2>Tu avance</h2></div>
              <div class="adm-cifras">
                <div><small>Resueltos</small><strong>{{ resueltos() }}</strong></div>
                <div><small>Puntaje</small><strong>{{ promedio() }}</strong></div>
                <div><small>Avisos sin leer</small><strong>{{ sinLeer() }}</strong></div>
              </div>
            </article>
            <article class="adm-tarjeta">
              <div class="adm-cabeza">
                <h2>Convocatorias</h2>
                <a class="adm-enlace" [routerLink]="['/estudiante']" [queryParams]="{ vista: 'dilemas' }">Ver todas <span aria-hidden="true">›</span></a>
              </div>
              <ul class="adm-lista">
                @for (sesion of (panel()?.sesiones ?? []).slice(0, 5); track sesion.id) {
                  <li class="adm-fila">
                    <span class="adm-fila-texto"><strong>{{ sesion.caso }}</strong><small>{{ sesion.grupo }}@if (sesion.nota != null) { · {{ sesion.nota }} / 5,0 }</small></span>
                    <span class="adm-estado-pill" [attr.data-estado]="sesion.participacionEstado ?? 'PENDIENTE'">{{ etiqueta(sesion) }}</span>
                  </li>
                } @empty { <li class="adm-vacio">Aún no tienes convocatorias.</li> }
              </ul>
            </article>
          </section>
        }
    </app-marco-estudiante>
  `
})
export class PanelEstudianteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private router = inject(Router);
  auth = inject(AuthService);
  private busqueda = inject(BusquedaService);
  private escenas = inject(EscenaService);
  panel = signal<PanelEstudiante | null>(null);
  error = signal('');
  seccion = signal<'inicio' | 'dilemas' | 'avisos' | 'perfil'>('inicio');
  soloNoLeidos = signal(false);
  diaFiltro = signal('');
  /** Mis dilemas: filtro, búsqueda, orden y página (sobre TODA la lista; la página solo corta lo que se ve). */
  readonly filtrosDilemas: { id: FiltroDilema; texto: string }[] = [
    { id: 'todos', texto: 'Todos' }, { id: 'pendientes', texto: 'Pendientes' },
    { id: 'en_curso', texto: 'En curso' }, { id: 'finalizados', texto: 'Finalizados' }
  ];
  filtroDilemas = signal<FiltroDilema>('todos');
  busquedaDilemas = signal('');
  ordenDilemas = signal('recientes');
  paginaDilemas = signal(1);
  paginaAvisos = signal(1);
  readonly dilemasFiltrados = computed(() => {
    const q = (this.busquedaDilemas() + ' ' + this.busqueda.texto()).trim().toLowerCase();
    const lista = (this.panel()?.sesiones ?? []).filter((s) => this.pasaFiltroDilema(s, this.filtroDilemas())
      && (!q || q.split(/\s+/).every((t) => `${s.caso} ${s.grupo} ${s.espacio}`.toLowerCase().includes(t))));
    if (this.ordenDilemas() === 'nombre') return [...lista].sort((a, b) => a.caso.localeCompare(b.caso, 'es') || a.id - b.id);
    return [...lista].sort((a, b) => (Date.parse(b.inicio) || 0) - (Date.parse(a.inicio) || 0) || b.id - a.id);
  });
  paginaDilemasActual() { return paginaValida(this.paginaDilemas(), this.dilemasFiltrados().length); }
  dilemasPagina() { return paginaDe(this.dilemasFiltrados(), this.paginaDilemasActual()); }
  paginaAvisosActual() { return paginaValida(this.paginaAvisos(), this.avisosVisibles().length); }
  avisosPagina() { return paginaDe(this.avisosVisibles(), this.paginaAvisosActual()); }
  private pasaFiltroDilema(s: Sesion, filtro: FiltroDilema) {
    if (filtro === 'pendientes') return !s.participacionEstado;
    if (filtro === 'en_curso') return s.participacionEstado === 'EN_CURSO';
    if (filtro === 'finalizados') return s.participacionEstado === 'FINALIZADA' || s.participacionEstado === 'AUSENTE';
    return true;
  }
  cuantosDilemas(filtro: FiltroDilema) { return (this.panel()?.sesiones ?? []).filter((s) => this.pasaFiltroDilema(s, filtro)).length; }
  valorCampo(evento: Event) { return (evento.target as HTMLInputElement | HTMLSelectElement).value; }
  canalAviso(canal: string) { return canal === 'CORREO' ? 'Correo' : canal === 'SISTEMA' ? 'Sistema' : canal; }
  descripcionSeccion() {
    const s = this.seccion();
    if (s === 'dilemas') return 'Los casos a los que te convocaron y tu avance en cada uno.';
    if (s === 'avisos') return 'Convocatorias, resultados y mensajes de tus docentes.';
    if (s === 'perfil') return 'Tus datos y tu avance.';
    return 'Bienvenido a Dilema, donde cada decisión cuenta.';
  }
  constructor() {
    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      const vista = params.get('vista');
      if (vista === 'dilemas' || vista === 'avisos' || vista === 'perfil') this.seccion.set(vista);
      else this.seccion.set('inicio');
    });
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (dato) => this.panel.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
    effect(() => {
      const sesion = this.destacado();
      if (this.panel()) untracked(() => this.cargarFondoDestacado(sesion));
    });
  }
  /**
   * Con un intento en curso entra directo a la simulación. Si no, pasa por el briefing (presentación, reglas y
   * "Iniciar simulación"): el intento y su reloj empiezan allí, no al pulsar aquí.
   */
  iniciarCaso(sesion: Sesion) {
    if (sesion.participacionId && sesion.participacionEstado === 'EN_CURSO') {
      this.router.navigate(['/estudiante/participacion', sesion.participacionId]);
      return;
    }
    this.router.navigate(['/estudiante/sesion', sesion.id]);
  }
  pendientes() { return (this.panel()?.sesiones ?? []).filter((s) => !s.participacionEstado).length; }
  enCurso() { return (this.panel()?.sesiones ?? []).filter((s) => s.participacionEstado === 'EN_CURSO').length; }
  finalizados() { return (this.panel()?.sesiones ?? []).filter((s) => s.participacionEstado === 'FINALIZADA' || s.participacionEstado === 'AUSENTE').length; }
  /** Sesiones asignadas al estudiante (las que trae su panel). */
  asignados() { return (this.panel()?.sesiones ?? []).length; }
  /** Dilemas resueltos: los que el estudiante terminó (una ausencia no cuenta como resuelto). */
  resueltos() { return (this.panel()?.sesiones ?? []).filter((s) => s.participacionEstado === 'FINALIZADA').length; }
  promedio() {
    const notas = (this.panel()?.sesiones ?? []).map((s) => s.nota).filter((n): n is number => n !== null);
    if (!notas.length) return '—';
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
  }
  nombre() {
    const completo = this.auth.usuario()?.nombre ?? '';
    return completo.trim().split(/\s+/)[0] || 'estudiante';
  }
  nombreCompleto() { return this.auth.usuario()?.nombre ?? 'Estudiante'; }
  iniciales() {
    const partes = this.nombreCompleto().trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'D';
  }
  /** Sesión de la tarjeta "Dilema Destacado" (ver elegirDestacado). */
  destacado = computed(() => elegirDestacado(this.panel()?.sesiones ?? [], sesionDelIngreso(), Date.now()));
  /** Inicio del desarrollo situacional, sin HTML y recortado en una frase completa. */
  textoDestacado = computed(() => resumenDesarrollo(this.destacado()?.desarrollo ?? ''));
  /** Fondo del primer escenario según el motor de escenas, y el nombre de ese escenario para el letrero. */
  fondoDestacado = signal<{ ruta: string; escenario: string } | null>(null);
  private pedidoFondo = 0;
  altDestacado() {
    const caso = this.destacado()?.caso;
    return caso ? `Escena inicial del caso ${caso}` : 'Escena de un caso de DILEMA';
  }
  /** Pide al motor de escenas el fondo del PRIMER escenario; sin escenarios, el neutro del tipo de caso. */
  private cargarFondoDestacado(sesion: Sesion | null) {
    const pedido = ++this.pedidoFondo;
    const escenarios = sesion?.escenarios ?? [];
    const primero = escenarios[0];
    const caso = {
      id: sesion?.casoId ?? null, nombre: sesion?.caso ?? '', desarrolloSituacional: sesion?.desarrollo ?? '',
      contexto: sesion?.contexto ?? '', bloques: escenarios.map((e) => ({ nombre: e.nombre, contexto: e.contexto }))
    };
    const escenario = primero?.nombre?.trim() ?? '';
    this.escenas.elegir(caso, { indice: 0, nombre: primero?.nombre ?? '', contexto: primero?.contexto ?? '' })
      .then((f) => { if (pedido === this.pedidoFondo) this.fondoDestacado.set({ ruta: f.ruta, escenario }); })
      .catch(() => { if (pedido === this.pedidoFondo) this.fondoDestacado.set({ ruta: FONDO_NEUTRO, escenario }); });
  }
  /** Tu progreso: dilemas resueltos sobre los asignados, en porcentaje. */
  progresoGeneral() {
    const total = this.asignados();
    return total ? Math.round((this.resueltos() / total) * 100) : 0;
  }
  nivel() {
    const p = this.progresoGeneral();
    if (p >= 80) return 'Nivel Avanzado';
    if (p >= 40) return 'Nivel Explorador';
    return 'Nivel Inicial';
  }
  listaSeccion() { return this.visibles(); }
  visibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return (this.panel()?.sesiones ?? []).filter((s) => {
      if (!q) return true;
      return `${s.caso} ${s.grupo} ${s.espacio} ${s.contexto} ${s.desarrollo}`.toLowerCase().includes(q);
    });
  }
  hoy() { return (this.panel()?.sesiones ?? []).filter((s) => this.mismoDia(s.inicio)); }
  proximos() { return (this.panel()?.sesiones ?? []).filter((s) => !s.participacionEstado || s.participacionEstado === 'EN_CURSO').slice(0, 4); }
  avisos() { return this.panel()?.avisos ?? []; }
  avisosVisibles() {
    const dia = this.diaFiltro();
    return this.avisos().filter((aviso) => {
      if (this.soloNoLeidos() && aviso.leida) return false;
      return !dia || this.diaLocal(aviso.fecha) === dia;
    });
  }
  valorFecha(evento: Event) {
    return (evento.target as HTMLInputElement).value;
  }
  sinLeer() { return this.panel()?.sinLeer ?? this.avisos().filter((a) => !a.leida).length; }
  fechaAviso(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  }
  private diaLocal(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return (iso ?? '').slice(0, 10);
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
  marcarAvisos() {
    const pendientes = this.avisos().filter((a) => !a.leida).map((aviso) => this.http.post<void>(`/api/estudiante/avisos/${aviso.id}/leer`, {}));
    if (!pendientes.length) return;
    forkJoin(pendientes).subscribe({
      complete: () => this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe((dato) => this.panel.set(dato))
    });
  }
  etiqueta(sesion: Sesion) {
    if (sesion.participacionEstado === 'FINALIZADA') return 'Finalizado';
    if (sesion.participacionEstado === 'AUSENTE') return 'Ausente';
    if (sesion.participacionEstado === 'EN_CURSO') return 'En curso';
    return 'Pendiente';
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
  barra(sesion: Sesion) {
    if (sesion.participacionEstado === 'FINALIZADA' || sesion.participacionEstado === 'AUSENTE') return 100;
    return sesion.progreso ?? 0;
  }
  codigoCaso(id: number) { return String(id).padStart(3, '0'); }
  resumen(html: string) {
    const texto = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return texto.length > 140 ? texto.slice(0, 140) + '…' : texto;
  }
}

@Component({
  selector: 'app-briefing',
  imports: [MarcoEstudianteComponent, RouterLink, FormsModule, MatButtonModule, MatCardModule],
  template: `
    <app-marco-estudiante activa="dilemas" [sinLeer]="sinLeer()">
      @if (sesion(); as actual) {
        <section class="tablero">
          <header class="saludo">
            <p class="kicker">{{ actual.codigo }}</p>
            <h1>Bienvenido al caso: {{ actual.caso }}</h1>
          </header>
          <article class="tarjeta stack">
            <h2>Mensaje del docente</h2>
            <p>{{ actual.mensaje || 'Sigue las instrucciones del caso y responde cada escena.' }}</p>
          </article>
          <div class="grid-2">
            <article class="tarjeta stack">
              <h2>Reglas de participación</h2>
              <dl class="resumen-lista">
                <div><dt>Tiempo</dt><dd>{{ actual.tiempoMaxMin }} min</dd></div>
                <div><dt>Ingreso</dt><dd>{{ actual.toleranciaMin }} min</dd></div>
                <div><dt>Inicio</dt><dd>{{ horaCorta(actual.inicio) }}</dd></div>
                <div><dt>Fin</dt><dd>{{ horaCorta(actual.fin) }}</dd></div>
              </dl>
              <p class="resumen-nota">La retroalimentación se muestra al finalizar.</p>
            </article>
            <article class="tarjeta stack">
              <h2>Ficha</h2>
              <dl class="resumen-lista">
                <div><dt>Grupo</dt><dd>{{ actual.grupo }}</dd></div>
                <div><dt>Espacio</dt><dd>{{ actual.espacio }}</dd></div>
                <div><dt>Lugar</dt><dd>{{ actual.lugar || 'Virtual' }}</dd></div>
                <div><dt>Estado</dt><dd>{{ actual.estado }}@if (actual.participacionEstado) { · {{ actual.participacionEstado }} }</dd></div>
                @if (actual.nota != null) { <div><dt>Puntaje</dt><dd>{{ actual.nota }} / 5,0</dd></div> }
                @if (actual.progreso != null) { <div><dt>Avance</dt><dd>{{ actual.progreso }}%</dd></div> }
              </dl>
            </article>
          </div>
          @if (actual.sensible && actual.advertencia) {
            <article class="aviso"><strong>Advertencia.</strong> {{ actual.advertencia }}</article>
          }
          @if (actual.contexto) { <article class="tarjeta"><h2>Contexto</h2><p>{{ actual.contexto }}</p></article> }
          <div [innerHTML]="actual.desarrollo"></div>
          <label class="check"><input type="checkbox" [(ngModel)]="acepto" /> He leído y acepto las reglas de participación.</label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="row">
            <a class="btn-suave" routerLink="/estudiante">Volver al panel</a>
            @if (actual.estado === 'SIN_INICIAR') {
              <p class="sub">El docente todavía no inicia la sesión.</p>
            } @else if (actual.participacionEstado === 'FINALIZADA' && actual.participacionId && !actual.repeticionAutorizada) {
              <button class="btn-oscuro" type="button" (click)="ver(actual.participacionId)">Ver resultados</button>
            } @else if (actual.estado === 'FINALIZADO' && !actual.repeticionAutorizada) {
              <p class="sub">La sesión ya finalizó.</p>
            } @else {
              <button class="btn-oscuro" type="button" [disabled]="!acepto" (click)="iniciar(actual)">{{ actual.repeticionAutorizada ? 'Iniciar nuevo intento' : 'Iniciar simulación' }}</button>
            }
          </div>
        </section>
      }
    </app-marco-estudiante>
  `
})
export class BriefingComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  sesion = signal<Sesion | null>(null);
  sinLeer = signal(0);
  acepto = false;
  error = signal('');
  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (panel) => {
        this.sesion.set(panel.sesiones.find((item) => item.id === id) ?? null);
        this.sinLeer.set(panel.sinLeer ?? panel.avisos.filter((a) => !a.leida).length);
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  iniciar(sesion: Sesion) {
    this.http.post<Participacion>(`/api/estudiante/sesiones/${sesion.id}/participaciones`, {}).subscribe({
      next: (participacion) => this.router.navigate(['/estudiante/participacion', participacion.id]),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  ver(id: number) { this.router.navigate(['/estudiante/participacion', id]); }
  horaCorta(valor: string | null | undefined) {
    if (!valor) return '—';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}

@Component({
  imports: [MarcoEstudianteComponent, NovelaReproductorComponent, ResultadosNovelaComponent],
  template: `
    <app-marco-estudiante [activa]="menuActivo()" [sinLeer]="sinLeer()">
      @if (juego(); as actual) {
        @if (novela(); as caso) {
          <!--
            La MISMA ventana que la vista previa del docente: pantalla completa, franja superior con Música y Cerrar,
            y el caso completo (portada, presentación, escenarios, preguntas y resultados al final).
          -->
          <div class="modal-vista" role="dialog" aria-modal="true" [attr.aria-label]="'Caso: ' + actual.caso">
            <div class="modal-cuerpo">
              <!-- three.js y el motor de la novela se descargan solo al entrar al caso (no con el panel). -->
              @defer (on immediate) {
                <app-novela-reproductor #reproductor
                  [caso]="caso" [personajes]="elenco()" [tiempoRestante]="actual.estado === 'EN_CURSO' ? restante() : null"
                  [resultados]="resultados()" [mostrarCerrar]="true" (cerrar)="volverAlPanel()"
                  [etiquetaSalir]="actual.estado === 'EN_CURSO' ? 'Salir y volver al panel (el intento sigue abierto y el reloj sigue corriendo)' : 'Salir y volver al panel'"
                  [modoEstudiante]="true" [seleccion]="seleccion()" [empezarEn]="empezarEn()"
                  textoFin="Enviando tus respuestas…" [textoVolver]="null"
                  (opcion)="elegirNovela($event)" (deshacer)="deshacer()" (finalizar)="finalizar()" />
              } @placeholder {
                <div class="escena-espera" role="status" style="width: 100%; max-width: calc((100vh - 130px) * 16 / 9); margin: 0 auto; aspect-ratio: 16 / 9; border-radius: 14px; display: grid; place-items: center; background: rgba(15,20,28,.55); color: #fff; font-size: 1rem;">Preparando la escena…</div>
              }
              @if (error()) { <p class="error-juego" role="alert">{{ error() }}</p> }
            </div>
          </div>
        } @else {
          <!-- Entrada por "Ver resultados" desde el panel: la misma pantalla de resultados. -->
          @if (resultados(); as r) {
            <section class="resultados-estudiante" [style.background-image]="fondoResultados()">
              <app-resultados-novela [resultados]="r" [textoReiniciar]="null" textoCerrar="Volver al panel"
                (cerrar)="volverAlPanel()" />
            </section>
          }
        }
      }
      @if (error() && !novela()) { <p class="error" role="alert">{{ error() }}</p> }
    </app-marco-estudiante>
  `,
  styles: [`
    /* Copia de la ventana de la vista previa del docente (docente.component.ts). */
    /* Libreta del caso: fondo azul claro; la libreta trae sus pestañas (Música, Pantalla, Salir). */
    .modal-vista { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: #d8e5ff; color: #1c2541; }
    .modal-cuerpo { flex: 1; overflow: auto; padding: 18px 22px 22px; }
    /* Lo único que el estudiante tiene de más: el reloj y la escena actual, a la izquierda de la franja. */
    .modal-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .modal-titulo { font-weight: 650; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .reloj-juego { font-variant-numeric: tabular-nums; min-width: 4.6rem; text-align: center; padding: 6px 14px; line-height: 1.5;
      border-radius: 999px; background: rgba(255,255,255,.12); font-size: .95rem; letter-spacing: .04em; }
    .reloj-juego.urgente { background: #991b1b; }
    .error-juego { margin: 10px auto 0; max-width: 720px; padding: 10px 14px; border-radius: 10px; background: #fff1f0; color: #9b1c12; }
    :host { display: block; width: 100%; height: 100%; min-width: 0; }
    /* La ficha usa todo el ancho del panel y se desplaza si el contenido no cabe. */
    .resultados-estudiante { width: 100%; height: 100%; min-height: 0; border-radius: 18px; overflow: auto;
      background-color: #0f1726; background-size: cover; background-position: center;
      scrollbar-width: thin; scrollbar-color: #8ea0c6 transparent; }
    .resultados-estudiante::-webkit-scrollbar { display: block; width: 10px; height: 10px; }
    .resultados-estudiante::-webkit-scrollbar-thumb { background: #8ea0c6; border-radius: 999px; }
    @media (max-width: 768px) { .modal-cuerpo { padding: 8px; } }
  `]
})
export class SimulacionComponent {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private escenas = inject(EscenaService);
  readonly musica = inject(MusicaNovelaService);
  private readonly reproductor = viewChild<NovelaReproductorComponent>('reproductor');
  juego = signal<Participacion | null>(null);
  novela = signal<CasoReproductor | null>(null);
  elenco = signal<PersonajeCaso[]>([]);
  /** Escenario donde arranca la novela al entrar (se fija una sola vez; si cambiara, la novela saltaría). */
  empezarEn = signal<number | null>(null);
  error = signal('');
  restante = signal(0);
  sinLeer = signal(0);
  fondoResultados = signal<string | null>(null);
  /** Pregunta del backend → "escenario:pregunta" del reproductor. */
  private claves = new Map<number, string>();
  private timer = 0;
  private cerradoPorTiempo = false;

  /** Respuestas guardadas en el backend, en el formato del reproductor ("escenario:pregunta" → índice de la opción). */
  readonly seleccion = computed(() => {
    const r: Record<string, number> = {};
    for (const q of this.juego()?.preguntas ?? []) {
      const clave = this.claves.get(q.id);
      const i = q.opciones.findIndex((o) => o.id === q.seleccionId);
      if (clave && i >= 0) r[clave] = i;
    }
    return r;
  });
  /** Resultados para la pantalla final: los del backend, solo acomodados. */
  readonly resultados = computed(() => {
    const j = this.juego();
    return j && (j.estado === 'FINALIZADA' || j.estado === 'AUSENTE') ? resultadosDeParticipacion(j) : null;
  });
  /** Franja superior: el nombre del caso en la portada y la presentación; luego la escena actual. */
  readonly tituloEscena = computed(() => {
    const r = this.reproductor();
    const paso = r?.paso();
    const caso = this.juego()?.caso ?? '';
    if (!r || !paso || paso.escena.escenario < 0) return caso;
    if (paso.tipo === 'fin') return this.resultados() ? 'Resultados' : caso;
    const b = r.bloqueActual();
    return b.nombre ? `Escena ${b.indice + 1} · ${b.nombre}` : caso;
  });

  constructor() {
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (dato) => this.sinLeer.set(dato.sinLeer ?? dato.avisos.filter((a) => !a.leida).length)
    });
    this.cargar();
    this.timer = window.setInterval(() => {
      this.restante.update((valor) => {
        const siguiente = Math.max(0, valor - 1);
        if (siguiente === 0 && valor > 0) this.porTiempo();
        return siguiente;
      });
    }, 1000);
    // La música empieza después del primer clic o tecla en la página (los navegadores no dejan sonar antes).
    this.musica.comprobar();
    const primerGesto = () => {
      quitar();
      if (this.juego()?.estado === 'EN_CURSO') this.musica.iniciar();
    };
    const quitar = () => {
      document.removeEventListener('pointerdown', primerGesto);
      document.removeEventListener('keydown', primerGesto);
    };
    document.addEventListener('pointerdown', primerGesto);
    document.addEventListener('keydown', primerGesto);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timer);
      document.body.style.overflow = '';
      quitar();
      this.musica.detener();
    });
  }

  menuActivo() {
    return this.juego()?.estado === 'EN_CURSO' ? 'dilemas' : 'inicio';
  }
  reloj() {
    const segundos = this.restante();
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  }
  volverAlPanel() { this.router.navigate(['/estudiante']); }

  elegirNovela(eleccion: OpcionElegida) {
    const pregunta = this.novela()?.bloques[eleccion.bloque]?.preguntas[eleccion.pregunta];
    const opcion = pregunta?.opciones[eleccion.opcion];
    if (pregunta?.id && opcion?.id) this.elegir(pregunta.id, opcion.id);
  }
  elegir(preguntaId: number, opcionId: number) {
    const id = this.juego()?.id;
    this.http.post<Participacion>(`/api/participaciones/${id}/responder`, { preguntaId, opcionId }).subscribe({
      next: (dato) => { this.error.set(''); this.recibir(dato); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  deshacer() {
    this.http.post<Participacion>(`/api/participaciones/${this.juego()?.id}/deshacer`, {}).subscribe({
      next: (dato) => { this.error.set(''); this.recibir(dato); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  finalizar() {
    this.http.post<Participacion>(`/api/participaciones/${this.juego()?.id}/finalizar`, {}).subscribe({
      next: (dato) => this.recibir(dato),
      error: (falla) => {
        this.error.set(mensajeError(falla));
        // Si ya estaba cerrada (por ejemplo, por tiempo), se muestran sus resultados; si no, vuelve a la pregunta.
        this.http.get<Participacion>(`/api/participaciones/${this.juego()?.id}`).subscribe({
          next: (dato) => {
            if (dato.estado !== 'EN_CURSO') this.recibir(dato);
            else this.reproductor()?.volverAUltimaPregunta();
          },
          error: () => this.reproductor()?.volverAUltimaPregunta()
        });
      }
    });
  }
  private porTiempo() {
    if (this.cerradoPorTiempo || this.juego()?.estado !== 'EN_CURSO') return;
    this.cerradoPorTiempo = true;
    this.reproductor()?.irAlFin();
    this.finalizar();
  }
  /** Respuesta del backend: si el intento terminó, la música se detiene y se muestran los resultados. */
  private recibir(dato: Participacion) {
    this.juego.set(dato);
    if (dato.estado !== 'EN_CURSO') {
      this.musica.detener();
      this.ponerFondoResultados(dato);
    }
  }
  private cargar() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Participacion>(`/api/participaciones/${id}`).subscribe({
      next: (dato) => {
        this.restante.set(Math.max(0, dato.segundosMax - dato.segundosUsados));
        if (dato.estado === 'EN_CURSO') {
          const caso = this.armarNovela(dato);
          this.juego.set(dato);
          this.empezarEn.set(this.primerPendiente(dato, caso));
          this.elenco.set(dato.personajes ?? []);
          this.novela.set(caso);
          document.body.style.overflow = 'hidden';
        } else {
          this.recibir(dato);
        }
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  /**
   * Al entrar sin respuestas, la portada (como la vista previa del docente). Al volver a un intento a medias, el primer
   * escenario con preguntas sin responder; si no queda ninguno, el último.
   */
  private primerPendiente(dato: Participacion, caso: CasoReproductor): number | null {
    if (!dato.preguntas.some((q) => q.seleccionId != null)) return null;
    const pendiente = caso.bloques.findIndex((b) => b.preguntas.some((q) => dato.preguntas.find((x) => x.id === q.id)?.seleccionId == null));
    return pendiente >= 0 ? pendiente : Math.max(0, caso.bloques.length - 1);
  }
  /** Agrupa las preguntas por escenario (bloqueIndice del backend) en el formato del reproductor, sin la correcta. */
  private armarNovela(dato: Participacion): CasoReproductor {
    const bloques: CasoReproductor['bloques'] = [];
    const indices = new Map<string, number>();
    this.claves.clear();
    for (const pregunta of dato.preguntas) {
      const llave = pregunta.bloqueIndice != null ? `i${pregunta.bloqueIndice}` : `n${pregunta.bloque}`;
      let b = indices.get(llave);
      if (b === undefined) {
        b = bloques.length;
        indices.set(llave, b);
        bloques.push({ nombre: pregunta.bloque, contexto: pregunta.contexto, preguntas: [] });
      }
      this.claves.set(pregunta.id, `${b}:${bloques[b].preguntas.length}`);
      bloques[b].preguntas.push({
        id: pregunta.id, enunciado: pregunta.enunciado, pista: pregunta.pista,
        opciones: pregunta.opciones.map((o) => ({ id: o.id, texto: o.texto }))
      });
    }
    return { id: dato.casoId, nombre: dato.caso, desarrolloSituacional: dato.desarrollo, contexto: dato.contexto, bloques };
  }
  /** Fondo de la pantalla de resultados: el del último escenario, oscurecido. */
  private ponerFondoResultados(dato: Participacion) {
    const caso = this.armarNovela(dato);
    const i = caso.bloques.length - 1;
    if (i < 0) return;
    this.escenas.elegir(caso, { indice: i, nombre: caso.bloques[i].nombre, contexto: caso.bloques[i].contexto })
      .then((f) => this.fondoResultados.set(`linear-gradient(rgba(11,18,32,.88), rgba(11,18,32,.94)), url("${f.ruta}")`))
      .catch(() => undefined);
  }
}

@Component({
  selector: 'app-avisos',
  template: ''
})
export class AvisosComponent {
  constructor() {
    inject(Router).navigate(['/estudiante'], { queryParams: { vista: 'avisos' }, replaceUrl: true });
  }
}
