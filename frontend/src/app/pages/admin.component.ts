import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { Usuario, mensajeError } from '../core/api.service';

const enlaces = [
  { href: '/admin', texto: 'Inicio', exacto: true },
  { href: '/admin/usuarios', texto: 'Docentes', exacto: true },
  { href: '/admin/usuarios/nuevo', texto: 'Nuevo docente', exacto: true },
  { href: '/admin/grupos', texto: 'Grupos', exacto: true },
  { href: '/admin/auditoria', texto: 'Auditoría', exacto: true },
  { href: '/admin/configuracion', texto: 'Configuración global', exacto: true },
  { href: '/admin/perfil', texto: 'Perfil' }
];

@Component({
  selector: 'app-panel-admin',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" lema="Gestiona docentes, permisos y la configuración del sistema.">
      <div class="dash dash-admin">
        <section class="dash-kpis">
          <article class="dash-kpi">
            <small>Docentes</small>
            <strong>{{ docentes().length }}</strong>
            <span>cuentas con rol docente</span>
          </article>
          <article class="dash-kpi">
            <small>Pueden editar</small>
            <strong>{{ conEditar() }}</strong>
            <span>crean y publican casos</span>
          </article>
          <article class="dash-kpi">
            <small>Gestionan espacios</small>
            <strong>{{ conEspacios() }}</strong>
            <span>pueden abrir grupos</span>
          </article>
        </section>

        <section class="dash-cuerpo dash-cuerpo-admin">
          <article class="dash-panel dash-panel-alto">
            <div class="tarjeta-cabeza">
              <h3>Directorio docente</h3>
              <a class="ver-todos" routerLink="/admin/usuarios">Ver todos →</a>
            </div>
            @for (usuario of docentes().slice(0, 8); track usuario.id) {
              <a class="dash-persona" [routerLink]="['/admin/usuarios', usuario.id]">
                <span class="inicio-avatar">{{ iniciales(usuario.nombre) }}</span>
                <div>
                  <strong>{{ usuario.nombre }}</strong>
                  <p class="sub">{{ usuario.email }}</p>
                </div>
                <em>{{ etiquetaPermisos(usuario.permisos) }}</em>
              </a>
            } @empty { <p class="sub">Todavía no hay docentes. Crea la primera cuenta.</p> }
          </article>

          <section class="inicio-cats dash-cats">
            <div class="tarjeta-cabeza">
              <h3>Tareas de administración</h3>
            </div>
            <div class="cats">
              <a class="cat etica" routerLink="/admin/usuarios/nuevo">
                <svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>
                <span>Crear docente</span><i>→</i>
              </a>
              <a class="cat social" routerLink="/admin/usuarios">
                <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg>
                <span>Asignar permisos</span><i>→</i>
              </a>
              <a class="cat psico" routerLink="/admin/grupos">
                <svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg>
                <span>Grupos</span><i>→</i>
              </a>
              <a class="cat etica" routerLink="/admin/auditoria">
                <svg viewBox="0 0 24 24"><path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/></svg>
                <span>Auditoría</span><i>→</i>
              </a>
              <a class="cat psico" routerLink="/admin/configuracion">
                <svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5"/></svg>
                <span>Configurar</span><i>→</i>
              </a>
            </div>
          </section>
        </section>
      </div>
    </app-marco-docente>
  `
})
export class PanelAdminComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  usuarios = signal<Usuario[]>([]);
  constructor() { this.http.get<Usuario[]>('/api/admin/usuarios').subscribe((dato) => this.usuarios.set(dato)); }
  nombre() {
    const completo = this.auth.usuario()?.nombre ?? '';
    return completo.trim().split(/\s+/)[0] || 'administración';
  }
  docentes() { return this.usuarios().filter((usuario) => usuario.rol === 'PROFESOR'); }
  admins() { return this.usuarios().filter((usuario) => usuario.rol === 'ADMIN'); }
  conEditar() { return this.docentes().filter((usuario) => usuario.permisos.includes('EDITAR')).length; }
  conEspacios() { return this.docentes().filter((usuario) => usuario.permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')).length; }
  iniciales(nombre: string) {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'D';
  }
  etiquetaPermisos(permisos: string[]) {
    if (permisos.includes('EDITAR') && permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')) return 'Editar y espacios';
    if (permisos.includes('EDITAR')) return 'Puede editar';
    if (permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')) return 'Gestiona espacios';
    return 'Solo visualizar';
  }
}

@Component({
  selector: 'app-usuarios',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero">
        <header class="saludo">
          <h1>Docentes</h1>
          <p>El administrador crea docentes y asigna permisos. Los estudiantes los matricula el docente.</p>
          <a class="btn-oscuro" routerLink="/admin/usuarios/nuevo">Nuevo docente</a>
        </header>
        @if (error()) { <p class="error">{{ error() }}</p> }
      <article class="tarjeta stack">
          @for (usuario of visibles(); track usuario.id) {
            <article class="item">
              <h3>{{ usuario.nombre }}</h3>
              <p class="sub">{{ usuario.email }} · {{ usuario.rol === 'PROFESOR' ? 'Docente' : 'Administración' }} · {{ usuario.activo === false ? 'Inactiva' : 'Activa' }}</p>
              <p class="sub">{{ etiquetaPermisos(usuario.permisos) }}</p>
              <div class="caso-acciones acciones-cuenta">
                @if (usuario.rol === 'PROFESOR') {
                  <a class="btn-suave" [routerLink]="['/admin/usuarios', usuario.id]">Permisos</a>
                }
                @if (usuario.id !== yo()) {
                  @if (usuario.activo === false) {
                    <button class="btn-oscuro" type="button" (click)="activo(usuario.id, true)">Activar</button>
                  } @else {
                    <button class="btn-suave" type="button" (click)="activo(usuario.id, false)">Desactivar</button>
                  }
                }
              </div>
            </article>
          } @empty { <p class="sub">No hay cuentas para mostrar.</p> }
      </article>
      </section>
    </app-marco-docente>
  `
})
export class UsuariosComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private filtro = inject(BusquedaService);
  private auth = inject(AuthService);
  usuarios = signal<Usuario[]>([]);
  error = signal('');
  constructor() {
    this.cargar();
  }
  yo() { return this.auth.usuario()?.id; }
  etiquetaPermisos(permisos: string[]) {
    const etiquetas = [];
    if (permisos.includes('VISUALIZAR')) etiquetas.push('Visualizar');
    if (permisos.includes('EDITAR')) etiquetas.push('Editar');
    if (permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')) etiquetas.push('Gestionar espacios');
    return etiquetas.join(' · ') || 'Sin permisos';
  }
  visibles() {
    const q = this.filtro.texto().trim().toLowerCase();
    return this.usuarios().filter((usuario) => !q || usuario.nombre.toLowerCase().includes(q) || usuario.email.toLowerCase().includes(q));
  }
  activo(id: number, activo: boolean) {
    this.http.post<Usuario>(`/api/admin/usuarios/${id}/activo`, { activo }).subscribe({
      next: () => this.cargar(),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private cargar() {
    this.http.get<Usuario[]>('/api/admin/usuarios').subscribe((dato) => this.usuarios.set(dato));
  }
}

@Component({
  selector: 'app-crear-usuario',
  imports: [MarcoDocenteComponent, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero ficha-tablero">
        <header class="saludo">
          <h1>Nuevo docente</h1>
          <p>Nace con el rol docente y solo el permiso Visualizar.</p>
        </header>
        <article class="dash-panel ficha-form">
          <div class="ficha-campos">
            <div class="grid-2">
              <label class="field"><span>Nombre completo</span><input [(ngModel)]="nombre" placeholder="Nombre y apellido" /></label>
              <label class="field"><span>Correo electrónico</span><input [(ngModel)]="email" placeholder="docente@institucion.edu" /></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Rol</span>
                <select [(ngModel)]="rol">
                  <option value="PROFESOR">Docente</option>
                  <option value="ADMIN">Administración</option>
                </select>
              </label>
              <label class="field"><span>Contraseña</span><input [(ngModel)]="clave" type="password" autocomplete="new-password" /></label>
            </div>
            <label class="ficha-check">
              <input type="checkbox" disabled [checked]="true" />
              <span>Visualizar queda activo desde el primer ingreso.</span>
            </label>
          </div>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="ficha-pie">
            <button class="btn-oscuro" type="button" (click)="crear()">Guardar</button>
          </div>
        </article>
      </section>
    </app-marco-docente>
  `
})
export class CrearUsuarioComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private router = inject(Router);
  nombre = '';
  email = '';
  clave = '';
  rol = 'PROFESOR';
  error = signal('');
  crear() {
    this.http.post('/api/admin/usuarios', { nombre: this.nombre, email: this.email, clave: this.clave, rol: this.rol }).subscribe({
      next: () => this.router.navigateByUrl('/admin/usuarios'),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}

@Component({
  selector: 'app-permisos-docente',
  imports: [MarcoDocenteComponent, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero ficha-tablero">
        <header class="saludo">
          <h1>Permisos de {{ nombre() }}</h1>
          <p>Visualizar permanece. Editar permite crear casos. Gestionar espacios permite crear grupos.</p>
        </header>
        <article class="dash-panel ficha-form">
          <div class="ficha-campos">
            <label class="ficha-check">
              <input type="checkbox" disabled [checked]="true" />
              <span>Visualizar queda activo desde el primer ingreso.</span>
            </label>
            <label class="ficha-check">
              <input type="checkbox" name="editar" [(ngModel)]="editar" />
              <span>Editar casos</span>
            </label>
            <label class="ficha-check">
              <input type="checkbox" name="gestionar" [(ngModel)]="gestionar" />
              <span>Gestionar espacios académicos</span>
            </label>
          </div>
          @if (error()) { <p class="error">{{ error() }}</p> }
          <div class="ficha-pie">
            <button class="btn-oscuro" type="button" (click)="guardar()">Guardar permisos</button>
          </div>
        </article>
      </section>
    </app-marco-docente>
  `
})
export class PermisosDocenteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private id = Number(this.route.snapshot.paramMap.get('id'));
  nombre = signal('');
  editar = false;
  gestionar = false;
  error = signal('');
  constructor() {
    this.http.get<Usuario[]>('/api/admin/usuarios').subscribe((lista) => {
      const docente = lista.find((usuario) => usuario.id === this.id);
      if (!docente || docente.rol !== 'PROFESOR') {
        this.router.navigateByUrl('/admin/usuarios');
        return;
      }
      this.nombre.set(docente.nombre);
      this.editar = docente.permisos.includes('EDITAR');
      this.gestionar = docente.permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS');
    });
  }
  guardar() {
    const permisos = [
      ...(this.editar ? ['EDITAR'] : []),
      ...(this.gestionar ? ['GESTIONAR_ESPACIOS_ACADEMICOS'] : [])
    ];
    this.http.post(`/api/admin/usuarios/${this.id}/permisos`, { permisos }).subscribe({
      next: () => this.router.navigateByUrl('/admin/usuarios'),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}

interface PersonaAdmin { id: number; nombre: string; email: string; }
interface GrupoAdmin { id: number; nombre: string; espacioAcademico: string; docente: PersonaAdmin; estudiantes: PersonaAdmin[]; }
interface Auditoria { id: number; fecha: string; accion: string; detalle: string; usuario: string; }

@Component({
  selector: 'app-grupos-admin',
  imports: [MarcoDocenteComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero">
        <header class="saludo">
          <h1>Grupos</h1>
          <p>Espacios académicos de todos los docentes y los estudiantes matriculados.</p>
        </header>
        <article class="tarjeta stack">
          @for (grupo of grupos(); track grupo.id) {
            <article class="item">
              <h3>{{ grupo.nombre }}</h3>
              <p class="sub">{{ grupo.espacioAcademico }} · {{ grupo.docente.nombre }}</p>
              <p class="sub">{{ grupo.estudiantes.length }} estudiantes</p>
              @for (estudiante of grupo.estudiantes; track estudiante.id) {
                <p class="sub">{{ estudiante.nombre }} · {{ estudiante.email }}</p>
              }
            </article>
          } @empty { <p class="sub">Todavía no hay grupos.</p> }
        </article>
      </section>
    </app-marco-docente>
  `
})
export class GruposAdminComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  grupos = signal<GrupoAdmin[]>([]);
  constructor() {
    this.http.get<GrupoAdmin[]>('/api/admin/grupos').subscribe((dato) => this.grupos.set(dato));
  }
}

@Component({
  selector: 'app-auditoria',
  imports: [MarcoDocenteComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero">
        <header class="saludo">
          <h1>Auditoría</h1>
          <p>Acciones registradas en el sistema.</p>
        </header>
        <article class="tarjeta stack">
          @for (fila of filas(); track fila.id) {
            <article class="item">
              <h3>{{ fila.accion }}</h3>
              <p class="sub">{{ fila.usuario || 'Sistema' }} · {{ fila.fecha }}</p>
              <p class="sub">{{ fila.detalle }}</p>
            </article>
          } @empty { <p class="sub">Todavía no hay registros de auditoría.</p> }
        </article>
      </section>
    </app-marco-docente>
  `
})
export class AuditoriaComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  filas = signal<Auditoria[]>([]);
  constructor() {
    this.http.get<Auditoria[]>('/api/admin/auditoria').subscribe((dato) => this.filas.set(dato));
  }
}

@Component({
  selector: 'app-configuracion',
  imports: [MarcoDocenteComponent, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin">
      <section class="tablero ficha-tablero">
        <header class="saludo">
          <h1>Configuración global</h1>
          <p>Estos valores se guardan en este navegador.</p>
        </header>
        <article class="dash-panel ficha-form">
          <div class="ficha-campos">
            <div class="grid-2">
              <label class="field"><span>Nombre del sistema</span><input [(ngModel)]="config.nombre" /></label>
              <label class="field"><span>Correo de soporte</span><input [(ngModel)]="config.soporte" /></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Zona horaria</span><input [(ngModel)]="config.zona" /></label>
              <label class="field"><span>Inactividad máxima (min)</span><input type="number" [(ngModel)]="config.inactividad" /></label>
            </div>
            <label class="ficha-check">
              <input type="checkbox" name="notificar" [(ngModel)]="config.notificar" />
              <span>Avisos por correo</span>
            </label>
            <label class="ficha-check">
              <input type="checkbox" name="docentePublica" [(ngModel)]="config.docentePublica" />
              <span>El docente puede publicar sin aprobación previa</span>
            </label>
          </div>
          @if (ok()) { <p class="ok">{{ ok() }}</p> }
          <div class="ficha-pie">
            <button class="btn-oscuro" type="button" (click)="guardar()">Guardar configuración</button>
          </div>
        </article>
      </section>
    </app-marco-docente>
  `
})
export class ConfiguracionComponent {
  enlaces = enlaces;
  ok = signal('');
  config = this.leer();
  guardar() {
    localStorage.setItem('dilema-config', JSON.stringify(this.config));
    this.ok.set('Configuración guardada en este navegador.');
  }
  private leer() {
    const base = { nombre: 'Simulador de Psicología Social', soporte: 'soporte.academico@universidad.edu', zona: 'America/Bogota', inactividad: 30, notificar: true, docentePublica: true, escalaMin: 0, escalaMax: 5 };
    try { return { ...base, ...JSON.parse(localStorage.getItem('dilema-config') || '{}') }; }
    catch { return base; }
  }
}

const enlacesDocente = [
  { href: '/docente', texto: 'Inicio', exacto: true },
  { href: '/docente/casos', texto: 'Mis Casos', exacto: true },
  { href: '/docente/grupos', texto: 'Grupos', exacto: true },
  { href: '/docente/programar', texto: 'Programar', exacto: true },
  { href: '/docente/seguimiento', texto: 'Reportes' },
  { href: '/docente/perfil', texto: 'Perfil' }
];

@Component({
  selector: 'app-perfil',
  imports: [MarcoDocenteComponent],
  template: `
    <app-marco-docente [enlaces]="menu()" [inicio]="inicio()">
      <section class="tablero ficha-tablero pagina-perfil">
        <header class="saludo">
          <h1>Mi perfil</h1>
          <p>Tus datos de cuenta.</p>
        </header>
        <article class="dash-panel ficha-form">
          <div class="perfil-vista">
            <div class="perfil-cabeza">
              <span class="inicio-avatar">{{ iniciales() }}</span>
              <div>
                <h2>{{ auth.usuario()?.nombre }}</h2>
                <p class="sub">{{ auth.usuario()?.email }}</p>
                <p class="sub">{{ etiquetaRol() }}</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </app-marco-docente>
  `
})
export class PerfilComponent {
  auth = inject(AuthService);
  menu = computed(() => this.auth.rol() === 'ADMIN' ? enlaces : enlacesDocente);
  inicio = computed(() => this.auth.rol() === 'ADMIN' ? '/admin' : '/docente');
  etiquetaRol() {
    if (this.auth.rol() === 'ADMIN') return 'Administración';
    if (this.auth.rol() === 'PROFESOR') return 'Docente';
    return 'Estudiante';
  }
  iniciales() {
    const partes = (this.auth.usuario()?.nombre ?? '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'D';
  }
}
