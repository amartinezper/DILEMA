package com.dilema.servicio.seguimiento;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.AccesoDenegado;
import com.dilema.servicio.ReglaNegocio;
import com.dilema.servicio.evaluacion.EstrategiaCalificacion;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Strategy (RF-16). Junta siempre los mismos datos de la sesión y deja
 * la conversión al formato elegido. Cambiar de PDF a Excel no puede
 * omitir un intento, un avance parcial ni una ausencia.
 */
public final class GeneradorReporte {
    private FormatoReporte formato;

    public void setFormato(FormatoReporte formato) {
        this.formato = formato;
    }

    public ArchivoReporte generar(Usuario profesor, SesionCaso sesion, List<Participacion> participaciones) {
        if (formato == null) {
            throw new ReglaNegocio("RF-16: elige el formato del reporte.");
        }
        verificarGrupoDelProfesor(profesor, sesion);
        if (sesion.grupo.estudiantes == null || sesion.grupo.estudiantes.isEmpty()) {
            throw new ReglaNegocio("RF-16: la sesión no tiene convocados.");
        }
        return formato.exportar(recolectarDatos(sesion, participaciones));
    }

    /** INV-22: solo reporta los grupos que dirige. */
    void verificarGrupoDelProfesor(Usuario profesor, SesionCaso sesion) {
        if (sesion == null || sesion.grupo == null || !sesion.grupo.esDirigidoPor(profesor)) {
            throw new AccesoDenegado("RF-16: no puedes descargar el reporte de un grupo que no diriges.");
        }
    }

    DatosReporte recolectarDatos(SesionCaso sesion, List<Participacion> participaciones) {
        List<Participacion> deLaSesion = new ArrayList<>();
        if (participaciones != null) {
            for (Participacion participacion : participaciones) {
                if (participacion != null && participacion.sesion != null && sesion.id != null
                        && sesion.id.equals(participacion.sesion.id)) {
                    deLaSesion.add(participacion);
                }
            }
        }
        List<Usuario> convocados = new ArrayList<>(sesion.grupo.estudiantes);
        convocados.sort(Comparator.comparing(u -> u.nombre == null ? "" : u.nombre));
        int total = totalPreguntas(sesion);
        List<LineaReporte> lineas = new ArrayList<>();
        for (Usuario estudiante : convocados) {
            List<Participacion> intentos = deLaSesion.stream()
                    .filter(p -> p.estudiante != null && p.estudiante.id != null && p.estudiante.id.equals(estudiante.id))
                    .sorted(Comparator.comparingInt((Participacion p) -> p.numeroIntento)
                            .thenComparing(p -> p.id == null ? Long.MAX_VALUE : p.id))
                    .toList();
            if (intentos.isEmpty()) {
                lineas.add(new LineaReporte(estudiante.nombre, 0, EstadoLinea.AUSENTE,
                        new BigDecimal("0.0"), 0, total, NivelDesempeno.BAJO, ""));
                continue;
            }
            for (Participacion intento : intentos) {
                lineas.add(lineaDe(estudiante.nombre, intento, total));
            }
        }
        String caso = sesion.caso == null ? "" : sesion.caso.nombre;
        return new DatosReporte(caso, sesion.grupo.nombre, sesion.inicio, sesion.fin, lineas);
    }

    private LineaReporte lineaDe(String estudiante, Participacion intento, int total) {
        int aciertos = aciertos(intento);
        BigDecimal puntaje = puntaje(intento);
        EstadoLinea estado = estadoDe(intento);
        String valoracion = intento.comentarioDocente() == null ? "" : intento.comentarioDocente();
        return new LineaReporte(estudiante, intento.numeroIntento, estado, puntaje, aciertos, total,
                NivelDesempeno.de(puntaje), valoracion);
    }

    private EstadoLinea estadoDe(Participacion intento) {
        if (intento.ausente()) return EstadoLinea.AUSENTE;
        if (intento.respuestas == null || intento.sesion == null || intento.sesion.caso == null) {
            return EstadoLinea.PARCIAL;
        }
        return EstrategiaCalificacion.esCompleta(intento) ? EstadoLinea.COMPLETA : EstadoLinea.PARCIAL;
    }

    private BigDecimal puntaje(Participacion intento) {
        if (intento.ausente()) return new BigDecimal("0.0");
        if (intento.evaluacion != null && intento.evaluacion.puntaje != null) {
            return intento.evaluacion.puntaje.setScale(1, RoundingMode.HALF_UP);
        }
        if (intento.sesion == null || intento.sesion.caso == null) return new BigDecimal("0.0");
        return EstrategiaCalificacion.paraEstadoDe(intento).calcularPuntaje(intento);
    }

    private int aciertos(Participacion intento) {
        if (intento.respuestas == null || intento.sesion == null || intento.sesion.caso == null) return 0;
        int total = 0;
        for (Pregunta pregunta : preguntas(intento)) {
            for (Respuesta respuesta : intento.respuestas) {
                if (respuesta.pregunta != null && pregunta.id != null && pregunta.id.equals(respuesta.pregunta.id)
                        && respuesta.opcion != null && respuesta.opcion.esCorrecta) {
                    total++;
                }
            }
        }
        return total;
    }

    private int totalPreguntas(SesionCaso sesion) {
        if (sesion.caso == null) return 0;
        return EstrategiaCalificacion.preguntas(sesion.caso).size();
    }

    private List<Pregunta> preguntas(Participacion intento) {
        return EstrategiaCalificacion.preguntas(intento.sesion.caso);
    }
}
