import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { FILAS_POR_PAGINA, PaginacionTablaComponent } from '../shared/paginacion-tabla.component';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { Usuario, mensajeError } from '../core/api.service';

const enlaces = [
  { href: '/admin', texto: 'Inicio', exacto: true },
  { href: '/admin/usuarios', texto: 'Docentes', exacto: true },
  { href: '/admin/estudiantes', texto: 'Estudiantes', exacto: true },
  { href: '/admin/grupos', texto: 'Grupos', exacto: true },
  { href: '/admin/perfil', texto: 'Perfil' }
];

/** Filas por página en las tablas de Docentes y Grupos. */
const POR_PAGINA = FILAS_POR_PAGINA;

function inicialesDe(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'D';
}

@Component({
  selector: 'app-panel-admin',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="Gestiona docentes, estudiantes, permisos y los grupos del sistema.">
      <section class="adm-kpis" aria-label="Resumen">
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg></span>
          <div><small>Docentes</small><strong>{{ docentes().length }}</strong><span>cuentas con rol docente</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18z"/><path d="m13.5 7.5 3 3"/></svg></span>
          <div><small>Pueden editar</small><strong>{{ conEditar() }}</strong><span>crean y publican casos</span></div>
        </article>
        <article class="adm-tarjeta adm-kpi">
          <span class="adm-kpi-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H4z"/></svg></span>
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
            @for (usuario of directorio(); track usuario.id) {
              <li>
                <a class="adm-fila" [routerLink]="['/admin/usuarios', usuario.id]">
                  <span class="adm-iniciales" aria-hidden="true">{{ iniciales(usuario.nombre) }}</span>
                  <span class="adm-fila-texto"><strong>{{ usuario.nombre }}</strong><small>{{ usuario.email }}</small></span>
                  <span class="adm-fila-dato">{{ etiquetaPermisos(usuario.permisos) }}</span>
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
            <li><a class="adm-fila" routerLink="/admin/estudiantes">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M6 19c.8-3.2 3-5 6-5s5.2 1.8 6 5"/></svg></span>
              <span class="adm-fila-texto"><strong>Estudiantes</strong><small>Dar de alta la cuenta y activarla o desactivarla</small></span>
              <span class="adm-flecha" aria-hidden="true">›</span></a></li>
            <li><a class="adm-fila" routerLink="/admin/grupos">
              <span class="adm-tarea-icono" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg></span>
              <span class="adm-fila-texto"><strong>Grupos</strong><small>Espacios académicos de todos los docentes</small></span>
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
  /** Primeros 5 docentes en orden alfabético. */
  directorio() { return [...this.docentes()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id).slice(0, 5); }
  admins() { return this.usuarios().filter((usuario) => usuario.rol === 'ADMIN'); }
  conEditar() { return this.docentes().filter((usuario) => usuario.permisos.includes('EDITAR')).length; }
  conEspacios() { return this.docentes().filter((usuario) => usuario.permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')).length; }
  iniciales(nombre: string) { return inicialesDe(nombre); }
  etiquetaPermisos(permisos: string[]) {
    if (permisos.includes('EDITAR')) return 'Edita casos';
    if (permisos.includes('GESTIONAR_ESPACIOS_ACADEMICOS')) return 'Gestiona espacios';
    return 'Solo visualizar';
  }
}

type FiltroCuenta = 'todos' | 'docentes' | 'admin' | 'inactivos';

@Component({
  selector: 'app-usuarios',
  imports: [MarcoDocenteComponent, RouterLink, PaginacionTablaComponent],
  host: { '(document:click)': 'menu.set(null)', '(document:keydown.escape)': 'menu.set(null)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="Crea cuentas y asigna permisos. Las cuentas de estudiante se dan de alta en Estudiantes.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar cuentas">
          @for (f of filtros; track f.id) {
            <button type="button" class="adm-filtro" [class.activo]="filtro() === f.id" [attr.aria-pressed]="filtro() === f.id"
              (click)="elegirFiltro(f.id)">{{ f.texto }} <span>({{ cuantos(f.id) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar cuenta</span>
            <input type="search" placeholder="Buscar por nombre o correo" [value]="busqueda()" (input)="buscar($any($event.target).value)" />
          </label>
          <label class="adm-orden">
            <span class="solo-lector">Ordenar</span>
            <select [value]="orden()" (change)="ordenar($any($event.target).value)">
              <option value="az">Nombre A–Z</option>
              <option value="za">Nombre Z–A</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
          <a class="adm-boton" routerLink="/admin/usuarios/nuevo"><span aria-hidden="true">+</span> Nuevo docente</a>
        </div>
      </div>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <article class="adm-tarjeta adm-tabla-tarjeta">
        <div class="adm-tabla-caja">
          <table class="adm-tabla">
            <thead>
              <tr><th scope="col">Cuenta</th><th scope="col">Rol</th><th scope="col">Permisos</th><th scope="col">Estado</th><th scope="col" class="derecha">Acciones</th></tr>
            </thead>
            <tbody>
              @for (usuario of filas(); track usuario.id) {
                <tr>
                  <td>
                    <div class="adm-cuenta-celda">
                      <span class="adm-iniciales" aria-hidden="true">{{ iniciales(usuario.nombre) }}</span>
                      <div class="adm-celda-doble"><strong>{{ usuario.nombre }}</strong><small>{{ usuario.email }}</small></div>
                    </div>
                  </td>
                  <td>{{ usuario.rol === 'PROFESOR' ? 'Docente' : 'Administración' }}</td>
                  <td class="gris">{{ etiquetaPermisos(usuario.permisos) }}</td>
                  <td><span class="adm-estado" [class.inactiva]="usuario.activo === false"><i aria-hidden="true"></i>{{ usuario.activo === false ? 'Inactiva' : 'Activa' }}</span></td>
                  <td class="derecha">
                    @if (usuario.id === yo()) {
                      <span class="gris">Tu cuenta</span>
                    } @else {
                      <div class="adm-acciones-celda">
                        @if (usuario.rol === 'PROFESOR') {
                          <a class="adm-enlace" [routerLink]="['/admin/usuarios', usuario.id]">Permisos <span aria-hidden="true">›</span></a>
                        }
                        <div class="adm-menu">
                          <button type="button" class="adm-mas" aria-haspopup="menu" [attr.aria-expanded]="menu() === usuario.id"
                            [attr.aria-label]="'Más acciones para ' + usuario.nombre" (click)="alternarMenu(usuario.id, $event)">⋯</button>
                          @if (menu() === usuario.id) {
                            <div class="adm-menu-lista" role="menu">
                              <button type="button" role="menuitem" (click)="activo(usuario.id, usuario.activo === false)">
                                {{ usuario.activo === false ? 'Activar' : 'Desactivar' }}</button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="5" class="adm-vacio">No hay cuentas para mostrar.</td></tr> }
            </tbody>
          </table>
        </div>
        @if (lista().length) {
          <app-paginacion-tabla [total]="lista().length" [pagina]="paginaActual()" (cambiar)="pagina.set($event)" />
        }
      </article>
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
  pagina = signal(1);
  /** Cuenta cuyo menú "⋯" está abierto. */
  menu = signal<number | null>(null);
  private http = inject(HttpClient);
  private filtroGlobal = inject(BusquedaService);
  private auth = inject(AuthService);
  usuarios = signal<Usuario[]>([]);
  error = signal('');
  /** Filtro, búsqueda y orden sobre TODA la lista; la página solo corta lo que se muestra. */
  lista = computed(() => {
    const q = (this.busqueda() || this.filtroGlobal.texto()).trim().toLowerCase();
    const filtrada = this.usuarios().filter((usuario) => this.pasaFiltro(usuario, this.filtro())
      && (!q || usuario.nombre.toLowerCase().includes(q) || usuario.email.toLowerCase().includes(q)));
    const orden = this.orden();
    if (orden === 'recientes') return [...filtrada].sort((a, b) => b.id - a.id);
    const az = [...filtrada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id);
    return orden === 'za' ? az.reverse() : az;
  });
  paginaActual = computed(() => Math.min(this.pagina(), Math.max(1, Math.ceil(this.lista().length / POR_PAGINA))));
  filas = computed(() => this.lista().slice((this.paginaActual() - 1) * POR_PAGINA, this.paginaActual() * POR_PAGINA));
  constructor() {
    this.cargar();
  }
  yo() { return this.auth.usuario()?.id; }
  iniciales(nombre: string) { return inicialesDe(nombre); }
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
  elegirFiltro(filtro: FiltroCuenta) { this.filtro.set(filtro); this.pagina.set(1); }
  buscar(texto: string) { this.busqueda.set(texto); this.pagina.set(1); }
  ordenar(orden: string) { this.orden.set(orden); this.pagina.set(1); }
  alternarMenu(id: number, evento: Event) {
    evento.stopPropagation();
    this.menu.set(this.menu() === id ? null : id);
  }
  activo(id: number, activo: boolean) {
    this.menu.set(null);
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
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="La cuenta nace con el rol elegido y solo el permiso Visualizar.">
      <a class="adm-volver" routerLink="/admin/usuarios"><span aria-hidden="true">‹</span> Volver a docentes</a>
      <div class="adm-ficha">
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
            <a class="adm-boton-contorno" routerLink="/admin/usuarios">Cancelar</a>
            <button class="adm-boton" type="button" (click)="crear()">Guardar</button>
          </div>
        </article>
        <aside class="adm-tarjeta adm-pasos">
          <h2>Después de crearla</h2>
          <ol>
            <li><span class="adm-paso-numero" aria-hidden="true">1</span><p>La persona ingresa con el correo y la contraseña.</p></li>
            <li><span class="adm-paso-numero" aria-hidden="true">2</span><p>Asigna permisos desde <strong>Docentes › Permisos</strong>: Visualizar, Editar casos y Gestionar espacios.</p></li>
            <li><span class="adm-paso-numero" aria-hidden="true">3</span><p>Da de alta a los estudiantes y el docente los asigna a su grupo.</p></li>
          </ol>
        </aside>
      </div>
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
    <app-marco-docente [enlaces]="enlaces" inicio="/admin" [descripcion]="descripcion()">
      <a class="adm-volver" routerLink="/admin/usuarios"><span aria-hidden="true">‹</span> Volver a docentes</a>
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
            <span><strong>Gestionar espacios académicos</strong>: crear grupos y asignar estudiantes.</span>
          </label>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="adm-form-pie">
          <a class="adm-boton-contorno" routerLink="/admin/usuarios">Cancelar</a>
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

type FiltroEstudiante = 'todos' | 'activos' | 'inactivos';

@Component({
  selector: 'app-estudiantes',
  imports: [MarcoDocenteComponent, RouterLink, PaginacionTablaComponent],
  host: { '(document:click)': 'menu.set(null)', '(document:keydown.escape)': 'menu.set(null)' },
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="Da de alta la cuenta. El docente con permiso de espacios la asigna a un grupo.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar por estado">
          @for (f of filtros; track f.id) {
            <button type="button" class="adm-filtro" [class.activo]="filtro() === f.id" [attr.aria-pressed]="filtro() === f.id"
              (click)="elegirFiltro(f.id)">{{ f.texto }} <span>({{ cuantos(f.id) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar estudiante</span>
            <input type="search" placeholder="Buscar por nombre o correo" [value]="busqueda()" (input)="buscar($any($event.target).value)" />
          </label>
          <a class="adm-boton" routerLink="/admin/estudiantes/nuevo"><span aria-hidden="true">+</span> Nuevo estudiante</a>
        </div>
      </div>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <article class="adm-tarjeta adm-tabla-tarjeta">
        <div class="adm-tabla-caja">
          <table class="adm-tabla">
            <thead>
              <tr><th scope="col">Estudiante</th><th scope="col">Estado</th><th scope="col" class="derecha">Acciones</th></tr>
            </thead>
            <tbody>
              @for (estudiante of filas(); track estudiante.id) {
                <tr>
                  <td>
                    <div class="adm-cuenta-celda">
                      <span class="adm-iniciales" aria-hidden="true">{{ iniciales(estudiante.nombre) }}</span>
                      <div class="adm-celda-doble"><strong>{{ estudiante.nombre }}</strong><small>{{ estudiante.email }}</small></div>
                    </div>
                  </td>
                  <td><span class="adm-estado" [class.inactiva]="estudiante.activo === false"><i aria-hidden="true"></i>{{ estudiante.activo === false ? 'Inactiva' : 'Activa' }}</span></td>
                  <td class="derecha">
                    <div class="adm-menu">
                      <button type="button" class="adm-mas" aria-haspopup="menu" [attr.aria-expanded]="menu() === estudiante.id"
                        [attr.aria-label]="'Cambiar estado de ' + estudiante.nombre" (click)="alternarMenu(estudiante.id, $event)">⋯</button>
                      @if (menu() === estudiante.id) {
                        <div class="adm-menu-lista" role="menu">
                          <button type="button" role="menuitem" (click)="activo(estudiante.id, estudiante.activo === false)">
                            {{ estudiante.activo === false ? 'Activar' : 'Desactivar' }}</button>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td colspan="3" class="adm-vacio">{{ vacio() }}</td></tr> }
            </tbody>
          </table>
        </div>
        @if (lista().length) {
          <app-paginacion-tabla [total]="lista().length" [pagina]="paginaActual()" (cambiar)="pagina.set($event)" />
        }
      </article>
    </app-marco-docente>
  `
})
export class EstudiantesComponent {
  enlaces = enlaces;
  filtros: { id: FiltroEstudiante; texto: string }[] = [
    { id: 'todos', texto: 'Todos' },
    { id: 'activos', texto: 'Solo activos' },
    { id: 'inactivos', texto: 'Solo inactivos' }
  ];
  filtro = signal<FiltroEstudiante>('todos');
  busqueda = signal('');
  pagina = signal(1);
  menu = signal<number | null>(null);
  private http = inject(HttpClient);
  private filtroGlobal = inject(BusquedaService);
  estudiantes = signal<Usuario[]>([]);
  error = signal('');
  lista = computed(() => {
    const estado = this.filtro();
    const q = (this.busqueda() || this.filtroGlobal.texto()).trim().toLowerCase();
    return this.estudiantes().filter((estudiante) => {
      const coincide = !q || estudiante.nombre.toLowerCase().includes(q) || estudiante.email.toLowerCase().includes(q);
      const activo = estudiante.activo !== false;
      return coincide && (estado === 'todos' || (estado === 'activos' ? activo : !activo));
    });
  });
  paginaActual = computed(() => Math.min(this.pagina(), Math.max(1, Math.ceil(this.lista().length / POR_PAGINA))));
  filas = computed(() => this.lista().slice((this.paginaActual() - 1) * POR_PAGINA, this.paginaActual() * POR_PAGINA));
  constructor() { this.cargar(); }
  iniciales(nombre: string) { return inicialesDe(nombre); }
  private pasa(estudiante: Usuario, filtro: FiltroEstudiante) {
    const activo = estudiante.activo !== false;
    if (filtro === 'activos') return activo;
    if (filtro === 'inactivos') return !activo;
    return true;
  }
  cuantos(filtro: FiltroEstudiante) { return this.estudiantes().filter((estudiante) => this.pasa(estudiante, filtro)).length; }
  elegirFiltro(filtro: FiltroEstudiante) { this.filtro.set(filtro); this.pagina.set(1); }
  buscar(texto: string) { this.busqueda.set(texto); this.pagina.set(1); }
  alternarMenu(id: number, evento: Event) {
    evento.stopPropagation();
    this.menu.set(this.menu() === id ? null : id);
  }
  vacio() {
    if (this.estudiantes().length === 0) return 'Todavía no hay estudiantes. Da de alta la primera cuenta.';
    return 'No hay estudiantes en este estado.';
  }
  activo(id: number, activo: boolean) {
    this.menu.set(null);
    this.http.post<Usuario>(`/api/admin/usuarios/${id}/activo`, { activo }).subscribe({
      next: (cuenta) => this.estudiantes.update((lista) => lista.map((estudiante) => estudiante.id === cuenta.id ? cuenta : estudiante)),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private cargar() {
    this.http.get<Usuario[]>('/api/admin/estudiantes').subscribe({
      next: (dato) => this.estudiantes.set(dato),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}

@Component({
  selector: 'app-crear-estudiante',
  imports: [MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="Nace sin contraseña. Entra con el código de la sesión que programe el docente.">
      <a class="adm-volver" routerLink="/admin/estudiantes"><span aria-hidden="true">‹</span> Volver a estudiantes</a>
      <article class="adm-tarjeta adm-form">
        <h2>Datos del estudiante</h2>
        <div class="adm-campos">
          <label class="adm-campo"><span>Nombre completo</span><input [(ngModel)]="nombre" placeholder="Nombre y apellido" /></label>
          <label class="adm-campo"><span>Correo electrónico</span><input [(ngModel)]="email" placeholder="estudiante@institucion.edu" /></label>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="adm-form-pie">
          <a class="adm-boton-contorno" routerLink="/admin/estudiantes">Cancelar</a>
          <button class="adm-boton" type="button" (click)="crear()">Guardar</button>
        </div>
      </article>
    </app-marco-docente>
  `
})
export class CrearEstudianteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private router = inject(Router);
  nombre = '';
  email = '';
  error = signal('');
  crear() {
    this.http.post('/api/admin/estudiantes', { nombre: this.nombre, email: this.email }).subscribe({
      next: () => this.router.navigateByUrl('/admin/estudiantes'),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}

interface PersonaAdmin { id: number; nombre: string; email: string; }
interface GrupoAdmin { id: number; nombre: string; espacioAcademico: string; docente: PersonaAdmin; estudiantes: PersonaAdmin[]; }
type FiltroGrupo = 'todos' | 'con' | 'sin';

@Component({
  selector: 'app-grupos-admin',
  imports: [MarcoDocenteComponent, PaginacionTablaComponent],
  template: `
    <app-marco-docente [enlaces]="enlaces" inicio="/admin"
      descripcion="Espacios académicos de todos los docentes y los estudiantes matriculados.">
      <div class="adm-herramientas">
        <div class="adm-filtros" role="group" aria-label="Filtrar grupos">
          @for (f of filtros; track f.id) {
            <button type="button" class="adm-filtro" [class.activo]="filtro() === f.id" [attr.aria-pressed]="filtro() === f.id"
              (click)="elegirFiltro(f.id)">{{ f.texto }} <span>({{ cuantos(f.id) }})</span></button>
          }
        </div>
        <div class="adm-barra">
          <label class="adm-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
            <span class="solo-lector">Buscar grupo</span>
            <input type="search" placeholder="Buscar grupo o docente" [value]="busqueda()" (input)="buscar($any($event.target).value)" />
          </label>
          <label class="adm-orden">
            <span class="solo-lector">Ordenar</span>
            <select [value]="orden()" (change)="ordenar($any($event.target).value)">
              <option value="az">Nombre A–Z</option>
              <option value="estudiantes">Más estudiantes</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
        </div>
      </div>
      <article class="adm-tarjeta adm-tabla-tarjeta">
        <div class="adm-tabla-caja">
          <table class="adm-tabla">
            <thead>
              <tr><th scope="col">Grupo</th><th scope="col">Docente</th><th scope="col">Estudiantes</th><th scope="col" class="derecha">Acciones</th></tr>
            </thead>
            <tbody>
              @for (grupo of filas(); track grupo.id) {
                <tr>
                  <td><div class="adm-celda-doble"><strong>{{ grupo.nombre }}</strong><small>{{ grupo.espacioAcademico }}</small></div></td>
                  <td>{{ grupo.docente.nombre }}</td>
                  <td>{{ grupo.estudiantes.length }}</td>
                  <td class="derecha">
                    @if (grupo.estudiantes.length) {
                      <button type="button" class="adm-enlace" [attr.aria-expanded]="abierto() === grupo.id" (click)="alternar(grupo.id)">
                        {{ abierto() === grupo.id ? 'Ocultar estudiantes' : 'Ver estudiantes' }} <span aria-hidden="true">{{ abierto() === grupo.id ? '⌄' : '›' }}</span></button>
                    } @else { <span class="gris">Sin estudiantes</span> }
                  </td>
                </tr>
                @if (abierto() === grupo.id) {
                  <tr class="adm-fila-detalle">
                    <td colspan="4">
                      <ul>
                        @for (estudiante of grupo.estudiantes; track estudiante.id) {
                          <li><span class="adm-iniciales" aria-hidden="true">{{ iniciales(estudiante.nombre) }}</span>
                            <span class="adm-celda-doble"><strong>{{ estudiante.nombre }}</strong><small>{{ estudiante.email }}</small></span></li>
                        }
                      </ul>
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="4" class="adm-vacio">{{ grupos().length ? 'Ningún grupo coincide con la búsqueda.' : 'Todavía no hay grupos.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (lista().length) {
          <app-paginacion-tabla [total]="lista().length" [pagina]="paginaActual()" (cambiar)="irPagina($event)" />
        }
      </article>
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
  pagina = signal(1);
  /** Grupo con la lista de estudiantes desplegada. */
  abierto = signal<number | null>(null);
  private http = inject(HttpClient);
  grupos = signal<GrupoAdmin[]>([]);
  /** Filtro, búsqueda y orden sobre TODA la lista; la página solo corta lo que se muestra. */
  lista = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const filtrada = this.grupos().filter((grupo) => this.pasaFiltro(grupo, this.filtro())
      && (!q || grupo.nombre.toLowerCase().includes(q) || grupo.docente.nombre.toLowerCase().includes(q)
        || grupo.espacioAcademico.toLowerCase().includes(q)));
    const orden = this.orden();
    if (orden === 'recientes') return [...filtrada].sort((a, b) => b.id - a.id);
    if (orden === 'estudiantes') return [...filtrada].sort((a, b) => b.estudiantes.length - a.estudiantes.length || a.nombre.localeCompare(b.nombre, 'es'));
    return [...filtrada].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id);
  });
  paginaActual = computed(() => Math.min(this.pagina(), Math.max(1, Math.ceil(this.lista().length / POR_PAGINA))));
  filas = computed(() => this.lista().slice((this.paginaActual() - 1) * POR_PAGINA, this.paginaActual() * POR_PAGINA));
  constructor() {
    this.http.get<GrupoAdmin[]>('/api/admin/grupos').subscribe((dato) => this.grupos.set(dato));
  }
  iniciales(nombre: string) { return inicialesDe(nombre); }
  private pasaFiltro(grupo: GrupoAdmin, filtro: FiltroGrupo) {
    if (filtro === 'con') return grupo.estudiantes.length > 0;
    if (filtro === 'sin') return grupo.estudiantes.length === 0;
    return true;
  }
  cuantos(filtro: FiltroGrupo) { return this.grupos().filter((grupo) => this.pasaFiltro(grupo, filtro)).length; }
  elegirFiltro(filtro: FiltroGrupo) { this.filtro.set(filtro); this.irPagina(1); }
  buscar(texto: string) { this.busqueda.set(texto); this.irPagina(1); }
  ordenar(orden: string) { this.orden.set(orden); this.irPagina(1); }
  irPagina(n: number) { this.pagina.set(n); this.abierto.set(null); }
  alternar(id: number) { this.abierto.set(this.abierto() === id ? null : id); }
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
    <app-marco-docente [enlaces]="menu()" [inicio]="inicio()" descripcion="Tus datos de cuenta.">
      <article class="adm-tarjeta adm-perfil">
        <span class="adm-iniciales adm-iniciales-grande" aria-hidden="true">{{ iniciales() }}</span>
        <div>
          <h2>{{ auth.usuario()?.nombre }}</h2>
          <p class="adm-dato">{{ auth.usuario()?.email }}</p>
          <p class="adm-dato">{{ etiquetaRol() }}</p>
        </div>
      </article>
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
  iniciales() { return inicialesDe(this.auth.usuario()?.nombre ?? ''); }
}
