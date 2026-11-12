import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/api.service';

@Component({
  selector: 'app-ingreso',
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <div class="login-marca">
        <img src="marca-dilema.png" alt="DILEMA" />
        <p>Simulador de psicología social</p>
      </div>

      @if (modo() === 'elegir') {
        <div class="ingreso-opciones">
          <button class="tarjeta acceso" type="button" (click)="modo.set('estudiante')">
            <h2>Estudiante</h2>
            <p class="sub">Correo institucional y código de la sesión.</p>
          </button>
          <button class="tarjeta acceso" type="button" (click)="modo.set('cuenta')">
            <h2>Docente o administración</h2>
            <p class="sub">Correo y contraseña.</p>
          </button>
        </div>
        <div class="rellenos">
          <p class="sub">Rellenar datos de demostración</p>
          <button class="btn-demo" type="button" (click)="rellenarEstudiante()">Estudiante</button>
          <button class="btn-demo" type="button" (click)="rellenarDocente()">Docente</button>
          <button class="btn-demo" type="button" (click)="rellenarAdmin()">Administración</button>
        </div>
      } @else if (modo() === 'estudiante') {
        <article class="tarjeta stack login-form">
          <button class="volver" type="button" (click)="volver()">Volver</button>
          <h2>Estudiante</h2>
          <p class="sub">Correo institucional y código de la sesión.</p>
          <label class="field"><span>Correo institucional</span><input [(ngModel)]="correoEstudiante" autocomplete="username" /></label>
          <label class="field"><span>Código de la sesión</span><input [(ngModel)]="codigo" autocomplete="off" /></label>
          @if (errorEstudiante()) { <p class="error">{{ errorEstudiante() }}</p> }
          <button class="btn-demo" type="button" (click)="rellenarEstudiante()">Rellenar estudiante</button>
          <button class="btn-oscuro" type="button" (click)="entrarEstudiante()">Entrar con código</button>
        </article>
      } @else {
        <article class="tarjeta stack login-form">
          <button class="volver" type="button" (click)="volver()">Volver</button>
          <h2>Docente o administración</h2>
          <p class="sub">Correo y contraseña.</p>
          <label class="field"><span>Correo</span><input [(ngModel)]="correoCuenta" autocomplete="username" /></label>
          <label class="field"><span>Contraseña</span><input [(ngModel)]="clave" type="password" autocomplete="current-password" /></label>
          @if (errorCuenta()) { <p class="error">{{ errorCuenta() }}</p> }
          <div class="rellenos">
            <button class="btn-demo" type="button" (click)="rellenarDocente()">Rellenar docente</button>
            <button class="btn-demo" type="button" (click)="rellenarAdmin()">Rellenar administración</button>
          </div>
          <button class="btn-oscuro" type="button" (click)="entrarCuenta()">Entrar con contraseña</button>
        </article>
      }
    </div>
  `
})
export class IngresoComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  modo = signal<'elegir' | 'estudiante' | 'cuenta'>('elegir');
  correoEstudiante = '';
  codigo = '';
  correoCuenta = '';
  clave = '';
  errorEstudiante = signal('');
  errorCuenta = signal('');

  rellenarEstudiante() {
    this.modo.set('estudiante');
    this.correoEstudiante = 'estudiante@psicosim.edu';
    this.codigo = 'DILEMA-2026';
    this.errorEstudiante.set('');
  }

  rellenarDocente() {
    this.modo.set('cuenta');
    this.correoCuenta = 'docente@psicosim.edu';
    this.clave = 'docente123';
    this.errorCuenta.set('');
  }

  rellenarAdmin() {
    this.modo.set('cuenta');
    this.correoCuenta = 'admin@psicosim.edu';
    this.clave = 'admin123';
    this.errorCuenta.set('');
  }

  volver() {
    this.modo.set('elegir');
    this.errorEstudiante.set('');
    this.errorCuenta.set('');
  }

  entrarEstudiante() {
    this.errorEstudiante.set('');
    this.auth.ingresarEstudiante(this.correoEstudiante.trim(), this.codigo.trim()).subscribe({
      next: (sesion) => this.router.navigateByUrl(this.destino(sesion.usuario.rol)),
      error: (falla) => this.errorEstudiante.set(mensajeError(falla))
    });
  }

  entrarCuenta() {
    this.errorCuenta.set('');
    this.auth.ingresarCuenta(this.correoCuenta.trim(), this.clave).subscribe({
      next: (sesion) => this.router.navigateByUrl(this.destino(sesion.usuario.rol)),
      error: (falla) => this.errorCuenta.set(mensajeError(falla))
    });
  }

  private destino(rol: string) {
    if (rol === 'ESTUDIANTE') return '/estudiante';
    if (rol === 'PROFESOR') return '/docente/casos';
    return '/admin/usuarios';
  }
}
