import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MarcoDilemaComponent } from './marco-dilema.component';
import { IconoComponent, NombreIcono } from './icono.component';

/**
 * Marco del docente y del administrador: el marco común (app-marco-dilema) con las opciones del rol y el
 * botón de la tarjeta del cohete ("+ Crear caso" para el docente, "+ Nuevo docente" para administración).
 */
@Component({
  selector: 'app-marco-docente',
  imports: [RouterLink, RouterLinkActive, MarcoDilemaComponent, IconoComponent],
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <app-marco-dilema [inicio]="inicio()" [descripcion]="descripcion()" [lemaIcono]="true"
      [lemaTexto]="esAdmin() ? 'Nuevo docente' : 'Crear caso'"
      [lemaEnlace]="esAdmin() ? '/admin/usuarios/nuevo' : '/docente/casos/nuevo'">
      <ng-container ngProjectAs="[menu]">
        @for (enlace of enlaces(); track enlace.href) {
          <a [routerLink]="enlace.href" routerLinkActive="activa" ariaCurrentWhenActive="page"
             [routerLinkActiveOptions]="{ exact: !!enlace.exacto }">
            <app-icono [nombre]="icono(enlace.href)" [tamano]="22" />
            {{ enlace.texto }}
          </a>
        }
      </ng-container>
      <ng-content />
    </app-marco-dilema>
  `
})
export class MarcoDocenteComponent {
  enlaces = input<{ href: string; texto: string; exacto?: boolean }[]>([]);
  inicio = input('/docente');
  /** Texto gris bajo el saludo: qué se hace en la pantalla actual. */
  descripcion = input('');

  esAdmin() { return this.inicio() === '/admin'; }

  /** Ícono de cada opción del menú (el mismo set de los 3 roles). */
  icono(href: string): NombreIcono {
    if (href.includes('/avisos')) return 'campana';
    if (href.includes('/nuevo')) return 'mas';
    if (href.includes('/casos')) return 'documento';
    if (href.includes('/estudiantes')) return 'birrete';
    if (href.includes('/grupos') || href.includes('/usuarios')) return 'personas';
    if (href.includes('/programar')) return 'calendario';
    if (href.includes('/seguimiento')) return 'grafica';
    if (href.includes('/configuracion')) return 'engranaje';
    if (href.includes('/perfil')) return 'persona';
    return 'casa';
  }
}
