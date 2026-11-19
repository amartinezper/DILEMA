import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { forkJoin } from 'rxjs';
import { MarcoComponent } from '../shared/marco.component';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { Aviso, PanelEstudiante, Participacion, Sesion, mensajeError } from '../core/api.service';

const enlaces = [
  { href: '/estudiante', texto: 'Casos asignados', exacto: true },
  { href: '/estudiante/avisos', texto: 'Notificaciones', exacto: true }
];

@Component({
  selector: 'app-panel-estudiante',
  imports: [RouterLink],
  template: `
    <div class="inicio-est" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <a class="inicio-logo" routerLink="/estudiante" (click)="seccion.set('inicio')">
          <img class="inicio-logo-icono" src="/dilema-cerebro.jpg" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          <button type="button" [class.activa]="seccion() === 'inicio'" (click)="seccion.set('inicio')">
            <svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H4z"/></svg>
            Inicio
          </button>
          <button type="button" [class.activa]="seccion() === 'dilemas'" (click)="seccion.set('dilemas')">
            <svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg>
            Mis Dilemas
          </button>
          <button type="button" [class.activa]="seccion() === 'resultados'" (click)="seccion.set('resultados')">
            <svg viewBox="0 0 24 24"><path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/></svg>
            Resultados
          </button>
          <button type="button" [class.activa]="seccion() === 'perfil'" (click)="seccion.set('perfil')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3.2 3.4-5 7-5s6.2 1.8 7 5"/></svg>
            Perfil
          </button>
        </nav>
        <p class="inicio-lema">
          <svg class="inicio-lema-onda" viewBox="0 0 210 120" preserveAspectRatio="none" aria-hidden="true">
            <path fill="#091830" d="M0,120 V48 C52,8 158,72 210,38 V120 Z"/>
            <ellipse cx="105" cy="58" rx="96" ry="34" fill="none" stroke="#16345c" stroke-width="6" opacity=".55" transform="rotate(12 105 58)"/>
            <ellipse cx="105" cy="58" rx="80" ry="26" fill="none" stroke="#1d4a7a" stroke-width="1.6" opacity=".35" transform="rotate(12 105 58)"/>
          </svg>
          <span>Piensa. Decide. Aprende.</span>
          <span class="lema-cierre">A decidir.</span>
        </p>
        <button class="inicio-salir" type="button" (click)="auth.salir()">
          <svg viewBox="0 0 24 24"><path d="M10 7V5H5v14h5v-2M10 12h10M16 8l4 4-4 4"/></svg>
          Cerrar Sesión
        </button>
      </aside>

      <main class="inicio-cuerpo">
        <div class="inicio-fondo" aria-hidden="true">
          <div class="inicio-cielo"></div>
          <div class="inicio-marca-hero">
            <img class="inicio-cerebro" src="/dilema-cerebro.jpg" alt="" />
          </div>
          <svg class="inicio-deco" viewBox="0 0 1440 900" preserveAspectRatio="none">
            <defs>
              <linearGradient id="anillo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#dbeafe" stop-opacity=".15"/>
                <stop offset=".45" stop-color="#93c5fd"/>
                <stop offset="1" stop-color="#3b82f6" stop-opacity=".2"/>
              </linearGradient>
              </defs>
            <g fill="#fff">
              <polygon points="860,18 864,32 880,36 864,40 860,54 856,40 840,36 856,32"/>
              <polygon points="1088,10 1092,24 1108,28 1092,32 1088,46 1084,32 1068,28 1084,24"/>
              <polygon points="1260,42 1264,54 1278,58 1264,62 1260,74 1256,62 1242,58 1256,54"/>
              <circle cx="940" cy="28" r="1.8"/>
              <circle cx="1188" cy="16" r="1.5"/>
              <circle cx="1336" cy="70" r="1.6"/>
              <circle cx="1012" cy="54" r="1.2"/>
            </g>
            <ellipse cx="1148" cy="110" rx="270" ry="110" fill="none" stroke="url(#anillo)" stroke-width="10" transform="rotate(-16 1148 110)"/>
            <ellipse cx="1148" cy="110" rx="228" ry="88" fill="none" stroke="#e0f2fe" stroke-width="2.2" transform="rotate(-16 1148 110)" opacity=".8"/>
            <path fill="#1e3a8a" d="M460,0 C660,28 800,128 970,250 C1130,368 1288,420 1460,360 L1460,278 C1288,338 1130,286 970,168 C800,46 660,-36 460,-48 Z"/>
            <path fill="#3b82f6" d="M460,0 C660,28 800,128 970,250 C1130,368 1288,420 1460,360 L1460,318 C1288,378 1130,326 970,208 C800,86 660,-12 460,-24 Z"/>
            <path fill="#ffffff" d="M460,0 C660,28 800,128 970,250 C1130,368 1288,420 1460,360 L1460,342 C1288,402 1130,350 970,230 C800,108 660,8 460,-10 Z"/>
            <path fill="#eef2ff" d="M0,0 H460 C660,28 800,128 970,250 C1130,368 1288,420 1440,360 L1440,900 L0,900 Z"/>
          </svg>
        </div>
        <header class="inicio-hero">
          <div class="inicio-user">
            <span class="inicio-avatar">{{ iniciales() }}</span>
            <span>{{ nombreCompleto() }}</span>
          </div>
          <div class="inicio-hero-copy">
            <div class="inicio-saludo">
              <h1>¡Hola, {{ nombre() }}! <span aria-hidden="true">👋</span></h1>
              <p>Bienvenido a <strong>Dilema</strong>, donde cada decisión cuenta.</p>
            </div>
          </div>
        </header>
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
                  @if (caso.participacionEstado === 'FINALIZADA' && caso.participacionId) {
                    <a class="btn-resolver" [routerLink]="['/estudiante/participacion', caso.participacionId]">Ver resultados</a>
                  } @else if (caso.estado === 'SIN_INICIAR') {
                    <p class="sub claro">Esperando a que el docente inicie la sesión.</p>
                  } @else if (caso.estado === 'FINALIZADO' && !caso.participacionId) {
                    <p class="sub claro">No participaste. Ausencia 0,0.</p>
                  } @else {
                    <a class="btn-resolver" [routerLink]="['/estudiante/sesion', caso.id]">▶ Resolver Dilema</a>
                  }
                }
              </div>
              <figure>
                <img src="/escenas/colinas-1.jpg" alt="Barrio Las Colinas al atardecer, llegada al caso" />
              </figure>
            </article>

            <article class="inicio-progreso">
              <h3><span class="progreso-ico">📊</span> Tu Progreso</h3>
              <div class="aro" [style.--p]="progresoGeneral()">
                <span>{{ progresoGeneral() }}%</span>
              </div>
              <p class="nivel">★ {{ nivel() }}</p>
              <p class="progreso-tip">{{ mensajeProgreso() }}</p>
            </article>
          </section>

          <section class="inicio-cats">
            <div class="tarjeta-cabeza">
              <h3>★ Categorías</h3>
              <button type="button" class="ver-todos" (click)="seccion.set('dilemas')">Ver todas →</button>
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

        @if (seccion() === 'dilemas' || seccion() === 'resultados') {
          <section class="inicio-lista">
            <h2>{{ seccion() === 'resultados' ? 'Resultados' : 'Mis Dilemas' }}</h2>
            <div class="rejilla-casos">
              @for (sesion of listaSeccion(); track sesion.id; let i = $index) {
                <article class="curso">
                  <div class="franja" [attr.data-tono]="i % 3"></div>
                  <span class="estado-pill">{{ etiqueta(sesion) }}</span>
                  <h3>{{ sesion.caso }}</h3>
                  <p class="sub">{{ sesion.grupo }} · {{ sesion.espacio }}</p>
                  <div class="progreso"><div [style.width.%]="barra(sesion)"></div></div>
                  <small class="avance">{{ barra(sesion) }}% de avance</small>
                  <div class="curso-acciones">
                    @if (sesion.participacionEstado === 'FINALIZADA' && sesion.participacionId) {
                      <a class="btn-suave" [routerLink]="['/estudiante/participacion', sesion.participacionId]">Ver resultados</a>
                    } @else if (sesion.estado === 'SIN_INICIAR') {
                      <p class="sub">Esperando a que el docente inicie la sesión.</p>
                    } @else if (sesion.estado === 'FINALIZADO' && !sesion.participacionId) {
                      <p class="sub">No participaste. Ausencia 0,0.</p>
                    } @else {
                      <a class="btn-oscuro" [routerLink]="['/estudiante/sesion', sesion.id]">Ingresar al caso</a>
                    }
                  </div>
                </article>
              } @empty { <p class="sub">No hay casos en esta vista.</p> }
            </div>
          </section>
        }

        @if (seccion() === 'perfil') {
          <section class="inicio-perfil">
            <h2>Perfil</h2>
            <p><strong>{{ nombreCompleto() }}</strong></p>
            <p class="sub">{{ auth.usuario()?.email }}</p>
            <p class="sub">Estudiante · {{ finalizados() }} dilemas resueltos · puntaje {{ promedio() }} / 5,0</p>
          </section>
        }
      </main>
    </div>
  `
})
export class PanelEstudianteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  auth = inject(AuthService);
  private busqueda = inject(BusquedaService);
  panel = signal<PanelEstudiante | null>(null);
  error = signal('');
  seccion = signal<'inicio' | 'dilemas' | 'resultados' | 'perfil'>('inicio');
  menuAbierto = signal(false);
  alternarMenu() { this.menuAbierto.update((abierto) => !abierto); }
  cerrarMenu() { this.menuAbierto.set(false); }
  constructor() {
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe({
      next: (dato) => this.panel.set(dato),
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
  abrirCategoria(_nombre: string) { this.seccion.set('dilemas'); }
  listaSeccion() {
    const lista = this.visibles();
    if (this.seccion() === 'resultados') {
      return lista.filter((s) => s.participacionEstado === 'FINALIZADA' || s.participacionEstado === 'AUSENTE');
    }
    return lista;
  }
  visibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return (this.panel()?.sesiones ?? []).filter((s) => !q || s.caso.toLowerCase().includes(q) || s.grupo.toLowerCase().includes(q));
  }
  hoy() { return (this.panel()?.sesiones ?? []).filter((s) => this.mismoDia(s.inicio)); }
  proximos() { return (this.panel()?.sesiones ?? []).filter((s) => !s.participacionEstado || s.participacionEstado === 'EN_CURSO').slice(0, 4); }
  avisos() { return (this.panel()?.avisos ?? []).slice(0, 4); }
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
  imports: [MarcoComponent, RouterLink, FormsModule, MatButtonModule, MatCardModule],
  template: `
    <app-marco [enlaces]="enlaces" modo="superior">
      @if (sesion(); as actual) {
        <section class="stack">
          <p class="kicker">{{ actual.codigo }}</p>
          <h1>Bienvenido al caso: {{ actual.caso }}</h1>
          <figure class="escena-juego">
            <img src="/escenas/colinas-1.jpg" alt="Vista de Las Colinas al atardecer" />
            <figcaption class="hud">
              <span>LAS COLINAS</span>
              <span>ESCENA 1 · LLEGADA AL BARRIO</span>
            </figcaption>
          </figure>
          <article class="card stack">
            <h2>Mensaje del docente</h2>
            <p>{{ actual.mensaje || 'Sigue las instrucciones del caso y responde cada escena.' }}</p>
          </article>
          <div class="grid-2">
            <article class="card stack">
              <h2>Reglas de participación</h2>
              <p>1. Tiempo máximo: {{ actual.tiempoMaxMin }} minutos.</p>
              <p>2. No podrás ingresar si ya pasó el tiempo de tolerancia.</p>
              <p>3. La retroalimentación se muestra solo al finalizar.</p>
            </article>
            <article class="card stack">
              <h2>Ficha</h2>
              <p>{{ actual.grupo }} · {{ actual.espacio }}</p>
              <p>{{ actual.lugar || 'Sin lugar físico' }}</p>
            </article>
          </div>
          <div [innerHTML]="actual.desarrollo"></div>
          <label class="check"><input type="checkbox" [(ngModel)]="acepto" /> He leído y acepto las reglas de participación.</label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="row">
            <a mat-stroked-button routerLink="/estudiante">Volver al panel</a>
            @if (actual.estado === 'SIN_INICIAR') {
              <p class="sub">El docente todavía no inicia la sesión.</p>
            } @else if (actual.participacionEstado === 'FINALIZADA' && actual.participacionId && !actual.repeticionAutorizada) {
              <button mat-flat-button color="primary" type="button" (click)="ver(actual.participacionId)">Ver resultados</button>
            } @else if (actual.estado === 'FINALIZADO' && !actual.repeticionAutorizada) {
              <p class="sub">La sesión ya finalizó.</p>
            } @else {
              <button mat-flat-button color="primary" type="button" [disabled]="!acepto" (click)="iniciar(actual)">{{ actual.repeticionAutorizada ? 'Iniciar nuevo intento' : 'Iniciar simulación' }}</button>
            }
          </div>
        </section>
      }
    </app-marco>
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
}

@Component({
  imports: [MarcoComponent, RouterLink, MatButtonModule, MatCardModule],
  template: `
    <app-marco [enlaces]="enlaces" modo="superior">
      @if (juego(); as actual) {
        @if (actual.estado === 'FINALIZADA' || actual.estado === 'AUSENTE') {
          <section class="stack">
            <p class="kicker">Informe del caso</p>
            <h1>Resultados del caso</h1>
            <p class="sub">{{ actual.caso }}</p>
            <p class="nota">Calificación final: {{ actual.nota ?? '—' }} / 5,0</p>
            <p class="sub">Nivel: {{ nivel(actual.nota) }}</p>
            @if (actual.aciertos !== null) {
              <p class="sub">Acertaste {{ actual.aciertos }} de {{ actual.total }} · Fallaste {{ actual.errores }} · Sin responder {{ actual.sinResponder }}</p>
            }
            <h2>Resumen de respuestas</h2>
            @for (pregunta of actual.preguntas; track pregunta.id) {
              <article class="item">
                <small>{{ pregunta.bloque }}</small>
                <h3>{{ pregunta.enunciado }}</h3>
                @for (opcion of pregunta.opciones; track opcion.id) {
                  <div class="opcion" [class.bien]="opcion.correcta" [class.mal]="pregunta.seleccionId === opcion.id && opcion.correcta === false" [class.elegida]="pregunta.seleccionId === opcion.id">
                    {{ pregunta.seleccionId === opcion.id ? 'Tu elección: ' : '' }}{{ opcion.texto }}
                    @if (pregunta.seleccionId === opcion.id || opcion.correcta) {
                      <p class="sub">{{ opcion.explicacion }}</p>
                      @if (opcion.fundamento) { <p class="sub">{{ opcion.fundamento }}</p> }
                    }
                  </div>
                }
              </article>
            }
            <a mat-stroked-button routerLink="/estudiante">Volver al panel</a>
          </section>
        } @else {
          @if (pregunta(); as item) {
            <section class="stack">
              <div class="row">
                <h2>Escena {{ indice() + 1 }}: {{ item.bloque }}</h2>
                <strong>Tiempo restante: {{ reloj() }}</strong>
              </div>
              <div class="progreso"><div [style.width.%]="actual.progreso"></div></div>
              <figure class="escena-juego">
                <img [src]="escenaSrc()" [alt]="'Escena ' + (indice() + 1) + ': ' + item.bloque" />
                <figcaption class="hud">
                  <span>{{ lugar() }}</span>
                  <span>ESCENA {{ indice() + 1 }} · {{ item.bloque }}</span>
                </figcaption>
              </figure>
              <article class="card">
                <p class="kicker">Contexto de la situación</p>
                <p>{{ item.contexto }}</p>
              </article>
              <article class="card stack">
                <p class="kicker">Interacción evaluativa</p>
                <h2>{{ item.enunciado }}</h2>
                @if (item.pista) { <p class="aviso"><strong>Herramienta.</strong> {{ item.pista }}</p> }
                @for (opcion of item.opciones; track opcion.id; let i = $index) {
                  <button class="opcion radio" [class.elegida]="item.seleccionId === opcion.id" type="button" (click)="elegir(item.id, opcion.id)">
                    <span>{{ item.seleccionId === opcion.id ? '●' : '○' }}</span>
                    <span>Opción {{ letras[i] }}: {{ opcion.texto }}</span>
                  </button>
                }
              </article>
              @if (error()) { <p class="error">{{ error() }}</p> }
              <div class="row">
                <button mat-stroked-button type="button" [disabled]="indice() === 0" (click)="mover(-1)">Escena anterior</button>
                <button mat-stroked-button type="button" (click)="deshacer()">Deshacer</button>
                @if (indice() < actual.preguntas.length - 1) {
                  <button mat-flat-button color="primary" type="button" (click)="mover(1)">Siguiente escena</button>
                } @else {
                  <button mat-flat-button color="primary" type="button" (click)="finalizar()">Finalizar</button>
                }
              </div>
            </section>
          }
        }
      }
    </app-marco>
  `
})
export class SimulacionComponent {
  enlaces = enlaces;
  letras = ['A', 'B', 'C', 'D', 'E', 'F'];
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  juego = signal<Participacion | null>(null);
  indice = signal(0);
  error = signal('');
  restante = signal(0);
  private timer = 0;
  private cerradoPorTiempo = false;
  constructor() {
    this.cargar();
    this.timer = window.setInterval(() => {
      this.restante.update((valor) => {
        const siguiente = Math.max(0, valor - 1);
        if (siguiente === 0 && valor > 0) this.porTiempo();
        return siguiente;
      });
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }
  pregunta() { return this.juego()?.preguntas[this.indice()] ?? null; }
  lugar() {
    const nombre = this.juego()?.caso ?? '';
    return /colinas/i.test(nombre) ? 'LAS COLINAS' : nombre.toUpperCase();
  }
  escenaSrc() {
    const n = (this.indice() % 3) + 1;
    return `/escenas/colinas-${n}.jpg`;
  }
  nivel(nota: number | null) {
    if (nota == null) return '—';
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4) return 'Alto';
    if (nota >= 3) return 'Básico';
    return 'Bajo';
  }
  reloj() {
    const segundos = this.restante();
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
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
      next: (dato) => this.juego.set(dato),
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
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}

@Component({
  selector: 'app-avisos',
  imports: [MarcoComponent],
  template: `
    <app-marco [enlaces]="enlaces" modo="superior">
      <section class="tablero">
        <header class="saludo">
          <h1>Avisos</h1>
          <p>Mensajes de tus convocatorias.</p>
        </header>
        <article class="tarjeta stack">
          <div class="tarjeta-cabeza">
            <h2>Sin leer</h2>
            <button class="btn-oscuro" type="button" (click)="marcar()">Marcar todo como leído</button>
          </div>
          @for (aviso of visibles(); track aviso.id; let i = $index) {
            <article class="fila-lista">
              <span class="punto" [attr.data-tono]="i % 3"></span>
              <div>
                <h3>{{ aviso.titulo }}</h3>
                <p class="sub">{{ aviso.cuerpo }}</p>
              </div>
            </article>
          } @empty { <p class="sub">No hay avisos pendientes.</p> }
        </article>
      </section>
    </app-marco>
  `
})
export class AvisosComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private busqueda = inject(BusquedaService);
  avisos = signal<Aviso[]>([]);
  constructor() { this.refrescar(); }
  visibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return this.avisos().filter((aviso) => !aviso.leida
      && (!q || aviso.titulo.toLowerCase().includes(q) || aviso.cuerpo.toLowerCase().includes(q)));
  }
  marcar() {
    const pendientes = this.visibles().map((aviso) => this.http.post<void>(`/api/estudiante/avisos/${aviso.id}/leer`, {}));
    if (!pendientes.length) return;
    forkJoin(pendientes).subscribe({ complete: () => this.refrescar(), error: () => this.refrescar() });
  }
  private refrescar() {
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe((panel) => this.avisos.set(panel.avisos));
  }
}
