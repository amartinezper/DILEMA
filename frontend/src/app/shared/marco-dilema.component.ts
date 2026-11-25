import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EncabezadoDilemaComponent } from './encabezado-dilema.component';
import { IconoComponent } from './icono.component';

/**
 * Marco de DILEMA, el mismo para los 3 roles (estudiante, docente y administrador): menú lateral azul
 * brillante con ondas, el cerebro y "Dilema"; la tarjeta del cohete con su botón; "Cerrar sesión";
 * fondo azul muy claro con ondas, el encabezado con el cerebro (app-encabezado-dilema) y el saludo.
 * Estilos: bloque .marco-dilema de styles.css. Cada rol solo pone sus opciones del menú (atributo
 * "menu") y el botón de la tarjeta; así un cambio de color o de forma se ve en los 3 roles.
 */
@Component({
  selector: 'app-marco-dilema',
  imports: [RouterLink, EncabezadoDilemaComponent, IconoComponent],
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <div class="inicio-est marco-claro marco-dilema" [class.menu-abierto]="menuAbierto()" [class.dl-compacto]="compacto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <app-icono nombre="menu" [tamano]="22" />
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <svg class="dl-menu-ondas" viewBox="0 0 260 900" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#ffffff" opacity=".07" d="M0,0 H260 V120 C200,170 120,150 60,190 C30,210 10,230 0,250 Z"/>
          <path fill="#ffffff" opacity=".06" d="M0,470 C70,430 160,460 260,400 V560 C180,610 90,560 0,610 Z"/>
          <path fill="#ffffff" opacity=".08" d="M0,900 V720 C80,690 170,740 260,700 V900 Z"/>
        </svg>
        <a class="inicio-logo" [routerLink]="inicio()" (click)="cerrarMenu()">
          <img class="inicio-logo-icono" src="/dilema-cerebro-luz.webp" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          <ng-content select="[menu]" />
        </nav>
        <div class="dl-lema">
          <app-icono class="dl-lema-cohete" nombre="cohete" [tamano]="34" />
          <p>Piensa. Decide.<br />Aprende.</p>
          <a class="dl-lema-boton" [routerLink]="lemaEnlace()" [queryParams]="lemaParametros()" (click)="cerrarMenu()">
            @if (lemaIcono()) { <app-icono nombre="mas" [tamano]="18" /> }
            {{ lemaTexto() }}
            @if (!lemaIcono()) { <app-icono nombre="flecha" [tamano]="18" /> }
          </a>
        </div>
        <button class="inicio-salir" type="button" (click)="auth.salir()">
          <app-icono nombre="salir" [tamano]="22" /> Cerrar sesión
        </button>
      </aside>

      <main class="inicio-cuerpo">
        <svg class="dl-fondo-ondas" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#dbe8ff" opacity=".7" d="M0,0 H520 C430,40 300,70 160,70 C90,70 40,60 0,50 Z"/>
          <path fill="#cfe0ff" opacity=".55" d="M0,800 V720 C160,670 320,700 470,740 C620,780 760,760 900,720 C1020,686 1120,690 1200,710 V800 Z"/>
          <path fill="#b9d2ff" opacity=".45" d="M0,800 V770 C200,740 380,770 560,790 C700,805 820,790 1000,770 C1100,760 1160,765 1200,770 V800 Z"/>
        </svg>
        <app-encabezado-dilema />
        <header class="inicio-hero">
          <div class="inicio-hero-copy">
            <div class="inicio-saludo">
              <h1>¡Hola, {{ primerNombre() }}!</h1>
              @if (descripcion(); as texto) {
                @if (texto === bienvenida) {
                  <p class="marco-descripcion">Bienvenido a <strong>Dilema</strong>, donde cada decisión cuenta.</p>
                } @else {
                  <p class="marco-descripcion">{{ texto }}</p>
                }
              }
            </div>
          </div>
        </header>
        <div class="inicio-est-cuerpo inicio-docente-main">
          <ng-content />
        </div>
      </main>
    </div>
  `
})
export class MarcoDilemaComponent {
  auth = inject(AuthService);
  /** Texto de bienvenida: se muestra con "Dilema" en azul. */
  readonly bienvenida = 'Bienvenido a Dilema, donde cada decisión cuenta.';
  /** Ruta del logo (inicio del rol). */
  inicio = input('/');
  /** Texto gris bajo el saludo: qué se hace en la pantalla actual. */
  descripcion = input('');
  /** Encabezado más bajo (ola y cerebro más pequeños), para pantallas de listas como Mis casos. */
  compacto = input(false);
  /** Botón de la tarjeta del cohete: texto, destino y si lleva "+" (crear) o "›" (ir). */
  lemaTexto = input.required<string>();
  lemaEnlace = input.required<string>();
  lemaParametros = input<Record<string, string> | null>(null);
  lemaIcono = input(false);
  menuAbierto = signal(false);
  alternarMenu() { this.menuAbierto.update((abierto) => !abierto); }
  cerrarMenu() { this.menuAbierto.set(false); }

  primerNombre() {
    const primero = (this.auth.usuario()?.nombre ?? '').trim().split(/\s+/)[0];
    if (primero) return primero;
    if (this.auth.rol() === 'ADMIN') return 'administración';
    if (this.auth.rol() === 'ESTUDIANTE') return 'estudiante';
    return 'docente';
  }
}
