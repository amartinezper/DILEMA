/**
 * Gestos del cuerpo de los personajes de la novela (funciones puras, sin Angular ni three.js).
 *
 * Elige la categoría de animación de cada personaje según el paso del guion y las emociones que el motor
 * ya detecta (DICCIONARIO_EXPRESIONES de guion.ts), y la versión concreta de cada categoría sin repetir
 * el mismo gesto en dos personajes a la vez. El catálogo está en public/animaciones/animaciones.json.
 *
 * Este archivo no importa nada en tiempo de ejecución para poder probarse con `node --test` (gestos.spec.mts).
 */

import type { Emocion, Nivel, Reaccion } from './guion';

export type Categoria = 'reposo' | 'hablar' | 'escuchar' | 'tristeza' | 'llanto' | 'rabia' | 'nervios'
  | 'pensar' | 'alivio' | 'saludo' | 'sentado';
export const CATEGORIAS: Categoria[] = ['reposo', 'hablar', 'escuchar', 'tristeza', 'llanto', 'rabia', 'nervios',
  'pensar', 'alivio', 'saludo', 'sentado'];

/** Para quién es la animación: quien habla, quien escucha o ambos. */
export type Papel = 'habla' | 'escucha' | 'ambos';

/** Una animación del catálogo (animaciones.json). */
export interface AnimacionCatalogo {
  id: string;
  /** Nombre del FBX en public/animaciones/. */
  archivo: string;
  categoria: Categoria;
  papel: Papel;
  /** false: se hace una vez (asentir) y el personaje vuelve a su reposo. */
  bucle: boolean;
  /** Gesto con los brazos muy abiertos: no se usa con el personaje junto al borde de la escena. */
  amplio?: boolean;
  /** Pendiente: está en el catálogo pero todavía no se usa (sentado). */
  pendiente?: boolean;
  nota?: string;
}

/** Gesto que le toca a un personaje en el paso actual. */
export interface Gesto { categoria: Categoria; papel: 'habla' | 'escucha'; }

/** Lo que el reproductor sabe del paso actual. */
export interface PasoGestos {
  tipo: 'dialogo' | 'narracion' | 'otro';
  /** Personajes en escena (ids de slotDe). */
  presentes: number[];
  /** Quien habla (solo en diálogo). */
  hablante: number | null;
  /** Emoción de la frase que se dice (diálogo); null si la frase no sugiere ninguna. */
  emocionFrase: { emocion: Emocion; nivel: Nivel } | null;
  /** Emoción que arrastra cada personaje en la escena. */
  emociones: Record<number, { emocion: Emocion | 'neutral'; nivel: Nivel }>;
  /** Personajes a los que la narración les describe una emoción ("la madre rompe en llanto"). */
  reacciones: Reaccion[];
  /** Texto del paso (para distinguir el alivio de otras alegrías). */
  texto: string;
}

const fuerteONormal = (n: Nivel) => n === 'fuerte' || n === 'normal';
/** La frase habla de llanto (no solo de tristeza): llora, lágrimas, solloza. */
const esLlanto = (texto: string) => /llor|lagrim|sollo/.test(sinTildes(texto));

function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Quien HABLA: hablar; con rabia o gritos, discutir/gritar; con llanto, llanto; con miedo, nervios. */
function gestoHablante(e: PasoGestos['emocionFrase'], texto: string): Categoria {
  if (!e) return 'hablar';
  if (e.emocion === 'enojo' && fuerteONormal(e.nivel)) return 'rabia';
  if (e.emocion === 'tristeza' && (e.nivel === 'fuerte' || esLlanto(texto))) return 'llanto';
  if (e.emocion === 'tristeza' && e.nivel === 'normal') return 'tristeza';
  if (e.emocion === 'sorpresa' && fuerteONormal(e.nivel)) return 'nervios';
  return 'hablar';
}

/** Emoción que el personaje arrastra y que se le nota en el cuerpo aunque escuche (o null). */
function gestoPropio(e: { emocion: Emocion | 'neutral'; nivel: Nivel } | undefined): Categoria | null {
  if (!e || !fuerteONormal(e.nivel)) return null;
  if (e.emocion === 'tristeza') return 'tristeza';
  if (e.emocion === 'enojo') return 'rabia';
  if (e.emocion === 'sorpresa') return 'nervios';
  return null;
}

/** Reacción descrita en la narración ("la madre rompe en llanto", "el hermano grita furioso"). */
function gestoReaccion(r: Reaccion, texto: string): Gesto | null {
  if (r.emocion === 'tristeza') return { categoria: r.nivel === 'fuerte' || esLlanto(texto) ? 'llanto' : 'tristeza', papel: 'escucha' };
  if (r.emocion === 'enojo' && fuerteONormal(r.nivel)) return { categoria: 'rabia', papel: r.nivel === 'fuerte' ? 'habla' : 'escucha' };
  if (r.emocion === 'sorpresa' && fuerteONormal(r.nivel)) return { categoria: 'nervios', papel: 'escucha' };
  if (r.emocion === 'alegria' && /alivi|respir\w* (hondo|profundo)/.test(sinTildes(texto))) return { categoria: 'alivio', papel: 'escucha' };
  return null;
}

/**
 * Gesto de cada personaje presente en el paso. Con movimiento reducido, todos en reposo.
 * - Diálogo: quien habla según la emoción de su frase; quienes escuchan según su propia emoción o el tono
 *   de la frase (triste → tristeza; rabia, gritos o miedo → nervios). Si el tono es neutro, el primero que
 *   escucha asiente una vez y los demás quedan en reposo.
 * - Narración: todos en reposo, salvo a quien la frase le describe una emoción.
 */
export function elegirGestos(p: PasoGestos, movimientoReducido: boolean): Record<number, Gesto> {
  const r: Record<number, Gesto> = {};
  for (const id of p.presentes) r[id] = { categoria: 'reposo', papel: 'escucha' };
  if (movimientoReducido) return r;

  if (p.tipo === 'dialogo' && p.hablante !== null) {
    r[p.hablante] = { categoria: gestoHablante(p.emocionFrase, p.texto), papel: 'habla' };
    const tono = p.emocionFrase;
    let tonoOyentes: Categoria | null = null;
    if (tono?.emocion === 'tristeza' && fuerteONormal(tono.nivel)) tonoOyentes = 'tristeza';
    else if ((tono?.emocion === 'enojo' || tono?.emocion === 'sorpresa') && fuerteONormal(tono.nivel)) tonoOyentes = 'nervios';
    let asintio = false;
    for (const id of p.presentes) {
      if (id === p.hablante) continue;
      const propio = gestoPropio(p.emociones[id]);
      let categoria: Categoria = propio ?? tonoOyentes ?? 'reposo';
      if (categoria === 'reposo' && !asintio) { categoria = 'escuchar'; asintio = true; }
      r[id] = { categoria, papel: 'escucha' };
    }
    return r;
  }

  if (p.tipo === 'narracion') {
    for (const reaccion of p.reacciones) {
      if (!(reaccion.personaje in r)) continue;
      const g = gestoReaccion(reaccion, p.texto);
      if (g) r[reaccion.personaje] = g;
    }
  }
  return r;
}

/**
 * Elige la versión de la categoría para un personaje: nunca las pendientes, solo las de su papel, sin
 * gestos amplios junto al borde y, si se puede, distinta de las que ya usan los demás (`ocupadas`).
 * `actual` se conserva si sigue sirviendo (no se reinicia el gesto en cada frase). Devuelve null si la
 * categoría no tiene ninguna animación.
 */
export function elegirVersion(catalogo: AnimacionCatalogo[], gesto: Gesto, opciones: {
  slot: number; actual: string | null; ocupadas: Set<string>; junto_al_borde: boolean;
}): AnimacionCatalogo | null {
  let lista = catalogo.filter(a => !a.pendiente && a.categoria === gesto.categoria && (a.papel === 'ambos' || a.papel === gesto.papel));
  if (opciones.junto_al_borde && lista.some(a => !a.amplio)) lista = lista.filter(a => !a.amplio);
  if (!lista.length) return null;
  const actual = lista.find(a => a.id === opciones.actual);
  if (actual && !opciones.ocupadas.has(actual.id)) return actual;
  for (let k = 0; k < lista.length; k++) {
    const a = lista[(opciones.slot + k) % lista.length];
    if (!opciones.ocupadas.has(a.id)) return a;
  }
  return lista[opciones.slot % lista.length];
}
