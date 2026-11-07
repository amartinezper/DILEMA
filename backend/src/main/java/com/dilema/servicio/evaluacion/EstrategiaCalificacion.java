package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Strategy (RF-13): calcula el puntaje de un intento a partir de la rúbrica del caso.
 * La estrategia concreta se elige según cómo terminó la participación: completa si
 * respondió todas las preguntas, parcial si falta alguna (intento incompleto o ausencia).
 */
public interface EstrategiaCalificacion {
    /** Lo que aporta una pregunta con criterio en la rúbrica; cada estrategia decide cómo. */
    BigDecimal puntajePregunta(Participacion participacion, Pregunta pregunta);

    /**
     * RF-13 / RF-24: recorre todas las preguntas del caso, registra en la participación
     * el puntaje de cada una (0,0 si no aporta o no tiene criterio) y devuelve la suma.
     */
    default BigDecimal calcularPuntaje(Participacion participacion) {
        BigDecimal acumulado = BigDecimal.ZERO;
        for (Pregunta pregunta : preguntas(participacion.sesion.caso)) {
            BigDecimal puntaje = pregunta.criterio == null || pregunta.criterio.peso == null
                    ? BigDecimal.ZERO : puntajePregunta(participacion, pregunta);
            participacion.registrarPuntaje(pregunta, puntaje.setScale(1, RoundingMode.HALF_UP));
            acumulado = acumulado.add(puntaje);
        }
        return acumulado.setScale(1, RoundingMode.HALF_UP);
    }

    static List<Pregunta> preguntas(Caso caso) {
        List<Pregunta> todas = new ArrayList<>();
        for (Escenario escenario : caso.escenarios) todas.addAll(escenario.preguntas);
        return todas;
    }

    static boolean esCompleta(Participacion participacion) {
        List<Pregunta> preguntas = preguntas(participacion.sesion.caso);
        return !preguntas.isEmpty() && participacion.respuestas.size() >= preguntas.size();
    }

    /** RF-13 / RF-24: la estrategia se elige según cómo terminó la participación. */
    static EstrategiaCalificacion paraEstadoDe(Participacion participacion) {
        return esCompleta(participacion) ? new CalificacionCompleta() : new CalificacionParcial();
    }
}
