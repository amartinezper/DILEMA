package com.dilema.servicio.seguimiento;

import java.util.List;

/**
 * RF-16. Orden de columnas compartido por las tres estrategias.
 * Vive aparte del CSV para que PDF y Excel no dependan de cómo ese formato escribe el texto.
 */
public final class ColumnasReporte {
    public static final List<String> NOMBRES = List.of(
            "estudiante", "estado", "puntaje", "aciertos", "totalPreguntas", "nivel", "valoracionGeneral");

    private ColumnasReporte() {}

    public static String encabezadoCsv() {
        return String.join(",", NOMBRES);
    }
}
