/**
 * Elección del fondo de cada escenario (funciones puras, sin Angular).
 *
 * Usa public/escenas/escenas.json: cada escena tiene palabras clave, un grupo (salud, protección,
 * educación, hogar, comunidad) y alternativas con variantes por momento del día y, a veces, ambiente.
 * Mismo caso + mismo escenario = mismo fondo.
 *
 * Este archivo no importa nada para poder probarse con `node --test` (ver escena.spec.mts).
 */

export interface AlternativaEscena {
  id: string;
  variantes: Record<string, string>;
  ambiente?: string[];
  ambiente_por_variante?: Record<string, string[]>;
}
export interface EntradaEscena { id: string; nombre: string; grupo: string; palabras: string[]; alternativas: AlternativaEscena[]; }
export interface IndiceEscenas { version: number; respaldo: string; escenas: EntradaEscena[]; }

export interface BloqueEscena { indice: number; nombre: string; contexto: string; }
export interface CasoEscena {
  id?: number | string | null;
  nombre?: string;
  desarrolloSituacional?: string;
  contexto?: string;
  bloques?: { nombre: string; contexto: string }[];
}

export type Momento = 'dia' | 'tarde' | 'noche' | 'lluvia';
export type Ambiente = 'tenso' | 'triste' | null;

export interface FondoElegido {
  escenaId: string;
  alternativaId: string;
  variante: string;
  /** Ruta pública de la imagen, por ejemplo "/escenas/casa-sala/1-dia.webp". */
  ruta: string;
  /** "palabras": por las palabras del escenario; "tipo-caso": fondo neutro según el tipo de caso. */
  motivo: 'palabras' | 'tipo-caso';
  momento: Momento;
  ambiente: Ambiente;
}

/** Fondo neutro por tipo de caso (grupo de escenas.json). */
export const NEUTRO_POR_GRUPO: Record<string, string> = {
  salud: 'consultorio',
  proteccion: 'oficina-institucional',
  educacion: 'colegio-orientacion',
  hogar: 'casa-sala',
  comunidad: 'calle-barrio'
};
export const NEUTRO_GENERAL = 'oficina-institucional';

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function contiene(texto: string, palabra: string): boolean {
  const p = normalizar(palabra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(texto);
}

/** Palabras muy generales: valen poco frente a una más concreta ("cocina" gana a "familia"). */
const GENERALES = new Set(['familia', 'casa', 'hogar', 'vivienda', 'colegio', 'hospital', 'universidad', 'centro', 'ciudad',
  'oficina', 'estacion', 'entidad', 'trabajo', 'sesion', 'consulta', 'entrada', 'puerta', 'clase', 'descanso', 'funcionario', 'funcionaria']);

/** Puntaje de una escena para un texto: más por frases largas (más específicas), poco por las generales. */
function puntaje(escena: EntradaEscena, texto: string): number {
  let total = 0;
  // "comisaría" y "comisaria" son la misma palabra sin tildes: cuenta una sola vez.
  for (const p of new Set(escena.palabras.map(normalizar))) {
    if (contiene(texto, p)) total += GENERALES.has(p) ? 0.5 : 1 + p.split(' ').length * 0.75;
  }
  return total;
}

/** Tipo de caso: el grupo de escenas que más aparece en todo el texto del caso (o null). */
export function tipoDeCaso(indice: IndiceEscenas, caso: CasoEscena): string | null {
  const texto = normalizar([caso.nombre, caso.desarrolloSituacional, caso.contexto,
    ...(caso.bloques ?? []).flatMap(b => [b.nombre, b.contexto])].join(' . '));
  const porGrupo: Record<string, number> = {};
  for (const e of indice.escenas) porGrupo[e.grupo] = (porGrupo[e.grupo] ?? 0) + puntaje(e, texto);
  let mejor: string | null = null;
  for (const [g, p] of Object.entries(porGrupo)) if (p > 0 && (!mejor || p > porGrupo[mejor])) mejor = g;
  return mejor;
}

/** Momento del día que sugiere el texto del escenario (por defecto, de día). */
export function momentoDelDia(textoNormalizado: string): Momento {
  if (/(^|[^a-z])(llueve|lluvia|lloviendo|aguacero|tormenta)([^a-z]|$)/.test(textoNormalizado)) return 'lluvia';
  if (/(^|[^a-z])(noche|nocturn[ao]|madrugada|medianoche|oscuras|anochecer)([^a-z]|$)/.test(textoNormalizado)
    || /(^|[^0-9])(1[0-1]|[7-9])\s*(:\d\d)?\s*p\.?\s*m/.test(textoNormalizado)) return 'noche';
  if (/(^|[^a-z])(tarde|atardecer|ocaso|vespertin[ao])([^a-z]|$)/.test(textoNormalizado)
    || /(^|[^0-9])([2-6])\s*(:\d\d)?\s*p\.?\s*m/.test(textoNormalizado)) return 'tarde';
  return 'dia';
}

/** Ambiente que sugiere el texto: tenso (violencia, amenaza…), triste (duelo, llanto…) o neutro. */
export function ambienteDe(textoNormalizado: string): Ambiente {
  const tenso = /(violencia|violent[ao]|golpe|agresi|amenaz|grit|pelea|discusion|miedo|peligro|maltrato|abuso|armad[ao]|crisis|huy[eo])/;
  const triste = /(llor|llanto|duelo|muerte|murio|fallec|perdida|triste|tristeza|solo en|sola en|abandon|depresi|luto)/;
  if (tenso.test(textoNormalizado)) return 'tenso';
  if (triste.test(textoNormalizado)) return 'triste';
  return null;
}

function ambientesDe(alt: AlternativaEscena, variante: string): string[] {
  return [...(alt.ambiente ?? []), ...(alt.ambiente_por_variante?.[variante] ?? [])];
}

/** Variante a usar: la pedida si existe; si no, día, tarde o noche (en ese orden), o la primera. */
function varianteDe(alt: AlternativaEscena, momento: Momento): string {
  if (alt.variantes[momento]) return momento;
  const orden = momento === 'noche' ? ['noche', 'tarde', 'dia'] : momento === 'lluvia' ? ['lluvia', 'noche', 'tarde', 'dia'] : ['dia', 'tarde', 'noche'];
  return orden.find(v => alt.variantes[v]) ?? Object.keys(alt.variantes)[0];
}

/**
 * Fondo de un escenario. Busca las palabras clave de cada escena en el nombre (pesa más) y el contexto
 * del escenario; desempata con el tipo de caso. Si nada coincide, usa el fondo neutro del tipo de caso.
 * Dentro de la escena prefiere la alternativa con la variante del momento del día y el ambiente pedidos;
 * entre las que quedan elige con una semilla (id del caso + índice del escenario + escena).
 */
export function elegirFondo(indice: IndiceEscenas, caso: CasoEscena, bloque: BloqueEscena): FondoElegido {
  const nombre = normalizar(bloque.nombre);
  const contexto = normalizar(bloque.contexto);
  const texto = `${nombre} . ${contexto}`;
  const tipo = tipoDeCaso(indice, caso);

  let elegida: EntradaEscena | null = null;
  let mejor = 0;
  for (const e of indice.escenas) {
    let p = puntaje(e, nombre) * 2 + puntaje(e, contexto);
    if (p > 0 && tipo && e.grupo === tipo) p += 0.5;
    if (p > mejor) { mejor = p; elegida = e; }
  }
  let motivo: FondoElegido['motivo'] = 'palabras';
  if (!elegida) {
    motivo = 'tipo-caso';
    const id = (tipo && NEUTRO_POR_GRUPO[tipo]) || NEUTRO_GENERAL;
    elegida = indice.escenas.find(e => e.id === id) ?? indice.escenas[0];
  }

  const momento = momentoDelDia(texto);
  const ambiente = ambienteDe(texto);
  const alts = elegida.alternativas;
  // 1) alternativas que tienen la variante del momento (si ninguna, todas)
  let candidatas = alts.filter(a => a.variantes[momento]);
  if (!candidatas.length) candidatas = alts;
  // 2) ambiente: si el texto lo pide, prefiere las que lo tienen; si es neutro, evita las tensas o tristes
  const conAmbiente = (a: AlternativaEscena) => ambientesDe(a, varianteDe(a, momento));
  const segunAmbiente = ambiente
    ? candidatas.filter(a => conAmbiente(a).includes(ambiente))
    : candidatas.filter(a => !conAmbiente(a).length);
  if (segunAmbiente.length) candidatas = segunAmbiente;
  const alt = candidatas[hash(`${caso.id ?? 'nuevo'}:${bloque.indice}:${elegida.id}`) % candidatas.length];
  const variante = varianteDe(alt, momento);
  return {
    escenaId: elegida.id, alternativaId: alt.id, variante,
    ruta: `/escenas/${alt.variantes[variante]}`,
    motivo, momento, ambiente
  };
}
