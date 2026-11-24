import { Component, input } from '@angular/core';

/** Nombres de los íconos disponibles. */
export type NombreIcono =
  | 'casa' | 'dialogo' | 'campana' | 'persona' | 'salir' | 'birrete' | 'trofeo' | 'check' | 'estrella'
  | 'play' | 'sube' | 'cohete' | 'flecha' | 'menu' | 'buscar' | 'libro' | 'personas' | 'calendario'
  | 'grafica' | 'mas';

/**
 * Íconos de línea de DILEMA: un solo set para los tres roles, con trazo de 2 px y puntas y esquinas
 * redondeadas. Geometría tomada de Lucide (ISC, ver CREDITOS.md); se dibuja aquí como SVG para no
 * agregar dependencias.
 *
 * Son decorativos (aria-hidden): el texto del botón o un aria-label en el botón dice qué hacen.
 * Toman el color del texto (currentColor) y el tamaño de `tamano` (px).
 */
@Component({
  selector: 'app-icono',
  template: `
    <!-- Tamaño y trazo en línea: así ninguna regla global (svg de 20 px, trazo 1.8) los cambia. -->
    <svg viewBox="0 0 24 24" [attr.width]="tamano()" [attr.height]="tamano()" fill="none" stroke="currentColor"
      [style.width.px]="tamano()" [style.height.px]="tamano()" style="stroke-width: 2; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @switch (nombre()) {
        @case ('casa') {
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        }
        @case ('dialogo') {
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 8h8"/><path d="M8 12h5"/>
        }
        @case ('campana') {
          <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
        }
        @case ('persona') {
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        }
        @case ('salir') {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>
        }
        @case ('birrete') {
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
          <path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
        }
        @case ('trofeo') {
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
        }
        @case ('check') { <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/> }
        @case ('estrella') {
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
        }
        @case ('play') { <circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/> }
        @case ('sube') { <path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/> }
        @case ('cohete') {
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        }
        @case ('flecha') { <path d="m9 18 6-6-6-6"/> }
        @case ('menu') { <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/> }
        @case ('buscar') { <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/> }
        @case ('libro') {
          <path d="M12 7v14"/>
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
        }
        @case ('personas') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        }
        @case ('calendario') {
          <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
        }
        @case ('grafica') { <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/> }
        @case ('mas') { <path d="M5 12h14"/><path d="M12 5v14"/> }
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; flex: none; line-height: 0; }
    svg { display: block; }
  `]
})
export class IconoComponent {
  nombre = input.required<NombreIcono>();
  /** Tamaño en px: 22 en el menú, 20 en botones, 28 en los círculos de las tarjetas de resumen. */
  tamano = input(20);
}
