import { Injectable } from '@angular/core';
import { BloqueEscena, CasoEscena, FondoElegido, IndiceEscenas, elegirFondo } from './escena';

export type { BloqueEscena, CasoEscena, FondoElegido } from './escena';

/** Fondos que el docente puede fijar a mano en su vista (no cambian lo que ve el estudiante). */
export const FONDOS_MANUALES: { id: string; nombre: string; escenaId: string }[] = [
  { id: 'hospital', nombre: 'Hospital', escenaId: 'hospital-urgencias' },
  { id: 'comisaria', nombre: 'Comisaría', escenaId: 'comisaria' },
  { id: 'aula', nombre: 'Aula', escenaId: 'colegio-salon' },
  { id: 'comunidad', nombre: 'Comunidad', escenaId: 'calle-barrio' },
  { id: 'consultorio', nombre: 'Consultorio', escenaId: 'consultorio' },
  { id: 'casa', nombre: 'Casa', escenaId: 'casa-sala' }
];

/** Elige el fondo de cada escenario con public/escenas/escenas.json (ver escena.ts). */
@Injectable({ providedIn: 'root' })
export class EscenaService {
  private indicePromesa?: Promise<IndiceEscenas>;

  indice(): Promise<IndiceEscenas> {
    this.indicePromesa ??= fetch('/escenas/escenas.json')
      .then(r => { if (!r.ok) throw new Error(`escenas.json: ${r.status}`); return r.json() as Promise<IndiceEscenas>; })
      .catch(e => { this.indicePromesa = undefined; throw e; });
    return this.indicePromesa;
  }

  /**
   * Fondo del escenario. Con `manual` (id de FONDOS_MANUALES) se usa esa escena con el mismo momento del
   * día y la misma semilla; es solo para la vista del docente.
   */
  async elegir(caso: CasoEscena, bloque: BloqueEscena, manual?: string | null): Promise<FondoElegido> {
    const indice = await this.indice();
    const automatico = elegirFondo(indice, caso, bloque);
    const escenaId = FONDOS_MANUALES.find(f => f.id === manual)?.escenaId;
    if (!escenaId || escenaId === automatico.escenaId) return automatico;
    // Reutiliza la elección con un índice que solo contiene la escena pedida.
    const soloEsa = { ...indice, escenas: indice.escenas.filter(e => e.id === escenaId) };
    const forzado = elegirFondo(soloEsa, caso, { ...bloque, nombre: `${bloque.nombre} ${soloEsa.escenas[0]?.palabras[0] ?? ''}` });
    return { ...forzado, motivo: automatico.motivo };
  }
}
