import { Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EncabezadoOlaComponent } from './encabezado-ola.component';
import { IconoComponent, NombreIcono } from './icono.component';

/**
 * Marco del docente y del administrador: menú lateral oscuro, encabezado con la ola (app-encabezado-ola),
 * saludo con la descripción de la pantalla y el contenido sobre fondo claro (estilos .marco-claro).
 */
@Component({
  selector: 'app-marco-docente',
  imports: [RouterLink, RouterLinkActive, EncabezadoOlaComponent, IconoComponent],
  template: `
    <div class="inicio-est marco-claro" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <app-icono nombre="menu" [tamano]="22" />
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
              <app-icono [nombre]="icono(enlace.href)" [tamano]="22" />
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
          <app-icono nombre="salir" [tamano]="22" />
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

  /** Ícono de cada opción del menú (el mismo set del estudiante). */
  icono(href: string): NombreIcono {
    if (href.includes('/avisos')) return 'campana';
    if (href.includes('/nuevo')) return 'mas';
    if (href.includes('/casos')) return 'libro';
    if (href.includes('/grupos') || href.includes('/usuarios') || href.includes('/estudiantes')) return 'personas';
    if (href.includes('/programar')) return 'calendario';
    if (href.includes('/seguimiento')) return 'grafica';
    if (href.includes('/perfil')) return 'persona';
    return 'casa';
  }
}
