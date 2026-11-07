package com.dilema.servicio.seguimiento;

import java.time.LocalDateTime;
import java.util.List;

/** RF-16. Los mismos datos de la sesión, sea cual sea el formato que después los exporte. */
public record DatosReporte(
        String nombreCaso,
        String nombreGrupo,
        LocalDateTime fechaInicio,
        LocalDateTime fechaFin,
        List<LineaReporte> lineas
) {}
