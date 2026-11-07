package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Strategy (RF-13): calcula el puntaje de un intento a partir de la rúbrica del caso.
 * La estrategia concreta se elige según cómo terminó la participación: completa si
 * respondió todas las preguntas, parcial si falta alguna (intento incompleto o ausencia).
 */
public interface EstrategiaCalificacion {
    BigDecimal calcularPuntaje(Participacion participacion);

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
