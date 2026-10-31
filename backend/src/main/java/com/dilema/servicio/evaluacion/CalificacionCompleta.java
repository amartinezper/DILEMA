package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Strategy (RF-13): intento completo — suma el peso de cada pregunta de la rúbrica
 * cuya opción elegida es la correcta (INV-29: la rúbrica suma 5,0).
 */
public class CalificacionCompleta implements EstrategiaCalificacion {
    @Override
    public BigDecimal calcularPuntaje(Participacion participacion) {
        BigDecimal acumulado = BigDecimal.ZERO;
        for (Pregunta pregunta : EstrategiaCalificacion.preguntas(participacion.sesion.caso)) {
            if (pregunta.criterio == null || pregunta.criterio.peso == null) continue;
            if (acierto(participacion, pregunta)) acumulado = acumulado.add(pregunta.criterio.peso);
        }
        return acumulado.setScale(1, RoundingMode.HALF_UP);
    }

    private boolean acierto(Participacion participacion, Pregunta pregunta) {
        return participacion.respuestas.stream()
                .anyMatch(r -> r.pregunta.id.equals(pregunta.id) && r.opcion.esCorrecta);
    }
}
