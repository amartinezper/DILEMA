/**
 * Motor del guion de la novela visual (funciones puras, sin Angular).
 *
 * Convierte el caso (desarrollo situacional, escenarios y preguntas) en una lista ordenada de pasos:
 * portada → presentación → por cada escenario: transición, contexto y preguntas → fin.
 * Reconoce diálogos ("Ana: …", "—… —dijo Ana", Ana dijo: "…"), entradas de personajes y
 * expresiones a partir del texto. Nunca incluye cuál opción es correcta.
 *
 * Este archivo no importa nada para poder probarse con `node --test` (ver guion.spec.mts).
 */

// ---------------------------------------------------------------- tipos

export type Emocion = 'alegria' | 'enojo' | 'tristeza' | 'sorpresa' | 'relajado';
export type Nivel = 'leve' | 'normal' | 'fuerte';
export interface EstadoEmocion { emocion: Emocion | 'neutral'; nivel: Nivel; }

export interface PersonajeGuion {
  /** Identificador en la escena (índice del personaje en el caso). */
  id: number;
  nombre: string;
  /** Rol del perfil (madre, nino, trabajadora_social…), del motor de elenco. */
  rol: string;
  genero: 'mujer' | 'hombre';
  /** Etiqueta del perfil ("Madre · 38 años"): su primera parte también sirve para nombrarlo. */
  etiqueta?: string;
  escenarios: number[];
}

export interface CasoGuion {
  nombre: string;
  desarrolloSituacional?: string;
  bloques: { nombre: string; contexto: string; preguntas?: unknown[] }[];
}

/** Estado de la escena en un paso: escenario, quién está y la emoción de cada uno. */
export interface EstadoEscena {
  /** Escenario cuyo fondo se ve (la portada y la presentación usan el primero). */
  bloque: number;
  /** -1 en portada y presentación; el índice del escenario después. */
  escenario: number;
  presentes: number[];
  emociones: Record<number, EstadoEmocion>;
}

/** Omit que se reparte sobre cada variante de la unión. */
type SinEscena<T> = T extends unknown ? Omit<T, 'escena'> : never;

export interface Reaccion { personaje: number; emocion: Emocion; nivel: Nivel; }

export type Paso = (
  | { tipo: 'portada'; titulo: string }
  | { tipo: 'transicion'; bloqueIndice: number; titulo: string }
  | { tipo: 'entrada'; personaje: number }
  | { tipo: 'narracion'; texto: string; reacciones: Reaccion[] }
  | { tipo: 'dialogo'; personaje: number; texto: string; emocion: Emocion | null; nivel: Nivel }
  | { tipo: 'pregunta'; bloqueIndice: number; preguntaIndice: number }
  | { tipo: 'fin' }
) & { escena: EstadoEscena };

// ---------------------------------------------------------------- diccionario de expresiones

/**
 * Diccionario de expresiones (un solo lugar para editarlo). Cada entrada: emoción, nivel y expresiones
 * regulares sobre el texto en minúsculas y sin tildes. Se revisa en orden: primero las intensas.
 */
export const DICCIONARIO_EXPRESIONES: { emocion: Emocion; nivel: Nivel; patrones: string[] }[] = [
  { emocion: 'tristeza', nivel: 'fuerte', patrones: ['llora\\w* desconsolad', 'desconsolad', 'rompe en llanto', 'rompio en llanto', 'llanto incontrolable'] },
  { emocion: 'enojo', nivel: 'fuerte', patrones: ['grit\\w* furios', 'furios\\w* grit', 'fuera de si', 'estall\\w* de (rabia|ira)', 'con mucha rabia'] },
  { emocion: 'sorpresa', nivel: 'fuerte', patrones: ['aterrad', 'en panico', 'horrorizad'] },
  { emocion: 'tristeza', nivel: 'normal', patrones: ['\\blloro\\b', '\\bllora\\b', 'llorando', 'lagrimas', 'sollo(zo|za|zando)', 'angusti', 'desesperad', '\\btriste\\b', 'tristeza'] },
  { emocion: 'enojo', nivel: 'normal', patrones: ['\\bgrit[oa]\\b', 'gritando', '\\bgrita\\b', 'furios', 'golpe[ao]\\b', 'golpeando', 'reclam[ao]\\b', 'enojad', 'enfurecid', 'rabia', 'insult'] },
  { emocion: 'sorpresa', nivel: 'normal', patrones: ['sorprendid', 'de repente', 'de pronto', 'no esperaba', 'se asust', 'asustad', 'sobresalt'] },
  { emocion: 'alegria', nivel: 'normal', patrones: ['\\b(rie|rio|rien)\\b', '\\briendo\\b', '\\bcontent[oa]', '\\bfeliz\\b', '\\balegre\\b'] },
  { emocion: 'tristeza', nivel: 'leve', patrones: ['baj\\w* la mirada', 'cansad', 'preocupad', 'abatid', 'desanimad', 'suspir'] },
  { emocion: 'enojo', nivel: 'leve', patrones: ['molest', 'irritad', 'frunc\\w* el ceno', 'incomod'] },
  { emocion: 'alegria', nivel: 'leve', patrones: ['sonri', 'alivio', 'aliviad', 'agradec'] },
  { emocion: 'relajado', nivel: 'leve', patrones: ['tranquil', '\\bcalma', 'calmad', 'respira', 'seren[oa]'] }
];
const EXPRESIONES_COMPILADAS = DICCIONARIO_EXPRESIONES.map(e => ({ ...e, re: e.patrones.map(p => new RegExp(p)) }));

/** Verbos de habla que atribuyen un diálogo ("—… —dijo Ana", Ana preguntó: "…"). */
export const VERBOS_HABLA = ['dijo', 'dice', 'respondio', 'responde', 'pregunto', 'pregunta', 'contesto', 'contesta', 'grito', 'grita',
  'susurro', 'susurra', 'murmuro', 'murmura', 'sollozo', 'solloza', 'exclamo', 'exclama', 'anadio', 'anade', 'agrego', 'agrega',
  'explico', 'explica', 'comento', 'comenta', 'insistio', 'insiste', 'reclamo', 'reclama', 'suplico', 'suplica', 'admitio',
  'admite', 'confeso', 'confiesa', 'replico', 'replica', 'repitio', 'repite', 'afirmo', 'afirma', 'aclaro', 'aclara',
  'interrumpio', 'interrumpe', 'lloro', 'llora', 'balbuceo', 'balbucea', 'penso', 'piensa', 'conto', 'cuenta', 'advirtio', 'advierte'];

/** Palabras que nombran a un personaje por su rol (además de su nombre), por rol del perfil. */
const NOMBRES_DE_ROL: Record<string, string[]> = {
  madre: ['madre', 'mama', 'mamita'], padre: ['padre', 'papa', 'papito'],
  abuela: ['abuela', 'abuelita', 'abuelo', 'abuelito'], abuelo: ['abuelo', 'abuelito'],
  hija: ['hija', 'nina', 'nena'], hijo: ['hijo', 'nino', 'nene'], nina: ['nina', 'nena', 'hija'], nino: ['nino', 'nene', 'hijo'],
  bebe: ['bebe'], adolescente: ['adolescente', 'joven'], estudiante: ['estudiante', 'alumna', 'alumno'],
  docente: ['docente', 'profesora', 'profesor', 'maestra', 'maestro', 'orientadora', 'orientador'],
  medica: ['medica', 'medico', 'doctora', 'doctor'], enfermera: ['enfermera', 'enfermero'],
  psicologa: ['psicologa', 'psicologo', 'terapeuta'], trabajadora_social: ['trabajadora social', 'trabajador social'],
  policia: ['policia', 'patrullera', 'patrullero', 'agente'], comisaria: ['comisaria', 'comisario'],
  vecina: ['vecina', 'vecino'], tia: ['tia', 'tio'], hermana: ['hermana', 'hermano'], pareja: ['esposa', 'esposo', 'pareja', 'novia', 'novio'],
  adulta_mayor: ['abuela', 'abuelo', 'anciana', 'anciano', 'senora', 'senor'], senora: ['senora', 'senor', 'dona', 'don'],
  universitaria: ['universitaria', 'universitario', 'estudiante'], trabajadora: ['trabajadora', 'trabajador', 'jefa', 'jefe']
};

// ---------------------------------------------------------------- texto

export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ENTIDADES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', mdash: '—',
  ndash: '–', hellip: '…', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á',
  Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿'
};

/** HTML a texto plano: cada párrafo, línea o elemento de lista queda en su propia línea. */
export function htmlATexto(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

/** Abreviaturas que no terminan la frase (sin el punto, en minúsculas y sin tildes). */
const ABREVIATURAS = new Set(['sr', 'sra', 'srta', 'dr', 'dra', 'lic', 'ing', 'prof', 'profa', 'no', 'num', 'pag', 'aprox',
  'ej', 'ud', 'uds', 'etc', 'av', 'cra', 'cll', 'mz', 'dpto', 'tel', 'ee', 'uu', 'p', 'a', 'm', 'mr', 'mrs', 'jr', 'vs', 'esp', 'min', 'max']);
const CIERRE: Record<string, string> = { '"': '"', '“': '”', '«': '»' };

/**
 * Divide un texto (sin HTML) en frases: respeta abreviaturas (Sr., Dra.), números (3.5) y puntos
 * suspensivos, y no corta dentro de comillas. Las frases muy largas (> ~180) se parten en las comas.
 */
export function dividirFrases(texto: string, maximo = 180): string[] {
  const frases: string[] = [];
  for (const linea of texto.split('\n')) {
    let actual = '';
    let comilla: string | null = null;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      actual += c;
      if (comilla) {
        if (c !== comilla) continue;
        comilla = null;
        // Una cita que termina en punto ('… miedo."') cierra la frase si lo que sigue empieza en mayúscula.
        const siguienteCita = linea.slice(i + 1);
        if (/[.!?…]$/.test(actual.slice(0, -1)) && /^\s+[\p{Lu}¿¡—–"“«]/u.test(siguienteCita)) { frases.push(actual.trim()); actual = ''; }
        continue;
      }
      if (CIERRE[c] && !(c === '"' && /\S/.test(linea[i - 1] ?? ' ') && /\s|$/.test(linea[i + 1] ?? ''))) { comilla = CIERRE[c]; continue; }
      if (!/[.!?…]/.test(c)) continue;
      // Agrupa signos seguidos ("...", "?!", ".”).
      while (i + 1 < linea.length && /[.!?…"”»)]/.test(linea[i + 1])) actual += linea[++i];
      const resto = linea.slice(i + 1);
      if (resto && !/^\s/.test(resto)) continue;                // "3.5", "EE.UU."
      const siguiente = resto.trimStart();
      if (!siguiente) continue;
      if (c === '.' && !/\.\.$|…$/.test(actual)) {
        const palabra = normalizar(/([\p{L}]+)\.[^\p{L}]*$/u.exec(actual)?.[1] ?? '');
        // "Sr. Pérez", "Dra. Gómez"; "No. 5" solo antes de un número ("dijo que no. Luego…" sí termina).
        if (palabra === 'no' ? /^\d/.test(siguiente) : ABREVIATURAS.has(palabra)) continue;
      }
      // Termina si lo que sigue empieza como una frase nueva (mayúscula, número, ¿, ¡, raya o comillas).
      if (/^[\p{Lu}\d¿¡—–"“«]/u.test(siguiente)) { frases.push(actual.trim()); actual = ''; }
    }
    if (actual.trim()) frases.push(actual.trim());
  }
  return frases.flatMap(f => partirLarga(f, maximo));
}

function partirLarga(frase: string, maximo: number): string[] {
  if (frase.length <= maximo) return [frase];
  const partes = frase.split(/(?<=,)\s+/);
  const salida: string[] = [];
  let actual = '';
  for (const p of partes) {
    if (actual && (actual + ' ' + p).length > maximo) { salida.push(actual); actual = p; }
    else actual = actual ? actual + ' ' + p : p;
  }
  if (actual) salida.push(actual);
  return salida;
}

// ---------------------------------------------------------------- personajes en el texto

interface Nombrable { id: number; formas: string[]; }

function contiene(texto: string, palabra: string): number {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).exec(texto);
  return m ? m.index + m[1].length : -1;
}

/** Palabras de rol en masculino; a una mujer no se la nombra con ellas (ni al revés). */
const MASCULINAS = new Set(['padre', 'papa', 'papito', 'abuelo', 'abuelito', 'hijo', 'nino', 'nene', 'alumno', 'profesor', 'maestro',
  'orientador', 'medico', 'doctor', 'enfermero', 'psicologo', 'trabajador social', 'patrullero', 'comisario', 'vecino', 'tio',
  'hermano', 'esposo', 'novio', 'anciano', 'senor', 'don', 'universitario', 'trabajador', 'jefe']);
const FEMENINAS = new Set(['madre', 'mama', 'mamita', 'abuela', 'abuelita', 'hija', 'nina', 'nena', 'alumna', 'profesora', 'maestra',
  'orientadora', 'medica', 'doctora', 'enfermera', 'psicologa', 'trabajadora social', 'patrullera', 'comisaria', 'vecina', 'tia',
  'hermana', 'esposa', 'novia', 'anciana', 'senora', 'dona', 'universitaria', 'trabajadora', 'jefa']);

const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'su', 'mi', 'don', 'dona', 'senor', 'senora']);

function nombrables(personajes: PersonajeGuion[]): Nombrable[] {
  return personajes.map(p => {
    const nombre = normalizar(p.nombre.trim());
    const formas = new Set<string>();
    if (nombre && !/^persona\s*\d*$/.test(nombre)) {
      formas.add(nombre);
      // La primera palabra también lo nombra ("Ana" de "Ana Pérez"), salvo artículos y preposiciones:
      // "La sobreviviente" no se nombra con "la".
      const primera = nombre.split(/\s+/)[0];
      if (!ARTICULOS.has(primera)) formas.add(primera);
    }
    const otroGenero = p.genero === 'mujer' ? MASCULINAS : FEMENINAS;
    for (const r of NOMBRES_DE_ROL[p.rol] ?? []) if (!otroGenero.has(r)) formas.add(r);
    const etiqueta = normalizar((p.etiqueta ?? '').split('·')[0].trim());
    if (etiqueta) formas.add(etiqueta);
    return { id: p.id, formas: [...formas].filter(f => f.length > 1) };
  });
}

/** Personajes nombrados en un texto (normalizado), en el orden en que aparecen. Los nombres propios ganan a los roles. */
function mencionados(texto: string, lista: Nombrable[]): number[] {
  const hallados: { id: number; pos: number }[] = [];
  for (const n of lista) {
    let mejor = -1;
    for (const f of n.formas) {
      const pos = contiene(texto, f);
      if (pos >= 0 && (mejor < 0 || pos < mejor)) mejor = pos;
    }
    if (mejor >= 0) hallados.push({ id: n.id, pos: mejor });
  }
  return hallados.sort((a, b) => a.pos - b.pos).map(h => h.id);
}

/** Personaje cuyo nombre (o rol) coincide exactamente con el texto, por ejemplo el "Ana" de "Ana: …". */
function quienEs(textoNombre: string, lista: Nombrable[]): number | null {
  const t = normalizar(textoNombre).replace(/^(el|la|los|las|don|dona|senor|senora|su)\s+/, '').trim();
  if (!t) return null;
  for (const n of lista) if (n.formas.includes(t)) return n.id;
  return null;
}

// ---------------------------------------------------------------- expresiones

/** Emoción que sugiere un texto (o null). */
export function expresionDe(texto: string): { emocion: Emocion; nivel: Nivel } | null {
  const t = normalizar(texto);
  for (const e of EXPRESIONES_COMPILADAS) if (e.re.some(r => r.test(t))) return { emocion: e.emocion, nivel: e.nivel };
  return null;
}

// ---------------------------------------------------------------- diálogos

export interface Fragmento { hablante: number | null; texto: string; verbo?: string; }

/**
 * Reconoce un diálogo en una frase o línea:
 *  a) "Ana: No sé qué hacer."
 *  b) "—No sé qué hacer —dijo Ana." (raya + verbo de habla + nombre)
 *  c) Ana dijo: "No sé qué hacer." (comillas "" “” o «»), o "…", dijo Ana.
 * Devuelve null si no hay un diálogo con un personaje conocido.
 */
export function reconocerDialogo(frase: string, personajes: PersonajeGuion[]): Fragmento | null {
  const lista = nombrables(personajes);
  // a) Nombre: texto
  const a = /^\s*([^:—–"“«]{1,40}?)\s*:\s*(.+)$/.exec(frase);
  if (a) {
    const id = quienEs(a[1], lista);
    if (id !== null) return { hablante: id, texto: a[2].trim() };
  }
  // b) —texto —(le) verbo Nombre(—. resto)
  const b = /^\s*[—–-]\s*(.+?)\s*[—–]\s*(?:(?:le|les|me|te|se|nos)\s+)?([\p{L}]+)\s+([^—–.,;:!?]+?)\s*(?:[—–]\s*([.,]?)\s*(.*)|[.,]?)\s*$/u.exec(frase);
  if (b && VERBOS_HABLA.includes(normalizar(b[2]))) {
    const id = quienEs(b[3], lista);
    // "—Estoy cansada —sollozó la abuela—. No puedo más." → "Estoy cansada. No puedo más."
    const primera = b[5] && b[4] === '.' && !/[.!?…]$/.test(b[1]) ? b[1] + '.' : b[1];
    let texto = limpiarFinal([primera, b[5]].filter(Boolean).join(' ').trim());
    // El punto de "—Me caí —murmuró Mateo." es de la frase dicha.
    if (texto && !/[.!?…"”»]$/.test(texto)) texto += '.';
    return { hablante: id, texto, verbo: normalizar(b[2]) };
  }
  if (/^\s*[—–]/.test(frase)) return { hablante: null, texto: frase.replace(/^\s*[—–]\s*/, '').trim() };
  // c) Nombre verbo: "texto"   |   "texto", verbo Nombre
  const c1 = /^(.*?)([\p{L} ]{1,40}?)\s+([\p{L}]+)\s*:?\s*["“«](.+?)["”»]\s*\.?\s*$/u.exec(frase);
  if (c1) {
    const verbo = normalizar(c1[3]);
    if (VERBOS_HABLA.includes(verbo)) {
      const id = quienEs(c1[2], lista) ?? ultimaPalabraPersonaje(c1[2], lista);
      if (id !== null) return { hablante: id, texto: c1[4].trim(), verbo };
    }
  }
  const c2 = /^\s*["“«](.+?)["”»]\s*,?\s*([\p{L}]+)\s+([^.,;:!?]+?)\s*\.?\s*$/u.exec(frase);
  if (c2 && VERBOS_HABLA.includes(normalizar(c2[2]))) {
    const id = quienEs(c2[3], lista);
    if (id !== null) return { hablante: id, texto: c2[1].trim(), verbo: normalizar(c2[2]) };
  }
  return null;
}

/** "Luego Ana dijo" → busca el nombre al final del fragmento anterior al verbo. */
function ultimaPalabraPersonaje(fragmento: string, lista: Nombrable[]): number | null {
  const palabras = normalizar(fragmento).trim().split(/\s+/);
  for (let n = Math.min(3, palabras.length); n >= 1; n--) {
    const id = quienEs(palabras.slice(-n).join(' '), lista);
    if (id !== null) return id;
  }
  return null;
}

function limpiarFinal(t: string): string {
  return t.replace(/\s*[—–]\s*$/, '').replace(/^[—–]\s*/, '').trim();
}

// ---------------------------------------------------------------- armado del guion

/**
 * Guion completo del caso. `personajes` vienen con su perfil (rol y género del motor de elenco) y sus
 * escenarios ("Aparece en"). El orden es: portada → presentación → por escenario: transición,
 * contexto y preguntas → fin. Cada paso lleva el estado de la escena para poder empezar en cualquier punto.
 */
export function armarGuion(caso: CasoGuion, personajes: PersonajeGuion[]): Paso[] {
  const lista = nombrables(personajes);
  const pasos: Paso[] = [];
  let estado: EstadoEscena = { bloque: 0, escenario: -1, presentes: [], emociones: {} };
  const copia = (): EstadoEscena => ({ ...estado, presentes: [...estado.presentes], emociones: { ...estado.emociones } });
  const agregar = (p: SinEscena<Paso>) => pasos.push({ ...p, escena: copia() } as Paso);
  let ultimo: number | null = null;

  const entrar = (id: number) => {
    if (estado.presentes.includes(id)) return;
    estado.presentes = [...estado.presentes, id];
    agregar({ tipo: 'entrada', personaje: id });
  };

  const narrar = (texto: string, enPresentacion: boolean) => {
    for (const linea of htmlATexto(texto).split('\n')) {
      // "Ana: …" o una raya al inicio de la línea: toda la línea es de ese personaje.
      const deLinea = reconocerDialogo(linea, personajes);
      const unidades: { hablante: number | null; texto: string; verbo?: string; dialogo: boolean }[] =
        deLinea && (deLinea.hablante !== null || /^\s*[—–]/.test(linea))
          ? dividirFrases(deLinea.texto).map(t => ({ hablante: deLinea.hablante, texto: t, verbo: deLinea.verbo, dialogo: true }))
          : dividirFrases(linea).map(f => {
            const d = reconocerDialogo(f, personajes);
            return d && d.hablante !== null
              ? { hablante: d.hablante, texto: d.texto, verbo: d.verbo, dialogo: true }
              : { hablante: null, texto: d ? d.texto : f, dialogo: false };
          });
      for (const u of unidades) {
        const t = normalizar(u.texto);
        if (u.dialogo && u.hablante !== null) {
          entrar(u.hablante);
          const e = expresionDe(`${u.verbo ?? ''} ${u.texto}`);
          if (e) estado.emociones = { ...estado.emociones, [u.hablante]: e };
          ultimo = u.hablante;
          agregar({ tipo: 'dialogo', personaje: u.hablante, texto: u.texto, emocion: e?.emocion ?? null, nivel: e?.nivel ?? 'leve' });
          continue;
        }
        const nombrados = mencionados(t, lista);
        if (enPresentacion) for (const id of nombrados) entrar(id);
        // La emoción va al personaje nombrado; si no se nombra a nadie ("ella", "él" o sujeto implícito), al último.
        const reacciones: Reaccion[] = [];
        const e = expresionDe(u.texto);
        const objetivo = nombrados[0] ?? ultimo;
        if (e && objetivo !== null && estado.presentes.includes(objetivo)) {
          reacciones.push({ personaje: objetivo, emocion: e.emocion, nivel: e.nivel });
          estado.emociones = { ...estado.emociones, [objetivo]: e };
        }
        if (nombrados.length) ultimo = nombrados[nombrados.length - 1];
        agregar({ tipo: 'narracion', texto: u.texto, reacciones });
      }
    }
  };

  agregar({ tipo: 'portada', titulo: caso.nombre?.trim() || 'Caso sin nombre' });
  if (htmlATexto(caso.desarrolloSituacional)) narrar(caso.desarrolloSituacional ?? '', true);

  caso.bloques.forEach((b, i) => {
    // Al empezar el escenario están los marcados en "Aparece en" y todos vuelven a neutral.
    estado = { bloque: i, escenario: i, presentes: personajes.filter(p => p.escenarios.includes(i)).map(p => p.id), emociones: {} };
    ultimo = null;
    agregar({ tipo: 'transicion', bloqueIndice: i, titulo: `Escena ${i + 1}: ${b.nombre?.trim() || `Escenario ${i + 1}`}` });
    if (b.contexto) narrar(b.contexto, false);
    (b.preguntas ?? []).forEach((_, j) => agregar({ tipo: 'pregunta', bloqueIndice: i, preguntaIndice: j }));
  });
  agregar({ tipo: 'fin' });
  return pasos;
}
