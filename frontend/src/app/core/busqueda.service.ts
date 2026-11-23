import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/** Texto de la búsqueda de la barra. Cada pantalla decide si lo usa para filtrar su lista. */
@Injectable({ providedIn: 'root' })
export class BusquedaService {
  private router = inject(Router);
  texto = signal('');

  constructor() {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) this.texto.set('');
    });
  }

  fijar(valor: string) { this.texto.set(valor); }
}
