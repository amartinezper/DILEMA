import { Component, DestroyRef, inject, signal } from '@angular/core';
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
import { NovelaReproductorComponent, CasoReproductor, OpcionElegida } from '../shared/novela/novela-reproductor.component';
import { MusicaNovelaService } from '../shared/novela/musica-novela.service';

const enlaces = [
  { href: '/estudiante', texto: 'Casos asignados', exacto: true },
  { href: '/estudiante/avisos', texto: 'Notificaciones', exacto: true }
];

@Component({
  selector: 'app-panel-estudiante',
  imports: [RouterLink, MarcoEstudianteComponent],
  template: `
    <app-marco-estudiante [activa]="seccion()" [sinLeer]="sinLeer()">
        @if (seccion() === 'inicio') {
          <section class="inicio-stats">
            <article>
              <span class="stat-icono juego">
                <svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 13h4M10 11v4M16.2 12h.01M18.2 14h.01"/></svg>
              </span>
              <div>
                <small>Dilemas Resueltos</small>
                <strong>{{ finalizados() }}</strong>
              </div>
            </article>
            <article>
              <span class="stat-icono copa">
                <svg viewBox="0 0 24 24"><path d="M8 5h8v4a4 4 0 0 1-8 0V5z"/><path d="M8 7H5.5A2.5 2.5 0 0 0 8 11M16 7h2.5A2.5 2.5 0 0 1 16 11"/><path d="M12 13v3M9 20h6M10 17h4"/></svg>
              </span>
              <div>
                <small>Tu Puntaje</small>
                <strong>{{ promedio() }} <em>/ 5,0</em></strong>
              </div>
            </article>
          </section>
        }

        @if (error()) { <p class="error">{{ error() }}</p> }

        @if (seccion() === 'inicio') {
          <div class="inicio-home">
          <section class="inicio-fila">
            <article class="inicio-destacado">
              <div class="destacado-texto">
                <p class="chip-estrella">★ Dilema Destacado</p>
                <h2>{{ tituloDestacado() }}</h2>
                <p>{{ textoDestacado() }}</p>
                @if (destacado(); as caso) {
                  @if (caso.repeticionAutorizada || caso.participacionEstado === 'EN_CURSO' || !caso.participacionEstado) {
                    <button class="btn-resolver" type="button" (click)="iniciarCaso(caso)">▶ Resolver Dilema</button>
                  } @else if (caso.participacionEstado === 'FINALIZADA' && caso.participacionId) {
                    <a class="btn-resolver" [routerLink]="['/estudiante/participacion', caso.participacionId]">Ver resultados</a>
                  } @else if (caso.estado === 'SIN_INICIAR') {
                    <p class="sub claro">Esperando a que el docente inicie la sesión.</p>
                  } @else if (caso.estado === 'FINALIZADO' && !caso.participacionId) {
                    <p class="sub claro">No participaste. Ausencia 0,0.</p>
                  } @else {
                    <button class="btn-resolver" type="button" (click)="iniciarCaso(caso)">▶ Resolver Dilema</button>
                  }
                }
              </div>
              <figure>
                <img src="/escenas/colinas-1.jpg" alt="Barrio Las Colinas al atardecer, llegada al caso" />
              </figure>
            </article>

            <article class="inicio-progreso">
              <h3><span class="progreso-ico">📊</span> Tu Progreso</h3>
              <div class="aro" [style.--p]="'' + progresoGeneral()">
                <span>{{ progresoGeneral() }}%</span>
              </div>
              <p class="nivel">★ {{ nivel() }}</p>
              <p class="progreso-tip">{{ mensajeProgreso() }}</p>
            </article>
          </section>

          <section class="inicio-cats">
            <div class="tarjeta-cabeza">
              <h3>★ Categorías</h3>
              <button type="button" class="ver-todos" (click)="verDilemas()">Ver todas →</button>
            </div>
            <div class="cats">
              <button type="button" class="cat etica" (click)="abrirCategoria('Ética')">
                <svg viewBox="0 0 24 24"><path d="M12 3v18M7 21h10M12 6h.01"/><path d="M12 7 7 16h10L12 7z"/><path d="M7 16c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2 2.5-.9 2.5-2M17 16c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2 2.5-.9 2.5-2"/></svg>
                <span>Ética</span><i>→</i>
              </button>
              <button type="button" class="cat social" (click)="abrirCategoria('Social')">
                <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg>
                <span>Social</span><i>→</i>
              </button>
              <button type="button" class="cat psico" (click)="abrirCategoria('Psicológico')">
                <svg viewBox="0 0 24 24"><path d="M12 4c-3.8 0-6.5 2.6-6.5 6.2 0 2.2 1 3.6 1.6 4.6C6.4 16.6 7.6 18.2 9.5 19.2h5c1.9-1 3.1-2.6 2.4-4.4.6-1 1.6-2.4 1.6-4.6C18.5 6.6 15.8 4 12 4z"/><path d="M12 4.2v15"/></svg>
                <span>Psicológico</span><i>→</i>
              </button>
              <button type="button" class="cat tec" (click)="abrirCategoria('Tecnología')">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.2 4.6 6.2 4.6 9S15.2 17.8 12 21M12 3C8.8 6.2 7.4 9.2 7.4 12S8.8 17.8 12 21"/></svg>
                <span>Tecnología</span><i>→</i>
              </button>
              <button type="button" class="cat vida" (click)="abrirCategoria('Vida Personal')">
                <svg viewBox="0 0 24 24"><path d="M12 20.6S5 16 5 10.6A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.6c0 5.4-7 10-7 10z"/></svg>
                <span>Vida Personal</span><i>→</i>
              </button>
            </div>
          </section>
          </div>
        }

        @if (seccion() === 'dilemas') {
          <section class="inicio-lista">
            <h2>{{ categoria() ? 'Categoría: ' + categoria() : 'Mis Dilemas' }}</h2>
            <div class="rejilla-casos">
              @for (sesion of listaSeccion(); track sesion.id; let i = $index) {
                <article class="curso">
                  <div class="franja" [attr.data-tono]="i % 3"></div>
                  <span class="estado-pill">{{ etiqueta(sesion) }}</span>
                  <h3>{{ sesion.caso }}</h3>
                  <p class="sub">{{ sesion.grupo }} · {{ sesion.espacio }}</p>
                  @if (sesion.nota != null) { <p class="sub">Puntaje {{ sesion.nota }} / 5,0</p> }
                  @if (sesion.repeticionAutorizada) { <p class="sub">El docente autorizó un nuevo intento.</p> }
                  <div class="progreso"><div [style.width.%]="barra(sesion)"></div></div>
                  <small class="avance">{{ barra(sesion) }}% de avance</small>
                  <div class="curso-acciones">
                    @if (sesion.repeticionAutorizada || sesion.participacionEstado === 'EN_CURSO' || !sesion.participacionEstado) {
                      <button class="btn-oscuro" type="button" (click)="iniciarCaso(sesion)">Ingresar al caso</button>
                    } @else if (sesion.participacionEstado === 'FINALIZADA' && sesion.participacionId) {
                      <a class="btn-suave" [routerLink]="['/estudiante/participacion', sesion.participacionId]">Ver resultados</a>
                    } @else if (sesion.estado === 'SIN_INICIAR') {
                      <p class="sub">Esperando a que el docente inicie la sesión.</p>
                    } @else if (sesion.estado === 'FINALIZADO' && !sesion.participacionId) {
                      <p class="sub">No participaste. Ausencia 0,0.</p>
                    } @else {
                      <button class="btn-oscuro" type="button" (click)="iniciarCaso(sesion)">Ingresar al caso</button>
                    }
                  </div>
                </article>
              } @empty { <p class="sub">No hay casos en esta vista.</p> }
            </div>
          </section>
        }

        @if (seccion() === 'avisos') {
          <section class="inicio-lista">
            <div class="tarjeta-cabeza">
              <h2>Avisos</h2>
              @if (sinLeer()) {
                <button class="btn-oscuro" type="button" (click)="marcarAvisos()">Marcar como leídos</button>
              }
            </div>
            @for (aviso of avisos(); track aviso.id; let i = $index) {
              <article class="aviso-card" [class.sin-leer]="!aviso.leida">
                <span class="punto" [attr.data-tono]="i % 3"></span>
                <div>
                  <div class="aviso-meta">
                    <span class="aviso-canal">{{ aviso.canal }}</span>
                    <span>{{ fechaAviso(aviso.fecha) }}</span>
                    @if (!aviso.leida) { <em class="aviso-pill">Sin leer</em> }
                  </div>
                  <h3>{{ aviso.titulo }}</h3>
                  <p class="sub">{{ aviso.cuerpo }}</p>
                </div>
              </article>
            } @empty { <p class="sub">No hay avisos todavía.</p> }
          </section>
        }

        @if (seccion() === 'perfil') {
          <section class="inicio-perfil">
            <div class="perfil-cabeza">
              <span class="inicio-avatar">{{ iniciales() }}</span>
              <div>
                <h2>{{ nombreCompleto() }}</h2>
                <p class="sub">{{ auth.usuario()?.email }}</p>
                <p class="sub">Estudiante</p>
              </div>
            </div>
            <div class="perfil-kpis">
              <article><small>Resueltos</small><strong>{{ finalizados() }}</strong></article>
              <article><small>Puntaje</small><strong>{{ promedio() }}</strong><span class="sub">sobre 5,0</span></article>
              <article><small>Avisos</small><strong>{{ sinLeer() }}</strong><span class="sub">sin leer</span></article>
            </div>
            <h3>Convocatorias</h3>
            @for (sesion of (panel()?.sesiones ?? []).slice(0, 5); track sesion.id) {
              <article class="perfil-caso">
                <strong>{{ sesion.caso }}</strong>
                <p class="sub">{{ etiqueta(sesion) }} · {{ sesion.grupo }}@if (sesion.nota != null) { · {{ sesion.nota }} / 5,0 }</p>
              </article>
            } @empty { <p class="sub">Aún no tienes convocatorias.</p> }
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
  panel = signal<PanelEstudiante | null>(null);
  error = signal('');
  seccion = signal<'inicio' | 'dilemas' | 'avisos' | 'perfil'>('inicio');
  categoria = signal('');
  constructor() {
    inject(ActivatedRoute).queryParamMap.subscribe((params) => {
      const vista = params.get('vista');
      if (vista === 'dilemas' || vista === 'avisos' || vista === 'perfil') {
        if (vista === 'dilemas') this.categoria.set('');
        this.seccion.set(vista);
      } else {
        this.seccion.set('inicio');
      }
    });
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (dato) => this.panel.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  iniciarCaso(sesion: Sesion) {
    if (sesion.participacionId && sesion.participacionEstado === 'EN_CURSO') {
      this.router.navigate(['/estudiante/participacion', sesion.participacionId]);
      return;
    }
    this.http.post<Participacion>(`/api/estudiante/sesiones/${sesion.id}/participaciones`, {}).subscribe({
      next: (participacion) => this.router.navigate(['/estudiante/participacion', participacion.id]),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  pendientes() { return (this.panel()?.sesiones ?? []).filter((s) => !s.participacionEstado).length; }
  enCurso() { return (this.panel()?.sesiones ?? []).filter((s) => s.participacionEstado === 'EN_CURSO').length; }
  finalizados() { return (this.panel()?.sesiones ?? []).filter((s) => s.participacionEstado === 'FINALIZADA' || s.participacionEstado === 'AUSENTE').length; }
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
  destacado(): Sesion | null {
    const lista = this.panel()?.sesiones ?? [];
    return lista.find((s) => /colinas|feminicidio/i.test(s.caso)) ?? lista[0] ?? null;
  }
  tituloDestacado() {
    const caso = this.destacado();
    if (caso && /colinas|feminicidio/i.test(caso.caso)) return 'Feminicidio en Las Colinas';
    return caso?.caso ?? 'Feminicidio en Las Colinas';
  }
  textoDestacado() {
    return 'En el barrio Las Colinas debes reconstruir lo ocurrido con la comunidad y decidir cómo intervenir. El caso es académico: no hay escenas gráficas.';
  }
  progresoGeneral() {
    const lista = this.panel()?.sesiones ?? [];
    if (!lista.length) return 0;
    const total = lista.reduce((acc, s) => acc + this.barra(s), 0);
    return Math.round(total / lista.length);
  }
  nivel() {
    const p = this.progresoGeneral();
    if (p >= 80) return 'Nivel Avanzado';
    if (p >= 40) return 'Nivel Explorador';
    return 'Nivel Inicial';
  }
  mensajeProgreso() {
    if (this.progresoGeneral() >= 70) return 'Vas muy bien. Sigue resolviendo dilemas para alcanzar el siguiente nivel.';
    if (this.finalizados()) return 'Sigue con el caso destacado para subir tu progreso.';
    return 'Empieza el dilema destacado para registrar tu primer avance.';
  }
  verDilemas() {
    this.categoria.set('');
    this.router.navigate(['/estudiante'], { queryParams: { vista: 'dilemas' } });
  }
  abrirCategoria(nombre: string) {
    this.categoria.set(nombre);
    this.seccion.set('dilemas');
  }
  listaSeccion() { return this.visibles(); }
  visibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    const clave = this.clavesCategoria(this.categoria());
    return (this.panel()?.sesiones ?? []).filter((s) => {
      const texto = `${s.caso} ${s.grupo} ${s.espacio} ${s.contexto} ${s.desarrollo}`.toLowerCase();
      const busca = !q || texto.includes(q);
      const categoria = !clave.length || this.seccion() !== 'dilemas' || clave.some((palabra) => texto.includes(palabra));
      return busca && categoria;
    });
  }
  private clavesCategoria(nombre: string) {
    if (nombre === 'Ética') return ['étic', 'etic', 'valor', 'dilema'];
    if (nombre === 'Social') return ['social', 'comunidad', 'barrio', 'colinas', 'feminicidio'];
    if (nombre === 'Psicológico') return ['psico'];
    if (nombre === 'Tecnología') return ['tecno', 'digital', 'red'];
    if (nombre === 'Vida Personal') return ['vida', 'familia', 'personal'];
    return [];
  }
  hoy() { return (this.panel()?.sesiones ?? []).filter((s) => this.mismoDia(s.inicio)); }
  proximos() { return (this.panel()?.sesiones ?? []).filter((s) => !s.participacionEstado || s.participacionEstado === 'EN_CURSO').slice(0, 4); }
  avisos() { return this.panel()?.avisos ?? []; }
  sinLeer() { return this.panel()?.sinLeer ?? this.avisos().filter((a) => !a.leida).length; }
  fechaAviso(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
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
  imports: [MarcoDocenteComponent, RouterLink, FormsModule, MatButtonModule, MatCardModule],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/estudiante" lema="Lee, decide y responde tus dilemas.">
      @if (sesion(); as actual) {
        <section class="tablero">
          <header class="saludo">
            <p class="kicker">{{ actual.codigo }}</p>
            <h1>Bienvenido al caso: {{ actual.caso }}</h1>
          </header>
          <figure class="escena-juego">
            <img src="/escenas/colinas-1.jpg" alt="Vista de Las Colinas al atardecer" />
            <figcaption class="hud">
              <span>LAS COLINAS</span>
              <span>ESCENA 1 · LLEGADA AL BARRIO</span>
            </figcaption>
          </figure>
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
    </app-marco-docente>
  `
})
export class BriefingComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  sesion = signal<Sesion | null>(null);
  acepto = false;
  error = signal('');
  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (panel) => this.sesion.set(panel.sesiones.find((item) => item.id === id) ?? null),
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
  imports: [MarcoEstudianteComponent, RouterLink, MatButtonModule, MatCardModule, NovelaReproductorComponent],
  template: `
    <app-marco-estudiante [activa]="menuActivo()" [sinLeer]="sinLeer()">
      @if (juego(); as actual) {
        @if (actual.estado === 'FINALIZADA' || actual.estado === 'AUSENTE') {
          <section class="informe-caso">
            <article class="tarjeta stack informe-ficha">
              <div class="informe-ficha-cabeza">
                <div>
                  <span class="aviso-canal" [attr.data-estado]="actual.estado">{{ actual.estado === 'AUSENTE' ? 'Ausente' : 'Finalizado' }}</span>
                  <h1>Resultados del caso</h1>
                  <p class="sub">{{ actual.caso }}</p>
                </div>
                <a class="btn-oscuro" routerLink="/estudiante">Volver al inicio</a>
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
            @if (actual.retroalimentacion) {
              <article class="tarjeta stack">
                <h2>Comentario del docente</h2>
                <p>{{ actual.retroalimentacion }}</p>
              </article>
            }
            <h2>Resumen de respuestas</h2>
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
          </section>
        } @else {
          <section class="informe-caso novela-juego">
            <div class="informe-juego-cabeza">
              <div>
                <p class="kicker">{{ actual.caso }}</p>
                <h2>Simulación</h2>
              </div>
            </div>
            <div class="progreso"><div [style.width.%]="actual.progreso"></div></div>
            @if (novela(); as caso) {
              <app-novela-reproductor
                [caso]="caso"
                [personajes]="elenco()"
                [tiempoRestante]="restante()"
                (opcion)="elegirNovela($event)"
                (finalizar)="finalizar()" />
            }
            @if (error()) { <p class="error">{{ error() }}</p> }
          </section>
        }
      }
    </app-marco-estudiante>
  `
})
export class SimulacionComponent {
  letras = ['A', 'B', 'C', 'D', 'E', 'F'];
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private musica = inject(MusicaNovelaService);
  juego = signal<Participacion | null>(null);
  novela = signal<CasoReproductor | null>(null);
  elenco = signal<PersonajeCaso[]>([]);
  indice = signal(0);
  error = signal('');
  restante = signal(0);
  sinLeer = signal(0);
  private timer = 0;
  private cerradoPorTiempo = false;
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
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.timer);
      this.musica.detener();
    });
  }
  pregunta() { return this.juego()?.preguntas[this.indice()] ?? null; }
  menuActivo() {
    return this.juego()?.estado === 'EN_CURSO' ? 'dilemas' : 'inicio';
  }
  etiquetaOpcion(pregunta: PreguntaJuego, opcion: OpcionJuego) {
    if (opcion.correcta) return 'Respuesta adecuada';
    if (pregunta.seleccionId === opcion.id) return 'Tu elección';
    return 'Opción';
  }
  elegirNovela(eleccion: OpcionElegida) {
    const caso = this.novela();
    const pregunta = caso?.bloques[eleccion.bloque]?.preguntas[eleccion.pregunta];
    const opcion = pregunta?.opciones[eleccion.opcion];
    if (pregunta?.id && opcion?.id) this.elegir(pregunta.id, opcion.id);
  }
  nivel(nota: number | null) {
    if (nota == null) return '—';
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4) return 'Alto';
    if (nota >= 3) return 'Básico';
    return 'Bajo';
  }
  elegir(preguntaId: number, opcionId: number) {
    const id = this.juego()?.id;
    this.http.post<Participacion>(`/api/participaciones/${id}/responder`, { preguntaId, opcionId }).subscribe({
      next: (dato) => this.juego.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  deshacer() {
    this.http.post<Participacion>(`/api/participaciones/${this.juego()?.id}/deshacer`, {}).subscribe({
      next: (dato) => this.juego.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  finalizar() {
    this.http.post<Participacion>(`/api/participaciones/${this.juego()?.id}/finalizar`, {}).subscribe({
      next: (dato) => {
        this.musica.detener();
        this.juego.set(dato);
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private porTiempo() {
    if (this.cerradoPorTiempo || this.juego()?.estado !== 'EN_CURSO') return;
    this.cerradoPorTiempo = true;
    this.finalizar();
  }
  mover(delta: number) {
    const total = this.juego()?.preguntas.length ?? 0;
    this.indice.update((valor) => Math.min(total - 1, Math.max(0, valor + delta)));
  }
  private cargar() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Participacion>(`/api/participaciones/${id}`).subscribe({
      next: (dato) => {
        this.juego.set(dato);
        this.restante.set(Math.max(0, dato.segundosMax - dato.segundosUsados));
        if (!this.novela() && dato.estado === 'EN_CURSO') {
          this.novela.set(this.armarNovela(dato));
          this.elenco.set(dato.personajes ?? []);
          this.musica.iniciar();
        }
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private armarNovela(dato: Participacion): CasoReproductor {
    const bloques: CasoReproductor['bloques'] = [];
    for (const pregunta of dato.preguntas) {
      let bloque = bloques.find((b) => b.nombre === pregunta.bloque);
      if (!bloque) {
        bloque = { nombre: pregunta.bloque, contexto: pregunta.contexto, preguntas: [] };
        bloques.push(bloque);
      }
      bloque.preguntas.push({
        id: pregunta.id,
        enunciado: pregunta.enunciado,
        pista: pregunta.pista,
        opciones: pregunta.opciones.map((o) => ({ id: o.id, texto: o.texto }))
      });
    }
    return {
      id: dato.casoId,
      nombre: dato.caso,
      desarrolloSituacional: dato.desarrollo,
      contexto: dato.contexto,
      bloques
    };
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
