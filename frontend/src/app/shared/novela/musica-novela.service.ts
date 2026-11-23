import { Injectable, signal } from '@angular/core';

/** Pista de música de la novela: frontend/audio/Harp.mp3 (angular.json la publica en /audio/). */
export const ARCHIVO_MUSICA = '/audio/Harp.mp3';
const VOLUMEN = 0.35;
const CLAVE_PREFERENCIA = 'dilema-musica';

/**
 * Música de fondo de la novela visual, en bucle.
 * - Si el archivo no existe, `disponible()` queda en false y no se muestra el botón.
 * - La preferencia (activa o silenciada) se recuerda en este navegador; por defecto está activa.
 */
@Injectable({ providedIn: 'root' })
export class MusicaNovelaService {
  readonly disponible = signal(false);
  readonly activa = signal(leerPreferencia());

  private audio: HTMLAudioElement | null = null;
  private comprobacion: Promise<boolean> | null = null;
  /** La novela está abierta (la música debe sonar si está activa). */
  private enCurso = false;

  /** Mira una sola vez si el archivo existe y es audio (sin él, el servidor puede devolver la página). */
  comprobar(): Promise<boolean> {
    this.comprobacion ??= fetch(ARCHIVO_MUSICA, { method: 'HEAD', cache: 'no-cache' })
      .then(r => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/'))
      .catch(() => false)
      .then(ok => { this.disponible.set(ok); return ok; });
    return this.comprobacion;
  }

  /** Se abre la novela: suena si el archivo existe y la música está activa. */
  async iniciar(): Promise<void> {
    this.enCurso = true;
    if (await this.comprobar()) this.sincronizar();
  }

  /** Se cierra la novela: se detiene y vuelve al principio. */
  detener(): void {
    this.enCurso = false;
    if (this.audio) { this.audio.pause(); this.audio.currentTime = 0; }
  }

  alternar(): void {
    this.activa.set(!this.activa());
    try { localStorage.setItem(CLAVE_PREFERENCIA, this.activa() ? 'activa' : 'silenciada'); } catch { /* sin almacenamiento */ }
    this.sincronizar();
  }

  private sincronizar(): void {
    if (!this.disponible()) return;
    if (this.enCurso && this.activa()) {
      if (!this.audio) {
        this.audio = new Audio(ARCHIVO_MUSICA);
        this.audio.loop = true;
        this.audio.volume = VOLUMEN;
      }
      // Si el navegador bloquea la reproducción automática, sonará al pulsar el botón.
      this.audio.play().catch(() => {});
    } else {
      this.audio?.pause();
    }
  }
}

function leerPreferencia(): boolean {
  try { return localStorage.getItem(CLAVE_PREFERENCIA) !== 'silenciada'; } catch { return true; }
}
