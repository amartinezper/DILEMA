import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  CapacidadesExpresion, NIVEL_POR_DEFECTO, NivelExpresion, PersonajeVrmComponent, TiemposCarga
} from '../shared/personaje-vrm/personaje-vrm.component';

const CATALOGO = '/personajes/catalogo/';

/** Una entrada de personajes.json (solo los campos que usa la demo). */
interface Personaje {
  archivo: string;
  id_elenco: string;
  extra: boolean;
  rol: string;
  edad_aparente: string | null;
  nombre: string | null;
  autor: string | null;
  pide_credito: boolean;
  licencia: string;
  excepcion_licencia: boolean;
  version_vrm: string;
  peso_original_mb: number;
  peso_ligero_mb: number;
  expresiones: Record<string, boolean>;
  materiales_fusionados: boolean;
  no_juntar_con: string[];
  notas: string;
}

/** Estado de la demo y expresión VRM normalizada que necesita (en personajes.json). */
const EXPRESIONES: { id: string; requiere?: string }[] = [
  { id: 'neutral' },
  { id: 'alegre', requiere: 'alegria' },
  { id: 'amable', requiere: 'relajado' },
  { id: 'preocupado', requiere: 'tristeza' },
  { id: 'tenso', requiere: 'enojo' },
  { id: 'alterado', requiere: 'enojo' },
  { id: 'sorprendido', requiere: 'sorpresa' },
  { id: 'llorando', requiere: 'tristeza' }
];

/** Página aislada para revisar el catálogo de personajes. No se enlaza desde el menú. */
@Component({
  selector: 'app-demo-personaje',
  imports: [PersonajeVrmComponent, MatButtonModule],
  template: `
    <main class="demo">
      <h1>Catálogo de personajes 3D</h1>

      @if (errorCatalogo()) {
        <p class="aviso-fijo" role="alert">No se pudo leer personajes.json: {{ errorCatalogo() }}</p>
      }

      <div class="selector">
        <label for="personaje">Personaje</label>
        <select id="personaje" [value]="actual()?.archivo ?? ''" (change)="elegir($any($event.target).value)">
          @for (g of grupos(); track g.id) {
            <optgroup [label]="g.id + ' · ' + g.rol">
              @for (p of g.personajes; track p.archivo) {
                <option [value]="p.archivo">
                  {{ p.archivo.replace('.vrm', '') }} · {{ p.nombre || 'sin nombre' }} · {{ p.peso_ligero_mb }} MB{{ p.extra ? ' · extra' : '' }}
                </option>
              }
            </optgroup>
          }
        </select>
        <button mat-stroked-button type="button" (click)="mover(-1)" aria-label="Personaje anterior">◀</button>
        <button mat-stroked-button type="button" (click)="mover(1)" aria-label="Personaje siguiente">▶</button>
        <button mat-button type="button" (click)="recargar()">Volver a medir</button>
        <button mat-button type="button" (click)="medirTodos()" [disabled]="midiendoTodos()">
          {{ midiendoTodos() ? 'Midiendo ' + (indice() + 1) + ' de ' + personajes().length + '…' : 'Medir todos' }}
        </button>
      </div>

      <div class="escenario">
        <div class="fondo" aria-hidden="true">
          <div class="ventana"><div class="marco-v"></div><div class="marco-h"></div></div>
          <div class="zocalo"></div>
          <div class="piso"></div>
        </div>

        @if (actual(); as p) {
          <!-- La clave de la lista fuerza a crear un componente nuevo en cada carga. -->
          @for (clave of [claveCarga()]; track clave) {
            <app-personaje-vrm class="personaje"
              [url]="url(p)"
              [expresion]="expresion()"
              [hablando]="hablando()"
              [nivel]="nivel()"
              (capacidades)="capacidades.set($event)"
              (progreso)="progreso.set($event)"
              (cargado)="estado.set('listo')"
              (tiempos)="registrar(p, $event)"
              (fallo)="falla(p, $event)" />
          }
        }

        @if (estado() === 'cargando' && actual()) {
          <div class="aviso">Cargando {{ actual()!.archivo }}… {{ progreso() }}%</div>
        }
        @if (estado() === 'error') {
          <div class="aviso error" role="alert">No se pudo cargar {{ actual()?.archivo }}: {{ mensaje() }}</div>
        }

        @if (actual(); as p) {
          @let r = resultados()[p.archivo];
          @let t = r?.tiempos;
          <div class="tiempos" aria-live="polite">
            <table>
              <caption>Carga de {{ p.archivo }} (s)</caption>
              <thead><tr><th>Peso</th><th>Descarga</th><th>Preparación</th><th>Total</th></tr></thead>
              <tbody>
                <tr>
                  @if (r?.error) {
                    <td colspan="4" class="fallo">error: {{ r?.error }}</td>
                  } @else if (t) {
                    <td>{{ mb(t.bytes) }}</td>
                    <td>{{ t.descarga.toFixed(2) }}</td>
                    <td>{{ t.preparacion.toFixed(2) }}</td>
                    <td><strong>{{ t.total.toFixed(2) }}</strong></td>
                  } @else {
                    <td colspan="4" class="vacio">—</td>
                  }
                </tr>
              </tbody>
            </table>
          </div>
        }

        <div class="dialogo">
          <span class="nombre">{{ actual()?.rol ?? 'Personaje' }}</span>
          <p>{{ visible() }}@if (hablando()) {<span class="cursor">▍</span>}</p>
        </div>
      </div>

      <div class="controles" aria-label="Expresiones">
        <div class="niveles" role="radiogroup" aria-label="Intensidad de la expresión">
          @for (n of niveles; track n) {
            <button mat-stroked-button type="button" role="radio" [attr.aria-checked]="nivel() === n"
              [class.activo]="nivel() === n" (click)="nivel.set(n)">{{ n }}</button>
          }
        </div>
        @for (e of expresiones; track e.id) {
          @let falta = !!e.requiere && !actual()?.expresiones?.[e.requiere] && !capacidades()?.partes;
          <button mat-stroked-button type="button" [class.activo]="expresion() === e.id" [disabled]="falta"
            [attr.title]="falta ? 'Este modelo no trae la expresión ' + e.requiere : null"
            (click)="expresion.set(e.id)">{{ e.id }}</button>
        }
        <button mat-flat-button type="button" (click)="escribir()">Repetir diálogo (bocas)</button>
      </div>

      @if (actual(); as p) {
        <section class="ficha">
          <h2>{{ p.archivo }} — {{ p.nombre || 'sin nombre' }} @if (p.extra) {<span class="etiqueta">extra</span>}
            @if (p.excepcion_licencia) {<span class="etiqueta alerta">excepción de licencia</span>}</h2>
          <dl>
            <dt>Rol</dt><dd>{{ p.id_elenco }} · {{ p.rol }} · edad aparente {{ p.edad_aparente ?? '—' }}</dd>
            <dt>Autor</dt><dd>{{ p.autor || 'sin autor en el archivo' }}{{ p.pide_credito ? ' (pide crédito)' : '' }}</dd>
            <dt>Peso</dt><dd>{{ p.peso_original_mb }} MB → {{ p.peso_ligero_mb }} MB · VRM {{ p.version_vrm }}
              {{ p.materiales_fusionados ? '· materiales fusionados' : '' }}</dd>
            <dt>Expresiones</dt><dd>{{ faltantes(p) }}</dd>
            <dt>Licencia</dt><dd>{{ p.licencia }}</dd>
            @if (p.no_juntar_con.length) {
              <dt>No juntar con</dt><dd>{{ p.no_juntar_con.join(', ') }}</dd>
            }
            <dt>Notas</dt><dd>{{ p.notas }}</dd>
          </dl>
        </section>
      }

      @if (medidos().length) {
        <section class="medidos">
          <h2>Tiempos medidos (de más lento a más rápido)</h2>
          <table>
            <thead><tr><th>Archivo</th><th>Peso</th><th>Descarga</th><th>Preparación</th><th>Total (s)</th></tr></thead>
            <tbody>
              @for (m of medidos(); track m.archivo) {
                <tr>
                  <th scope="row">{{ m.archivo }}</th>
                  @if (m.error) {
                    <td colspan="4" class="fallo">error: {{ m.error }}</td>
                  } @else {
                    <td>{{ mb(m.tiempos!.bytes) }}</td>
                    <td>{{ m.tiempos!.descarga.toFixed(2) }}</td>
                    <td>{{ m.tiempos!.preparacion.toFixed(2) }}</td>
                    <td><strong>{{ m.tiempos!.total.toFixed(2) }}</strong></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </main>
  `,
  styles: [`
    .demo { max-width: 1100px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 16px; }
    h1 { margin: 0; font-size: 1.4rem; }
    h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .escenario { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; background: #cfe7e3; }
    .fondo { position: absolute; inset: -12px; filter: blur(3px);
      background: linear-gradient(180deg, #d8efeb 0%, #c4e2dd 62%, #b7d6d1 100%); }
    .ventana { position: absolute; left: 9%; top: 14%; width: 24%; height: 38%; border: 10px solid #f4f7f6;
      background: linear-gradient(180deg, #a9d4f0 0%, #dceefa 100%); box-shadow: 0 4px 14px rgba(0,0,0,.12); }
    .marco-v { position: absolute; left: 50%; top: 0; bottom: 0; width: 8px; transform: translateX(-50%); background: #f4f7f6; }
    .marco-h { position: absolute; top: 50%; left: 0; right: 0; height: 8px; transform: translateY(-50%); background: #f4f7f6; }
    .zocalo { position: absolute; left: 0; right: 0; top: 66%; height: 3%; background: #8fb8b2; }
    .piso { position: absolute; left: 0; right: 0; top: 69%; bottom: 0;
      background: repeating-linear-gradient(90deg, #e3e6e4 0 80px, #d6dad8 80px 82px); }
    .personaje { position: absolute; inset: 0; }
    .aviso { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px 14px;
      border-radius: 8px; background: rgba(0,0,0,.6); color: #fff; font-size: .9rem; }
    .aviso.error { background: #b3261e; }
    .aviso-fijo { margin: 0; padding: 8px 12px; border-radius: 8px; background: #b3261e; color: #fff; }
    .dialogo { position: absolute; left: 4%; right: 4%; bottom: 4%; min-height: 22%; padding: 22px 22px 16px;
      border-radius: 10px; background: rgba(15,20,28,.78); color: #f3f3f3; border: 1px solid rgba(255,255,255,.15); }
    .dialogo p { margin: 0; font-size: clamp(.85rem, 1.8vw, 1.15rem); line-height: 1.5; }
    .nombre { position: absolute; top: -14px; left: 18px; padding: 4px 12px; border-radius: 6px;
      background: #2f6f68; color: #fff; font-weight: 600; font-size: .85rem; }
    .cursor { animation: parpadeo .8s steps(1) infinite; margin-left: 2px; }
    @keyframes parpadeo { 50% { opacity: 0; } }
    .controles, .selector { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .selector select { min-width: 0; max-width: 100%; flex: 1 1 280px; padding: 8px; border-radius: 6px;
      border: 1px solid #9aa5a3; font: inherit; background: #fff; }
    .controles .activo { background: #2f6f68; color: #fff; }
    .niveles { display: flex; gap: 4px; padding-right: 8px; margin-right: 4px; border-right: 1px solid #c9d1cf; }
    .tiempos { position: absolute; top: 12px; left: 12px; padding: 8px 10px; border-radius: 8px;
      background: rgba(15,20,28,.78); color: #f3f3f3; font-size: .78rem; font-variant-numeric: tabular-nums; }
    .tiempos caption { text-align: left; font-weight: 600; padding-bottom: 4px; }
    .tiempos th, .tiempos td { padding: 2px 6px; text-align: right; white-space: nowrap; }
    .tiempos thead th { font-weight: 500; opacity: .75; }
    .fallo { color: #b3261e; text-align: left; white-space: normal; }
    .tiempos .fallo { color: #ffb4ab; max-width: 260px; }
    .tiempos .vacio { text-align: center; opacity: .5; }
    .ficha dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; font-size: .9rem; }
    .ficha dt { font-weight: 600; }
    .ficha dd { margin: 0; overflow-wrap: anywhere; }
    .etiqueta { margin-left: 8px; padding: 2px 8px; border-radius: 10px; background: #e0ece9; font-size: .75rem; font-weight: 500; }
    .etiqueta.alerta { background: #fde2dd; color: #8c1d18; }
    .medidos { overflow-x: auto; }
    .medidos table { border-collapse: collapse; font-size: .85rem; font-variant-numeric: tabular-nums; }
    .medidos th, .medidos td { padding: 3px 10px; text-align: right; border-bottom: 1px solid #e3e6e4; white-space: nowrap; }
    .medidos th[scope=row] { text-align: left; font-weight: 500; }
    @media (max-width: 640px) { .tiempos { font-size: .65rem; padding: 4px 6px; } .ficha dl { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
  `]
})
export class DemoPersonajeComponent implements OnInit, OnDestroy {
  readonly expresiones = EXPRESIONES;
  readonly texto = 'Mujer de 22 años, hospitalizada en urgencias, que requiere apoyo psicosocial y protección institucional.';

  readonly expresion = signal('neutral');
  /** Intensidad de las expresiones; por defecto la del motor (nunca "fuerte"). */
  readonly niveles: NivelExpresion[] = ['leve', 'normal', 'fuerte'];
  readonly nivel = signal<NivelExpresion>(NIVEL_POR_DEFECTO);
  /** Lo que trae el modelo cargado (partes sueltas de VRoid y expresiones completas). */
  readonly capacidades = signal<CapacidadesExpresion | undefined>(undefined);
  readonly hablando = signal(false);
  readonly visible = signal('');
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly progreso = signal(0);
  readonly mensaje = signal('');
  readonly errorCatalogo = signal('');

  readonly personajes = signal<Personaje[]>([]);
  readonly indice = signal(0);
  readonly actual = computed<Personaje | undefined>(() => this.personajes()[this.indice()]);
  readonly grupos = computed(() => {
    const mapa = new Map<string, { id: string; rol: string; personajes: Personaje[] }>();
    for (const p of this.personajes()) {
      if (!mapa.has(p.id_elenco)) mapa.set(p.id_elenco, { id: p.id_elenco, rol: p.rol, personajes: [] });
      mapa.get(p.id_elenco)!.personajes.push(p);
    }
    return [...mapa.values()];
  });
  readonly claveCarga = signal(0);
  readonly resultados = signal<Record<string, { tiempos?: TiemposCarga; error?: string }>>({});
  readonly medidos = computed(() =>
    Object.entries(this.resultados())
      .map(([archivo, r]) => ({ archivo, ...r }))
      .sort((a, b) => (b.tiempos?.total ?? Infinity) - (a.tiempos?.total ?? Infinity)));
  readonly midiendoTodos = signal(false);

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.escribir();
    fetch(CATALOGO + 'personajes.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`el servidor respondió ${r.status}`); return r.json(); })
      .then((d: { personajes: Personaje[] }) => {
        // Mismo orden que el selector: por Id y, dentro de cada Id, por archivo.
        this.personajes.set([...d.personajes].sort((a, b) =>
          a.id_elenco.localeCompare(b.id_elenco) || a.archivo.localeCompare(b.archivo)));
        this.recargar();
      })
      .catch(e => this.errorCatalogo.set(e instanceof Error ? e.message : String(e)));
  }

  ngOnDestroy(): void { clearTimeout(this.temporizador); }

  url(p: Personaje): string { return CATALOGO + p.archivo; }

  elegir(archivo: string): void {
    const i = this.personajes().findIndex(p => p.archivo === archivo);
    if (i < 0 || i === this.indice()) return;
    this.indice.set(i);
    this.recargar();
  }

  mover(paso: number): void {
    const n = this.personajes().length;
    if (!n) return;
    this.indice.set((this.indice() + paso + n) % n);
    this.recargar();
  }

  /** Vuelve a crear el personaje para medir otra vez el modelo elegido. */
  recargar(): void {
    this.estado.set('cargando');
    this.progreso.set(0);
    this.mensaje.set('');
    this.capacidades.set(undefined);
    if (this.actual() && !this.expresionDisponible(this.actual()!, this.expresion())) this.expresion.set('neutral');
    this.claveCarga.update(n => n + 1);
  }

  /** Carga todos los modelos uno tras otro, desde el primero, y deja la tabla de tiempos completa. */
  medirTodos(): void {
    if (!this.personajes().length) return;
    this.resultados.set({});
    this.midiendoTodos.set(true);
    this.indice.set(0);
    this.recargar();
  }

  registrar(p: Personaje, t: TiemposCarga): void {
    this.resultados.update(r => ({ ...r, [p.archivo]: { tiempos: t } }));
    this.siguienteEnMedicion();
  }

  falla(p: Personaje, mensaje: string): void {
    this.mensaje.set(mensaje);
    this.estado.set('error');
    this.resultados.update(r => ({ ...r, [p.archivo]: { error: mensaje } }));
    this.siguienteEnMedicion();
  }

  private siguienteEnMedicion(): void {
    if (!this.midiendoTodos()) return;
    if (this.indice() >= this.personajes().length - 1) { this.midiendoTodos.set(false); return; }
    // Una pausa corta deja liberar el modelo anterior antes de medir el siguiente.
    setTimeout(() => this.mover(1), 300);
  }

  expresionDisponible(p: Personaje, id: string): boolean {
    const e = EXPRESIONES.find(x => x.id === id);
    return !e?.requiere || !!p.expresiones[e.requiere];
  }

  faltantes(p: Personaje): string {
    const faltan = Object.entries(p.expresiones).filter(([, v]) => !v).map(([k]) => k);
    return faltan.length ? 'trae todas menos: ' + faltan.join(', ') : 'trae todas';
  }

  mb(bytes: number): string {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /** Escribe el texto letra por letra; mientras tanto el personaje habla. */
  escribir(): void {
    clearTimeout(this.temporizador);
    this.visible.set('');
    this.hablando.set(true);
    let i = 0;
    const paso = () => {
      i++;
      this.visible.set(this.texto.slice(0, i));
      if (i >= this.texto.length) { this.hablando.set(false); return; }
      const letra = this.texto[i - 1];
      this.temporizador = setTimeout(paso, letra === ',' ? 220 : letra === '.' ? 320 : 38);
    };
    this.temporizador = setTimeout(paso, 400);
  }
}
