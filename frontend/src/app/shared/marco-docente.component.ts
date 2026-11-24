import { Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EncabezadoOlaComponent } from './encabezado-ola.component';

/**
 * Marco del docente y del administrador: menú lateral oscuro, encabezado con la ola (app-encabezado-ola),
 * saludo con la descripción de la pantalla y el contenido sobre fondo claro (estilos .marco-claro).
 */
@Component({
  selector: 'app-marco-docente',
  imports: [RouterLink, RouterLinkActive, EncabezadoOlaComponent],
  template: `
    <div class="inicio-est marco-claro" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <a class="inicio-logo" [routerLink]="inicio()">
          <img class="inicio-logo-icono" src="/dilema-cerebro.jpg" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          @for (enlace of enlaces(); track enlace.href) {
            <a [routerLink]="enlace.href" routerLinkActive="activa"
               [routerLinkActiveOptions]="{ exact: !!enlace.exacto }">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @switch (icono(enlace.href)) {
                  @case ('casos') { <path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/> }
                  @case ('grupos') { <circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M4 19c.7-3 2.8-5 5-5s4.3 2 5 5M13 19c.4-2 1.6-3.4 3-3.4 1.6 0 3 1.5 3.4 3.4"/> }
                  @case ('calendario') { <path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/> }
                  @case ('reporte') { <path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/> }
                  @case ('mas') { <path d="M12 6v12M6 12h12"/> }
                  @case ('ajuste') { <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5"/> }
                  @case ('aviso') { <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16zM10 19a2 2 0 0 0 4 0"/> }
                  @default { <path d="M4 11.5 12 5l8 6.5V20H4z"/> }
                }
              </svg>
              {{ enlace.texto }}
            </a>
          }
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
        <div class="inicio-docente-main">
          <ng-content />
        </div>
      </main>
    </div>
  `
})
export class MarcoDocenteComponent {
  auth = inject(AuthService);
  enlaces = input<{ href: string; texto: string; exacto?: boolean }[]>([]);
  inicio = input('/docente');
  /** Texto gris bajo el saludo: qué se hace en la pantalla actual. */
  descripcion = input('');
  menuAbierto = signal(false);
  alternarMenu() { this.menuAbierto.update((abierto) => !abierto); }
  cerrarMenu() { this.menuAbierto.set(false); }

  nombre() { return this.auth.usuario()?.nombre ?? ''; }

  primerNombre() {
    const primero = this.nombre().trim().split(/\s+/)[0];
    if (primero) return primero;
    if (this.auth.rol() === 'ADMIN') return 'administración';
    if (this.auth.rol() === 'ESTUDIANTE') return 'estudiante';
    return 'docente';
  }

  icono(href: string) {
    if (href.includes('/avisos')) return 'aviso';
    if (href.includes('/nuevo')) return 'mas';
    if (href.includes('/casos')) return 'casos';
    if (href.includes('/grupos') || href.includes('/usuarios')) return 'grupos';
    if (href.includes('/programar')) return 'calendario';
    if (href.includes('/seguimiento')) return 'reporte';
    if (href.includes('/perfil')) return 'ajuste';
    return 'inicio';
  }
}
