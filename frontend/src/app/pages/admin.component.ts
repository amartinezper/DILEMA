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
  { href: '/admin/configuracion', texto: 'Configuración global', exacto: true },
  { href: '/admin/perfil', texto: 'Perfil' }
];

@Component({
  selector: 'app-panel-admin',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true"
      descripcion="Gestiona docentes, permisos y la configuración del sistema.">
      <section class="adm-kpis" aria-label="Resumen">
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg></span>
          <div><small>Docentes</small><strong>{{ docentes().length }}</strong><span>cuentas con rol docente</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/><path d="m9.5 12.5 2 2 3.5-4"/></svg></span>
          <div><small>Pueden editar</small><strong>{{ conEditar() }}</strong><span>crean y publican casos</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/></svg></span>
          <div><small>Gestionan espacios</small><strong>{{ conEspacios() }}</strong><span>pueden abrir grupos</span></div>
        </article>
      </section>

      <section class="adm-dos">
        <article class="adm-tarjeta">
          <div class="adm-cabeza">
            <h2>Directorio docente</h2>
            <a class="adm-enlace" routerLink="/admin/usuarios">Ver todos <span aria-hidden="true">›</span></a>
          </div>
          <ul class="adm-lista">
            @for (usuario of docentes().slice(0, 8); track usuario.id) {
              <li>
                <a class="adm-fila" [routerLink]="['/admin/usuarios', usuario.id]">
                  <span class="inicio-avatar" aria-hidden="true">{{ iniciales(usuario.nombre) }}</span>
                  <span class="adm-fila-texto"><strong>{{ usuario.nombre }}</strong><small>{{ usuario.email }}</small></span>
                  <span class="adm-pildora azul">{{ etiquetaPermisos(usuario.permisos) }}</span>
                </a>
              </li>
            } @empty { <li class="adm-vacio">Todavía no hay docentes. Crea la primera cuenta.</li> }
          </ul>
        </article>

        <article class="adm-tarjeta">
          <div class="adm-cabeza"><h2>Tareas de administración</h2></div>
          <ul class="adm-lista">
            <li><a class="adm-fila" routerLink="/admin/usuarios/nuevo">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></span>
              <span class="adm-fila-texto"><strong>Crear docente</strong><small>Nueva cuenta con el permiso Visualizar</small></span>
              <span class="adm-flecha" aria-hidden="true">›</span></a></li>
            <li><a class="adm-fila" routerLink="/admin/usuarios">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2"/><path d="m15 11 2 2 3.5-4"/></svg></span>
              <span class="adm-fila-texto"><strong>Asignar permisos</strong><small>Editar casos y gestionar espacios académicos</small></span>
              <span class="adm-flecha" aria-hidden="true">›</span></a></li>
            <li><a class="adm-fila" routerLink="/admin/grupos">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg></span>
              <span class="adm-fila-texto"><strong>Grupos</strong><small>Espacios académicos de todos los docentes</small></span>
              <span class="adm-flecha" aria-hidden="true">›</span></a></li>
            <li><a class="adm-fila" routerLink="/admin/configuracion">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5"/></svg></span>
              <span class="adm-fila-texto"><strong>Configurar</strong><small>Valores generales del sistema</small></span>
              <span class="adm-flecha" aria-hidden="true">›</span></a></li>
          </ul>
        </article>
      </section>
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

type FiltroCuenta = 'todos' | 'docentes' | 'admin' | 'inactivos';

@Component({
  selector: 'app-usuarios',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true"
      descripcion="Crea cuentas y asigna permisos. Los estudiantes los matricula cada docente.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar cuentas">
          @for (f of filtros; track f.id) {
            <button type="button" class="adm-filtro" [class.activo]="filtro() === f.id" [attr.aria-pressed]="filtro() === f.id"
              (click)="filtro.set(f.id)">{{ f.texto }} <span>({{ cuantos(f.id) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar cuenta</span>
            <input type="search" placeholder="Buscar por nombre o correo" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
          </label>
          <label class="adm-orden">
            <span class="solo-lector">Ordenar</span>
            <select [value]="orden()" (change)="orden.set($any($event.target).value)">
              <option value="az">Nombre A–Z</option>
              <option value="za">Nombre Z–A</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
          <a class="adm-boton" routerLink="/admin/usuarios/nuevo"><span aria-hidden="true">+</span> Nuevo usuario</a>
        </div>
      </div>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <div class="adm-rejilla">
        @for (usuario of visibles(); track usuario.id) {
          <article class="adm-tarjeta adm-cuenta">
            <div class="adm-pildoras">
              <span class="adm-pildora" [class.azul]="usuario.rol === 'PROFESOR'" [class.violeta]="usuario.rol !== 'PROFESOR'">{{ usuario.rol === 'PROFESOR' ? 'Docente' : 'Administración' }}</span>
              <span class="adm-pildora" [class.verde]="usuario.activo !== false" [class.gris]="usuario.activo === false">{{ usuario.activo === false ? 'Inactiva' : 'Activa' }}</span>
            </div>
            <h3>{{ usuario.nombre }}</h3>
            <p class="adm-dato">{{ usuario.email }}</p>
            <p class="adm-dato adm-permisos">{{ etiquetaPermisos(usuario.permisos) }}</p>
            <div class="adm-pie">
              @if (usuario.rol === 'PROFESOR') {
                <a class="adm-enlace" [routerLink]="['/admin/usuarios', usuario.id]">Permisos <span aria-hidden="true">›</span></a>
              } @else { <span></span> }
              @if (usuario.id !== yo()) {
                @if (usuario.activo === false) {
                  <button class="adm-enlace" type="button" (click)="activo(usuario.id, true)">Activar</button>
                } @else {
                  <button class="adm-enlace adm-enlace-suave" type="button" (click)="activo(usuario.id, false)">Desactivar</button>
                }
              } @else { <span class="adm-dato">Tu cuenta</span> }
            </div>
          </article>
        } @empty { <p class="adm-vacio">No hay cuentas para mostrar.</p> }
      </div>
    </app-marco-docente>
  `
})
export class UsuariosComponent {
  enlaces = enlaces;
  filtros: { id: FiltroCuenta; texto: string }[] = [
    { id: 'todos', texto: 'Todos' }, { id: 'docentes', texto: 'Docentes' },
    { id: 'admin', texto: 'Administración' }, { id: 'inactivos', texto: 'Inactivos' }
  ];
  filtro = signal<FiltroCuenta>('todos');
  busqueda = signal('');
  orden = signal('az');
  private http = inject(HttpClient);
  private filtroGlobal = inject(BusquedaService);
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
  private pasaFiltro(usuario: Usuario, filtro: FiltroCuenta) {
    if (filtro === 'docentes') return usuario.rol === 'PROFESOR';
    if (filtro === 'admin') return usuario.rol === 'ADMIN';
    if (filtro === 'inactivos') return usuario.activo === false;
    return true;
  }
  cuantos(filtro: FiltroCuenta) { return this.usuarios().filter((usuario) => this.pasaFiltro(usuario, filtro)).length; }
  visibles() {
    const q = (this.busqueda() || this.filtroGlobal.texto()).trim().toLowerCase();
    const lista = this.usuarios().filter((usuario) => this.pasaFiltro(usuario, this.filtro())
      && (!q || usuario.nombre.toLowerCase().includes(q) || usuario.email.toLowerCase().includes(q)));
    const orden = this.orden();
    if (orden === 'recientes') return [...lista].sort((a, b) => b.id - a.id);
    const az = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id);
    return orden === 'za' ? az.reverse() : az;
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
  imports: [MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true"
      descripcion="La cuenta nace con el rol elegido y solo el permiso Visualizar.">
      <article class="adm-tarjeta adm-form">
        <h2>Datos de la cuenta</h2>
        <div class="adm-campos">
          <label class="adm-campo"><span>Nombre completo</span><input [(ngModel)]="nombre" placeholder="Nombre y apellido" /></label>
          <label class="adm-campo"><span>Correo electrónico</span><input [(ngModel)]="email" placeholder="docente@institucion.edu" /></label>
          <label class="adm-campo"><span>Rol</span>
            <select [(ngModel)]="rol">
              <option value="PROFESOR">Docente</option>
              <option value="ADMIN">Administración</option>
            </select>
          </label>
          <label class="adm-campo"><span>Contraseña</span><input [(ngModel)]="clave" type="password" autocomplete="new-password" /></label>
        </div>
        <label class="adm-check">
          <input type="checkbox" disabled [checked]="true" />
          <span>Visualizar queda activo desde el primer ingreso.</span>
        </label>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="adm-form-pie">
          <a class="adm-enlace" routerLink="/admin/usuarios">Cancelar</a>
          <button class="adm-boton" type="button" (click)="crear()">Guardar</button>
        </div>
      </article>
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
  imports: [MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true" [descripcion]="descripcion()">
      <article class="adm-tarjeta adm-form">
        <h2>Permisos{{ nombre() ? ' de ' + nombre() : '' }}</h2>
        <div class="adm-checks">
          <label class="adm-check">
            <input type="checkbox" disabled [checked]="true" />
            <span><strong>Visualizar</strong> queda activo desde el primer ingreso.</span>
          </label>
          <label class="adm-check">
            <input type="checkbox" name="editar" [(ngModel)]="editar" />
            <span><strong>Editar casos</strong>: crear, editar y publicar casos.</span>
          </label>
          <label class="adm-check">
            <input type="checkbox" name="gestionar" [(ngModel)]="gestionar" />
            <span><strong>Gestionar espacios académicos</strong>: crear grupos y matricular estudiantes.</span>
          </label>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="adm-form-pie">
          <a class="adm-enlace" routerLink="/admin/usuarios">Cancelar</a>
          <button class="adm-boton" type="button" (click)="guardar()">Guardar permisos</button>
        </div>
      </article>
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
  descripcion = computed(() => this.nombre()
    ? `Permisos de ${this.nombre()}. Visualizar permanece; Editar permite crear casos y Gestionar espacios, crear grupos.`
    : 'Visualizar permanece. Editar permite crear casos. Gestionar espacios permite crear grupos.');
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
type FiltroGrupo = 'todos' | 'con' | 'sin';

@Component({
  selector: 'app-grupos-admin',
  imports: [MarcoDocenteComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true"
      descripcion="Espacios académicos de todos los docentes y los estudiantes matriculados.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar grupos">
          @for (f of filtros; track f.id) {
            <button type="button" class="adm-filtro" [class.activo]="filtro() === f.id" [attr.aria-pressed]="filtro() === f.id"
              (click)="filtro.set(f.id)">{{ f.texto }} <span>({{ cuantos(f.id) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar grupo</span>
            <input type="search" placeholder="Buscar grupo o docente" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
          </label>
          <label class="adm-orden">
            <span class="solo-lector">Ordenar</span>
            <select [value]="orden()" (change)="orden.set($any($event.target).value)">
              <option value="az">Nombre A–Z</option>
              <option value="estudiantes">Más estudiantes</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
        </div>
      </div>
      <div class="adm-rejilla">
        @for (grupo of visibles(); track grupo.id) {
          <article class="adm-tarjeta adm-grupo">
            <div class="adm-pildoras">
              <span class="adm-pildora azul">{{ grupo.espacioAcademico }}</span>
              <span class="adm-pildora" [class.verde]="grupo.estudiantes.length" [class.gris]="!grupo.estudiantes.length">{{ grupo.estudiantes.length }} {{ grupo.estudiantes.length === 1 ? 'estudiante' : 'estudiantes' }}</span>
            </div>
            <h3>{{ grupo.nombre }}</h3>
            <p class="adm-dato">Docente: {{ grupo.docente.nombre }}</p>
            @if (grupo.estudiantes.length) {
              <details class="adm-detalle">
                <summary>Ver estudiantes</summary>
                <ul>
                  @for (estudiante of grupo.estudiantes; track estudiante.id) {
                    <li><strong>{{ estudiante.nombre }}</strong><small>{{ estudiante.email }}</small></li>
                  }
                </ul>
              </details>
            } @else { <p class="adm-dato">Todavía sin estudiantes.</p> }
          </article>
        } @empty { <p class="adm-vacio">{{ grupos().length ? 'Ningún grupo coincide con la búsqueda.' : 'Todavía no hay grupos.' }}</p> }
      </div>
    </app-marco-docente>
  `
})
export class GruposAdminComponent {
  enlaces = enlaces;
  filtros: { id: FiltroGrupo; texto: string }[] = [
    { id: 'todos', texto: 'Todos' }, { id: 'con', texto: 'Con estudiantes' }, { id: 'sin', texto: 'Sin estudiantes' }
  ];
  filtro = signal<FiltroGrupo>('todos');
  busqueda = signal('');
  orden = signal('az');
  private http = inject(HttpClient);
  grupos = signal<GrupoAdmin[]>([]);
  constructor() {
    this.http.get<GrupoAdmin[]>('/api/admin/grupos').subscribe((dato) => this.grupos.set(dato));
  }
  private pasaFiltro(grupo: GrupoAdmin, filtro: FiltroGrupo) {
    if (filtro === 'con') return grupo.estudiantes.length > 0;
    if (filtro === 'sin') return grupo.estudiantes.length === 0;
    return true;
  }
  cuantos(filtro: FiltroGrupo) { return this.grupos().filter((grupo) => this.pasaFiltro(grupo, filtro)).length; }
  visibles() {
    const q = this.busqueda().trim().toLowerCase();
    const lista = this.grupos().filter((grupo) => this.pasaFiltro(grupo, this.filtro())
      && (!q || grupo.nombre.toLowerCase().includes(q) || grupo.docente.nombre.toLowerCase().includes(q)
        || grupo.espacioAcademico.toLowerCase().includes(q)));
    const orden = this.orden();
    if (orden === 'recientes') return [...lista].sort((a, b) => b.id - a.id);
    if (orden === 'estudiantes') return [...lista].sort((a, b) => b.estudiantes.length - a.estudiantes.length || a.nombre.localeCompare(b.nombre, 'es'));
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id);
  }
}

@Component({
  selector: 'app-configuracion',
  imports: [MarcoDocenteComponent, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [claro]="true"
      descripcion="Valores generales del sistema. Se guardan en este navegador.">
      <article class="adm-tarjeta adm-form">
        <h2>Configuración global</h2>
        <div class="adm-campos">
          <label class="adm-campo"><span>Nombre del sistema</span><input [(ngModel)]="config.nombre" /></label>
          <label class="adm-campo"><span>Correo de soporte</span><input [(ngModel)]="config.soporte" /></label>
          <label class="adm-campo"><span>Zona horaria</span><input [(ngModel)]="config.zona" /></label>
          <label class="adm-campo"><span>Inactividad máxima (min)</span><input type="number" [(ngModel)]="config.inactividad" /></label>
        </div>
        <div class="adm-checks">
          <label class="adm-check">
            <input type="checkbox" name="notificar" [(ngModel)]="config.notificar" />
            <span>Avisos por correo</span>
          </label>
          <label class="adm-check">
            <input type="checkbox" name="docentePublica" [(ngModel)]="config.docentePublica" />
            <span>El docente puede publicar sin aprobación previa</span>
          </label>
        </div>
        @if (ok()) { <p class="ok">{{ ok() }}</p> }
        <div class="adm-form-pie">
          <button class="adm-boton" type="button" (click)="guardar()">Guardar configuración</button>
        </div>
      </article>
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
    <!-- El docente sigue con el estilo anterior hasta que se apruebe el rediseño; el administrador usa el claro. -->
    <app-marco-docente [enlaces]="menu()" [inicio]="inicio()" [claro]="esAdmin()" descripcion="Tus datos de cuenta.">
      @if (esAdmin()) {
        <article class="adm-tarjeta adm-perfil">
          <span class="inicio-avatar adm-avatar-grande" aria-hidden="true">{{ iniciales() }}</span>
          <div>
            <h2>{{ auth.usuario()?.nombre }}</h2>
            <p class="adm-dato">{{ auth.usuario()?.email }}</p>
            <span class="adm-pildora violeta">{{ etiquetaRol() }}</span>
          </div>
        </article>
      } @else {
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
      }
    </app-marco-docente>
  `
})
export class PerfilComponent {
  auth = inject(AuthService);
  esAdmin = computed(() => this.auth.rol() === 'ADMIN');
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
