import { Component } from '@angular/core';

let siguienteId = 0;

/**
 * Encabezado del estudiante: ola azul brillante arriba a la derecha y, sobre ella, el cerebro con su
 * órbita y sus estrellas (dilema-cerebro-luz.webp, fondo transparente). Nada se monta encima.
 *
 * Lienzo de tamaño fijo anclado a la derecha: en pantallas angostas solo se recorta la punta delgada
 * de la ola por la izquierda. El contenedor debe ser position: relative; no recibe clics.
 */
@Component({
  selector: 'app-encabezado-estudiante',
  template: `
    <div class="lienzo" aria-hidden="true">
      <svg class="ola" width="900" height="190" viewBox="0 0 900 190">
        <defs>
          <linearGradient [attr.id]="id + '-azul'" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1e6cf5"/>
            <stop offset="1" stop-color="#0b50d8"/>
          </linearGradient>
        </defs>
        <!-- Ola de atrás, más clara y semitransparente. -->
        <path fill="#8fbaff" opacity=".35" d="M120,0 C230,10 300,46 400,86 C500,126 600,160 720,172 C800,180 860,182 900,182 V0 Z"/>
        <!-- Ola principal, azul intenso. -->
        <path [attr.fill]="'url(#' + id + '-azul)'" d="M210,0 C300,8 360,40 450,76 C540,112 630,140 730,150 C800,157 860,158 900,158 V0 Z"/>
        <!-- Brillo suave sobre el borde. -->
        <path fill="none" stroke="#bcd6ff" stroke-width="2" opacity=".55" d="M210,0 C300,8 360,40 450,76 C540,112 630,140 730,150 C800,157 860,158 900,158"/>
        <!-- Forma ondulada más clara dentro de la ola. -->
        <path fill="#ffffff" opacity=".08" d="M330,0 C420,30 520,70 620,84 C720,98 820,80 900,60 V0 Z"/>
      </svg>
      <img class="cerebro" src="/dilema-cerebro-luz.webp" alt="" />
    </div>
  `,
  styles: [`
    :host { position: absolute; top: 0; left: 0; right: 0; height: 190px; overflow: hidden; pointer-events: none; z-index: 0; }
    .lienzo { position: absolute; top: 0; right: 0; width: 900px; height: 190px; }
    .ola { position: absolute; inset: 0; display: block; }
    .cerebro { position: absolute; right: 14px; top: -34px; width: 290px; height: auto; display: block; }
    @media (max-width: 768px) {
      :host { height: 130px; }
      .lienzo { transform: scale(.68); transform-origin: top right; }
    }
  `]
})
export class EncabezadoEstudianteComponent {
  /** Ids propios por instancia (degradado del SVG). */
  readonly id = `ola-est-${++siguienteId}`;
}
