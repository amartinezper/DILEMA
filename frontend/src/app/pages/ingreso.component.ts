import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/api.service';

/**
 * Pantalla de ingreso. Solo presenta los dos caminos que ya expone el backend:
 * el estudiante entra con correo y código de convocatoria; docente y
 * administración entran con correo y contraseña. No hay registro, redes
 * sociales ni recuperación de clave porque el API no ofrece esas operaciones.
 * Los textos y los campos salen de esa diferencia. Los botones de
 * demostración solo rellenan las cuentas de práctica para entrar más rápido.
 */
@Component({
  selector: 'app-ingreso',
  imports: [FormsModule],
  template: `
    <div class="dilema-ingreso">
      <aside class="dilema-marca">
        <span class="chispa c1" aria-hidden="true"></span>
        <span class="chispa c2" aria-hidden="true"></span>
        <span class="chispa c3" aria-hidden="true"></span>
        <span class="chispa c4" aria-hidden="true"></span>
        <img class="cerebro" src="dilema-cerebro-luz.webp" alt="" />
        <h1>Dilema</h1>
        <p>Piensa. Decide. Aprende.</p>
      </aside>

      <main class="dilema-lado">
        <section class="dilema-caja">
          <h2>Iniciar sesión</h2>
          <p class="lead">Bienvenido de nuevo a <strong>Dilema</strong>, donde cada decisión cuenta.</p>

          <div class="modo" role="tablist" aria-label="Tipo de ingreso">
            <button type="button" role="tab" [attr.aria-selected]="modo() === 'estudiante'" [class.activo]="modo() === 'estudiante'" (click)="elegir('estudiante')">Estudiante</button>
            <button type="button" role="tab" [attr.aria-selected]="modo() === 'cuenta'" [class.activo]="modo() === 'cuenta'" (click)="elegir('cuenta')">Docente</button>
          </div>

          @if (modo() === 'estudiante') {
            <form (ngSubmit)="entrarEstudiante()">
              <label class="field">
                <span>Correo electrónico</span>
                <span class="control">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
                  <input name="correo" [(ngModel)]="correoEstudiante" type="email" autocomplete="username" placeholder="correo@institucion.edu" required />
                </span>
              </label>
              <label class="field">
                <span>Código de la sesión</span>
                <span class="control">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
                  <input name="codigo" [(ngModel)]="codigo" autocomplete="one-time-code" placeholder="Código que te compartió el docente" required />
                </span>
              </label>
              @if (errorEstudiante()) { <p class="error" role="alert">{{ errorEstudiante() }}</p> }
              <button class="btn-entrar" type="submit" [disabled]="enviando()">{{ enviando() ? 'Entrando…' : 'Iniciar sesión' }}</button>
            </form>
          } @else {
            <form (ngSubmit)="entrarCuenta()">
              <label class="field">
                <span>Correo electrónico</span>
                <span class="control">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
                  <input name="correo" [(ngModel)]="correoCuenta" type="email" autocomplete="username" placeholder="correo@institucion.edu" required />
                </span>
              </label>
              <label class="field">
                <span>Contraseña</span>
                <span class="control">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
                  <input name="clave" [(ngModel)]="clave" [type]="verClave() ? 'text' : 'password'" autocomplete="current-password" placeholder="Contraseña de tu cuenta" required />
                  <button class="ojo" type="button" (click)="verClave.set(!verClave())" [attr.aria-label]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
                  </button>
                </span>
              </label>
              <p class="nota-cuenta">Administración entra por aquí, con la misma contraseña.</p>
              @if (errorCuenta()) { <p class="error" role="alert">{{ errorCuenta() }}</p> }
              <button class="btn-entrar" type="submit" [disabled]="enviando()">{{ enviando() ? 'Entrando…' : 'Iniciar sesión' }}</button>
            </form>
          }

          <div class="rellenos">
            <span>Demostración</span>
            <button type="button" class="btn-demo" (click)="rellenarEstudiante()">Estudiante</button>
            <button type="button" class="btn-demo" (click)="rellenarDocente()">Docente</button>
            <button type="button" class="btn-demo" (click)="rellenarAdmin()">Administración</button>
          </div>
        </section>
        <span class="brillo" aria-hidden="true"></span>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    :host::-webkit-scrollbar { display: none; width: 0; height: 0; }
    .dilema-ingreso {
      min-height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: linear-gradient(180deg, #eaf2ff, #f5f9ff);
    }
    .dilema-marca {
      position: relative;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 8px;
      padding: 48px 32px;
      overflow: hidden;
      background:
        radial-gradient(ellipse 330px 230px at -2% -4%, rgba(125, 185, 255, 0.34) 97%, transparent 100%),
        radial-gradient(ellipse 300px 260px at -6% 104%, rgba(125, 185, 255, 0.30) 97%, transparent 100%),
        radial-gradient(ellipse 260px 330px at 106% 102%, rgba(125, 185, 255, 0.26) 97%, transparent 100%),
        radial-gradient(480px 360px at 50% 40%, rgba(120, 205, 255, 0.30), transparent 70%),
        linear-gradient(165deg, #1e6cf5, #0b50d8);
      color: white;
      text-align: center;
    }
    .cerebro {
      width: min(718px, 90%);
      height: auto;
      margin: -20px 0 44px;
      animation: flotar 5.5s ease-in-out infinite;
    }
    .dilema-marca h1 {
      margin: 0;
      font-size: 72px;
      line-height: 0.95;
      font-weight: 700;
      letter-spacing: -0.045em;
    }
    .dilema-marca p {
      margin: 6px 0 0;
      font-size: 22px;
      font-weight: 400;
      letter-spacing: 0.01em;
      color: #dbe9ff;
    }
    .chispa {
      position: absolute;
      width: 8px;
      height: 8px;
      background: white;
      clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
      animation: estrella 2.8s ease-in-out infinite;
    }
    .c1 { top: 16%; left: 18%; }
    .c2 { top: 22%; right: 16%; animation-delay: .8s; }
    .c3 { bottom: 18%; left: 24%; width: 6px; height: 6px; animation-delay: 1.4s; }
    .c4 { top: 58%; right: 22%; width: 5px; height: 5px; animation-delay: .4s; }
    .dilema-lado {
      position: relative;
      display: grid;
      place-items: center;
      padding: 32px 24px;
      overflow: hidden;
      background:
        radial-gradient(ellipse 300px 220px at 0% -4%, rgba(255, 255, 255, 0.45) 97%, transparent 100%),
        radial-gradient(ellipse 280px 340px at 104% 4%, rgba(255, 255, 255, 0.35) 97%, transparent 100%),
        radial-gradient(ellipse 320px 240px at -4% 104%, rgba(255, 255, 255, 0.4) 97%, transparent 100%),
        radial-gradient(ellipse 260px 280px at 104% 104%, rgba(255, 255, 255, 0.35) 97%, transparent 100%),
        linear-gradient(180deg, #eaf2ff, #f5f9ff);
    }
    .dilema-caja {
      width: min(440px, 100%);
      background: white;
      border-radius: 28px;
      padding: 40px 36px 32px;
      box-shadow: 0 24px 60px rgba(30, 108, 245, 0.14), 0 4px 14px rgba(30, 108, 245, 0.06);
      animation: subir .5s ease both;
    }
    .dilema-caja h2 {
      margin: 0;
      text-align: center;
      font-size: 32px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #0b1b3f;
    }
    .lead {
      margin: 10px 0 0;
      text-align: center;
      color: #64748b;
      font-size: 15px;
      line-height: 1.5;
    }
    .lead strong { color: #1a6cf0; font-weight: 700; }
    .modo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin: 22px 0 18px;
      padding: 4px;
      background: #e3eeff;
      border-radius: 999px;
    }
    .modo button {
      border: 0;
      background: transparent;
      color: #1a6cf0;
      border-radius: 999px;
      padding: 10px 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .modo button.activo {
      background: white;
      color: #0b1b3f;
      box-shadow: 0 6px 16px rgba(30, 108, 245, 0.14);
    }
    form { display: grid; gap: 14px; animation: subir .35s ease both; }
    .field { display: grid; gap: 8px; }
    .field > span {
      color: #0f172a;
      font-size: 14px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }
    .control {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 0 12px;
      background: #f1f6fd;
      border: 1px solid #d6e4fa;
      border-radius: 12px;
      color: #6b7f9e;
    }
    .control:focus-within {
      border-color: #1a73ff;
      box-shadow: 0 0 0 4px rgba(26, 115, 255, 0.14);
      background: white;
    }
    .control svg { width: 18px; height: 18px; flex: 0 0 auto; }
    .control input {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 12px 0;
      color: #0f172a;
      font-size: 15px;
      border-radius: 0;
    }
    .control input:focus { outline: none; box-shadow: none; }
    .control input::placeholder { color: #8394ad; }
    .ojo {
      border: 0;
      background: transparent;
      color: #94a3b8;
      padding: 4px;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .ojo:hover, .ojo:focus-visible { color: #2563eb; }
    .nota-cuenta { margin: -4px 0 0; color: #64748b; font-size: 13px; line-height: 1.4; }
    .btn-entrar {
      margin-top: 6px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(180deg, #1a73ff, #0b5ce0);
      color: white;
      font-size: 16px;
      font-weight: 650;
      padding: 14px 16px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(11, 92, 224, 0.18);
    }
    .btn-entrar:hover:not(:disabled) { transform: translateY(-1px); background: linear-gradient(180deg, #2a7dff, #0a55d2); }
    .btn-entrar:disabled { background: #93c5fd; box-shadow: none; cursor: wait; }
    .error { margin: 0; color: #9b1c1c; font-size: 14px; }
    .rellenos {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;
      margin-top: 18px; padding-top: 16px; border-top: 1px solid #e3ecf9;
    }
    .rellenos > span { color: #64748b; font-size: 13px; }
    .btn-demo {
      border: 1px solid #d9e6fb; background: white; color: #0b1b3f; border-radius: 999px;
      box-shadow: 0 2px 6px rgba(30, 108, 245, 0.06);
      padding: 8px 12px; cursor: pointer; font-weight: 650; font-size: 13px;
    }
    .btn-demo:hover { border-color: #1a73ff; color: #1a6cf0; }
    .brillo {
      position: absolute;
      right: 28px;
      bottom: 28px;
      width: 10px;
      height: 10px;
      background: white;
      clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%);
      opacity: .7;
      animation: estrella 3.2s ease-in-out infinite;
    }
    @keyframes flotar {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-12px); }
    }
    @keyframes estrella {
      0%, 100% { opacity: .25; transform: scale(.75); }
      50% { opacity: 1; transform: scale(1); }
    }
    @keyframes subir {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: none; }
    }
    @media (max-width: 900px) {
      .dilema-ingreso { grid-template-columns: 1fr; min-height: 100%; }
      .dilema-marca {
        min-height: 360px;
        padding: 32px 20px;
        background:
          radial-gradient(ellipse 170px 120px at -4% -6%, rgba(125, 185, 255, 0.34) 97%, transparent 100%),
          radial-gradient(ellipse 150px 110px at -6% 106%, rgba(125, 185, 255, 0.30) 97%, transparent 100%),
          radial-gradient(ellipse 140px 130px at 106% 104%, rgba(125, 185, 255, 0.26) 97%, transparent 100%),
          radial-gradient(260px 200px at 50% 36%, rgba(120, 205, 255, 0.30), transparent 70%),
          linear-gradient(165deg, #1e6cf5, #0b50d8);
      }
      .dilema-marca h1 { font-size: 52px; }
      .cerebro { width: min(372px, 96%); margin: -12px 0 4px; }
      .dilema-lado {
        padding: 32px 24px 40px;
        background:
          radial-gradient(ellipse 170px 130px at -4% -2%, rgba(255, 255, 255, 0.45) 97%, transparent 100%),
          radial-gradient(ellipse 160px 140px at 106% 102%, rgba(255, 255, 255, 0.4) 97%, transparent 100%),
          linear-gradient(180deg, #eaf2ff, #f5f9ff);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cerebro, .chispa, .brillo, .dilema-caja, form { animation: none; }
    }
  `]
})
export class IngresoComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Paso visible. Docente abre el formulario de contraseña; estudiante pide el código. */
  modo = signal<'estudiante' | 'cuenta'>('cuenta');
  correoEstudiante = '';
  codigo = '';
  correoCuenta = '';
  clave = '';
  errorEstudiante = signal('');
  errorCuenta = signal('');
  /** Solo muestra u oculta la contraseña. No la envía ni la modifica. */
  verClave = signal(false);
  /** Evita un segundo envío mientras el API todavía no responde. */
  enviando = signal(false);

  /** Cambia de formulario y limpia el aviso del intento anterior. */
  elegir(modo: 'estudiante' | 'cuenta') {
    this.errorEstudiante.set('');
    this.errorCuenta.set('');
    this.enviando.set(false);
    this.modo.set(modo);
  }

  /** Rellena la cuenta de práctica del estudiante, abre su formulario y entra. */
  rellenarEstudiante() {
    this.elegir('estudiante');
    this.correoEstudiante = 'estudiante@psicosim.edu';
    this.codigo = 'DILEMA-2026';
    this.entrarEstudiante();
  }

  /** Rellena la cuenta de práctica del docente y abre el formulario de contraseña. */
  rellenarDocente() {
    this.elegir('cuenta');
    this.correoCuenta = 'docente@psicosim.edu';
    this.clave = 'docente123';
  }

  /** Rellena la cuenta de práctica de administración. Entra por el mismo formulario que el docente. */
  rellenarAdmin() {
    this.elegir('cuenta');
    this.correoCuenta = 'admin@psicosim.edu';
    this.clave = 'admin123';
  }

  /**
   * Ingreso del estudiante: correo institucional y código de la convocatoria.
   * El destino lo decide el rol que devuelve el backend, no esta pantalla.
   */
  entrarEstudiante() {
    if (this.enviando()) return;
    this.errorEstudiante.set('');
    this.enviando.set(true);
    this.auth.ingresarEstudiante(this.correoEstudiante.trim(), this.codigo.trim()).subscribe({
      next: (sesion) => this.router.navigateByUrl(this.destino(sesion.usuario.rol)),
      error: (falla) => {
        this.enviando.set(false);
        this.errorEstudiante.set(mensajeError(falla));
      }
    });
  }

  /**
   * Ingreso de docente y administración: correo y contraseña.
   * La contraseña no se recorta: un espacio puede formar parte de ella.
   */
  entrarCuenta() {
    if (this.enviando()) return;
    this.errorCuenta.set('');
    this.enviando.set(true);
    this.auth.ingresarCuenta(this.correoCuenta.trim(), this.clave).subscribe({
      next: (sesion) => this.router.navigateByUrl(this.destino(sesion.usuario.rol)),
      error: (falla) => {
        this.enviando.set(false);
        this.errorCuenta.set(mensajeError(falla));
      }
    });
  }

  /** El API dice el rol. Esta pantalla solo abre la ruta que ya existe para ese rol. */
  private destino(rol: string) {
    if (rol === 'ESTUDIANTE') return '/estudiante';
    if (rol === 'PROFESOR') return '/docente';
    return '/admin';
  }
}
