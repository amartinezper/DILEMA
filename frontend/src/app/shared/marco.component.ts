import { Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';

@Component({
  selector: 'app-marco',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="cascaron">
      <aside class="riel">
        @for (enlace of enlaces(); track enlace.href) {
          <a [routerLink]="enlace.href" routerLinkActive="activa"
             [routerLinkActiveOptions]="{ exact: !!enlace.exacto }" [attr.aria-label]="enlace.texto" [title]="enlace.texto">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              @switch (icono(enlace.href)) {
                @case ('aviso') { <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16zM10 19a2 2 0 0 0 4 0"/> }
                @case ('casos') { <path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5zM5 5.5A2.5 2.5 0 0 0 7.5 8H17"/> }
                @case ('grupos') { <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 19c.4-2.4 2.4-4 5-4s4.6 1.6 5 4M14 15c1.8.2 3.3 1.3 3.8 4"/> }
                @case ('calendario') { <path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/> }
                @case ('reporte') { <path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/> }
                @case ('mas') { <path d="M12 6v12M6 12h12"/> }
                @case ('ajuste') { <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5"/> }
                @default { <path d="M4 11.5 12 5l8 6.5V20H4zM10 20v-6h4v6"/> }
              }
            </svg>
          </a>
        }
      </aside>
      <div class="cuerpo">
        <header class="barra">
          <a class="marca" [routerLink]="inicio()">
            <span class="monograma">D</span>
            <span class="marca-texto"><strong>DILEMA</strong><small>Psicología social</small></span>
          </a>
          <nav class="pildoras">
            @for (enlace of enlaces(); track enlace.href) {
              <a class="pildora" [routerLink]="enlace.href" routerLinkActive="activa"
                 [routerLinkActiveOptions]="{ exact: !!enlace.exacto }">{{ enlace.texto }}</a>
            }
          </nav>
          <label class="busca">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
            <input [value]="busqueda.texto()" (input)="busqueda.fijar(valor($event))" placeholder="Buscar..." aria-label="Buscar" />
          </label>
          @if (auth.rol() === 'ESTUDIANTE') {
            <a class="campana" routerLink="/estudiante/avisos" aria-label="Notificaciones" title="Notificaciones">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16zM10 19a2 2 0 0 0 4 0"/></svg>
            </a>
          }
          <div class="perfil">
            <button type="button" class="perfil-boton" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()">
              <span class="perfil-nombre">{{ nombre() }}</span>
              <span class="avatar">{{ iniciales() }}</span>
            </button>
            @if (menu()) {
              <div class="menu-perfil">
                <strong>{{ nombre() }}</strong>
                <small>{{ rolVisible() }}</small>
                <button type="button" (click)="auth.salir()">Cerrar sesión</button>
              </div>
            }
          </div>
        </header>
        <section class="main">
          <ng-content />
        </section>
      </div>
    </div>
  `
})
export class MarcoComponent {
  auth = inject(AuthService);
  busqueda = inject(BusquedaService);
  modo = input('lateral');
  enlaces = input<{ href: string; texto: string; exacto?: boolean }[]>([]);
  menu = signal(false);

  inicio() {
    const rol = this.auth.rol();
    if (rol === 'ESTUDIANTE') return '/estudiante';
    if (rol === 'ADMIN') return '/admin';
    return '/docente';
  }

  nombre() { return this.auth.usuario()?.nombre ?? ''; }

  iniciales() {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'D';
  }

  rolVisible() {
    const rol = this.auth.rol();
    if (rol === 'PROFESOR') return 'Docente';
    if (rol === 'ADMIN') return 'Administración';
    return 'Estudiante';
  }

  icono(href: string) {
    if (href.includes('/avisos')) return 'aviso';
    if (href.includes('/nuevo')) return 'mas';
    if (href.includes('/casos')) return 'casos';
    if (href.includes('/grupos') || href.endsWith('/usuarios')) return 'grupos';
    if (href.includes('/programar')) return 'calendario';
    if (href.includes('/seguimiento')) return 'reporte';
    if (href.includes('/configuracion')) return 'ajuste';
    return 'inicio';
  }

  valor(evento: Event) {
    return (evento.target as HTMLInputElement).value;
  }
}
