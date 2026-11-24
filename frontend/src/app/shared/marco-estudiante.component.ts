import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EncabezadoOlaComponent } from './encabezado-ola.component';

@Component({
  selector: 'app-marco-estudiante',
  imports: [RouterLink, EncabezadoOlaComponent],
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <div class="inicio-est marco-claro" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <a class="inicio-logo" routerLink="/estudiante" (click)="ir('inicio')">
          <img class="inicio-logo-icono" src="/dilema-cerebro.jpg" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          <button type="button" [class.activa]="marca() === 'inicio'" (click)="ir('inicio')">
            <svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H4z"/></svg>
            Inicio
          </button>
          <button type="button" [class.activa]="marca() === 'dilemas'" (click)="ir('dilemas')">
            <svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg>
            Mis Dilemas
          </button>
          <button type="button" [class.activa]="marca() === 'avisos'" (click)="ir('avisos')">
            <svg viewBox="0 0 24 24"><path d="M12 4a6 6 0 0 1 6 6v3l1.5 2.5H4.5L6 13V10a6 6 0 0 1 6-6zM9 18a3 3 0 0 0 6 0"/></svg>
            Avisos
            @if (sinLeer()) { <em class="badge">{{ sinLeer() }}</em> }
          </button>
          <button type="button" [class.activa]="marca() === 'perfil'" (click)="ir('perfil')">
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
        <app-encabezado-ola />
        <header class="inicio-hero">
          <div class="inicio-hero-copy">
            <div class="inicio-saludo">
              <h1>¡Hola, {{ primerNombre() }}!</h1>
              @if (descripcion()) { <p class="marco-descripcion">{{ descripcion() }}</p> }
            </div>
          </div>
        </header>
        <div class="inicio-est-cuerpo">
          <ng-content />
        </div>
      </main>
    </div>
  `
})
export class MarcoEstudianteComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  activa = input<string | null>(null);
  sinLeer = input(0);
  /** Texto gris bajo el saludo: qué se hace en la sección actual. */
  descripcion = input('Bienvenido a Dilema, donde cada decisión cuenta.');
  menuAbierto = signal(false);
  alternarMenu() { this.menuAbierto.update((abierto) => !abierto); }
  cerrarMenu() { this.menuAbierto.set(false); }
  marca() { return this.activa() || 'inicio'; }
  ir(vista: string) {
    this.cerrarMenu();
    if (vista === 'inicio') this.router.navigate(['/estudiante']);
    else this.router.navigate(['/estudiante'], { queryParams: { vista } });
  }
  nombre() { return this.auth.usuario()?.nombre ?? 'Estudiante'; }
  primerNombre() {
    return this.nombre().trim().split(/\s+/)[0] || 'estudiante';
  }
}
