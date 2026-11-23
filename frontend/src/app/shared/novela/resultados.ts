/**
 * Resultados de un caso (funciones puras, sin Angular).
 *
 * `calcularResultados` solo se usa en la VISTA PREVIA DEL DOCENTE, que tiene las respuestas correctas en el
 * editor. Para el estudiante los resultados los calcula el backend al finalizar; `resultadosDeParticipacion`
 * solo los acomoda para la pantalla (no decide nada: la nota, los aciertos y la opción correcta vienen dados).
 */

export interface OpcionResultado { texto: string; correcta?: boolean | null; explicacion?: string | null; fundamento?: string | null; }
export interface PreguntaResultado { enunciado: string; criterio?: string | null; peso?: number | null; opciones: OpcionResultado[]; }
export interface CasoResultado { nombre?: string | null; bloques: { nombre: string; preguntas: PreguntaResultado[] }[]; }

/** Una fila de la pantalla de resultados. */
export interface FilaResultado {
  escenario: string;
  /** Número del escenario (desde 1) y de la pregunta dentro del escenario (desde 1). */
  numeroEscenario: number;
  numeroPregunta: number;
  /** Criterio de la rúbrica (vacío si el docente no lo escribió). */
  criterio: string | null;
  /** Peso de la pregunta y puntos obtenidos (el peso si acertó, 0 si no). */
  peso: number;
  puntos: number;
  /** Enunciado en HTML (como lo escribió el docente). */
  enunciado: string;
  elegida: string | null;
  /** true = acierto, false = fallo, null = sin responder. */
  acierto: boolean | null;
  explicacionElegida: string | null;
  fundamentoElegida: string | null;
  /** Solo si falló o no respondió: la opción correcta, su explicación y su fundamento. */
  correcta: string | null;
  explicacionCorrecta: string | null;
  fundamentoCorrecta: string | null;
}

/** Lo que muestra la pantalla de resultados (vista previa o lo que devuelve el backend). */
export interface ResultadosNovela {
  /** Nombre del caso (encabezado de la pantalla). */
  caso?: string | null;
  aciertos: number;
  fallos: number;
  sinResponder: number;
  /** Nota de 0,0 a 5,0. */
  nota: number;
  /** Texto general de retroalimentación (el del backend para el estudiante). */
  retroalimentacion?: string | null;
  preguntas: FilaResultado[];
}

/**
 * Calcula los resultados con las opciones elegidas (clave "escenario:pregunta" → índice de la opción).
 * La nota suma el peso de cada pregunta acertada; si los pesos no suman 5,0 (borrador), se escala a 5,0.
 */
export function calcularResultados(caso: CasoResultado, elegidas: Record<string, number>): ResultadosNovela {
  const filas: FilaResultado[] = [];
  let pesoTotal = 0, pesoAcertado = 0, aciertos = 0, fallos = 0, sinResponder = 0, preguntas = 0;
  caso.bloques.forEach((b, i) => b.preguntas.forEach((q, j) => {
    preguntas++;
    const peso = Number(q.peso) || 0;
    pesoTotal += peso;
    const k = elegidas[`${i}:${j}`];
    const elegida = k === undefined ? null : q.opciones[k] ?? null;
    const correcta = q.opciones.find(o => o.correcta) ?? null;
    const acierto = elegida ? !!elegida.correcta : null;
    if (acierto === true) { aciertos++; pesoAcertado += peso; }
    else if (acierto === false) fallos++;
    else sinResponder++;
    filas.push({
      escenario: b.nombre || `Escenario ${i + 1}`,
      numeroEscenario: i + 1,
      numeroPregunta: j + 1,
      criterio: q.criterio?.trim() || null,
      peso,
      puntos: acierto === true ? peso : 0,
      enunciado: q.enunciado,
      elegida: elegida?.texto ?? null,
      acierto,
      explicacionElegida: elegida?.explicacion || null,
      fundamentoElegida: elegida?.fundamento || null,
      correcta: acierto === true ? null : correcta?.texto ?? null,
      explicacionCorrecta: acierto === true ? null : correcta?.explicacion || null,
      fundamentoCorrecta: acierto === true ? null : correcta?.fundamento || null
    });
  }));
  const nota = pesoTotal > 0 ? (pesoAcertado / pesoTotal) * 5 : preguntas ? (aciertos / preguntas) * 5 : 0;
  return { caso: caso.nombre ?? null, aciertos, fallos, sinResponder, nota: Math.round(nota * 10) / 10, preguntas: filas };
}

/** Desempeño por criterio de la rúbrica: puntos obtenidos sobre el peso total de sus preguntas. */
export interface CriterioResultado { criterio: string; puntos: number; peso: number; }

export function resumenPorCriterio(filas: FilaResultado[]): CriterioResultado[] {
  const mapa = new Map<string, CriterioResultado>();
  for (const f of filas) {
    if (!f.criterio || !(f.peso > 0)) continue;
    const c = mapa.get(f.criterio) ?? { criterio: f.criterio, puntos: 0, peso: 0 };
    c.puntos += f.puntos; c.peso += f.peso;
    mapa.set(f.criterio, c);
  }
  return [...mapa.values()].map(c => ({ ...c, puntos: Math.round(c.puntos * 100) / 100, peso: Math.round(c.peso * 100) / 100 }));
}

/** Nivel de la nota (sobre 5,0): alto desde 4,0, medio desde 3,0, bajo por debajo. */
export function nivelDeNota(nota: number): 'alto' | 'medio' | 'bajo' {
  return nota >= 4 ? 'alto' : nota >= 3 ? 'medio' : 'bajo';
}

/** Lo que devuelve el backend del intento del estudiante (solo los campos que usa la pantalla). */
export interface ParticipacionResultado {
  caso: string;
  nota: number | null;
  retroalimentacion: string | null;
  aciertos: number | null;
  errores: number | null;
  sinResponder: number | null;
  preguntas: {
    bloque: string; enunciado: string; criterio: string | null; bloqueIndice?: number; peso?: number | null;
    puntaje: number | null; seleccionId: number | null;
    opciones: { id: number; texto: string; correcta: boolean | null; explicacion: string | null; fundamento: string | null }[];
  }[];
}

/**
 * Pantalla de resultados del estudiante a partir de lo que devolvió el backend al finalizar: copia la nota,
 * los conteos, el puntaje de cada pregunta y la opción que el backend marcó como correcta. No califica.
 */
export function resultadosDeParticipacion(p: ParticipacionResultado): ResultadosNovela {
  const porEscenario = new Map<number, number>();
  const nombres: string[] = [];
  const preguntas: FilaResultado[] = p.preguntas.map(q => {
    let bloque = q.bloqueIndice;
    if (bloque === undefined || bloque === null) {
      bloque = nombres.indexOf(q.bloque);
      if (bloque < 0) { nombres.push(q.bloque); bloque = nombres.length - 1; }
    }
    const numeroPregunta = (porEscenario.get(bloque) ?? 0) + 1;
    porEscenario.set(bloque, numeroPregunta);
    const elegida = q.opciones.find(o => o.id === q.seleccionId) ?? null;
    const correcta = q.opciones.find(o => o.correcta === true) ?? null;
    const acierto = elegida ? elegida.correcta === true : null;
    return {
      escenario: q.bloque,
      numeroEscenario: bloque + 1,
      numeroPregunta,
      criterio: q.criterio?.trim() || null,
      peso: Number(q.peso) || 0,
      puntos: Number(q.puntaje) || 0,
      enunciado: q.enunciado,
      elegida: elegida?.texto ?? null,
      acierto,
      explicacionElegida: elegida?.explicacion || null,
      fundamentoElegida: elegida?.fundamento || null,
      correcta: acierto === true ? null : correcta?.texto ?? null,
      explicacionCorrecta: acierto === true ? null : correcta?.explicacion || null,
      fundamentoCorrecta: acierto === true ? null : correcta?.fundamento || null
    };
  });
  return {
    caso: p.caso,
    aciertos: p.aciertos ?? 0,
    fallos: p.errores ?? 0,
    sinResponder: p.sinResponder ?? 0,
    nota: p.nota ?? 0,
    retroalimentacion: p.retroalimentacion,
    preguntas
  };
}
