package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;

import java.math.BigDecimal;

/**
 * Strategy (RF-13) / RF-24 (INV-20): intento incompleto o ausencia — recorre cada
 * criterio de la rúbrica y aporta 0 donde no hay respuesta registrada.
 */
public class CalificacionParcial implements EstrategiaCalificacion {
    @Override
    public BigDecimal puntajePregunta(Participacion participacion, Pregunta pregunta) {
        Respuesta respuesta = buscar(participacion, pregunta);
        return respuesta != null && respuesta.opcion.esCorrecta ? pregunta.criterio.peso : BigDecimal.ZERO;
    }

    private Respuesta buscar(Participacion participacion, Pregunta pregunta) {
        return participacion.respuestas.stream()
                .filter(r -> r.pregunta.id.equals(pregunta.id)).findFirst().orElse(null);
    }
}
