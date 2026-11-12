import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
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
  imports: [MarcoComponent, RouterLink],
  template: `
    <app-marco [enlaces]="enlaces" modo="superior">
      <section class="tablero">
        <header class="saludo">
          <h1>Hola, {{ nombre() }}</h1>
          <p>Aquí tienes tus casos asignados y los avisos de la convocatoria.</p>
        </header>
        <div class="atajos">
          <a class="atajo oscuro" routerLink="/estudiante">Casos asignados</a>
          <a class="atajo" routerLink="/estudiante/avisos">Notificaciones</a>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="tablero-cuerpo">
          <div class="stack">
            <article class="tarjeta">
              <div class="tarjeta-cabeza"><h2>Casos asignados</h2></div>
              <div class="rejilla-casos">
                @for (sesion of visibles(); track sesion.id; let i = $index) {
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
                        @if (sesion.repeticionAutorizada) {
                          <a class="btn-oscuro" [routerLink]="['/estudiante/sesion', sesion.id]">Nuevo intento</a>
                        }
                      } @else {
                        <a class="btn-oscuro" [routerLink]="['/estudiante/sesion', sesion.id]">Ingresar al caso</a>
                      }
                    </div>
                  </article>
                } @empty { <p class="sub">No tienes casos asignados.</p> }
              </div>
            </article>
            <div class="tablero-abajo">
              <article class="tarjeta">
                <h2>Tu rendimiento</h2>
                <p class="nota-grande">{{ promedio() }} <small>/ 5.0</small></p>
                <p class="sub">{{ finalizados() }} finalizados · {{ enCurso() }} en curso · {{ pendientes() }} pendientes</p>
              </article>
              <article class="tarjeta">
                <h2>Próximos casos</h2>
                <div class="stack">
                  @for (sesion of proximos(); track sesion.id) {
                    <div class="fila-lista">
                      <span class="punto"></span>
                      <div>
                        <strong>{{ sesion.caso }}</strong>
                        <p class="sub">{{ sesion.grupo }} · {{ cuando(sesion.inicio) }}</p>
                      </div>
                    </div>
                  } @empty { <p class="sub">No tienes casos pendientes.</p> }
                </div>
              </article>
            </div>
          </div>
          <aside class="stack">
            <article class="tarjeta">
              <h2>Tu horario de hoy</h2>
              <div class="stack">
                @for (sesion of hoy(); track sesion.id; let i = $index) {
                  <div class="fila-lista">
                    <span class="punto" [attr.data-tono]="i % 3"></span>
                    <div>
                      <strong>{{ sesion.caso }}</strong>
                      <p class="sub">{{ cuando(sesion.inicio) }} · {{ sesion.lugar || sesion.espacio }}</p>
                    </div>
                  </div>
                } @empty { <p class="sub">Hoy no tienes sesiones.</p> }
              </div>
            </article>
            <article class="tarjeta">
              <div class="tarjeta-cabeza">
                <h2>Avisos</h2>
                <a class="ver-todos" routerLink="/estudiante/avisos">Ver todos</a>
              </div>
              <div class="stack">
                @for (aviso of avisos(); track aviso.id; let i = $index) {
                  <div class="fila-lista">
                    <span class="punto" [attr.data-tono]="i % 3"></span>
                    <div>
                      <strong>{{ aviso.titulo }}</strong>
                      <p class="sub">{{ aviso.cuerpo }}</p>
                    </div>
                  </div>
                } @empty { <p class="sub">No tienes avisos.</p> }
              </div>
            </article>
          </aside>
        </div>
      </section>
    </app-marco>
  `
})
export class PanelEstudianteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private busqueda = inject(BusquedaService);
  panel = signal<PanelEstudiante | null>(null);
  error = signal('');
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
            @if (actual.participacionEstado === 'FINALIZADA' && actual.participacionId && !actual.repeticionAutorizada) {
              <button mat-flat-button color="primary" type="button" (click)="ver(actual.participacionId)">Ver resultados</button>
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
              <div class="escena-vacia">Imagen de la escena</div>
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
  leidos = signal<number[]>(JSON.parse(localStorage.getItem('dilema-leidos') || '[]'));
  constructor() { this.refrescar(); }
  visibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return this.avisos().filter((aviso) => !this.leidos().includes(aviso.id)
      && (!q || aviso.titulo.toLowerCase().includes(q) || aviso.cuerpo.toLowerCase().includes(q)));
  }
  marcar() {
    const ids = this.avisos().map((aviso) => aviso.id);
    localStorage.setItem('dilema-leidos', JSON.stringify(ids));
    this.leidos.set(ids);
  }
  private refrescar() {
    this.http.get<PanelEstudiante>('/api/estudiante/panel').subscribe((panel) => this.avisos.set(panel.avisos));
  }
}
