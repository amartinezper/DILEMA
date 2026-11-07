package com.dilema.servicio.seguimiento;

import java.math.BigDecimal;

/**
 * RF-16. Una fila del reporte: un intento, sin el detalle de cada respuesta.
 * La ausencia también es una fila, con puntaje 0,0, aunque no exista la participación.
 */
public record LineaReporte(
        String estudiante,
        int numeroIntento,
        EstadoLinea estado,
        BigDecimal puntaje,
        int aciertos,
        int totalPreguntas,
        NivelDesempeno nivel,
        String valoracionGeneral
) {}
