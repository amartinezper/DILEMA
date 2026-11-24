import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MarcoDilemaComponent } from './marco-dilema.component';
import { IconoComponent } from './icono.component';

/**
 * Marco del estudiante: el marco común (app-marco-dilema) con sus opciones (Inicio, Mis dilemas, Avisos y
 * Perfil) y el botón "¡A decidir!" que lleva a Mis dilemas.
 */
@Component({
  selector: 'app-marco-estudiante',
  imports: [MarcoDilemaComponent, IconoComponent],
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <app-marco-dilema inicio="/estudiante" [descripcion]="descripcion()"
      lemaTexto="¡A decidir!" lemaEnlace="/estudiante" [lemaParametros]="{ vista: 'dilemas' }">
      <ng-container ngProjectAs="[menu]">
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
      </ng-container>
      <ng-content />
    </app-marco-dilema>
  `
})
export class MarcoEstudianteComponent {
  private router = inject(Router);
  activa = input<string | null>(null);
  sinLeer = input(0);
  /** Texto gris bajo el saludo: qué se hace en la sección actual. */
  descripcion = input('Bienvenido a Dilema, donde cada decisión cuenta.');
  marca() { return this.activa() || 'inicio'; }
  ir(vista: string) {
    if (vista === 'inicio') this.router.navigate(['/estudiante']);
    else this.router.navigate(['/estudiante'], { queryParams: { vista } });
  }
}
