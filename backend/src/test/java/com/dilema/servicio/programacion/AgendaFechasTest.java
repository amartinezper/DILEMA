package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AgendaFechasTest {

    @Test
    @DisplayName("INV-18 acepta datetime-local y completa los segundos")
    void parsea() {
        assertEquals(LocalDateTime.of(2026, 6, 2, 8, 30, 0), AgendaFechas.parse("2026-06-02T08:30"));
        assertEquals(LocalDateTime.of(2026, 6, 2, 8, 30, 15), AgendaFechas.parse("2026-06-02T08:30:15"));
    }

    @Test
    @DisplayName("INV-18 rechaza vacío o basura")
    void rechaza() {
        assertThrows(ReglaNegocio.class, () -> AgendaFechas.parse(" "));
        assertThrows(ReglaNegocio.class, () -> AgendaFechas.parse("ayer"));
    }
}
