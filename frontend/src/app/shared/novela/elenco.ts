/**
 * Motor del elenco (funciones puras, sin Angular ni three.js).
 *
 * A partir de los personajes que escribió el docente (o, si no escribió ninguno, del texto del caso)
 * decide quién aparece, su perfil (género, edad, rol), el Id del elenco (M01…H11), el modelo 3D del
 * catálogo y su aspecto (piel, cabello, canas, iris y ropa). Todo es determinista: el mismo caso da
 * siempre el mismo resultado.
 *
 * Este archivo no importa nada para poder probarse con `node --test` (ver elenco.spec.mts).
 */

// ---------------------------------------------------------------- tipos

export type Genero = 'mujer' | 'hombre';
export type Piel = 'clara' | 'triguena' | 'morena' | 'morena_oscura';
export type Rgb = [number, number, number];

export interface PersonajeEntrada { nombre: string; descripcion: string; escenarios: number[]; }

export interface TextosCaso {
  nombre?: string;
  desarrolloSituacional?: string;
  contexto?: string;
  bloques?: { nombre: string; contexto: string }[];
}

export interface PersonajeValido {
  /** Posición en caso.personajes; -1 si lo detectó el motor en el texto. */
  indice: number;
  nombre: string;
  descripcion: string;
  escenarios: number[];
  detectado: boolean;
}

export interface Perfil {
  genero: Genero;
  edad: number;
  rol: string;
  /** Texto corto para el docente, por ejemplo "Madre · 38 años". */
  etiqueta: string;
  /** De dónde salió cada dato: descripción, nombre, texto del caso o valor por defecto. */
  fuentes: { genero: Fuente; edad: Fuente; rol: Fuente };
  piel: Piel | null;
  cabello: string | null;
  canas: boolean | null;
  ojos: string | null;
}
export type Fuente = 'descripcion' | 'nombre' | 'texto' | 'defecto';

/** Entrada de personajes.json (solo lo que usa el motor). */
export interface ModeloCatalogo {
  archivo: string;
  id_elenco: string;
  extra: boolean;
  genero: Genero;
  edad_aparente: string | null;
  luminancia_cabello: number | null;
  materiales_fusionados: boolean;
  no_juntar_con: string[];
  materiales: Record<string, string[]>;
  /** Ropa de un oficio: "salud" (bata), "policia" (uniforme), "formal" (traje), "escolar" o null. */
  ropa_oficio?: RopaOficio;
}
export type RopaOficio = 'salud' | 'policia' | 'formal' | 'escolar' | null;

export interface Aspecto {
  /** false en modelos con materiales fusionados: conservan sus colores. */
  recolorear: boolean;
  piel: Piel;
  tonoPiel: Rgb;
  cabello: {
    color: Rgb;
    /** "multiplicar" solo oscurece (cabello claro de base); "canvas" desatura y aclara la textura. */
    modo: 'multiplicar' | 'canvas' | 'ninguno';
    canas: boolean;
  };
  iris: Rgb;
  ropa: { superior: Rgb; inferior: Rgb };
}

export interface Asignacion {
  personaje: PersonajeValido;
  perfil: Perfil;
  /** Id del elenco según el perfil (M01…H11). */
  idElenco: string;
  /** Modelo elegido del catálogo (null si el catálogo está vacío para ese género). */
  modelo: ModeloCatalogo | null;
  aspecto: Aspecto;
  /** Avisos para el docente cuando el motor tuvo que suponer algo. */
  avisos: string[];
}

export const MAX_PERSONAJES = 4;

// ---------------------------------------------------------------- utilidades

/** Minúsculas, sin tildes, sin etiquetas HTML ni entidades. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto plano conservando mayúsculas y tildes (para encontrar nombres propios). */
function plano(texto: string | null | undefined): string {
  return (texto ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Hash FNV-1a de 32 bits. */
export function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio (mulberry32) a partir de una semilla de texto. */
export function aleatorio(semilla: string): () => number {
  let a = hash(semilla) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function elegirPonderado<T>(azar: () => number, opciones: [T, number][]): T {
  const total = opciones.reduce((s, [, p]) => s + p, 0);
  let r = azar() * total;
  for (const [valor, peso] of opciones) {
    r -= peso;
    if (r < 0) return valor;
  }
  return opciones[opciones.length - 1][0];
}

function contiene(textoNormalizado: string, palabra: string): boolean {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(textoNormalizado);
}

function posicion(textoNormalizado: string, palabra: string): number {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).exec(textoNormalizado);
  return m ? m.index + m[1].length : -1;
}

// ---------------------------------------------------------------- vocabulario

/** Roles: palabras (sin tildes), rol, género (null si depende del artículo) y edad típica. */
interface Rol { palabras: string[]; rol: string; genero: Genero | null; edad: number; }
const ROLES: Rol[] = [
  { palabras: ['trabajadora social'], rol: 'trabajadora_social', genero: 'mujer', edad: 36 },
  { palabras: ['trabajador social'], rol: 'trabajadora_social', genero: 'hombre', edad: 38 },
  { palabras: ['adulta mayor'], rol: 'adulta_mayor', genero: 'mujer', edad: 72 },
  { palabras: ['adulto mayor'], rol: 'adulta_mayor', genero: 'hombre', edad: 72 },
  { palabras: ['comisaria de familia', 'comisaria'], rol: 'comisaria', genero: 'mujer', edad: 46 },
  { palabras: ['comisario de familia', 'comisario'], rol: 'comisaria', genero: 'hombre', edad: 48 },
  { palabras: ['madre', 'mama', 'mamita'], rol: 'madre', genero: 'mujer', edad: 38 },
  { palabras: ['padre', 'papa', 'papito'], rol: 'padre', genero: 'hombre', edad: 40 },
  { palabras: ['abuela', 'abuelita'], rol: 'abuela', genero: 'mujer', edad: 72 },
  { palabras: ['abuelo', 'abuelito'], rol: 'abuelo', genero: 'hombre', edad: 74 },
  { palabras: ['anciana'], rol: 'adulta_mayor', genero: 'mujer', edad: 80 },
  { palabras: ['anciano'], rol: 'adulta_mayor', genero: 'hombre', edad: 80 },
  { palabras: ['bebe', 'recien nacido', 'recien nacida', 'lactante'], rol: 'bebe', genero: null, edad: 1 },
  { palabras: ['nina', 'nena', 'hija menor'], rol: 'nina', genero: 'mujer', edad: 8 },
  { palabras: ['nino', 'nene', 'hijo menor'], rol: 'nino', genero: 'hombre', edad: 8 },
  { palabras: ['adolescente'], rol: 'adolescente', genero: null, edad: 15 },
  { palabras: ['hija'], rol: 'hija', genero: 'mujer', edad: 12 },
  { palabras: ['hijo'], rol: 'hijo', genero: 'hombre', edad: 12 },
  { palabras: ['psicologa'], rol: 'psicologa', genero: 'mujer', edad: 38 },
  { palabras: ['psicologo'], rol: 'psicologa', genero: 'hombre', edad: 40 },
  { palabras: ['medica', 'doctora'], rol: 'medica', genero: 'mujer', edad: 40 },
  { palabras: ['medico', 'doctor'], rol: 'medica', genero: 'hombre', edad: 42 },
  { palabras: ['enfermera'], rol: 'enfermera', genero: 'mujer', edad: 34 },
  { palabras: ['enfermero'], rol: 'enfermera', genero: 'hombre', edad: 34 },
  { palabras: ['terapeuta'], rol: 'psicologa', genero: null, edad: 38 },
  { palabras: ['policia', 'patrullera', 'patrullero', 'agente de policia', 'uniformada', 'uniformado'], rol: 'policia', genero: null, edad: 31 },
  { palabras: ['docente', 'maestra', 'maestro', 'profesora', 'profesor', 'orientadora', 'orientador', 'coordinadora', 'coordinador', 'rectora', 'rector'], rol: 'docente', genero: null, edad: 42 },
  { palabras: ['abogada', 'abogado', 'fiscal', 'jueza', 'juez', 'defensora', 'defensor', 'funcionaria', 'funcionario', 'profesional'], rol: 'profesional', genero: null, edad: 44 },
  { palabras: ['vecina'], rol: 'vecina', genero: 'mujer', edad: 52 },
  { palabras: ['vecino'], rol: 'vecina', genero: 'hombre', edad: 54 },
  { palabras: ['tia'], rol: 'tia', genero: 'mujer', edad: 42 },
  { palabras: ['tio'], rol: 'tia', genero: 'hombre', edad: 44 },
  { palabras: ['hermana'], rol: 'hermana', genero: 'mujer', edad: 16 },
  { palabras: ['hermano'], rol: 'hermana', genero: 'hombre', edad: 16 },
  { palabras: ['esposa', 'novia', 'companera sentimental'], rol: 'pareja', genero: 'mujer', edad: 34 },
  { palabras: ['esposo', 'novio', 'companero sentimental'], rol: 'pareja', genero: 'hombre', edad: 36 },
  { palabras: ['estudiante universitaria', 'universitaria'], rol: 'universitaria', genero: 'mujer', edad: 21 },
  { palabras: ['estudiante universitario', 'universitario'], rol: 'universitaria', genero: 'hombre', edad: 21 },
  { palabras: ['estudiante', 'alumna', 'alumno'], rol: 'estudiante', genero: null, edad: 15 },
  { palabras: ['jefa', 'empleada', 'trabajadora', 'obrera', 'conductora'], rol: 'trabajadora', genero: 'mujer', edad: 45 },
  { palabras: ['jefe', 'empleado', 'trabajador', 'obrero', 'conductor', 'celador', 'vigilante'], rol: 'trabajadora', genero: 'hombre', edad: 47 },
  { palabras: ['senora', 'dona'], rol: 'senora', genero: 'mujer', edad: 52 },
  { palabras: ['senor', 'don'], rol: 'senora', genero: 'hombre', edad: 55 },
  { palabras: ['joven', 'muchacha', 'muchacho', 'chica', 'chico'], rol: 'joven', genero: null, edad: 20 },
  { palabras: ['mujer'], rol: 'adulta', genero: 'mujer', edad: 35 },
  { palabras: ['hombre'], rol: 'adulta', genero: 'hombre', edad: 38 }
];

/** Palabras con género claro que no son un rol (para decidir el género de "estudiante", "joven"...). */
const GENERO_PALABRAS: [string, Genero][] = [
  ['muchacha', 'mujer'], ['muchacho', 'hombre'], ['chica', 'mujer'], ['chico', 'hombre'], ['ella', 'mujer'],
  ['femenina', 'mujer'], ['femenino', 'mujer'], ['masculino', 'hombre'],
  ['joven mujer', 'mujer'], ['joven hombre', 'hombre'], ['embarazada', 'mujer'], ['gestante', 'mujer']
];

/** Etiquetas para el docente: [femenino, masculino]. */
const ETIQUETAS: Record<string, [string, string]> = {
  madre: ['Madre', 'Madre'], padre: ['Padre', 'Padre'], abuela: ['Abuela', 'Abuelo'], abuelo: ['Abuelo', 'Abuelo'],
  adulta_mayor: ['Adulta mayor', 'Adulto mayor'], bebe: ['Bebé', 'Bebé'], nina: ['Niña', 'Niña'], nino: ['Niño', 'Niño'],
  adolescente: ['Adolescente', 'Adolescente'], hija: ['Hija', 'Hijo'], hijo: ['Hijo', 'Hijo'],
  psicologa: ['Psicóloga', 'Psicólogo'], medica: ['Médica', 'Médico'], enfermera: ['Enfermera', 'Enfermero'],
  trabajadora_social: ['Trabajadora social', 'Trabajador social'], policia: ['Policía', 'Policía'],
  comisaria: ['Comisaria', 'Comisario'], docente: ['Docente', 'Docente'], profesional: ['Profesional', 'Profesional'],
  vecina: ['Vecina', 'Vecino'], tia: ['Tía', 'Tío'], hermana: ['Hermana', 'Hermano'], pareja: ['Pareja', 'Pareja'],
  universitaria: ['Universitaria', 'Universitario'], estudiante: ['Estudiante', 'Estudiante'],
  trabajadora: ['Trabajadora', 'Trabajador'], senora: ['Señora', 'Señor'], joven: ['Joven', 'Joven'],
  adulta: ['Mujer adulta', 'Hombre adulto'], persona: ['Mujer adulta', 'Hombre adulto']
};

/** Nombres comunes en Colombia (sin tildes, en minúscula). */
const NOMBRES_MUJER = new Set(('maria ana laura carolina valentina sofia daniela camila paula luz gloria martha marta sandra diana ' +
  'claudia patricia yolanda rosa carmen isabella isabela mariana gabriela natalia andrea juliana catalina lucia sara salome ' +
  'luisa angie leidy yesenia marisol esperanza blanca teresa beatriz adriana alejandra angela angelica viviana lina monica ' +
  'liliana milena johana jennifer karen tatiana vanessa ximena jimena manuela antonia emilia valeria nicole samantha ' +
  'fernanda margarita amparo cecilia stella nubia olga gladys mercedes ines elena julia rocio pilar consuelo dora nelly ' +
  'aura elsa ruth sonia lorena susana silvia ingrid yuliana yurany dayana estefania stefany brenda abigail violeta ' +
  'luciana martina victoria emma agustina celeste regina hilda fabiola edilma ofelia alba graciela socorro').split(' '));
const NOMBRES_HOMBRE = new Set(('juan jose carlos luis andres jorge pedro miguel santiago sebastian mateo samuel daniel david ' +
  'diego felipe camilo alejandro julian oscar fernando ricardo hernan jairo fabio edgar william jhon john brayan kevin ' +
  'nicolas tomas emiliano alberto rafael gustavo alvaro german manuel antonio francisco javier jaime eduardo mauricio ' +
  'cristian christian johan jonathan esteban martin simon gabriel isaac jeronimo maximiliano agustin benjamin thiago ' +
  'dylan alexander anderson duvan yeison wilson nelson orlando hector ramiro rodrigo arturo enrique armando gilberto ' +
  'humberto ivan raul ruben sergio victor wilmer jhonatan alonso efrain gerardo guillermo leonardo marco pablo ' +
  'emilio lucas joaquin ignacio octavio rigoberto reinaldo libardo aurelio ernesto').split(' '));

const PIELES: [Piel, string[]][] = [
  ['morena_oscura', ['afro', 'afrodescendiente', 'afrocolombiana', 'afrocolombiano', 'piel negra', 'mujer negra', 'hombre negro', 'morena oscura', 'moreno oscuro', 'piel oscura']],
  ['morena', ['morena', 'moreno', 'piel morena', 'mestiza', 'mestizo', 'indigena']],
  ['triguena', ['triguena', 'trigueno', 'canela']],
  ['clara', ['piel clara', 'piel blanca', 'tez clara', 'tez blanca', 'rubia', 'rubio', 'pelirroja', 'pelirrojo']]
];

/** Nombres que también son palabras comunes: solo cuentan si no empiezan la oración. */
const NOMBRES_AMBIGUOS = new Set(['luz', 'rosa', 'esperanza', 'blanca', 'pilar', 'victoria', 'consuelo', 'socorro', 'aura',
  'celeste', 'regina', 'violeta', 'alba', 'mercedes', 'dora', 'amparo', 'stella', 'martin', 'simon']);

const CABELLOS: [string, string[]][] = [
  ['canoso', ['canosa', 'canoso', 'canas', 'cabello blanco', 'pelo blanco', 'cabello gris', 'pelo gris', 'entrecana', 'entrecano']],
  ['rubio', ['rubia', 'rubio']],
  ['pelirrojo', ['pelirroja', 'pelirrojo', 'cabello rojo', 'pelo rojo']],
  ['negro', ['cabello negro', 'pelo negro', 'pelinegra', 'pelinegro']],
  ['castano', ['castana', 'castano', 'cabello cafe', 'pelo cafe']]
];

const OJOS: [string, string[]][] = [
  ['azul', ['ojos azules', 'ojos claros']],
  ['verde', ['ojos verdes']],
  ['cafe', ['ojos cafes', 'ojos negros', 'ojos oscuros']]
];

// ---------------------------------------------------------------- personajes válidos y detección

const GENERICO = /^\s*persona\s*\d*\s*$/i;

/**
 * Personajes que el motor debe mostrar: ignora los "Persona N" sin descripción (y los vacíos).
 * Si no queda ninguno, los detecta en el texto del caso. Máximo 4.
 */
export function personajesValidos(personajes: PersonajeEntrada[] | null | undefined, textos: TextosCaso): PersonajeValido[] {
  const validos: PersonajeValido[] = [];
  (personajes ?? []).forEach((p, indice) => {
    const nombre = (p.nombre ?? '').trim();
    const descripcion = (p.descripcion ?? '').trim();
    if (!descripcion && (!nombre || GENERICO.test(nombre))) return;
    validos.push({ indice, nombre, descripcion, escenarios: [...(p.escenarios ?? [])], detectado: false });
  });
  if (validos.length) return validos.slice(0, MAX_PERSONAJES);
  return detectarPersonajes(textos);
}

/** Texto completo del caso (desarrollo, contexto y escenarios), en texto plano. */
export function textoDelCaso(textos: TextosCaso): string {
  return [textos.nombre, textos.desarrolloSituacional, textos.contexto,
    ...(textos.bloques ?? []).flatMap(b => [b.nombre, b.contexto])].map(plano).filter(Boolean)
    .map(t => (/[.!?;:]$/.test(t) ? t : t + '.')).join(' ');
}

function oraciones(textoPlano: string): string[] {
  return textoPlano.split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Detecta hasta 4 personajes en el texto del caso: primero nombres propios comunes en Colombia y
 * luego roles (madre, docente, policía…) que no queden cubiertos por un nombre.
 */
export function detectarPersonajes(textos: TextosCaso): PersonajeValido[] {
  const completo = textoDelCaso(textos);
  const frases = oraciones(completo);
  const bloques = (textos.bloques ?? []).map(b => normalizar(`${b.nombre} ${b.contexto}`));
  const encontrados: { nombre: string; descripcion: string; clave: string; orden: number }[] = [];

  // 1) nombres propios: palabra con mayúscula que está en las listas de nombres
  const vistos = new Set<string>();
  const reNombre = /(?<!\p{L})(\p{Lu}\p{Ll}+)(?:\s+(\p{Lu}\p{Ll}+))?/gu;
  for (const frase of frases) {
    let m: RegExpExecArray | null;
    reNombre.lastIndex = 0;
    while ((m = reNombre.exec(frase))) {
      const primero = normalizar(m[1]);
      if (!NOMBRES_MUJER.has(primero) && !NOMBRES_HOMBRE.has(primero)) continue;
      if (NOMBRES_AMBIGUOS.has(primero) && m.index === 0) continue;
      // Nombre compuesto común ("María José", "Juan Pablo") o nombre + apellido: se usa la primera palabra como clave.
      const segundo = m[2] ? normalizar(m[2]) : '';
      const nombre = segundo && (NOMBRES_MUJER.has(segundo) || NOMBRES_HOMBRE.has(segundo)) ? `${m[1]} ${m[2]}` : m[1];
      const clave = normalizar(nombre);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      // Descripción: desde el nombre hasta el final de la oración (máx. 140 caracteres).
      const desde = frase.slice(m.index);
      encontrados.push({ nombre, descripcion: desde.slice(0, 140).trim(), clave, orden: completo.indexOf(frase) + m.index });
    }
  }

  // 2) roles no cubiertos por la descripción de un nombre
  const cubierto = encontrados.map(e => normalizar(e.descripcion)).join(' | ');
  const textoN = normalizar(completo);
  for (const rol of ROLES) {
    // Demasiado generales para un caso ("el profesional" suele ser quien juega el caso).
    if (['adulta', 'joven', 'senora', 'trabajadora', 'profesional'].includes(rol.rol)) continue;
    for (const palabra of rol.palabras) {
      // "comisaría" casi siempre es el lugar; solo cuenta como persona en "la/una comisaria" sin "en/a/de" antes.
      if (rol.rol === 'comisaria' && rol.genero === 'mujer' && !esComisariaPersona(textoN)) continue;
      const pos = posicion(textoN, palabra);
      if (pos < 0 || contiene(cubierto, palabra)) continue;
      const clave = rol.rol + ':' + (rol.genero ?? palabra);
      if (encontrados.some(e => e.clave === clave)) continue;
      const frase = frases.find(f => contiene(normalizar(f), palabra)) ?? '';
      const nombre = palabra.charAt(0).toUpperCase() + palabra.slice(1);
      encontrados.push({ nombre: etiquetaRol(rol.rol, rol.genero ?? generoPorArticulo(textoN, palabra) ?? 'mujer') || nombre,
        descripcion: frase.slice(0, 140), clave, orden: pos });
      break;
    }
  }

  encontrados.sort((a, b) => a.orden - b.orden);
  return encontrados.slice(0, MAX_PERSONAJES).map(e => {
    const clave = normalizar(e.nombre);
    let escenarios = bloques.map((b, i) => (contiene(b, clave) ? i : -1)).filter(i => i >= 0);
    if (!escenarios.length) escenarios = bloques.map((_, i) => i);
    if (!escenarios.length) escenarios = [0];
    return { indice: -1, nombre: e.nombre, descripcion: e.descripcion, escenarios, detectado: true };
  });
}

/** "la comisaria dijo…" es la persona; "en la comisaria", "a la comisaria de familia" es el lugar. */
function esComisariaPersona(texto: string): boolean {
  const re = /(^|[^a-z])([a-z]+ )?(la|una) comisaria/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const previa = (m[2] ?? '').trim();
    if (!['en', 'a', 'de', 'hacia', 'desde', 'por', 'hasta', 'para', 'ante'].includes(previa)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- perfil

function generoPorArticulo(texto: string, palabra: string): Genero | null {
  const p = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|[^a-z])(la|una|esta|esa|nuestra|el|un|este|ese|nuestro|del|al)\\s+(?:[a-z]+\\s+)?${p}([^a-z]|$)`).exec(texto);
  if (!m) return null;
  return ['la', 'una', 'esta', 'esa', 'nuestra'].includes(m[2]) ? 'mujer' : 'hombre';
}

interface Lectura { genero: Genero | null; edad: number | null; rol: Rol | null; }

/** Roles poco específicos (tratamientos y palabras generales): solo cuentan si no hay otro rol. */
const ROLES_GENERALES = new Set(['senora', 'joven', 'adulta']);

/** Género de cualquier palabra de rol con género que aparezca en el texto ("universitario", "vecina"…). */
function generoDeRoles(texto: string): Genero | null {
  let mejor: { g: Genero; pos: number } | null = null;
  for (const rol of ROLES) {
    if (!rol.genero) continue;
    for (const palabra of rol.palabras) {
      const pos = posicion(texto, palabra);
      if (pos >= 0 && (!mejor || pos < mejor.pos)) mejor = { g: rol.genero, pos };
    }
  }
  return mejor?.g ?? null;
}

/** Lee género, edad y rol de un texto normalizado. */
function leer(texto: string): Lectura {
  const r: Lectura = { genero: null, edad: null, rol: null };
  if (!texto) return r;
  // Edad explícita: "38 años", "de 7 anos", "8 meses"
  const anos = /(\d{1,3})\s*(?:anos|ano)\b/.exec(texto);
  const meses = /(\d{1,2})\s*meses\b/.exec(texto);
  if (anos) r.edad = Math.min(105, Number(anos[1]));
  else if (meses) r.edad = 1;
  else if (/mediana edad/.test(texto)) r.edad = 50;
  else if (/tercera edad/.test(texto)) r.edad = 72;
  // Rol: el que aparece primero en el texto (entre los más específicos de la lista).
  let mejor: { rol: Rol; pos: number; palabra: string } | null = null;
  for (const rol of ROLES) {
    for (const palabra of rol.palabras) {
      let pos = posicion(texto, palabra);
      if (pos < 0) continue;
      if (ROLES_GENERALES.has(rol.rol)) pos += 10000;   // "joven universitario" -> universitario
      // Un rol más largo que contiene a otro (trabajadora social > trabajadora) gana aunque empiece igual.
      if (!mejor || pos < mejor.pos || (pos === mejor.pos && palabra.length > mejor.palabra.length)) mejor = { rol, pos, palabra };
    }
  }
  if (mejor) {
    r.rol = mejor.rol;
    r.genero = mejor.rol.genero ?? generoPorArticulo(texto, mejor.palabra);
  }
  if (!r.genero) r.genero = generoDeRoles(texto);
  if (!r.genero) {
    for (const [palabra, g] of GENERO_PALABRAS) if (contiene(texto, palabra)) { r.genero = g; break; }
  }
  if (!r.genero) {
    const primera = texto.split(/[^a-z]+/).find(Boolean) ?? '';
    if (NOMBRES_MUJER.has(primera)) r.genero = 'mujer';
    else if (NOMBRES_HOMBRE.has(primera)) r.genero = 'hombre';
  }
  return r;
}

function vacia(): Lectura { return { genero: null, edad: null, rol: null }; }

/**
 * Lee el texto del caso alrededor de cada mención del nombre ("Laura, la madre de 38 años", "su hijo Mateo
 * de 7 años"): toma el rol y la edad más cercanos al nombre, no los primeros de la oración.
 */
function leerCerca(texto: string, clave: string): Lectura {
  const r = vacia();
  if (!clave) return r;
  const re = new RegExp(`(^|[^a-z0-9])${clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'g');
  let m: RegExpExecArray | null;
  let mejorRol: { rol: Rol; palabra: string; distancia: number } | null = null;
  while ((m = re.exec(texto))) {
    const inicio = m.index + m[1].length;
    const fin = inicio + clave.length;
    const ventana = texto.slice(Math.max(0, inicio - 30), Math.min(texto.length, fin + 45));
    const centro = inicio - Math.max(0, inicio - 30);
    for (const rol of ROLES) {
      for (const palabra of rol.palabras) {
        const pos = posicion(ventana, palabra);
        if (pos < 0) continue;
        // Distancia al nombre (antes: "su hijo Mateo"; después: "Laura, la madre"). "Don Hernán, el vecino" -> vecino.
        const distancia = (pos < centro ? centro - (pos + palabra.length) : pos - (centro + clave.length))
          + (ROLES_GENERALES.has(rol.rol) ? 1000 : 0);
        if (!mejorRol || distancia < mejorRol.distancia) mejorRol = { rol, palabra, distancia };
      }
    }
    if (r.edad == null) {
      const despues = texto.slice(fin, fin + 40);
      const anos = /^[^.;]*?(\d{1,3})\s*anos?\b/.exec(despues);
      if (anos) r.edad = Math.min(105, Number(anos[1]));
    }
  }
  if (mejorRol) {
    r.rol = mejorRol.rol;
    r.genero = mejorRol.rol.genero;
  }
  return r;
}

function generoDelNombre(nombre: string): Genero | null {
  for (const parte of normalizar(nombre).split(/[^a-z]+/).filter(Boolean)) {
    if (NOMBRES_MUJER.has(parte)) return 'mujer';
    if (NOMBRES_HOMBRE.has(parte)) return 'hombre';
  }
  return null;
}

function buscarEn(texto: string, lista: [string, string[]][]): string | null {
  for (const [valor, palabras] of lista) if (palabras.some(p => contiene(texto, p))) return valor;
  return null;
}

/**
 * Perfil del personaje. Cada dato se toma de la primera fuente que lo trae: descripción, nombre y, por
 * último, las oraciones del caso que mencionan al personaje. Si nada lo dice: mujer adulta de 30 años.
 */
export function perfilDe(personaje: { nombre: string; descripcion: string }, textos: TextosCaso): Perfil {
  const desc = normalizar(personaje.descripcion);
  const nom = normalizar(personaje.nombre);
  const generico = GENERICO.test(personaje.nombre ?? '');
  const lecturaTexto = nom && !generico ? leerCerca(normalizar(textoDelCaso(textos)), nom.split(' ')[0]) : vacia();
  const lecturaNombre = generico ? vacia() : leer(nom);
  const fuentes: [Fuente, Lectura][] = [
    ['descripcion', leer(desc)],
    ['nombre', { ...lecturaNombre, genero: generoDelNombre(personaje.nombre) ?? lecturaNombre.genero }],
    ['texto', lecturaTexto]
  ];
  const tomar = <K extends keyof Lectura>(k: K): [NonNullable<Lectura[K]> | null, Fuente] => {
    for (const [f, l] of fuentes) if (l[k] != null) return [l[k] as NonNullable<Lectura[K]>, f];
    return [null, 'defecto'];
  };
  const [rol, fRol] = tomar('rol');
  let [genero, fGenero] = tomar('genero');
  let [edad, fEdad] = tomar('edad');
  if (!genero) { genero = rol?.genero ?? 'mujer'; fGenero = rol?.genero ? fRol : 'defecto'; }
  if (edad == null) { edad = rol?.edad ?? 30; fEdad = rol ? fRol : 'defecto'; }
  // Un rol de niño con una edad de adulto (p. ej. "hijo de 30 años") se respeta: manda la edad.
  const rolId = rol?.rol ?? 'persona';
  const todo = `${desc} ${nom}`;
  const piel = buscarEn(todo, PIELES as [string, string[]][]) as Piel | null;
  const cabello = buscarEn(todo, CABELLOS);
  const ojos = buscarEn(todo, OJOS);
  const canas = cabello === 'canoso' ? true : (cabello && cabello !== 'canoso' ? false : null);
  return {
    genero, edad, rol: rolId,
    etiqueta: `${etiquetaRol(rolId, genero)} · ${edad === 1 ? '1 año' : `${edad} años`}`,
    fuentes: { genero: fGenero, edad: fEdad, rol: fRol },
    piel, cabello, canas, ojos
  };
}

function etiquetaRol(rol: string, genero: Genero): string {
  const e = ETIQUETAS[rol] ?? ETIQUETAS['persona'];
  return genero === 'mujer' ? e[0] : e[1];
}

// ---------------------------------------------------------------- Id del elenco

const SALUD = new Set(['medica', 'enfermera', 'psicologa']);
const PROFESIONALES = new Set(['docente', 'trabajadora_social', 'comisaria', 'profesional']);

/** Edad central de cada Id (para buscar el más cercano cuando falta un modelo). */
export const EDAD_CENTRAL: Record<string, number> = {
  '01': 8, '02': 15, '03': 21, '04': 30, '05': 40, '06': 44, '07': 38, '08': 52, '09': 67, '10': 80, '11': 31
};

/**
 * Id del elenco: M01/H01 ≤11 · 02 12–17 · 03 18–25 · 04 26–34 · 05 madre/padre 35–44 · 06 profesionales ·
 * 07 salud y psicología · 08 45–59 · 09 60–74 · 10 75+ · 11 policía. Los roles de trabajo solo aplican
 * entre los 18 y los 59 años; fuera de ese rango manda la edad.
 */
export function idElencoDe(perfil: Pick<Perfil, 'genero' | 'edad' | 'rol'>): string {
  const g = perfil.genero === 'mujer' ? 'M' : 'H';
  const e = perfil.edad;
  const adulto = e >= 18 && e < 60;
  let n: string;
  if (adulto && perfil.rol === 'policia') n = '11';
  else if (adulto && SALUD.has(perfil.rol)) n = '07';
  else if (adulto && e >= 26 && PROFESIONALES.has(perfil.rol)) n = '06';
  else if (e <= 11) n = '01';
  else if (e <= 17) n = '02';
  else if (e <= 25) n = '03';
  else if (e <= 34) n = '04';
  else if (e <= 44) n = '05';
  else if (e <= 59) n = '08';
  else if (e <= 74) n = '09';
  else n = '10';
  return g + n;
}

/** Ids del catálogo que cubren un Id del elenco ("M09" lo cubre el grupo "M09-M10"). */
function cubre(idCatalogo: string, id: string): boolean {
  return idCatalogo === id || idCatalogo.split('-').includes(id);
}

// ---------------------------------------------------------------- modelos y aspecto

/**
 * Asigna el elenco de un caso: personajes válidos → perfil → Id → modelo (sin repetir archivo y
 * respetando no_juntar_con) → aspecto. La semilla es el id del caso más el índice del personaje.
 */
export function asignarElenco(
  casoId: number | string | null | undefined,
  personajes: PersonajeEntrada[] | null | undefined,
  textos: TextosCaso,
  catalogo: ModeloCatalogo[]
): Asignacion[] {
  const validos = personajesValidos(personajes, textos);
  const usados = new Set<string>();
  const vetados = new Set<string>();
  return validos.map((personaje, orden) => {
    const perfil = perfilDe(personaje, textos);
    const idElenco = idElencoDe(perfil);
    const semilla = `${casoId ?? 'nuevo'}:${personaje.indice >= 0 ? personaje.indice : 'd' + orden}`;
    const avisos: string[] = [];
    if (perfil.fuentes.genero === 'defecto' && perfil.fuentes.rol === 'defecto') avisos.push('No se indica quién es: se usa una mujer adulta.');
    else if (perfil.fuentes.edad === 'defecto') avisos.push('No se indica la edad: se supone ' + perfil.edad + ' años.');
    const modelo = elegirModelo(semilla, perfil, idElenco, catalogo, usados, vetados, avisos);
    if (modelo) {
      usados.add(modelo.archivo);
      modelo.no_juntar_con.forEach(a => vetados.add(a));
    }
    return { personaje, perfil, idElenco, modelo, aspecto: aspectoDe(semilla, perfil, modelo), avisos };
  });
}

/**
 * Ropa de oficio permitida y preferida según el rol (Id del elenco):
 * - salud (07) y policía (11): primero un modelo con su ropa ("salud" o "policia"), en cualquier Id del
 *   mismo género, del más cercano en edad al más lejano; si no hay, traje o ropa común.
 * - profesionales (06): traje o ropa común.
 * - estudiantes: uniforme de colegio o ropa común.
 * - el resto (familiares o sin rol definido): ropa común; si en ese Id no hay, traje; por último, uniforme escolar.
 * La ropa "salud" y "policia" nunca se usa para un personaje sin ese rol.
 */
export function preferenciasDeRopa(perfil: Pick<Perfil, 'rol'>, idElenco: string): { oficio: RopaOficio; niveles: RopaOficio[][] } {
  const n = idElenco.slice(1);
  if (n === '07') return { oficio: 'salud', niveles: [['formal', null], ['escolar']] };
  if (n === '11') return { oficio: 'policia', niveles: [['formal', null], ['escolar']] };
  if (n === '06') return { oficio: null, niveles: [['formal', null], ['escolar']] };
  // Uniforme de colegio solo para estudiantes menores de edad (Id 01 o 02); los universitarios, ropa común.
  if (perfil.rol === 'estudiante' && (n === '01' || n === '02')) return { oficio: null, niveles: [['escolar', null], ['formal']] };
  return { oficio: null, niveles: [[null], ['formal'], ['escolar']] };
}

function elegirModelo(
  semilla: string, perfil: Perfil, idElenco: string, catalogo: ModeloCatalogo[],
  usados: Set<string>, vetados: Set<string>, avisos: string[]
): ModeloCatalogo | null {
  const ropa = (m: ModeloCatalogo): RopaOficio => m.ropa_oficio ?? null;
  const { oficio, niveles } = preferenciasDeRopa(perfil, idElenco);
  // La ropa de salud o de policía solo para ese rol.
  const permitido = (m: ModeloCatalogo) => (ropa(m) !== 'salud' && ropa(m) !== 'policia') || ropa(m) === oficio;
  const libre = (m: ModeloCatalogo) => permitido(m) && !usados.has(m.archivo) && !vetados.has(m.archivo)
    && !m.no_juntar_con.some(a => usados.has(a));
  const g = idElenco[0];
  // Ids del mismo género ordenados por cercanía de edad (el propio primero).
  const ids = Object.keys(EDAD_CENTRAL).map(n => g + n)
    .sort((a, b) => (a === idElenco ? -1 : b === idElenco ? 1 : 0)
      || Math.abs(EDAD_CENTRAL[a.slice(1)] - perfil.edad) - Math.abs(EDAD_CENTRAL[b.slice(1)] - perfil.edad));
  const elegir = (lista: ModeloCatalogo[]) =>
    [...lista].sort((a, b) => a.archivo.localeCompare(b.archivo))[hash(semilla + ':modelo') % lista.length];
  const enId = (id: string) => catalogo.filter(m => cubre(m.id_elenco, id) && libre(m));

  // 1) Rol con ropa de oficio (salud, policía): el modelo con esa ropa más cercano en edad.
  if (oficio) {
    for (const id of ids) {
      const conOficio = enId(id).filter(m => ropa(m) === oficio);
      if (!conOficio.length) continue;
      if (id !== idElenco) avisos.push(`Para ${idElenco} se usa un modelo de ${id} con ropa de ${oficio === 'salud' ? 'salud' : 'policía'}.`);
      return elegir(conOficio);
    }
  }
  // 2) Por Id (el propio y luego los cercanos), en el orden de preferencia de ropa.
  for (const id of ids) {
    const libres = enId(id);
    for (const nivel of niveles) {
      const candidatos = libres.filter(m => nivel.includes(ropa(m)));
      if (!candidatos.length) continue;
      if (id !== idElenco) avisos.push(`No hay modelo libre para ${idElenco}: se usa uno de ${id}.`);
      return elegir(candidatos);
    }
  }
  return null;
}

const TONOS_PIEL: Record<Piel, Rgb> = {
  clara: [1, 1, 1],
  triguena: [0.96, 0.86, 0.76],
  morena: [0.84, 0.68, 0.55],
  morena_oscura: [0.62, 0.47, 0.37]
};
const COLORES_CABELLO: Record<string, Rgb> = {
  negro: [0.1, 0.085, 0.08],
  castano_oscuro: [0.24, 0.16, 0.11],
  castano: [0.4, 0.27, 0.17],
  castano_claro: [0.58, 0.43, 0.28],
  rubio: [0.78, 0.64, 0.42],
  pelirrojo: [0.55, 0.24, 0.12],
  canas: [0.84, 0.84, 0.82],
  entrecano: [0.58, 0.56, 0.53]
};
const IRIS: Record<string, Rgb> = {
  cafe: [0.45, 0.28, 0.15], cafe_oscuro: [0.24, 0.14, 0.08], avellana: [0.52, 0.42, 0.2],
  verde: [0.34, 0.46, 0.3], azul: [0.3, 0.45, 0.62]
};
/** Colores sobrios para la ropa llamativa. */
const ROPA_SOBRIA: Rgb[] = [
  [0.2, 0.25, 0.38], [0.45, 0.46, 0.48], [0.76, 0.7, 0.6], [0.42, 0.32, 0.24], [0.4, 0.42, 0.3],
  [0.45, 0.2, 0.22], [0.16, 0.16, 0.18], [0.88, 0.86, 0.82], [0.3, 0.4, 0.55]
];

export function luminancia([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** ¿Lleva canas? Todos los de 60 o más; algunos de 45–59 (o si la descripción lo dice). */
export function llevaCanas(perfil: Pick<Perfil, 'edad' | 'canas'>, azar: () => number): boolean {
  if (perfil.canas != null) return perfil.canas || perfil.edad >= 60;
  if (perfil.edad >= 60) return true;
  if (perfil.edad >= 45) return azar() < 0.4;
  return false;
}

/** Aspecto del personaje: piel, cabello (y canas), iris y ropa sobria. Determinista por semilla. */
export function aspectoDe(semilla: string, perfil: Perfil, modelo: ModeloCatalogo | null): Aspecto {
  const azar = aleatorio(semilla + ':aspecto');
  const piel: Piel = perfil.piel ?? elegirPonderado<Piel>(azar, [['triguena', 40], ['clara', 25], ['morena', 25], ['morena_oscura', 10]]);
  const canas = llevaCanas(perfil, azar);
  let nombreCabello: string;
  if (canas) nombreCabello = perfil.edad >= 60 ? 'canas' : 'entrecano';
  else if (perfil.cabello === 'rubio') nombreCabello = 'rubio';
  else if (perfil.cabello === 'pelirrojo') nombreCabello = 'pelirrojo';
  else if (perfil.cabello === 'negro') nombreCabello = 'negro';
  else if (perfil.cabello === 'castano') nombreCabello = 'castano';
  else nombreCabello = elegirPonderado(azar, [['negro', 35], ['castano_oscuro', 35], ['castano', 20], ['castano_claro', 7], ['rubio', 3]]);
  const color = COLORES_CABELLO[nombreCabello];
  const lumModelo = modelo?.luminancia_cabello;
  let modo: Aspecto['cabello']['modo'];
  if (lumModelo == null || modelo?.materiales_fusionados) modo = 'ninguno';
  else if (canas) modo = 'canvas';
  // Si el cabello del modelo ya es más claro que el objetivo, basta con oscurecerlo (multiplicar el color).
  else modo = luminancia(color) <= lumModelo ? 'multiplicar' : 'canvas';
  const ojos = perfil.ojos === 'azul' ? 'azul' : perfil.ojos === 'verde' ? 'verde'
    : elegirPonderado(azar, [['cafe', 75], ['cafe_oscuro', 15], ['avellana', 7], ['verde', 3]]);
  const superior = ROPA_SOBRIA[Math.floor(azar() * ROPA_SOBRIA.length)];
  let inferior = ROPA_SOBRIA[Math.floor(azar() * ROPA_SOBRIA.length)];
  if (inferior === superior) inferior = ROPA_SOBRIA[(ROPA_SOBRIA.indexOf(superior) + 3) % ROPA_SOBRIA.length];
  return {
    recolorear: !!modelo && !modelo.materiales_fusionados,
    piel, tonoPiel: TONOS_PIEL[piel],
    cabello: { color, modo, canas },
    iris: IRIS[ojos],
    ropa: { superior, inferior }
  };
}
