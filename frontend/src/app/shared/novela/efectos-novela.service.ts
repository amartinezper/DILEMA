import { Injectable, signal } from '@angular/core';

/** Efectos de la libreta: pasar de línea, elegir una ficha y anotar la decisión. */
export type Efecto = 'avanzar' | 'elegir' | 'anotar';

const CLAVE = 'dilema-efectos';

function leerPreferencia(): boolean {
  try { return localStorage.getItem(CLAVE) !== '0'; } catch { return true; }
}

/**
 * Efectos de sonido suaves de la novela, sintetizados con Web Audio (sin archivos ni dependencias):
 * un roce de papel al avanzar, un toque de lápiz al elegir y dos notas suaves al anotar. Se apagan con el
 * botón "Efectos" y la preferencia se recuerda en este navegador. Son independientes de la música.
 */
@Injectable({ providedIn: 'root' })
export class EfectosNovelaService {
  readonly activos = signal(leerPreferencia());
  private contexto?: AudioContext;
  private ruido?: AudioBuffer;

  alternar(): void {
    const v = !this.activos();
    this.activos.set(v);
    try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch { /* sin almacenamiento: solo esta sesión */ }
    if (v) this.sonar('elegir');
  }

  sonar(efecto: Efecto): void {
    if (!this.activos() || typeof window === 'undefined') return;
    try {
      const Contexto = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) return;
      this.contexto ??= new Contexto();
      const c = this.contexto;
      if (c.state === 'suspended') void c.resume();
      const t = c.currentTime + 0.01;
      if (efecto === 'avanzar') this.papel(c, t);
      else if (efecto === 'elegir') this.lapiz(c, t);
      else { this.nota(c, t, 660, 0.12); this.nota(c, t + 0.11, 990, 0.18); }
    } catch {
      // Sin audio (navegador sin permiso o sin Web Audio): el juego sigue igual.
    }
  }

  /** Roce de papel: ruido corto filtrado, muy bajo. */
  private papel(c: AudioContext, t: number): void {
    this.ruido ??= this.crearRuido(c);
    const fuente = c.createBufferSource();
    fuente.buffer = this.ruido;
    const filtro = c.createBiquadFilter();
    filtro.type = 'bandpass'; filtro.frequency.value = 2200; filtro.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    fuente.connect(filtro).connect(g).connect(c.destination);
    fuente.start(t); fuente.stop(t + 0.14);
  }

  /** Toque de lápiz: un golpe corto y agudo. */
  private lapiz(c: AudioContext, t: number): void {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.1);
  }

  /** Nota suave (anotar). */
  private nota(c: AudioContext, t: number, frecuencia: number, duracion: number): void {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = frecuencia;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + duracion + 0.02);
  }

  private crearRuido(c: AudioContext): AudioBuffer {
    const b = c.createBuffer(1, Math.round(c.sampleRate * 0.15), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
}
