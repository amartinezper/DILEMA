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
      <header class="login-barra">
        <span class="monograma">D</span>
        <span class="marca-texto"><strong>DILEMA</strong><small>Psicología social</small></span>
      </header>
      <main class="login-wrap ingreso-dos">
        <article class="tarjeta stack">
          <h2>Estudiante</h2>
          <p class="sub">Correo institucional y código de la sesión.</p>
          <label class="field"><span>Correo institucional</span><input [(ngModel)]="correoEstudiante" autocomplete="username" /></label>
          <label class="field"><span>Código de la sesión</span><input [(ngModel)]="codigo" autocomplete="off" /></label>
          @if (errorEstudiante()) { <p class="error">{{ errorEstudiante() }}</p> }
          <button class="btn-oscuro" type="button" (click)="entrarEstudiante()">Entrar con código</button>
        </article>
        <article class="tarjeta stack">
          <h2>Docente o administrador</h2>
          <p class="sub">Correo y contraseña.</p>
          <label class="field"><span>Correo</span><input [(ngModel)]="correoCuenta" autocomplete="username" /></label>
          <label class="field"><span>Contraseña</span><input [(ngModel)]="clave" type="password" autocomplete="current-password" /></label>
          @if (errorCuenta()) { <p class="error">{{ errorCuenta() }}</p> }
          <button class="btn-oscuro" type="button" (click)="entrarCuenta()">Entrar con contraseña</button>
        </article>
      </main>
    </div>
  `
})
export class IngresoComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  correoEstudiante = '';
  codigo = '';
  correoCuenta = '';
  clave = '';
  errorEstudiante = signal('');
  errorCuenta = signal('');

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
