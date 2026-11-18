import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('dilema-token');
  const pedido = (!token || req.url.includes('/api/auth/ingresar'))
    ? next(req)
    : next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  return pedido.pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/api/auth/')) {
      localStorage.removeItem('dilema-token');
      localStorage.removeItem('dilema-usuario');
      localStorage.removeItem('dilema-sesion');
      if (!location.pathname.endsWith('/ingreso')) location.assign('/ingreso');
    }
    return throwError(() => error);
  }));
};

/** El API antiguo anteponía el código del requisito. El cliente ve la explicación, no el código. */
const explicaciones: Record<string, string> = {
  'RF-23: la ventana de la sesión ya cerró.': 'Esta convocatoria ya terminó. La fecha de cierre pasó y ya no puedes entrar con este código.',
  'RF-22: ya pasó el tiempo definido por el docente para iniciar.': 'Ya pasó el tiempo que el docente dejó para entrar. Pídele que amplíe el plazo si todavía debes participar.',
  'RF-25: la sesión ya finalizó y no admite participación.': 'Esta sesión ya finalizó, así que ya no puedes participar.',
  'RF-25: ya registraste una participación. Solo el docente creador puede autorizar otra.': 'Ya completaste este caso. Para intentarlo otra vez, el docente que lo creó tiene que autorizarlo.',
  'RF-19: solo se finaliza una sesión en curso.': 'Solo puedes cerrar una sesión que esté en curso.',
  'RF-19: solo se inicia una sesión sin iniciar.': 'Solo puedes abrir una sesión que todavía no ha comenzado.',
  'RF-09: no se puede publicar. ': 'No se puede publicar el caso. '
};

export function paraCliente(texto: string): string {
  const conocido = explicaciones[texto];
  if (conocido) return conocido;
  const limpio = texto.replace(/\b(?:RF|INV)-\d+:\s*/g, '').replace(/[ \t]{2,}/g, ' ').trim();
  return limpio || 'No se pudo completar la operación.';
}

export function mensajeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { mensaje?: string } | null;
    return paraCliente(cuerpo?.mensaje ?? 'No se pudo completar la operación.');
  }
  return 'No se pudo completar la operación.';
}

export interface Usuario { id: number; nombre: string; email: string; rol: string; permisos: string[]; }
export interface SesionAuth { token: string; usuario: Usuario; sesionId: number | null; }
export interface Opcion { id?: number; texto: string; correcta: boolean; explicacion: string; fundamento: string; }
export interface Pregunta { id?: number; enunciado: string; pista: string; criterio: string; peso: number; opciones: Opcion[]; }
export interface Bloque { id?: number; nombre: string; contexto: string; preguntas: Pregunta[]; }
export interface PersonajeCaso { id?: number; nombre: string; descripcion: string; escenarios: number[]; }
export interface Criterio { id?: number; nombre: string; peso: number; descripcion: string; }
export interface Caso {
  id?: number; nombre: string; desarrolloSituacional: string; contexto: string; tiempoEstimadoMin: number;
  sensible: boolean; advertencia: string; estado?: string; bloques: Bloque[]; rubrica: Criterio[];
  personajes: PersonajeCaso[]; repartoRubrica?: string;
}
export interface CasoResumen { id: number; nombre: string; estado: string; tiempoEstimadoMin: number; bloques: number; preguntas: number; }
export interface Persona { id: number; nombre: string; email: string; }
export interface Grupo { id: number; nombre: string; espacioAcademico: string; docente: Persona; estudiantes: Persona[]; }
export interface Sesion {
  id: number; codigo: string; estado: string; inicio: string; fin: string; tiempoMaxMin: number; toleranciaMin: number;
  lugar: string; mensaje: string; casoId: number; caso: string; grupoId: number; grupo: string; espacio: string;
  desarrollo: string; contexto: string; sensible: boolean; advertencia: string;
  participacionId: number | null; participacionEstado: string | null; nota: number | null; progreso: number | null;
  repeticionAutorizada: boolean;
}
export interface Aviso { id: number; canal: string; titulo: string; cuerpo: string; leida: boolean; fecha: string; }
export interface PanelEstudiante { sesiones: Sesion[]; avisos: Aviso[]; sinLeer: number; }
export interface OpcionJuego { id: number; texto: string; correcta: boolean | null; explicacion: string | null; fundamento: string | null; }
export interface PreguntaJuego {
  id: number; bloque: string; contexto: string; enunciado: string; pista: string | null; criterio: string;
  seleccionId: number | null; opciones: OpcionJuego[]; puntaje: number | null;
}
export interface Participacion {
  id: number; sesionId: number; estado: string; caso: string; progreso: number; total: number;
  segundosMax: number; segundosUsados: number; nota: number | null; retroalimentacion: string | null;
  estudiante: string; preguntas: PreguntaJuego[]; repeticionAutorizada: boolean;
  aciertos: number | null; errores: number | null; sinResponder: number | null;
}
export interface Fila { participacionId: number | null; estudianteId: number; estudiante: string; email: string; estado: string; nota: number | null; retroalimentacion: string | null; repeticionAutorizada: boolean; }
export interface Auditoria { id: number; fecha: string; accion: string; detalle: string; usuario: string; }
