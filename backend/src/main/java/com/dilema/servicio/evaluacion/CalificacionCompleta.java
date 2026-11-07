package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;

import java.math.BigDecimal;

/**
 * Strategy (RF-13): intento completo — aporta el peso de cada pregunta de la rúbrica
 * cuya opción elegida es la correcta (INV-29: la rúbrica suma 5,0).
 */
public class CalificacionCompleta implements EstrategiaCalificacion {
    @Override
    public BigDecimal puntajePregunta(Participacion participacion, Pregunta pregunta) {
        return acierto(participacion, pregunta) ? pregunta.criterio.peso : BigDecimal.ZERO;
    }

    private boolean acierto(Participacion participacion, Pregunta pregunta) {
        return participacion.respuestas.stream()
                .anyMatch(r -> r.pregunta.id.equals(pregunta.id) && r.opcion.esCorrecta);
    }
}
