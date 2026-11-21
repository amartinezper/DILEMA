package com.dilema.servicio.seguimiento;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * RF-16. Texto común del reporte. Cada estrategia decide cómo pintarlo;
 * aquí solo se arma el título, el periodo y los siete valores de la fila.
 */
final class PresentacionReporte {
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private PresentacionReporte() {}

    static String titulo(DatosReporte datos) {
        String caso = datos.nombreCaso() == null || datos.nombreCaso().isBlank() ? "Caso" : datos.nombreCaso();
        String grupo = datos.nombreGrupo() == null || datos.nombreGrupo().isBlank() ? "Grupo" : datos.nombreGrupo();
        return caso + " — " + grupo;
    }

    static String periodo(DatosReporte datos) {
        return "Inicio " + fecha(datos.fechaInicio()) + "   ·   Cierre " + fecha(datos.fechaFin());
    }

    static List<String> valores(LineaReporte linea) {
        return List.of(
                linea.estudiante() == null ? "" : linea.estudiante(),
                linea.estado().name(),
                linea.puntaje().toPlainString(),
                Integer.toString(linea.aciertos()),
                Integer.toString(linea.totalPreguntas()),
                linea.nivel().name(),
                linea.valoracionGeneral() == null ? "" : linea.valoracionGeneral());
    }

    private static String fecha(LocalDateTime momento) {
        return momento == null ? "sin fecha" : FECHA.format(momento);
    }
}
