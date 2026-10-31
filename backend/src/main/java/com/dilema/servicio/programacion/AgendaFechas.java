package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public final class AgendaFechas {
    private AgendaFechas() {}

    public static LocalDateTime parse(String valor) {
        if (valor == null || valor.isBlank()) throw new ReglaNegocio("INV-18: indica inicio y fin.");
        String texto = valor.trim();
        if (texto.length() == 16) texto = texto + ":00";
        try {
            return LocalDateTime.parse(texto, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException error) {
            throw new ReglaNegocio("INV-18: la fecha y hora no tienen un formato válido.");
        }
    }
}
