import { Component, computed, input, output } from '@angular/core';

/** Filas por página en las tablas (administrador, reportes del docente y estudiante). */
export const FILAS_POR_PAGINA = 8;

/** Página de una lista (desde 1). Los filtros y la búsqueda se aplican antes, sobre TODA la lista. */
export function paginaDe<T>(lista: T[], pagina: number, porPagina = FILAS_POR_PAGINA): T[] {
  return lista.slice((pagina - 1) * porPagina, pagina * porPagina);
}

/** Página válida aunque la lista se haya achicado (por un filtro o una búsqueda). */
export function paginaValida(pagina: number, total: number, porPagina = FILAS_POR_PAGINA): number {
  return Math.min(Math.max(1, pagina), Math.max(1, Math.ceil(total / porPagina)));
}

/**
 * "Mostrando 1–8 de N" a la izquierda y ‹ 1 2 3 › a la derecha, con la página actual en azul marino.
 * Sin botones si todo cabe en una página. Estilos en styles.css (.adm-paginacion).
 */
@Component({
  selector: 'app-paginacion-tabla',
  template: `
    @if (total() > 0) {
      <div class="adm-paginacion">
        <span class="adm-paginacion-texto">Mostrando {{ desde() }}–{{ hasta() }} de {{ total() }}</span>
        @if (paginas() > 1) {
          <nav class="adm-paginas" aria-label="Páginas">
            <button type="button" class="adm-pagina" (click)="ir(pagina() - 1)" [disabled]="pagina() === 1" aria-label="Página anterior">‹</button>
            @for (n of numeros(); track n) {
              <button type="button" class="adm-pagina" [class.actual]="n === pagina()" [attr.aria-current]="n === pagina() ? 'page' : null"
                [attr.aria-label]="'Página ' + n" (click)="ir(n)">{{ n }}</button>
            }
            <button type="button" class="adm-pagina" (click)="ir(pagina() + 1)" [disabled]="pagina() === paginas()" aria-label="Página siguiente">›</button>
          </nav>
        }
      </div>
    }
  `
})
export class PaginacionTablaComponent {
  total = input(0);
  pagina = input(1);
  porPagina = input(FILAS_POR_PAGINA);
  cambiar = output<number>();
  paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  /** Hasta 5 números alrededor de la página actual. */
  numeros = computed(() => {
    const total = this.paginas(), actual = this.pagina(), max = 5;
    const inicio = Math.max(1, Math.min(actual - Math.floor(max / 2), total - max + 1));
    return Array.from({ length: Math.min(max, total) }, (_, i) => inicio + i);
  });
  desde = computed(() => (this.total() ? (this.pagina() - 1) * this.porPagina() + 1 : 0));
  hasta = computed(() => Math.min(this.total(), this.pagina() * this.porPagina()));
  ir(n: number) { if (n >= 1 && n <= this.paginas()) this.cambiar.emit(n); }
}
