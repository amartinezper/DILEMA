import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { EncabezadoEstudianteComponent } from './encabezado-estudiante.component';
import { IconoComponent } from './icono.component';

/**
 * Marco del estudiante: menú lateral azul brillante con el cerebro, encabezado con la ola azul y el
 * cerebro a la derecha, saludo y el contenido sobre fondo azul muy claro (estilos .marco-est).
 */
@Component({
  selector: 'app-marco-estudiante',
  imports: [RouterLink, EncabezadoEstudianteComponent, IconoComponent],
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <div class="inicio-est marco-claro marco-est" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <app-icono nombre="menu" [tamano]="22" />
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <svg class="est-menu-ondas" viewBox="0 0 260 900" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#ffffff" opacity=".07" d="M0,0 H260 V120 C200,170 120,150 60,190 C30,210 10,230 0,250 Z"/>
          <path fill="#ffffff" opacity=".06" d="M0,470 C70,430 160,460 260,400 V560 C180,610 90,560 0,610 Z"/>
          <path fill="#ffffff" opacity=".08" d="M0,900 V720 C80,690 170,740 260,700 V900 Z"/>
        </svg>
        <a class="inicio-logo" routerLink="/estudiante" (click)="ir('inicio')">
          <img class="inicio-logo-icono" src="/dilema-cerebro-luz.webp" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          <button type="button" [class.activa]="marca() === 'inicio'" [attr.aria-current]="marca() === 'inicio' ? 'page' : null" (click)="ir('inicio')">
            <app-icono nombre="casa" [tamano]="22" /> Inicio
          </button>
          <button type="button" [class.activa]="marca() === 'dilemas'" [attr.aria-current]="marca() === 'dilemas' ? 'page' : null" (click)="ir('dilemas')">
            <app-icono nombre="dialogo" [tamano]="22" /> Mis dilemas
          </button>
          <button type="button" [class.activa]="marca() === 'avisos'" [attr.aria-current]="marca() === 'avisos' ? 'page' : null" (click)="ir('avisos')">
            <app-icono nombre="campana" [tamano]="22" /> Avisos
            @if (sinLeer()) { <em class="badge" [attr.aria-label]="sinLeer() + ' sin leer'">{{ sinLeer() }}</em> }
          </button>
          <button type="button" [class.activa]="marca() === 'perfil'" [attr.aria-current]="marca() === 'perfil' ? 'page' : null" (click)="ir('perfil')">
            <app-icono nombre="persona" [tamano]="22" /> Perfil
          </button>
        </nav>
        <div class="est-lema">
          <app-icono class="est-lema-cohete" nombre="cohete" [tamano]="34" />
          <p>Piensa. Decide.<br />Aprende.</p>
          <button type="button" class="est-lema-boton" (click)="ir('dilemas')">
            ¡A decidir! <app-icono nombre="flecha" [tamano]="18" />
          </button>
        </div>
        <button class="inicio-salir" type="button" (click)="auth.salir()">
          <app-icono nombre="salir" [tamano]="22" /> Cerrar sesión
        </button>
      </aside>

      <main class="inicio-cuerpo">
        <svg class="est-fondo-ondas" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#dbe8ff" opacity=".7" d="M0,0 H520 C430,40 300,70 160,70 C90,70 40,60 0,50 Z"/>
          <path fill="#cfe0ff" opacity=".55" d="M0,800 V720 C160,670 320,700 470,740 C620,780 760,760 900,720 C1020,686 1120,690 1200,710 V800 Z"/>
          <path fill="#b9d2ff" opacity=".45" d="M0,800 V770 C200,740 380,770 560,790 C700,805 820,790 1000,770 C1100,760 1160,765 1200,770 V800 Z"/>
        </svg>
        <app-encabezado-estudiante />
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
  /** Texto de bienvenida: se muestra con "Dilema" en azul. */
  readonly bienvenida = 'Bienvenido a Dilema, donde cada decisión cuenta.';
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
