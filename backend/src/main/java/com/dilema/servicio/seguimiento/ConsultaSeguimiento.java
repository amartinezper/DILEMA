package com.dilema.servicio.seguimiento;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.SesionCaso;
import com.dilema.servicio.ReglaNegocio;

import java.util.ArrayList;
import java.util.List;

/**
 * Iterator (RF-15). El docente navega las sesiones ya realizadas y abre una participación
 * para ver la respuesta vigente de cada pregunta, su explicación y la valoración general.
 */
public final class ConsultaSeguimiento {
    public List<SesionCaso> navegarCasosRealizados(HistorialSesiones historial) {
        List<SesionCaso> recorrido = new ArrayList<>();
        Iterador<SesionCaso> iterador = historial.crearIterador();
        while (iterador.haySiguiente()) recorrido.add(iterador.siguiente());
        return recorrido;
    }

    /**
     * Recorre las participaciones de la sesión. Si no hay ninguna, lo informa
     * y no entrega una lista vacía en silencio.
     */
    public List<Participacion> participacionesDe(List<Participacion> deLaSesion) {
        Iterador<Participacion> iterador = new IteradorParticipaciones(deLaSesion);
        if (!iterador.haySiguiente()) {
            throw new ReglaNegocio("RF-15: la sesión no tiene participaciones.");
        }
        List<Participacion> recorrido = new ArrayList<>();
        while (iterador.haySiguiente()) recorrido.add(iterador.siguiente());
        return recorrido;
    }

    /** La respuesta vigente es la opción guardada, no el historial de cambios. */
    public Contratos.ParticipacionConsultada verParticipacion(Participacion participacion) {
        List<Contratos.RespuestaVigente> respuestas = new ArrayList<>();
        if (participacion.sesion != null && participacion.sesion.caso != null) {
            for (Escenario escenario : participacion.sesion.caso.escenarios) {
                for (Pregunta pregunta : escenario.preguntas) {
                    Respuesta vigente = buscar(participacion, pregunta);
                    String explicacion = null;
                    String fundamento = null;
                    String opcion = null;
                    Boolean acertada = null;
                    if (vigente != null && vigente.opcion != null) {
                        opcion = vigente.opcion.descripcion;
                        acertada = vigente.opcion.esCorrecta;
                        if (vigente.opcion.retroalimentacion != null) {
                            explicacion = vigente.opcion.retroalimentacion.explicacion;
                            fundamento = vigente.opcion.retroalimentacion.fundamento;
                        }
                    }
                    respuestas.add(new Contratos.RespuestaVigente(pregunta.enunciado, opcion, acertada, explicacion, fundamento));
                }
            }
        }
        String estudiante = participacion.estudiante == null ? "" : participacion.estudiante.nombre;
        return new Contratos.ParticipacionConsultada(participacion.id, estudiante, participacion.numeroIntento,
                participacion.comentarioDocente() == null ? "" : participacion.comentarioDocente(), respuestas);
    }

    private Respuesta buscar(Participacion participacion, Pregunta pregunta) {
        if (participacion.respuestas == null || pregunta.id == null) return null;
        for (Respuesta respuesta : participacion.respuestas) {
            if (respuesta.pregunta != null && pregunta.id.equals(respuesta.pregunta.id)) return respuesta;
        }
        return null;
    }
}
