import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarcoDocenteComponent } from '../shared/marco-docente.component';
import { EditorTextoComponent } from '../shared/editor-texto.component';
import { Bloque, Caso, CasoResumen, Fila, Grupo, Participacion, Sesion, mensajeError } from '../core/api.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../core/auth.service';
import { BusquedaService } from '../core/busqueda.service';
import { BloqueNovela, CasoNovela, EscenaNovelaComponent, PersonajeNovela } from '../shared/novela/escena-novela.component';
import { Asignacion } from '../shared/novela/elenco.service';
import { FONDOS_MANUALES } from '../shared/novela/escena.service';
import { NovelaReproductorComponent } from '../shared/novela/novela-reproductor.component';
import { ResultadosNovela, calcularResultados } from '../shared/novela/resultados';
import { MusicaNovelaService } from '../shared/novela/musica-novela.service';
import { NgTemplateOutlet } from '@angular/common';

const enlaces = [
  { href: '/docente', texto: 'Inicio', exacto: true },
  { href: '/docente/casos', texto: 'Mis Casos', exacto: true },
  { href: '/docente/grupos', texto: 'Grupos', exacto: true },
  { href: '/docente/programar', texto: 'Programar', exacto: true },
  { href: '/docente/seguimiento', texto: 'Reportes' }
];

function opcionVacia(correcta = false) {
  return { texto: '', correcta, explicacion: '', fundamento: '' };
}
function preguntaVacia() {
  return { enunciado: '', pista: '', criterio: '', peso: 0, opciones: [opcionVacia(true), opcionVacia(false)] };
}
function casoVacio(): Caso {
  return {
    nombre: '', desarrolloSituacional: '', contexto: '', tiempoEstimadoMin: 30, sensible: false, advertencia: '',
    bloques: [{ nombre: 'Escenario 1', contexto: '', preguntas: [preguntaVacia()] }],
    rubrica: [],
    personajes: [1, 2, 3, 4].map((n) => ({ nombre: `Persona ${n}`, descripcion: '', escenarios: [0] })),
    repartoRubrica: 'PONDERADA'
  };
}

@Component({
  selector: 'app-panel-docente',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <div class="dash dash-admin">
        <section class="dash-kpis">
          <article class="dash-kpi">
            <small>Casos</small>
            <strong>{{ casos().length }}</strong>
            <span>{{ publicados() }} publicados</span>
          </article>
          <article class="dash-kpi">
            <small>Grupos</small>
            <strong>{{ grupos().length }}</strong>
            <span>espacios a tu cargo</span>
          </article>
          <article class="dash-kpi">
            <small>Hoy</small>
            <strong>{{ hoy().length }}</strong>
            <span>{{ enCurso().length }} en curso</span>
          </article>
        </section>

        <section class="dash-cuerpo dash-cuerpo-admin dash-cuerpo-docente">
          <article class="dash-panel dash-panel-alto">
            <div class="tarjeta-cabeza">
              <h3>Agenda de hoy</h3>
              <a class="ver-todos" routerLink="/docente/programar">Programar →</a>
            </div>
            <ol class="dash-linea">
              @for (sesion of hoy(); track sesion.id) {
                <li>
                  <em>{{ hora(sesion.inicio) }}</em>
                  <div>
                    <strong>{{ sesion.caso }}</strong>
                    <p class="sub">{{ sesion.grupo }} · {{ sesion.estado }} · código {{ sesion.codigo }}</p>
                  </div>
                </li>
              } @empty {
                <li class="vacia">No hay sesiones hoy. Convoca un grupo cuando el caso esté listo.</li>
              }
            </ol>
          </article>

          <article class="dash-panel dash-panel-alto">
            <div class="tarjeta-cabeza">
              <h3>Próximas</h3>
              <a class="ver-todos" routerLink="/docente/programar">Ver todas →</a>
            </div>
            <ol class="dash-linea dash-linea-fecha">
              @for (sesion of proximas(); track sesion.id) {
                <li>
                  <div>
                    <strong>{{ sesion.caso }}</strong>
                    <p class="sub">{{ cuando(sesion.inicio) }} · {{ sesion.grupo }}</p>
                  </div>
                </li>
              } @empty {
                <li class="vacia">No hay sesiones por delante.</li>
              }
            </ol>
          </article>

          <section class="inicio-cats dash-cats">
            <div class="tarjeta-cabeza">
              <h3>Flujo de trabajo</h3>
            </div>
            <div class="cats cuatro">
              <a class="cat etica" routerLink="/docente/casos/nuevo">
                <svg viewBox="0 0 24 24"><path d="M5 5.5h9.5A2.5 2.5 0 0 1 17 8v11H8.5A2.5 2.5 0 0 1 6 16.5V6.5A1 1 0 0 0 5 5.5z"/></svg>
                <span>Diseñar</span><i>→</i>
              </a>
              <a class="cat social" routerLink="/docente/grupos">
                <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16.2" cy="9" r="2.4"/><path d="M4 19c.7-3.2 2.8-5.2 5-5.2s4.3 2 5 5.2M13.4 19c.4-2.2 1.7-3.6 3.2-3.6 1.6 0 3 1.5 3.4 3.6"/></svg>
                <span>Agrupar</span><i>→</i>
              </a>
              <a class="cat psico" routerLink="/docente/programar">
                <svg viewBox="0 0 24 24"><path d="M7 4v3M17 4v3M5 8h14M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></svg>
                <span>Convocar</span><i>→</i>
              </a>
              <a class="cat tec" routerLink="/docente/seguimiento">
                <svg viewBox="0 0 24 24"><path d="M5 19V10M10 19V5M15 19v-7M20 19V8"/></svg>
                <span>Seguir</span><i>→</i>
              </a>
            </div>
          </section>
        </section>
      </div>
    </app-marco-docente>
  `
})
export class PanelDocenteComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private busqueda = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  sesiones = signal<Sesion[]>([]);
  grupos = signal<Grupo[]>([]);
  constructor() {
    this.http.get<CasoResumen[]>('/api/docente/casos').subscribe((dato) => this.casos.set(dato));
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => this.sesiones.set(dato));
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => this.grupos.set(dato));
  }
  nombre() {
    const completo = this.auth.usuario()?.nombre ?? '';
    return completo.trim().split(/\s+/)[0] || 'docente';
  }
  casosVisibles() {
    const q = this.busqueda.texto().trim().toLowerCase();
    return this.casos().filter((caso) => !q || caso.nombre.toLowerCase().includes(q)).slice(0, 6);
  }
  publicados() {
    return this.casos().filter((caso) => caso.estado === 'PUBLICADO').length;
  }
  enCurso() {
    return this.sesiones().filter((sesion) => sesion.estado === 'EN_CURSO');
  }
  hoy() { return this.sesiones().filter((sesion) => this.mismoDia(sesion.inicio)); }
  proximas() { return this.sesiones().filter((sesion) => sesion.estado !== 'FINALIZADO' && !this.mismoDia(sesion.inicio)).slice(0, 4); }
  hora(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      .replace(/\s*p\.\s*m\./i, '\u00a0p.m.')
      .replace(/\s*a\.\s*m\./i, '\u00a0a.m.');
  }
  cuando(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  private mismoDia(iso: string) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return false;
    const hoy = new Date();
    return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth() && fecha.getDate() === hoy.getDate();
  }
}

@Component({
  selector: 'app-casos',
  imports: [MarcoDocenteComponent, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Mis casos</h1>
          <p>El listado abre el editor que ya existe. Crear un caso sigue en la misma pantalla de siempre.</p>
        </header>
        <article class="tarjeta">
          <div class="tarjeta-cabeza">
            <h2>Listado</h2>
            @if (puedeEditar()) { <a class="btn-oscuro" routerLink="/docente/casos/nuevo">Crear caso</a> }
          </div>
          <div class="rejilla-casos">
            @for (caso of visibles(); track caso.id; let i = $index) {
              <a class="curso" [routerLink]="['/docente/casos', caso.id]">
                <div class="franja" [attr.data-tono]="i % 3"></div>
                <span class="estado-pill">{{ caso.estado }}</span>
                <h3>{{ caso.nombre }}</h3>
                <p class="sub">{{ caso.bloques }} escenarios · {{ caso.preguntas }} preguntas</p>
              </a>
            } @empty { <p class="sub">No hay casos para mostrar.</p> }
          </div>
        </article>
      </section>
    </app-marco-docente>
  `
})
export class CasosComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private filtro = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  puedeEditar() { return this.auth.puede('EDITAR'); }
  constructor() { this.http.get<CasoResumen[]>('/api/docente/casos').subscribe((dato) => this.casos.set(dato)); }
  visibles() {
    const q = this.filtro.texto().trim().toLowerCase();
    return this.casos().filter((caso) => !q || caso.nombre.toLowerCase().includes(q) || caso.estado.toLowerCase().includes(q));
  }
}

/** movida: el docente la arrastró (si no, la escena reparte a los personajes sola). */
interface PersonaEscena { id: string; nombre: string; color: string; x: number; y: number; movida?: boolean; }
interface AyudaDescripcion { genero: string; edad: string; rol: string; }

/** Roles de las listas de ayuda: texto femenino y masculino que se escribe en la descripción. */
const ROLES_AYUDA = [
  { id: 'madre', f: 'madre', m: 'padre' }, { id: 'abuela', f: 'abuela', m: 'abuelo' }, { id: 'hija', f: 'hija', m: 'hijo' },
  { id: 'nina', f: 'niña', m: 'niño' }, { id: 'estudiante', f: 'la estudiante', m: 'el estudiante' },
  { id: 'docente', f: 'la docente', m: 'el docente' }, { id: 'medica', f: 'médica', m: 'médico' },
  { id: 'enfermera', f: 'enfermera', m: 'enfermero' }, { id: 'psicologa', f: 'psicóloga', m: 'psicólogo' },
  { id: 'trabajadora', f: 'trabajadora social', m: 'trabajador social' }, { id: 'policia', f: 'la policía', m: 'el policía' },
  { id: 'comisaria', f: 'comisaria de familia', m: 'comisario de familia' }, { id: 'vecina', f: 'vecina', m: 'vecino' }
];
/** Roles que ya implican un género (si no se eligió género en la lista). */
const GENERO_DEL_ROL: Record<string, string> = { madre: 'mujer' };

@Component({
  selector: 'app-editor-caso',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink, EditorTextoComponent, EscenaNovelaComponent,
    NovelaReproductorComponent, NgTemplateOutlet],
  styles: [`
    .personaje-fila { display: grid; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--line, #e5e7eb); }
    .ayudas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .ayudas select { flex: 1 1 110px; min-width: 0; padding: 5px 6px; font: inherit; font-size: .85rem; border: 1px solid var(--line, #d1d5db); border-radius: 6px; background: white; }
    .personaje-pie { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 12px; }
    .aparece { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: .85rem; }
    .aparece .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--line, #d1d5db); border-radius: 999px; cursor: pointer; }
    .entendido { font-size: .8rem; color: #2f6f68; font-weight: 600; }
    .entendido.falta { color: #6b7280; font-weight: 400; }
    .escena-controles { flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .acciones-editor { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .campo-cabeza { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .insertar { padding: 3px 10px; font: inherit; font-size: .8rem; border: 1px solid var(--line, #d1d5db); border-radius: 999px; background: white; cursor: pointer; }
    .form-dialogo { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; padding: 8px; border-radius: 8px; background: #f3f6f5; }
    .form-dialogo select, .form-dialogo input { padding: 6px 8px; font: inherit; border: 1px solid var(--line, #d1d5db); border-radius: 6px; }
    .form-dialogo input { flex: 1 1 220px; min-width: 0; }
    .form-dialogo button { padding: 6px 12px; font: inherit; border: 1px solid var(--line, #d1d5db); border-radius: 6px; background: white; cursor: pointer; }
    .ayuda-dialogo { display: block; margin-top: 4px; font-size: .78rem; color: #6b7280; }
    .modal-vista { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: #0f141c; color: #f3f3f3; }
    .modal-cabeza { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px 16px; background: #1b2430; }
    .modal-cabeza .cerrar, .modal-cabeza .musica { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
      border-radius: 8px; border: 0; background: #fff; color: #1d2430; font: inherit; line-height: 1.5; cursor: pointer; }
    /* "Música" va a la izquierda de "Cerrar", los dos pegados a la derecha. */
    .modal-cabeza .musica + .cerrar { margin-left: 0; }
    .modal-cabeza .musica svg { width: 1.15em; height: 1.15em; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .modal-cabeza .musica .parlante { fill: currentColor; }
    .modal-cabeza .cerrar:focus-visible, .modal-cabeza .musica:focus-visible { outline: 2px solid #9fe3d9; outline-offset: 2px; }
    .modal-cuerpo { flex: 1; overflow: auto; padding: 12px 16px; }
  `],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <section class="stack">
        <div class="row">
          <div>
            <p class="kicker">Creación / edición de caso</p>
            <h1>{{ caso.nombre || 'Crear caso de estudio clínico' }}</h1>
          </div>
          <div class="acciones-editor">
            <button mat-flat-button color="primary" type="button" (click)="abrirVistaPrevia($any($event.currentTarget))">Vista previa</button>
            <a mat-stroked-button routerLink="/docente/casos">Volver</a>
          </div>
        </div>
        <div class="pasos">
          @for (paso of pasos; track paso.id) {
            <button type="button" [class.activa]="activo() === paso.id" (click)="irA(paso.id)">{{ paso.texto }}</button>
          }
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (ok()) { <p class="ok">{{ ok() }}</p> }

        @if (activo() === 'estructura') {
          <section class="card stack">
            <label class="field"><span>NOMBRE</span><input [(ngModel)]="caso.nombre" [disabled]="bloqueado()" /></label>
            <div class="field">
              <div class="campo-cabeza"><span>DESARROLLO SITUACIONAL</span>
                @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertar('desarrollo')">Insertar diálogo</button> }
              </div>
              @if (insertando() === 'desarrollo') {
                <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: 'desarrollo' }" />
              }
              <app-editor #editorDesarrollo [(valor)]="caso.desarrolloSituacional" [bloqueado]="bloqueado()" />
              <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
            </div>
            <label class="field"><span>CONTEXTO</span>
              <app-editor [(valor)]="caso.contexto" [bloqueado]="bloqueado()" />
            </label>
            <label class="field"><span>TIEMPO ESTIMADO (MIN)</span><input type="number" [(ngModel)]="caso.tiempoEstimadoMin" [disabled]="bloqueado()" /></label>
          </section>
        }

        @if (activo() === 'escenas') {
          <section class="card stack">
            <h2>Escenas y contexto</h2>
            <p class="sub">Cada escena lleva su contexto. Las decisiones se arman en el siguiente paso.</p>
            @for (bloque of caso.bloques; track $index) {
              <article class="item stack">
                <label class="field"><span>NOMBRE DEL ESCENARIO</span><input [(ngModel)]="bloque.nombre" [disabled]="bloqueado()" /></label>
                <div class="field">
                  <div class="campo-cabeza"><span>CONTEXTO SITUACIONAL</span>
                    @if (!bloqueado()) { <button type="button" class="insertar" (click)="abrirInsertar('bloque-' + $index)">Insertar diálogo</button> }
                  </div>
                  @if (insertando() === 'bloque-' + $index) {
                    <ng-container *ngTemplateOutlet="formDialogo; context: { $implicit: { bloque: $index, area: ctx } }" />
                  }
                  <textarea #ctx [(ngModel)]="bloque.contexto" [disabled]="bloqueado()"
                    [attr.aria-label]="'Contexto situacional del escenario ' + ($index + 1)"></textarea>
                  <small class="ayuda-dialogo">{{ ayudaDialogo }}</small>
                </div>
                @if (!bloqueado()) { <button mat-stroked-button type="button" (click)="caso.bloques.splice($index, 1)">Quitar escenario</button> }
              </article>
            }
            @if (!bloqueado()) { <button mat-stroked-button type="button" (click)="agregarBloque()">Agregar escenario académico</button> }
          </section>
        }

        @if (activo() === 'preguntas') {
          <section class="card stack">
            @for (bloque of caso.bloques; track $index) {
              <article class="item stack">
                <h3>{{ bloque.nombre || 'Escenario' }}</h3>
                <p class="sub">{{ bloque.contexto }}</p>
                @for (pregunta of bloque.preguntas; track $index) {
                  <div class="stack">
                    <label class="field"><span>ENUNCIADO</span>
                      <app-editor [(valor)]="pregunta.enunciado" [bloqueado]="bloqueado()" />
                    </label>
                    <label class="field"><span>HERRAMIENTA (PISTA, OPCIONAL)</span><input [(ngModel)]="pregunta.pista" [disabled]="bloqueado()" /></label>
                    <div class="grid-2">
                      <label class="field"><span>CRITERIO</span><input [(ngModel)]="pregunta.criterio" [disabled]="bloqueado()" /></label>
                      <label class="field"><span>PESO</span><input type="number" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()" /></label>
                    </div>
                    @for (opcion of pregunta.opciones; track $index) {
                      <div class="item stack">
                        <label class="field"><span>OPCIÓN</span><input [(ngModel)]="opcion.texto" [disabled]="bloqueado()" /></label>
                        <label class="check"><input type="checkbox" [checked]="opcion.correcta" [disabled]="bloqueado()" (change)="marcar(pregunta, $index)" /> <span>Correcta</span></label>
                        <label class="field"><span>POR QUÉ</span><input [(ngModel)]="opcion.explicacion" [disabled]="bloqueado()" /></label>
                        <label class="field"><span>FUNDAMENTO</span><input [(ngModel)]="opcion.fundamento" [disabled]="bloqueado()" /></label>
                      </div>
                    }
                    @if (!bloqueado()) {
                      <button mat-stroked-button type="button" (click)="pregunta.opciones.push(opcionVacia())">Agregar opción</button>
                      <button mat-stroked-button type="button" (click)="quitarPregunta(bloque, $index)">Quitar pregunta</button>
                    }
                  </div>
                }
                @if (!bloqueado()) { <button mat-flat-button color="primary" type="button" (click)="agregarPregunta(bloque)">Agregar pregunta</button> }
              </article>
            }
          </section>
        }

        @if (activo() === 'rubrica') {
          <section class="card stack">
            <p class="sub">Cada pregunta tiene su criterio. Los pesos van de 0,0 a 5,0 y deben sumar 5,0.</p>
            <div class="row">
              <button mat-stroked-button type="button" [disabled]="bloqueado()" (click)="elegirReparto('PONDERADA')">Ponderada</button>
              <button mat-stroked-button type="button" [disabled]="bloqueado()" (click)="elegirReparto('EQUITATIVA')">Equitativa</button>
              <span class="sub">{{ caso.repartoRubrica === 'EQUITATIVA' ? 'El sistema reparte 5,0.' : 'Tú fijas cada peso.' }}</span>
            </div>
            @for (bloque of caso.bloques; track $index) {
              @for (pregunta of bloque.preguntas; track $index) {
                <div class="row">
                  <span>{{ bloque.nombre }} · {{ pregunta.criterio || 'Sin criterio' }}</span>
                  @if (caso.repartoRubrica === 'EQUITATIVA') {
                    <strong>{{ pregunta.peso || 0 }}</strong>
                  } @else {
                    <input type="number" min="0" max="5" step="0.1" [(ngModel)]="pregunta.peso" [disabled]="bloqueado()" />
                  }
                </div>
              }
            }
            <p>Suma actual: {{ suma() }}</p>
          </section>
        }

        @if (activo() === 'escena') {
          <section class="card stack">
            <h2>Diseño de escena</h2>
            <p class="sub">Describe a cada personaje (por ejemplo «madre de 38 años») y el sistema elige un personaje 3D que encaje. Marca en qué escenarios aparece y arrástralo en la escena: a los lados, o hacia arriba y abajo para alejarlo o acercarlo. La posición es solo el boceto de tu vista.</p>
            @for (personaje of caso.personajes; track $index; let i = $index) {
              <div class="personaje-fila">
                <div class="grid-2">
                  <label class="field"><span>NOMBRE</span><input [(ngModel)]="personaje.nombre" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)" /></label>
                  <div class="field">
                    <span>DESCRIPCIÓN</span>
                    <input [(ngModel)]="personaje.descripcion" [disabled]="bloqueado()" (ngModelChange)="cambioPersonaje(i)"
                      placeholder="Ej.: madre de 38 años, trabaja en una panadería" [attr.aria-label]="'Descripción de ' + (personaje.nombre || 'Persona ' + (i + 1))" />
                    <div class="ayudas" role="group" [attr.aria-label]="'Ayudas para describir a ' + (personaje.nombre || 'Persona ' + (i + 1))">
                      <select [disabled]="bloqueado()" [value]="ayuda(i).genero" (change)="escribirAyuda(i, 'genero', $any($event.target).value)" aria-label="Género">
                        <option value="">Género…</option>
                        <option value="mujer">Mujer</option>
                        <option value="hombre">Hombre</option>
                      </select>
                      <select [disabled]="bloqueado()" [value]="ayuda(i).edad" (change)="escribirAyuda(i, 'edad', $any($event.target).value)" aria-label="Edad">
                        <option value="">Edad…</option>
                        @for (e of edades; track e) { <option [value]="e">{{ e }} años</option> }
                      </select>
                      <select [disabled]="bloqueado()" [value]="ayuda(i).rol" (change)="escribirAyuda(i, 'rol', $any($event.target).value)" aria-label="Rol">
                        <option value="">Rol…</option>
                        @for (r of roles; track r.id) { <option [value]="r.id">{{ ayuda(i).genero === 'hombre' ? r.m : r.f }}</option> }
                      </select>
                    </div>
                  </div>
                </div>
                <div class="personaje-pie">
                  <div class="aparece" role="group" [attr.aria-label]="'Escenarios donde aparece ' + (personaje.nombre || 'Persona ' + (i + 1))">
                    <span>Aparece en:</span>
                    @for (bloque of caso.bloques; track $index; let b = $index) {
                      <label class="chip"><input type="checkbox" [checked]="personaje.escenarios.includes(b)" [disabled]="bloqueado()"
                        (change)="alternarEscenario(i, b)" />{{ b + 1 }}</label>
                    }
                  </div>
                  <small class="entendido" [class.falta]="!etiquetas()[i]">{{ etiquetas()[i] || 'Sin descripción: no aparece en la escena' }}</small>
                </div>
              </div>
            }
            <div class="row escena-controles">
              <div class="fondos" role="group" aria-label="Escenario">
                @for (bloque of casoEscena().bloques; track $index; let b = $index) {
                  <button type="button" [class.activa]="escenarioActivo() === b" (click)="escenarioActivo.set(b)">Escenario {{ b + 1 }}</button>
                }
              </div>
              <div class="fondos" role="group" aria-label="Fondo (solo en tu vista)">
                <button type="button" [class.activa]="!fondoManual()" (click)="elegirFondo(null)">Fondo automático</button>
                @for (fondo of fondos; track fondo.id) {
                  <button type="button" [class.activa]="fondoManual() === fondo.id" (click)="elegirFondo(fondo.id)">{{ fondo.nombre }}</button>
                }
              </div>
            </div>
            <app-escena-novela
              [caso]="casoEscena()" [bloque]="bloqueEscena()" [personajes]="personajesEscena()"
              [modoEditor]="true" [bloqueado]="bloqueado()" [fondoManual]="fondoManual()" [posiciones]="posicionesEscena()"
              (elenco)="recibirElenco($event)" (mover)="moverPersona($event)" />
            @if (detectados()) { <p class="sub">{{ detectados() }}</p> }
          </section>
        }

        @if (activo() === 'estado') {
          <section class="card stack">
            <p class="kicker">{{ caso.estado || 'SIN GUARDAR' }}</p>
            @if (!bloqueado()) { <button class="btn-oscuro" type="button" (click)="guardar()">Guardar borrador</button> }
            @if (caso.id) { <button class="btn-suave" type="button" (click)="duplicar()">Duplicar</button> }
            @if (puedePublicar()) { <button class="btn-oscuro" type="button" (click)="transicion('publicar')">Publicar</button> }
            @if (puedeVolverBorrador()) { <button class="btn-suave" type="button" (click)="transicion('despublicar')">Volver a borrador</button> }
            @if (puedeArchivar()) { <button class="btn-suave" type="button" (click)="transicion('archivar')">Archivar</button> }
          </section>
        }
        @if (vistaPrevia()) {
          <section class="card stack">
            <p class="kicker">Previsualización</p>
            <h2>{{ caso.nombre || 'Caso sin nombre' }}</h2>
            <div [innerHTML]="caso.desarrolloSituacional"></div>
            <div class="sub" [innerHTML]="caso.contexto"></div>
          </section>
        }
        <div class="row">
          @if (!bloqueado()) { <button class="btn-suave" type="button" (click)="guardar()">Guardar borrador</button> }
          <button class="btn-suave" type="button" (click)="vistaPrevia.set(!vistaPrevia())">Previsualizar</button>
          @if (puedePublicar()) { <button class="btn-oscuro" type="button" (click)="transicion('publicar')">Publicar</button> }
          @if (puedeVolverBorrador()) { <button class="btn-suave" type="button" (click)="transicion('despublicar')">Volver a borrador</button> }
          @if (puedeArchivar()) { <button class="btn-suave" type="button" (click)="transicion('archivar')">Archivar</button> }
        </div>
      </section>

      <!-- Formulario de "Insertar diálogo" (desarrollo situacional o contexto de un escenario). -->
      <ng-template #formDialogo let-destino>
        <div class="form-dialogo" role="group" aria-label="Insertar diálogo">
          @if (hablantes().length) {
            <select [(ngModel)]="dialogoPersonaje" aria-label="Personaje que habla">
              @for (h of hablantes(); track h) { <option [value]="h">{{ h }}</option> }
            </select>
            <input [(ngModel)]="dialogoTexto" placeholder="Lo que dice" aria-label="Lo que dice"
              (keydown.enter)="$event.preventDefault(); insertarDialogo(destino)" />
            <button type="button" (click)="insertarDialogo(destino)" [disabled]="!dialogoPersonaje || !dialogoTexto.trim()">Insertar</button>
          } @else {
            <span class="sub">Primero describe a los personajes en «Diseño de escena».</span>
          }
          <button type="button" (click)="insertando.set(null)">Cancelar</button>
        </div>
      </ng-template>

      @if (vistaAbierta(); as vista) {
        <div class="modal-vista" role="dialog" aria-modal="true" aria-label="Vista previa del caso" (keydown.escape)="cerrarVistaPrevia()">
          <header class="modal-cabeza">
            @if (musica.disponible()) {
              <button type="button" class="musica" [attr.aria-pressed]="musica.activa()"
                [attr.aria-label]="musica.activa() ? 'Silenciar música' : 'Activar música'" (click)="musica.alternar()">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path class="parlante" d="M3 7.5h3l4.5-3.5v12L6 12.5H3z" />
                  @if (musica.activa()) {
                    <path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.8 5a7 7 0 0 1 0 10" />
                  } @else {
                    <path d="M13.5 7.5l5 5M18.5 7.5l-5 5" />
                  }
                </svg>
                <span>Música</span>
              </button>
            }
            <button type="button" class="cerrar" (click)="cerrarVistaPrevia()">Cerrar</button>
          </header>
          <div class="modal-cuerpo">
            <!-- Los resultados se calculan aquí, con los datos del editor: no hay peticiones al backend. -->
            <app-novela-reproductor [caso]="vista" [personajes]="vista.personajes"
              [resultados]="resultadosVista()" [mostrarCerrar]="true"
              (finalizar)="resultadosVista.set(calcularResultados(vista, $event))" (reiniciar)="resultadosVista.set(null)"
              (cerrar)="cerrarVistaPrevia()" anchoMaximo="calc((100vh - 130px) * 16 / 9)" />
          </div>
        </div>
      }
    </app-marco-docente>
  `
})
export class EditorCasoComponent {
  readonly musica = inject(MusicaNovelaService);
  // Si se sale del editor con la vista previa abierta, la música no sigue sonando.
  private readonly alSalir = inject(DestroyRef).onDestroy(() => this.musica.detener());
  enlaces = enlaces;
  pasos = [
    { id: 'estructura', texto: 'Información general' },
    { id: 'escenas', texto: 'Escenas y contexto' },
    { id: 'preguntas', texto: 'Decisiones y opciones' },
    { id: 'rubrica', texto: 'Rúbrica' },
    { id: 'escena', texto: 'Diseño de escena' },
    { id: 'estado', texto: 'Estado' }
  ];
  /** Fondos que el docente puede fijar a mano (solo cambian su vista). */
  fondos = FONDOS_MANUALES;
  edades = [8, 15, 22, 30, 38, 50, 66, 80];
  roles = ROLES_AYUDA;
  opcionVacia = opcionVacia;
  preguntaVacia = preguntaVacia;
  activo = signal('estructura');
  vistaPrevia = signal(false);
  caso: Caso = casoVacio();
  error = signal('');
  ok = signal('');
  /** null = fondo automático (el mismo que verá el estudiante). */
  fondoManual = signal<string | null>(null);
  escenarioActivo = signal(0);
  /** Copias del caso para la escena; se actualizan con 600 ms de espera al escribir. */
  casoEscena = signal<CasoNovela>({ nombre: '', bloques: [] });
  personajesEscena = signal<PersonajeNovela[]>([]);
  bloqueEscena = computed<BloqueNovela>(() => {
    const bloques = this.casoEscena().bloques;
    const indice = Math.min(this.escenarioActivo(), Math.max(0, bloques.length - 1));
    const b = bloques[indice];
    return { indice, nombre: b?.nombre || `Escenario ${indice + 1}`, contexto: b?.contexto ?? '' };
  });
  /** Solo las posiciones que el docente arrastró; las demás las reparte la escena según cuántos hay. */
  posicionesEscena = computed(() => this.personas().map(p => (p.movida ? { x: p.x, y: p.y } : null)));
  /** Lo que entendió el motor de cada personaje ("Madre · 38 años"), por índice. */
  etiquetas = signal<Record<number, string>>({});
  /** Aviso cuando no hay descripciones y el motor detecta personajes en el texto del caso. */
  detectados = signal('');
  // ---- Vista previa (no guarda nada ni llama al backend al elegir opciones)
  /** Copia del caso al abrir la vista previa (lo escrito en el editor, aunque no esté guardado). */
  vistaAbierta = signal<Caso | null>(null);
  /** Resultados de la vista previa (calculados en el navegador al pulsar "Finalizar"). */
  resultadosVista = signal<ResultadosNovela | null>(null);
  calcularResultados = calcularResultados;
  private botonVista?: HTMLElement;
  // ---- Insertar diálogo
  readonly ayudaDialogo = "Para que un personaje hable, escribe 'Nombre: lo que dice' o usa Insertar diálogo. Lo demás lo cuenta el narrador.";
  insertando = signal<string | null>(null);
  dialogoPersonaje = '';
  dialogoTexto = '';
  private editorDesarrollo = viewChild<EditorTextoComponent>('editorDesarrollo');
  private ayudas: Record<number, AyudaDescripcion> = {};
  private generado: Record<number, string> = {};
  private esperaEscena?: ReturnType<typeof setTimeout>;
  personas = signal<PersonaEscena[]>([
    { id: 'p1', nombre: 'Persona 1', color: '#3ee0ff', x: 8, y: 58 },
    { id: 'p2', nombre: 'Persona 2', color: '#ffba20', x: 30, y: 58 },
    { id: 'p3', nombre: 'Persona 3', color: '#00ff94', x: 52, y: 58 },
    { id: 'p4', nombre: 'Persona 4', color: '#c4b5fd', x: 74, y: 58 }
  ]);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private claveBoceto = 'dilema-boceto-nuevo';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id && !this.auth.puede('EDITAR')) {
      this.router.navigateByUrl('/docente/casos');
      return;
    }
    this.claveBoceto = `dilema-boceto-${id ?? 'nuevo'}`;
    const guardado = localStorage.getItem(this.claveBoceto);
    if (guardado) {
      try {
        // El "fondo" de bocetos anteriores era un degradado CSS: ya no se usa; ahora se guarda fondoManual.
        const boceto = JSON.parse(guardado) as { fondoManual?: string | null; personas?: PersonaEscena[] };
        if (boceto.fondoManual) this.fondoManual.set(boceto.fondoManual);
        if (Array.isArray(boceto.personas) && boceto.personas.length) this.personas.set(boceto.personas);
      } catch { localStorage.removeItem(this.claveBoceto); }
    }
    this.refrescarEscena();
    if (id) {
      this.http.get<Caso>(`/api/docente/casos/${id}`).subscribe({
        next: (dato) => {
          this.caso = this.recibir(dato);
          this.personas.update((lista) => lista.map((persona, indice) => ({
            ...persona,
            nombre: this.caso.personajes[indice]?.nombre || persona.nombre
          })));
          this.refrescarEscena();
        },
        error: (falla) => this.error.set(mensajeError(falla))
      });
    }
  }
  irA(paso: string) {
    this.activo.set(paso);
    // Los escenarios y textos se editan en otras pestañas: al entrar a la escena se toma la versión actual.
    if (paso === 'escena') this.refrescarEscena();
  }
  /** Copia el caso actual para la escena (la escena solo se entera de los cambios por estas copias). */
  refrescarEscena() {
    clearTimeout(this.esperaEscena);
    this.casoEscena.set({
      id: this.caso.id ?? null, nombre: this.caso.nombre,
      desarrolloSituacional: this.caso.desarrolloSituacional, contexto: this.caso.contexto,
      bloques: this.caso.bloques.map((b) => ({ nombre: b.nombre, contexto: b.contexto }))
    });
    this.personajesEscena.set((this.caso.personajes ?? []).map((p) => ({
      nombre: p.nombre ?? '', descripcion: p.descripcion ?? '', escenarios: [...(p.escenarios ?? [])]
    })));
  }
  /** Nombre o descripción cambiaron: el modelo se actualiza tras 600 ms sin escribir. */
  cambioPersonaje(indice: number) {
    this.sincronizarPersona(indice);
    clearTimeout(this.esperaEscena);
    this.esperaEscena = setTimeout(() => this.refrescarEscena(), 600);
  }
  alternarEscenario(indice: number, bloque: number) {
    const personaje = this.caso.personajes[indice];
    if (!personaje) return;
    const lista = new Set(personaje.escenarios ?? []);
    if (lista.has(bloque)) lista.delete(bloque); else lista.add(bloque);
    personaje.escenarios = [...lista].sort((a, b) => a - b);
    this.refrescarEscena();
  }
  ayuda(indice: number): AyudaDescripcion {
    return this.ayudas[indice] ??= { genero: '', edad: '', rol: '' };
  }
  /**
   * Las listas de género, edad y rol escriben una frase al inicio de la descripción (por ejemplo
   * "madre de 38 años"); lo que el docente escribió después se conserva.
   */
  escribirAyuda(indice: number, campo: keyof AyudaDescripcion, valor: string) {
    const personaje = this.caso.personajes[indice];
    if (!personaje) return;
    const ayuda = this.ayuda(indice);
    ayuda[campo] = valor;
    const genero = ayuda.genero || GENERO_DEL_ROL[ayuda.rol] || '';
    const rol = ROLES_AYUDA.find((r) => r.id === ayuda.rol);
    const quien = rol ? (genero === 'hombre' ? rol.m : rol.f) : (genero === 'hombre' ? 'hombre' : genero === 'mujer' ? 'mujer' : '');
    const frase = [quien, ayuda.edad ? `${quien ? 'de ' : ''}${ayuda.edad} años` : ''].filter(Boolean).join(' ');
    let resto = (personaje.descripcion ?? '').trim();
    const previo = this.generado[indice];
    if (previo && resto.startsWith(previo)) resto = resto.slice(previo.length).replace(/^[\s,;.]+/, '');
    personaje.descripcion = [frase, resto].filter(Boolean).join(', ');
    this.generado[indice] = frase;
    this.cambioPersonaje(indice);
  }
  recibirElenco(asignados: Asignacion[]) {
    const etiquetas: Record<number, string> = {};
    for (const a of asignados) if (a.personaje.indice >= 0) etiquetas[a.personaje.indice] = a.perfil.etiqueta;
    this.etiquetas.set(etiquetas);
    const detectados = asignados.filter((a) => a.personaje.detectado);
    this.detectados.set(detectados.length
      ? 'Aún no describes a ningún personaje. Con el texto del caso, el estudiante verá: '
        + detectados.map((a) => `${a.personaje.nombre} (${a.perfil.etiqueta})`).join(', ') + '.'
      : '');
  }
  abrirVistaPrevia(boton: HTMLElement) {
    this.botonVista = boton;
    this.vistaAbierta.set(structuredClone(this.caso));
    this.resultadosVista.set(null);
    this.musica.iniciar();
    document.body.style.overflow = 'hidden';
    // Foco en el reproductor para usarlo con teclado.
    setTimeout(() => document.querySelector<HTMLElement>('.modal-vista .reproductor')?.focus(), 0);
  }
  cerrarVistaPrevia() {
    this.musica.detener();
    this.vistaAbierta.set(null);
    document.body.style.overflow = '';
    this.botonVista?.focus();
  }
  /** Personajes que pueden hablar: los que tienen descripción. */
  hablantes() {
    return (this.caso.personajes ?? []).filter((p) => (p.descripcion ?? '').trim())
      .map((p, i) => (p.nombre ?? '').trim() || `Persona ${i + 1}`);
  }
  abrirInsertar(destino: string) {
    this.insertando.set(this.insertando() === destino ? null : destino);
    this.dialogoTexto = '';
    if (!this.hablantes().includes(this.dialogoPersonaje)) this.dialogoPersonaje = this.hablantes()[0] ?? '';
  }
  /** Inserta "Nombre: texto" en una línea nueva donde estaba el cursor. Se guarda en el mismo campo de siempre. */
  insertarDialogo(destino: 'desarrollo' | { bloque: number; area: HTMLTextAreaElement }) {
    const texto = this.dialogoTexto.trim();
    if (!this.dialogoPersonaje || !texto) return;
    const linea = `${this.dialogoPersonaje}: ${texto}`;
    if (destino === 'desarrollo') {
      this.editorDesarrollo()?.insertarLinea(linea);
    } else {
      const bloque = this.caso.bloques[destino.bloque];
      if (!bloque) return;
      const valor = bloque.contexto ?? '';
      const pos = Math.min(destino.area.selectionStart ?? valor.length, valor.length);
      const antes = valor.slice(0, pos), despues = valor.slice(pos);
      const prefijo = antes && !antes.endsWith('\n') ? '\n' : '';
      const sufijo = despues && !despues.startsWith('\n') ? '\n' : '';
      bloque.contexto = antes + prefijo + linea + sufijo + despues;
      const cursor = (antes + prefijo + linea).length;
      setTimeout(() => { destino.area.focus(); destino.area.setSelectionRange(cursor, cursor); });
    }
    this.dialogoTexto = '';
    this.insertando.set(null);
  }
  moverPersona(evento: { indice: number; x: number; y: number }) {
    this.personas.update((lista) => lista.map((p, i) => i === evento.indice ? { ...p, x: evento.x, y: evento.y, movida: true } : p));
    this.guardarBoceto();
  }
  bloqueado() {
    return !this.auth.puede('EDITAR') || this.caso.estado === 'PUBLICADO' || this.caso.estado === 'ARCHIVADO';
  }
  puedePublicar() {
    return !!this.caso.id && this.auth.puede('EDITAR') && (this.caso.estado === 'BORRADOR' || this.caso.estado === 'ARCHIVADO');
  }
  puedeVolverBorrador() { return !!this.caso.id && this.auth.puede('EDITAR') && this.caso.estado === 'PUBLICADO'; }
  puedeArchivar() { return !!this.caso.id && this.auth.puede('EDITAR') && this.caso.estado === 'PUBLICADO'; }
  sincronizarPersona(indice: number) {
    const nombre = this.caso.personajes[indice]?.nombre;
    if (!nombre) return;
    this.personas.update((lista) => lista.map((persona, i) => i === indice ? { ...persona, nombre } : persona));
    this.guardarBoceto();
  }
  suma() {
    return Math.round(this.caso.bloques.reduce((total, bloque) => total + bloque.preguntas.reduce((peso, pregunta) => peso + Number(pregunta.peso || 0), 0), 0) * 10) / 10;
  }
  elegirReparto(modo: 'PONDERADA' | 'EQUITATIVA') {
    this.caso.repartoRubrica = modo;
    if (modo === 'EQUITATIVA') this.repartir();
  }
  repartir() {
    const preguntas = this.caso.bloques.flatMap((bloque) => bloque.preguntas);
    const cantidad = preguntas.length;
    if (!cantidad) return;
    const parte = Math.floor((5 / cantidad) * 10) / 10;
    let acumulado = 0;
    preguntas.forEach((pregunta, indice) => {
      const peso = indice === cantidad - 1 ? Math.round((5 - acumulado) * 10) / 10 : parte;
      acumulado = Math.round((acumulado + peso) * 10) / 10;
      pregunta.peso = peso;
    });
  }
  agregarBloque() {
    this.caso.bloques.push({ nombre: `Escenario académico ${this.caso.bloques.length + 1}`, contexto: '', preguntas: [preguntaVacia()] });
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
  }
  agregarPregunta(bloque: Bloque) {
    bloque.preguntas.push(preguntaVacia());
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
  }
  quitarPregunta(bloque: Bloque, indice: number) {
    bloque.preguntas.splice(indice, 1);
    if (this.caso.repartoRubrica === 'EQUITATIVA') this.repartir();
  }
  marcar(pregunta: { opciones: { correcta: boolean }[] }, indice: number) {
    pregunta.opciones.forEach((opcion, i) => opcion.correcta = i === indice);
  }
  elegirFondo(id: string | null) { this.fondoManual.set(id); this.guardarBoceto(); }
  guardar() {
    this.error.set('');
    const pedido = this.caso.id
      ? this.http.put<Caso>(`/api/docente/casos/${this.caso.id}`, this.caso)
      : this.http.post<Caso>('/api/docente/casos', this.caso);
    pedido.subscribe({
      next: (dato) => {
        this.caso = this.recibir(dato);
        this.ok.set('Borrador guardado.');
        if (!this.route.snapshot.paramMap.get('id')) this.router.navigate(['/docente/casos', dato.id]);
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  duplicar() {
    this.http.post<Caso>(`/api/docente/casos/${this.caso.id}/duplicar`, {}).subscribe({
      next: (dato) => this.router.navigate(['/docente/casos', dato.id]),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  transicion(accion: 'publicar' | 'despublicar' | 'archivar') {
    this.error.set('');
    this.http.post<Caso>(`/api/docente/casos/${this.caso.id}/${accion}`, {}).subscribe({
      next: (dato) => {
        this.caso = this.recibir(dato);
        this.ok.set(accion === 'publicar' ? 'Caso publicado.' : accion === 'archivar' ? 'Caso archivado.' : 'El caso volvió a borrador.');
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  private recibir(dato: Caso) {
    dato.repartoRubrica ??= 'PONDERADA';
    dato.personajes ??= [];
    return dato;
  }
  private guardarBoceto() {
    localStorage.setItem(this.claveBoceto, JSON.stringify({ fondoManual: this.fondoManual(), personas: this.personas() }));
  }
}

@Component({
  selector: 'app-grupos',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Grupos</h1>
          <p>Cohortes, matrícula y asignación de casos.</p>
        </header>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <div class="dos">
          <section class="tarjeta stack">
            <div class="row"><h2>Mis grupos</h2>@if (puedeGestionar()) { <button class="btn-oscuro" type="button" (click)="nuevo.set(!nuevo())">Nuevo grupo</button> }</div>
            @if (nuevo()) {
              <label class="field"><span>Nombre</span><input [(ngModel)]="nombre" /></label>
              <label class="field"><span>Semestre</span><input [(ngModel)]="espacio" placeholder="2026-I" /></label>
              <button class="btn-oscuro" type="button" (click)="crear()">Crear grupo</button>
            }
            @for (grupo of gruposVisibles(); track grupo.id) {
              <button class="item grupo-item" type="button" [class.activa]="seleccionado() === grupo.id" (click)="elegir(grupo.id)">
                <strong>{{ grupo.nombre }}</strong>
                <p class="sub">{{ grupo.espacioAcademico }} · {{ grupo.estudiantes.length }} estudiantes</p>
              </button>
            }
          </section>
          @if (actual(); as grupo) {
            <section class="tarjeta stack">
              <div class="row">
                <div>
                  <h2>{{ grupo.nombre }}</h2>
                  <p class="sub">{{ grupo.espacioAcademico }}</p>
                </div>
                <a mat-flat-button color="primary" [routerLink]="['/docente/programar']" [queryParams]="{ grupo: grupo.id }">Asignar caso a grupo</a>
              </div>
              <label class="field"><span>Nombre del estudiante</span>
                <input [(ngModel)]="nombres[grupo.id]" placeholder="Nombre completo" />
              </label>
              <label class="field"><span>Correo institucional</span>
                <input [(ngModel)]="correos[grupo.id]" placeholder="estudiante@universidad.edu" />
              </label>
              <button class="btn-matricula" mat-stroked-button type="button" (click)="agregar(grupo.id)">Matricular</button>
              <p class="sub">El estudiante no recibe contraseña. El código llega al agendar la sesión.</p>
              <div class="tabla-grupo-scroll">
                <table class="tabla-grupo">
                  <thead><tr><th>Nombre</th><th>Correo</th><th></th></tr></thead>
                  <tbody>
                    @for (estudiante of grupo.estudiantes; track estudiante.id) {
                      <tr>
                        <td>{{ estudiante.nombre }}</td>
                        <td>{{ estudiante.email }}</td>
                        <td><button mat-stroked-button type="button" (click)="retirar(grupo.id, estudiante.id)">Eliminar</button></td>
                      </tr>
                    } @empty { <tr><td colspan="3">Este grupo no tiene estudiantes.</td></tr> }
                  </tbody>
                </table>
              </div>
            </section>
          }
        </div>
      </section>
    </app-marco-docente>
  `
})
export class GruposComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  grupos = signal<Grupo[]>([]);
  seleccionado = signal<number | null>(null);
  nuevo = signal(false);
  actual = computed(() => this.grupos().find((g) => g.id === this.seleccionado()) ?? null);
  nombre = '';
  espacio = '';
  correos: Record<number, string> = {};
  nombres: Record<number, string> = {};
  private auth = inject(AuthService);
  private filtro = inject(BusquedaService);
  error = signal('');
  puedeGestionar() { return this.auth.puede('GESTIONAR_ESPACIOS_ACADEMICOS'); }
  gruposVisibles() {
    const q = this.filtro.texto().trim().toLowerCase();
    return this.grupos().filter((grupo) => !q || grupo.nombre.toLowerCase().includes(q) || grupo.espacioAcademico.toLowerCase().includes(q));
  }
  constructor() { this.cargar(); }
  crear() {
    this.http.post<Grupo>('/api/docente/grupos', { nombre: this.nombre, espacioAcademico: this.espacio }).subscribe({
      next: () => { this.nombre = ''; this.espacio = ''; this.cargar(); },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  agregar(id: number) {
    this.http.post(`/api/docente/grupos/${id}/estudiantes`, { nombre: this.nombres[id] ?? '', email: this.correos[id] ?? '' }).subscribe({
      next: () => this.cargar(),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  retirar(grupoId: number, estudianteId: number) {
    this.http.delete(`/api/docente/grupos/${grupoId}/estudiantes/${estudianteId}`).subscribe({ next: () => this.cargar() });
  }
  elegir(id: number) { this.seleccionado.set(id); }
  private cargar() {
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => {
      this.grupos.set(dato);
      if (!dato.some((g) => g.id === this.seleccionado())) this.seleccionado.set(dato[0]?.id ?? null);
    });
  }
}

@Component({
  selector: 'app-programar',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule, RouterLink],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Programar</h1>
          <p>Agenda un caso publicado con un grupo y abre la sesión cuando corresponda.</p>
        </header>
        <div class="dos-ancha">
          <section class="tarjeta stack">
            <h2>Caso y grupo</h2>
            <label class="field"><span>Caso publicado</span>
              <select [(ngModel)]="casoId">
                @for (caso of casos(); track caso.id) { @if (caso.estado === 'PUBLICADO') { <option [ngValue]="caso.id">{{ caso.nombre }}</option> } }
              </select>
            </label>
            <label class="field"><span>Grupo</span>
              <select [(ngModel)]="grupoId">
                @for (grupo of grupos(); track grupo.id) { <option [ngValue]="grupo.id">{{ grupo.nombre }} · {{ grupo.espacioAcademico }}</option> }
              </select>
            </label>
            <h2>Programación</h2>
            <div class="grid-2">
              <label class="field"><span>Inicio</span><input type="datetime-local" [(ngModel)]="inicio" /></label>
              <label class="field"><span>Fin</span><input type="datetime-local" [(ngModel)]="fin" /></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Tiempo máximo (min)</span><input type="number" [(ngModel)]="tiempoMax" /></label>
              <label class="field"><span>Tolerancia de ingreso (min)</span><input type="number" [(ngModel)]="tolerancia" /></label>
            </div>
            <label class="field"><span>Lugar</span><input [(ngModel)]="lugar" /></label>
            <label class="field"><span>Mensaje para los estudiantes</span><textarea [(ngModel)]="mensaje"></textarea></label>
            @if (error()) { <p class="error">{{ error() }}</p> }
            @if (ok()) { <p class="ok">{{ ok() }}</p> }
            <div class="row row-programar">
              <div class="row-acciones">
                <button mat-stroked-button type="button" (click)="borrador()">Guardar borrador</button>
                <button mat-flat-button color="primary" type="button" (click)="agendar()">Guardar y notificar</button>
              </div>
              <a mat-stroked-button routerLink="/docente/grupos">Cancelar</a>
            </div>
          </section>
          <aside class="tarjeta stack">
            <h2>Resumen</h2>
            <p><strong>Caso.</strong> {{ nombreCaso() }}</p>
            <p><strong>Grupo.</strong> {{ nombreGrupo() }}</p>
            <p><strong>Ventana.</strong> {{ inicio || '—' }} → {{ fin || '—' }}</p>
            <p><strong>Tiempo.</strong> {{ tiempoMax }} minutos · tolerancia {{ tolerancia }}</p>
            <p><strong>Lugar.</strong> {{ lugar || 'Sin lugar físico' }}</p>
            <p class="sub">Al notificar, cada estudiante recibe el mensaje, la URL y el código. La sesión nace sin iniciar hasta que el docente la abra.</p>
          </aside>
        </div>
        <h2>Convocatorias</h2>
        @for (sesion of sesionesVisibles(); track sesion.id) {
          <article class="tarjeta stack">
            <small>{{ sesion.estado }} · código {{ sesion.codigo }}</small>
            <h3>{{ sesion.caso }}</h3>
            <p class="sub">{{ sesion.grupo }} · {{ sesion.inicio }} → {{ sesion.fin }}</p>
            <p class="sub">{{ sesion.lugar || 'Sin lugar físico' }} · tolerancia {{ sesion.toleranciaMin }} min</p>
            <div class="row">
              @if (sesion.estado === 'SIN_INICIAR') { <button mat-flat-button color="primary" type="button" (click)="accion(sesion.id, 'iniciar')">Iniciar</button> }
              @if (sesion.estado === 'EN_CURSO') { <button mat-stroked-button type="button" (click)="accion(sesion.id, 'finalizar')">Finalizar</button> }
            </div>
          </article>
        }
      </section>
    </app-marco-docente>
  `
})
export class ProgramarComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private filtro = inject(BusquedaService);
  casos = signal<CasoResumen[]>([]);
  grupos = signal<Grupo[]>([]);
  sesiones = signal<Sesion[]>([]);
  casoId = 0;
  grupoId = 0;
  inicio = '';
  fin = '';
  tiempoMax = 30;
  tolerancia = 15;
  lugar = '';
  mensaje = '';
  error = signal('');
  ok = signal('');
  constructor() {
    const guardado = localStorage.getItem('dilema-agenda');
    if (guardado) {
      try {
        const dato = JSON.parse(guardado);
        this.casoId = dato.casoId ?? 0;
        this.grupoId = dato.grupoId ?? 0;
        this.inicio = dato.inicio ?? '';
        this.fin = dato.fin ?? '';
        this.tiempoMax = dato.tiempoMax ?? 30;
        this.tolerancia = dato.tolerancia ?? 15;
        this.lugar = dato.lugar ?? '';
        this.mensaje = dato.mensaje ?? '';
      } catch { localStorage.removeItem('dilema-agenda'); }
    }
    const grupo = Number(this.route.snapshot.queryParamMap.get('grupo') || 0);
    if (grupo) this.grupoId = grupo;
    this.cargar();
  }
  nombreCaso() { return this.casos().find((c) => c.id === Number(this.casoId))?.nombre ?? 'Sin caso'; }
  sesionesVisibles() {
    const q = this.filtro.texto().trim().toLowerCase();
    return this.sesiones().filter((sesion) => !q || sesion.caso.toLowerCase().includes(q) || sesion.grupo.toLowerCase().includes(q) || sesion.codigo.toLowerCase().includes(q));
  }
  nombreGrupo() { return this.grupos().find((g) => g.id === Number(this.grupoId))?.nombre ?? 'Sin grupo'; }
  borrador() {
    localStorage.setItem('dilema-agenda', JSON.stringify({
      casoId: this.casoId, grupoId: this.grupoId, inicio: this.inicio, fin: this.fin,
      tiempoMax: this.tiempoMax, tolerancia: this.tolerancia, lugar: this.lugar, mensaje: this.mensaje
    }));
    this.ok.set('Borrador guardado en este navegador.');
    this.error.set('');
  }
  agendar() {
    this.http.post<Sesion>('/api/docente/sesiones', {
      casoId: Number(this.casoId), grupoId: Number(this.grupoId), inicio: this.inicio, fin: this.fin,
      tiempoMaxMin: Number(this.tiempoMax), toleranciaMin: Number(this.tolerancia), lugar: this.lugar, mensaje: this.mensaje
    }).subscribe({
      next: () => {
        this.ok.set('Convocatoria registrada. Los estudiantes reciben el aviso sin que el código quede visible.');
        localStorage.removeItem('dilema-agenda');
        this.cargar();
      },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  accion(id: number, verbo: string) {
    this.http.post(`/api/docente/sesiones/${id}/${verbo}`, {}).subscribe({ next: () => this.cargar(), error: (falla) => this.error.set(mensajeError(falla)) });
  }
  private cargar() {
    this.http.get<CasoResumen[]>('/api/docente/casos').subscribe((dato) => {
      this.casos.set(dato);
      if (!dato.some((c) => c.id === Number(this.casoId))) this.casoId = dato.find((c) => c.estado === 'PUBLICADO')?.id ?? 0;
    });
    this.http.get<Grupo[]>('/api/docente/grupos').subscribe((dato) => {
      this.grupos.set(dato);
      if (!dato.some((g) => g.id === Number(this.grupoId))) this.grupoId = dato[0]?.id ?? 0;
    });
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => this.sesiones.set(dato));
  }
}

@Component({
  selector: 'app-seguimiento',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, RouterLink, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      <section class="tablero">
        <header class="saludo">
          <h1>Reportes</h1>
          <p>Desempeño, estado de la bitácora y descarga del grupo.</p>
        </header>
        <div class="dos-ancha reportes-grid">
          <div class="filtros">
            <label class="field"><span>Caso</span>
              <select [(ngModel)]="sesionId" (ngModelChange)="ver($event)">
                @for (sesion of sesiones(); track sesion.id) {
                  <option [ngValue]="sesion.id">{{ sesion.caso }} · {{ sesion.grupo }}</option>
                }
              </select>
            </label>
            <label class="field"><span>Estudiante</span>
              <input [(ngModel)]="busqueda" placeholder="Filtrar por estudiante" />
            </label>
          </div>
          <table>
            <thead><tr><th>Estudiante</th><th>Estado</th><th>Puntaje</th><th>Nivel</th><th></th></tr></thead>
            <tbody>
              @for (fila of visibles(); track fila.email) {
                <tr>
                  <td>{{ fila.estudiante }}<br><small>{{ fila.email }}</small></td>
                  <td>{{ fila.estado }}</td>
                  <td>{{ fila.nota ?? '—' }} / 5,0</td>
                  <td>{{ nivel(fila.nota) }}</td>
                  <td>
                    @if (fila.participacionId) { <a mat-stroked-button [routerLink]="['/docente/seguimiento', fila.participacionId]">Ver respuestas</a> }
                  </td>
                </tr>
              } @empty { <tr><td colspan="5">No hay estudiantes en esta convocatoria.</td></tr> }
            </tbody>
          </table>
          <aside class="tarjeta stack ficha-cohorte">
            <h2>Ficha de cohorte</h2>
            <p class="nota">{{ promedio() }}</p>
            <p class="sub">Promedio sobre 5,0</p>
            <p>Finalizados: {{ finalizados() }} / {{ filas().length }}</p>
            <p>Pendientes: {{ filas().length - finalizados() }}</p>
            <p>Superior {{ conteo('Superior') }} · Alto {{ conteo('Alto') }} · Básico {{ conteo('Básico') }} · Bajo {{ conteo('Bajo') }}</p>
            <div class="row">
              <button class="btn-oscuro" type="button" (click)="descargar('csv')">CSV</button>
              <button class="btn-suave" type="button" (click)="descargar('pdf')">PDF</button>
              <button class="btn-suave" type="button" (click)="descargar('xlsx')">Excel</button>
            </div>
          </aside>
        </div>
      </section>
    </app-marco-docente>
  `
})
export class SeguimientoComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private filtro = inject(BusquedaService);
  sesiones = signal<Sesion[]>([]);
  filas = signal<Fila[]>([]);
  sesionId = 0;
  busqueda = '';
  constructor() {
    this.http.get<Sesion[]>('/api/docente/sesiones').subscribe((dato) => {
      this.sesiones.set(dato);
      if (dato[0]) this.ver(dato[0].id);
    });
  }
  ver(id: number) {
    this.sesionId = Number(id);
    this.http.get<Fila[]>(`/api/docente/sesiones/${this.sesionId}/seguimiento`).subscribe((dato) => this.filas.set(dato));
  }
  visibles() {
    const textos = [this.busqueda, this.filtro.texto()].map((texto) => texto.trim().toLowerCase()).filter(Boolean);
    return this.filas().filter((fila) => textos.every((q) => fila.estudiante.toLowerCase().includes(q) || fila.email.toLowerCase().includes(q)));
  }
  nivel(nota: number | null) {
    if (nota == null) return '—';
    if (nota >= 4.6) return 'Superior';
    if (nota >= 4) return 'Alto';
    if (nota >= 3) return 'Básico';
    return 'Bajo';
  }
  finalizados() { return this.filas().filter((f) => f.estado === 'FINALIZADA' || f.estado === 'AUSENTE').length; }
  promedio() {
    const notas = this.filas().map((f) => f.nota).filter((n): n is number => n != null);
    if (!notas.length) return '—';
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
  }
  conteo(nivel: string) { return this.filas().filter((f) => this.nivel(f.nota) === nivel).length; }
  descargar(formato: 'csv' | 'pdf' | 'xlsx') {
    this.http.get(`/api/docente/sesiones/${this.sesionId}/reporte`, { params: { formato }, responseType: 'blob' }).subscribe((archivo) => {
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `reporte-${this.sesionId}.${formato}`;
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }
}

@Component({
  selector: 'app-detalle-participacion',
  imports: [MatButtonModule, MatCardModule, MarcoDocenteComponent, FormsModule],
  template: `
    <app-marco-docente [enlaces]="enlaces">
      @if (dato(); as actual) {
        <section class="tarjeta stack">
          <p class="kicker">{{ actual.estudiante }} · {{ actual.estado }}</p>
          <h1>{{ actual.caso }}</h1>
          <p class="nota">{{ actual.nota ?? '—' }}</p>
          @for (pregunta of actual.preguntas; track pregunta.id) {
            <article class="item">
              <small>{{ pregunta.bloque }} · {{ pregunta.criterio }}</small>
              <h3>{{ pregunta.enunciado }}</h3>
              @for (opcion of pregunta.opciones; track opcion.id) {
                <p [class.ok]="opcion.correcta" [class.error]="pregunta.seleccionId === opcion.id && !opcion.correcta">
                  {{ pregunta.seleccionId === opcion.id ? 'Elegida: ' : '' }}{{ opcion.texto }}
                </p>
              }
            </article>
          }
          <label class="field"><span>VALORACIÓN GENERAL</span><textarea [(ngModel)]="texto" [disabled]="actual.estado !== 'FINALIZADA'"></textarea></label>
          @if (error()) { <p class="error">{{ error() }}</p> }
          @if (ok()) { <p class="ok">{{ ok() }}</p> }
          <button mat-flat-button color="primary" type="button" [disabled]="actual.estado !== 'FINALIZADA'" (click)="valorar(actual.id)">Guardar valoración</button>
          @if (actual.repeticionAutorizada) {
            <p class="ok">Ya hay un intento adicional autorizado.</p>
          } @else {
            <button mat-stroked-button type="button" [disabled]="actual.estado !== 'FINALIZADA'" (click)="repetir(actual.id)">Autorizar repetición</button>
          }
        </section>
      }
    </app-marco-docente>
  `
})
export class DetalleParticipacionComponent {
  enlaces = enlaces;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  dato = signal<Participacion | null>(null);
  texto = '';
  error = signal('');
  ok = signal('');
  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.http.get<Participacion>(`/api/participaciones/${id}`).subscribe({
      next: (dato) => { this.dato.set(dato); this.texto = dato.retroalimentacion ?? ''; },
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  valorar(id: number) {
    this.http.post(`/api/docente/participaciones/${id}/retroalimentacion`, { texto: this.texto }).subscribe({
      next: () => this.ok.set('Valoración registrada. El estudiante recibe el aviso.'),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
  repetir(id: number) {
    this.http.post(`/api/docente/participaciones/${id}/repeticion`, {}).subscribe({
      next: () => this.ok.set('Repetición autorizada para un intento adicional.'),
      error: (falla) => this.error.set(mensajeError(falla))
    });
  }
}
