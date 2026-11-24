import { Component } from '@angular/core';

let siguienteId = 0;

/**
 * Encabezado de DILEMA: la ola azul con el cerebro, su órbita y dos estrellas. Una sola pieza para los
 * tres roles (marco-docente y marco-estudiante), para que se vea idéntico en todas las pantallas.
 *
 * Se dibuja en un lienzo de tamaño fijo (1000 x 110 px) anclado a la derecha: en pantallas anchas la ola
 * nace delgada cerca de la mitad; en las angostas solo se recorta su punta delgada por la izquierda.
 * El contenedor debe ser position: relative; el encabezado no recibe clics (nada se monta encima).
 */
@Component({
  selector: 'app-encabezado-ola',
  template: `
    <div class="lienzo" aria-hidden="true">
      <svg class="ola" width="1000" height="110" viewBox="0 0 1000 110">
        <defs>
          <linearGradient [attr.id]="id + '-noche'" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#06164a"/>
            <stop offset=".55" stop-color="#0a2266"/>
            <stop offset="1" stop-color="#0f2f8f"/>
          </linearGradient>
          <clipPath [attr.id]="id + '-dentro'"><path [attr.d]="zona"/></clipPath>
          <clipPath [attr.id]="id + '-fuera'"><path clip-rule="evenodd" [attr.d]="'M-60,-60 H1080 V200 H-60 Z ' + zona"/></clipPath>
          <filter [attr.id]="id + '-difuso'" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
          <filter [attr.id]="id + '-suave'" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="2.5"/></filter>
        </defs>
        <!-- Azul marino muy oscuro; solo junto al borde se aclara a azul intenso. -->
        <path [attr.fill]="'url(#' + id + '-noche)'" [attr.d]="zona"/>
        <g [attr.clip-path]="'url(#' + id + '-dentro)'" fill="none">
          <path stroke="#1f5cf5" stroke-width="44" [attr.filter]="'url(#' + id + '-difuso)'" [attr.d]="borde"/>
          <path stroke="#3a78ff" stroke-width="16" [attr.filter]="'url(#' + id + '-suave)'" [attr.d]="borde"/>
        </g>
        <!-- Del lado claro: halo blanco suave y franja de luz azul clara en el borde. -->
        <g [attr.clip-path]="'url(#' + id + '-fuera)'" fill="none">
          <path stroke="#ffffff" stroke-width="26" opacity=".9" [attr.filter]="'url(#' + id + '-difuso)'" [attr.d]="borde"/>
          <path stroke="#cfe0ff" stroke-width="6" [attr.filter]="'url(#' + id + '-suave)'" [attr.d]="borde"/>
        </g>
        <path fill="none" stroke="#9ec2ff" stroke-width="3" [attr.d]="borde"/>
        <!-- Órbita grande: la mitad de atrás va bajo el cerebro. -->
        <g transform="rotate(-5 838 54)" fill="none">
          <ellipse cx="838" cy="54" rx="126" ry="41" stroke="#9cc2ff" stroke-width="1.6" opacity=".7"/>
          <ellipse cx="838" cy="54" rx="114" ry="35" stroke="#5b8dff" stroke-width="1" opacity=".45"/>
        </g>
        <!-- Estrellas blancas de 4 puntas: una a la izquierda del cerebro y una pequeña arriba a la derecha. -->
        <path class="estrella" transform="translate(693 22) scale(.75)" d="M12 0C12.8 8 16 11.2 24 12 16 12.8 12.8 16 12 24 11.2 16 8 12.8 0 12 8 11.2 11.2 8 12 0Z"/>
        <path class="estrella" transform="translate(978 16) scale(.34)" d="M12 0C12.8 8 16 11.2 24 12 16 12.8 12.8 16 12 24 11.2 16 8 12.8 0 12 8 11.2 11.2 8 12 0Z"/>
      </svg>
      <!-- Cerebro con fondo transparente (tools/imagenes/cerebro-transparente.py). -->
      <img class="cerebro" src="/dilema-cerebro-ola.webp" alt="" />
      <!-- Mitad de adelante de la órbita, por encima del cerebro. -->
      <svg class="ola frente" width="1000" height="110" viewBox="0 0 1000 110">
        <defs><clipPath [attr.id]="id + '-frente'"><rect x="670" y="54" width="340" height="80"/></clipPath></defs>
        <g [attr.clip-path]="'url(#' + id + '-frente)'" transform="rotate(-5 838 54)" fill="none">
          <ellipse cx="838" cy="54" rx="126" ry="41" stroke="#b9d4ff" stroke-width="1.6" opacity=".75"/>
        </g>
      </svg>
    </div>
  `,
  styles: [`
    :host { position: absolute; top: 0; left: 0; right: 0; height: 110px; overflow: hidden; pointer-events: none; z-index: 0; }
    .lienzo { position: absolute; top: 0; right: 0; width: 1000px; height: 110px; }
    .ola { position: absolute; inset: 0; display: block; overflow: visible; }
    .estrella { fill: #fff; filter: drop-shadow(0 0 4px rgba(255, 255, 255, .9)); }
    .cerebro { position: absolute; left: 732px; top: -3px; width: 212px; height: 112px; display: block; }
    .frente { z-index: 1; }
  `]
})
export class EncabezadoOlaComponent {
  /** Ids propios por instancia (gradientes, recortes y filtros del SVG). */
  readonly id = `ola-${++siguienteId}`;
  /** Zona de la ola: nace delgada arriba y baja hasta apoyar el cerebro en su borde. */
  readonly zona = 'M380,0 C470,4 520,10 562,19 C640,35 700,58 786,81 C860,99 930,108 1010,110 L1010,0 Z';
  /** Borde inferior de la ola (franja de luz y halo). */
  readonly borde = 'M380,0 C470,4 520,10 562,19 C640,35 700,58 786,81 C860,99 930,108 1030,110';
}
