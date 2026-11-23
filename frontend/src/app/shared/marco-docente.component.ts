import { Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-marco-docente',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="inicio-est" [class.menu-abierto]="menuAbierto()">
      <button class="inicio-menu-btn" type="button" (click)="alternarMenu()" [attr.aria-expanded]="menuAbierto()" aria-label="Menú">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
      </button>
      <div class="inicio-menu-fondo" (click)="cerrarMenu()" aria-hidden="true"></div>
      <aside class="inicio-menu">
        <a class="inicio-logo" [routerLink]="inicio()">
          <img class="inicio-logo-icono" src="/dilema-cerebro.jpg" alt="" />
          <span>Dilema</span>
        </a>
        <nav (click)="cerrarMenu()">
          @for (enlace of enlaces(); track enlace.href) {
            <a [routerLink]="enlace.href" routerLinkActive="activa"
               [routerLinkActiveOptions]="{ exact: !!enlace.exacto }">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @switch (icono(enlace.href)) {
                  @case ('casos') { <path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/> }
                  @case ('grupos') { <circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M4 19c.7-3 2.8-5 5-5s4.3 2 5 5M13 19c.4-2 1.6-3.4 3-3.4 1.6 0 3 1.5 3.4 3.4"/> }
                  @case ('calendario') { <path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/> }
                  @case ('reporte') { <path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/> }
                  @case ('mas') { <path d="M12 6v12M6 12h12"/> }
                  @case ('ajuste') { <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5"/> }
                  @case ('aviso') { <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16zM10 19a2 2 0 0 0 4 0"/> }
                  @default { <path d="M4 11.5 12 5l8 6.5V20H4z"/> }
                }
              </svg>
              {{ enlace.texto }}
            </a>
          }
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
            <svg class="inicio-orbita" viewBox="0 0 500 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <linearGradient id="anillo-doc-logo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#dbeafe" stop-opacity=".15"/>
                  <stop offset=".45" stop-color="#93c5fd"/>
                  <stop offset="1" stop-color="#3b82f6" stop-opacity=".2"/>
                </linearGradient>
              </defs>
              <g fill="#fff">
                <polygon points="140,28 144,42 160,46 144,50 140,64 136,50 120,46 136,42"/>
                <polygon points="250,8 254,22 270,26 254,30 250,44 246,30 230,26 246,22"/>
                <polygon points="380,48 384,60 398,64 384,68 380,80 376,68 362,64 376,60"/>
                <circle cx="200" cy="40" r="1.8"/>
                <circle cx="250" cy="18" r="1.5"/>
                <circle cx="400" cy="70" r="1.6"/>
              </g>
              <ellipse cx="250" cy="125" rx="250" ry="118" fill="none" stroke="url(#anillo-doc-logo)" stroke-width="10" transform="rotate(-18 250 125)"/>
              <ellipse cx="250" cy="125" rx="210" ry="96" fill="none" stroke="#e0f2fe" stroke-width="2.2" transform="rotate(-18 250 125)" opacity=".8"/>
            </svg>
            <img class="inicio-cerebro" src="/dilema-cerebro.jpg" alt="" />
          </div>
          <svg class="inicio-deco" viewBox="0 0 1440 420" preserveAspectRatio="none">
            <defs>
              <linearGradient id="anillo-doc" x1="0" y1="0" x2="1" y2="1">
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
            <ellipse cx="1188" cy="128" rx="250" ry="118" fill="none" stroke="url(#anillo-doc)" stroke-width="10" transform="rotate(-18 1188 128)"/>
            <ellipse cx="1188" cy="128" rx="210" ry="96" fill="none" stroke="#e0f2fe" stroke-width="2.2" transform="rotate(-18 1188 128)" opacity=".8"/>
            <path fill="#1e3a8a" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,273 C1290,318 1148,286 980,168 C800,36 650,-38 430,-48 Z"/>
            <path fill="#3b82f6" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,313 C1290,358 1148,326 980,208 C800,76 650,-14 430,-24 Z"/>
            <path fill="#ffffff" d="M430,0 C650,22 800,118 980,250 C1148,368 1290,400 1460,355 L1460,337 C1290,382 1148,350 980,232 C800,100 650,8 430,-10 Z"/>
            <path fill="#eef2ff" d="M0,0 H430 C650,22 800,118 980,250 C1148,368 1290,400 1440,355 L1440,420 L0,420 Z"/>
          </svg>
          <svg class="inicio-deco-movil" viewBox="0 0 1440 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="anillo-doc-m" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#dbeafe" stop-opacity=".18"/>
                <stop offset=".45" stop-color="#93c5fd"/>
                <stop offset="1" stop-color="#3b82f6" stop-opacity=".22"/>
              </linearGradient>
              <clipPath id="cielo-doc-m">
                <path d="M0,0 L0,34 C560,16 1040,198 1440,188 L1440,0 Z"/>
              </clipPath>
            </defs>
            <g clip-path="url(#cielo-doc-m)"></g>
            <path fill="#eef2ff" d="M0,20 C560,2 1040,184 1440,174 L1440,300 L0,300 Z"/>
            <path fill="#1e3a8a" d="M0,34 C560,16 1040,198 1480,188 L1480,156 C1040,166 560,-16 0,2 Z"/>
            <path fill="#3b82f6" d="M0,34 C560,16 1040,198 1480,188 L1480,172 C1040,182 560,0 0,18 Z"/>
            <path fill="#ffffff" d="M0,34 C560,16 1040,198 1480,188 L1480,180 C1040,190 560,8 0,26 Z"/>
          </svg>
        </div>
        <header class="inicio-hero">
          <div class="inicio-hero-copy">
            <div class="inicio-saludo">
              <h1>¡Hola, {{ primerNombre() }}! <span aria-hidden="true">👋</span></h1>
            </div>
          </div>
        </header>
        <div class="inicio-docente-main">
          <ng-content />
        </div>
      </main>
    </div>
  `
})
export class MarcoDocenteComponent {
  auth = inject(AuthService);
  enlaces = input<{ href: string; texto: string; exacto?: boolean }[]>([]);
  inicio = input('/docente');
  lema = input('Coordina casos, grupos y sesiones desde un solo lugar.');
  menuAbierto = signal(false);
  alternarMenu() { this.menuAbierto.update((abierto) => !abierto); }
  cerrarMenu() { this.menuAbierto.set(false); }

  nombre() { return this.auth.usuario()?.nombre ?? ''; }

  primerNombre() {
    const primero = this.nombre().trim().split(/\s+/)[0];
    if (primero) return primero;
    if (this.auth.rol() === 'ADMIN') return 'administración';
    if (this.auth.rol() === 'ESTUDIANTE') return 'estudiante';
    return 'docente';
  }

  icono(href: string) {
    if (href.includes('/avisos')) return 'aviso';
    if (href.includes('/nuevo')) return 'mas';
    if (href.includes('/casos')) return 'casos';
    if (href.includes('/grupos') || href.includes('/usuarios')) return 'grupos';
    if (href.includes('/programar')) return 'calendario';
    if (href.includes('/seguimiento')) return 'reporte';
    if (href.includes('/configuracion') || href.includes('/perfil')) return 'ajuste';
    return 'inicio';
  }
}
