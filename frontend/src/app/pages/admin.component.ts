import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MarcoComponent } from '../shared/marco.component';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { Usuario, mensajeError } from '../core/api.service';

const enlaces = [
  { href: '/admin', texto: 'Inicio', exacto: true },
  { href: '/admin/usuarios', texto: 'Docentes', exacto: true },
  { href: '/admin/usuarios/nuevo', texto: 'Nuevo docente', exacto: true },
  { href: '/admin/configuracion', texto: 'Configuración global', exacto: true }
];

const material = [MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule];

@Component({
  selector: 'app-panel-admin',
  imports: [MarcoComponent, RouterLink],
  template: `
    <app-marco [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Hola, {{ nombre() }}</h1>
          <p>Docentes del sistema y sus permisos.</p>
        </header>
        <div class="atajos">
          <a class="atajo oscuro" routerLink="/admin/usuarios">Docentes</a>
          <a class="atajo" routerLink="/admin/usuarios/nuevo">Nuevo docente</a>
          <a class="atajo" routerLink="/admin/configuracion">Configuración</a>
        </div>
        <div class="tablero-abajo">
          <article class="tarjeta">
            <h2>Docentes</h2>
            <p class="nota-grande">{{ docentes().length }}</p>
            <p class="sub">Cuentas con rol docente. Nacen solo con Visualizar.</p>
          </article>
          <article class="tarjeta">
            <div class="tarjeta-cabeza">
              <h2>Recientes</h2>
              <a class="ver-todos" routerLink="/admin/usuarios">Ver todos</a>
            </div>
            <div class="stack">
              @for (usuario of docentes().slice(0, 4); track usuario.id) {
                <a class="fila-lista" [routerLink]="['/admin/usuarios', usuario.id]">
                  <span class="punto"></span>
                  <div>
                    <strong>{{ usuario.nombre }}</strong>
                    <p class="sub">{{ usuario.permisos.join(', ') || 'Sin permisos' }}</p>
                  </div>
                </a>
              } @empty { <p class="sub">Todavía no hay docentes.</p> }
            </div>
          </article>
        </div>
      </section>
    </app-marco>
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
}

@Component({
  selector: 'app-usuarios',
  imports: [MarcoComponent, RouterLink, ...material],
  template: `
    <app-marco [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Docentes</h1>
          <p>El administrador crea docentes y asigna permisos. Los estudiantes los matricula el docente.</p>
        </header>
      <article class="tarjeta stack">
          @for (usuario of visibles(); track usuario.id) {
            <article class="item">
              <h3>{{ usuario.nombre }}</h3>
              <p class="sub">{{ usuario.email }} · {{ usuario.rol === 'PROFESOR' ? 'Docente' : 'Administración' }}</p>
              <p class="sub">{{ usuario.permisos.join(', ') || 'Sin permisos' }}</p>
              @if (usuario.rol === 'PROFESOR') {
                <a mat-stroked-button [routerLink]="['/admin/usuarios', usuario.id]">Permisos</a>
              }
            </article>
          } @empty { <p class="sub">No hay cuentas para mostrar.</p> }
      </article>
      </section>
    </app-marco>
  `
})
export class UsuariosComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private filtro = inject(BusquedaService);
  usuarios = signal<Usuario[]>([]);
  constructor() {
    this.http.get<Usuario[]>('/api/admin/usuarios').subscribe((dato) => this.usuarios.set(dato));
  }
  visibles() {
    const q = this.filtro.texto().trim().toLowerCase();
    return this.usuarios().filter((usuario) => !q || usuario.nombre.toLowerCase().includes(q) || usuario.email.toLowerCase().includes(q));
  }
}

@Component({
  selector: 'app-crear-usuario',
  imports: [MarcoComponent, FormsModule, ...material],
  template: `
    <app-marco [enlaces]="enlaces">
      <header class="saludo"><h1>Nuevo docente</h1><p>Nace con el rol docente y solo el permiso Visualizar.</p></header>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Nuevo docente</mat-card-title>
          <mat-card-subtitle>Nace con el rol docente y solo el permiso Visualizar.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="stack">
          <mat-form-field appearance="outline">
            <mat-label>Nombre completo</mat-label>
            <input matInput [(ngModel)]="nombre" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Correo electrónico</mat-label>
            <input matInput [(ngModel)]="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rol</mat-label>
            <mat-select [(ngModel)]="rol">
              <mat-option value="PROFESOR">Docente</mat-option>
              <mat-option value="ADMIN">Administración</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-checkbox disabled [checked]="true">Visualizar</mat-checkbox>
          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput [(ngModel)]="clave" type="password" autocomplete="new-password" />
          </mat-form-field>
          @if (error()) { <p class="error">{{ error() }}</p> }
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" type="button" (click)="crear()">Guardar</button>
        </mat-card-actions>
      </mat-card>
    </app-marco>
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
  imports: [MarcoComponent, FormsModule, ...material],
  template: `
    <app-marco [enlaces]="enlaces">
      <header class="saludo"><h1>Permisos</h1><p>Visualizar permanece. Editar y gestionar espacios se asignan aquí.</p></header>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Permisos de {{ nombre() }}</mat-card-title>
          <mat-card-subtitle>Visualizar permanece. Editar permite crear casos. Gestionar espacios permite crear grupos.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="stack">
          <mat-checkbox disabled [checked]="true">Visualizar</mat-checkbox>
          <mat-checkbox [(ngModel)]="editar">Editar casos</mat-checkbox>
          <mat-checkbox [(ngModel)]="gestionar">Gestionar espacios académicos</mat-checkbox>
          @if (error()) { <p class="error">{{ error() }}</p> }
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" type="button" (click)="guardar()">Guardar permisos</button>
        </mat-card-actions>
      </mat-card>
    </app-marco>
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

@Component({
  selector: 'app-configuracion',
  imports: [MarcoComponent, FormsModule, ...material],
  template: `
    <app-marco [enlaces]="enlaces">
      <header class="saludo"><h1>Configuración</h1><p>Estos valores se guardan en este navegador.</p></header>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Parámetros generales</mat-card-title>
          <mat-card-subtitle>Configuración de este navegador</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="stack">
          <mat-form-field appearance="outline"><mat-label>Nombre del sistema</mat-label><input matInput [(ngModel)]="config.nombre" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Correo de soporte</mat-label><input matInput [(ngModel)]="config.soporte" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Zona horaria</mat-label><input matInput [(ngModel)]="config.zona" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Inactividad máxima (minutos)</mat-label><input matInput type="number" [(ngModel)]="config.inactividad" /></mat-form-field>
          <mat-checkbox [(ngModel)]="config.notificar">Habilitar notificaciones por correo</mat-checkbox>
          <mat-checkbox [(ngModel)]="config.docentePublica">Permitir que el docente publique sin aprobación previa</mat-checkbox>
          @if (ok()) { <p class="ok">{{ ok() }}</p> }
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" type="button" (click)="guardar()">Guardar configuración</button>
        </mat-card-actions>
      </mat-card>
    </app-marco>
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
