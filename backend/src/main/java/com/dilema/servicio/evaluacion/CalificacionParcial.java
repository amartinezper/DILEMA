package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Strategy (RF-13) / RF-24 (INV-20): intento incompleto o ausencia — recorre cada
 * criterio de la rúbrica y aporta 0 donde no hay respuesta registrada.
 */
public class CalificacionParcial implements EstrategiaCalificacion {
    @Override
    public BigDecimal calcularPuntaje(Participacion participacion) {
        BigDecimal acumulado = BigDecimal.ZERO;
        for (Pregunta pregunta : EstrategiaCalificacion.preguntas(participacion.sesion.caso)) {
            if (pregunta.criterio == null || pregunta.criterio.peso == null) continue;
            Respuesta respuesta = buscar(participacion, pregunta);
            if (respuesta != null && respuesta.opcion.esCorrecta) acumulado = acumulado.add(pregunta.criterio.peso);
        }
        return acumulado.setScale(1, RoundingMode.HALF_UP);
    }

    private Respuesta buscar(Participacion participacion, Pregunta pregunta) {
        return participacion.respuestas.stream()
                .filter(r -> r.pregunta.id.equals(pregunta.id)).findFirst().orElse(null);
    }
}
