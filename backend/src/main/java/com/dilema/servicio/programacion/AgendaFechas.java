package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public final class AgendaFechas {
    private AgendaFechas() {}

    public static LocalDateTime parse(String valor) {
        if (valor == null || valor.isBlank()) throw new ReglaNegocio("Indica la fecha y hora de inicio y de cierre.");
        String texto = valor.trim();
        if (texto.length() == 16) texto = texto + ":00";
        try {
            return LocalDateTime.parse(texto, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException error) {
            throw new ReglaNegocio("La fecha o la hora no se entendieron. Revísalas e inténtalo de nuevo.");
        }
    }
}
