import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-marco-estudiante',
  imports: [RouterLink],
  template: `
    <div class="inicio-est" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <a class="inicio-logo" routerLink="/estudiante" (click)="ir('inicio')">
          <img class="inicio-logo-icono" src="/dilema-cerebro.jpg" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          <button type="button" [class.activa]="marca() === 'inicio'" (click)="ir('inicio')">
            <svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20H4z"/></svg>
            Inicio
          </button>
          <button type="button" [class.activa]="marca() === 'dilemas'" (click)="ir('dilemas')">
            <svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg>
            Mis Dilemas
          </button>
          <button type="button" [class.activa]="marca() === 'avisos'" (click)="ir('avisos')">
            <svg viewBox="0 0 24 24"><path d="M12 4a6 6 0 0 1 6 6v3l1.5 2.5H4.5L6 13V10a6 6 0 0 1 6-6zM9 18a3 3 0 0 0 6 0"/></svg>
            Avisos
            @if (sinLeer()) { <em class="badge">{{ sinLeer() }}</em> }
          </button>
          <button type="button" [class.activa]="marca() === 'perfil'" (click)="ir('perfil')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5 19c.8-3.2 3.4-5 7-5s6.2 1.8 7 5"/></svg>
            Perfil
          </button>
        </nav>
        <p class="inicio-lema">
          <svg class="inicio-lema-onda" viewBox="0 0 210 120" preserveAspectRatio="none" aria-hidden="true">
            <path fill="#091830" d="M0,120 V48 C52,8 158,72 210,38 V120 Z"/>
            <ellipse cx="105" cy="58" rx="96" ry="34" fill="none" stroke="#16345c" stroke-width="6" opacity=".55" transform="rotate(12 105 58)"/>
            <ellipse cx="105" cy="58" rx="80" ry="26" fill="none" stroke="#1d4a7a" stroke-width="1.6" opacity=".35" transform="rotate(12 105 58)"/>
          </svg>
          <span>Piensa. Decide. Aprende.</span>
          <span class="lema-cierre">A decidir.</span>
        </p>
        <button class="inicio-salir" type="button" (click)="auth.salir()">
          <svg viewBox="0 0 24 24"><path d="M10 7V5H5v14h5v-2M10 12h10M16 8l4 4-4 4"/></svg>
          Cerrar Sesión
        </button>
      </aside>

      <main class="inicio-cuerpo">
        <div class="inicio-fondo" aria-hidden="true">
          <div class="inicio-cielo"></div>
          <div class="inicio-marca-hero">
            <img class="inicio-cerebro" src="/dilema-cerebro.jpg" alt="" />
          </div>
          <svg class="inicio-deco" viewBox="0 0 1440 420" preserveAspectRatio="none">
            <defs>
              <linearGradient id="anillo-est" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#dbeafe" stop-opacity=".15"/>
                <stop offset=".45" stop-color="#93c5fd"/>
                <stop offset="1" stop-color="#3b82f6" stop-opacity=".2"/>
              </linearGradient>
            </defs>
            <g fill="#fff">
              <polygon points="860,18 864,32 880,36 864,40 860,54 856,40 840,36 856,32"/>
              <polygon points="1088,10 1092,24 1108,28 1092,32 1088,46 1084,32 1068,28 1084,24"/>
              <polygon points="1260,42 1264,54 1278,58 1264,62 1260,74 1256,62 1242,58 1256,54"/>
              <circle cx="940" cy="28" r="1.8"/>
              <circle cx="1188" cy="16" r="1.5"/>
              <circle cx="1336" cy="70" r="1.6"/>
              <circle cx="1012" cy="54" r="1.2"/>
            </g>
            <ellipse cx="1188" cy="128" rx="250" ry="118" fill="none" stroke="url(#anillo-est)" stroke-width="10" transform="rotate(-18 1188 128)"/>
            <ellipse cx="1188" cy="128" rx="210" ry="96" fill="none" stroke="#e0f2fe" stroke-width="2.2" transform="rotate(-18 1188 128)" opacity=".8"/>
            <path fill="#1e3a8a" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,273 C1290,318 1148,286 980,168 C800,36 650,-38 430,-48 Z"/>
            <path fill="#3b82f6" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,313 C1290,358 1148,326 980,208 C800,76 650,-14 430,-24 Z"/>
            <path fill="#ffffff" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,337 C1290,382 1148,350 980,232 C800,100 650,8 430,-10 Z"/>
            <path fill="#eef2ff" d="M0,0 H430 C650,22 800,118 980,250 C1148,368 1290,400 1440,355 L1440,420 L0,420 Z"/>
          </svg>
        </div>
        <header class="inicio-hero">
          <div class="inicio-user">
            <span class="inicio-avatar">{{ iniciales() }}</span>
            <span>{{ nombre() }}</span>
          </div>
          <div class="inicio-hero-copy">
            <div class="inicio-saludo">
              <h1>¡Hola, {{ primerNombre() }}! <span aria-hidden="true">👋</span></h1>
              <p>Bienvenido a <strong>Dilema</strong>, donde cada decisión cuenta.</p>
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
  activa = input<string | null>(null);
  sinLeer = input(0);
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
  iniciales() {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'ED';
  }
}
