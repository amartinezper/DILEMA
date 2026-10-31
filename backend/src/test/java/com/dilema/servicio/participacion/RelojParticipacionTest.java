package com.dilema.servicio.participacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RelojParticipacionTest {

    @Test
    @DisplayName("RF-23 cierra el intento al agotar el tiempo máximo o al llegar el fin de la sesión")
    void cierraPorTiempoOPorVentana() {
        Participacion participacion = intento(LocalDateTime.of(2026, 6, 2, 9, 0), 10,
                LocalDateTime.of(2026, 6, 2, 11, 0));
        assertFalse(RelojParticipacion.debeCerrar(participacion, LocalDateTime.of(2026, 6, 2, 9, 9)));
        assertTrue(RelojParticipacion.debeCerrar(participacion, LocalDateTime.of(2026, 6, 2, 9, 10)));

        Participacion corta = intento(LocalDateTime.of(2026, 6, 2, 9, 0), 40,
                LocalDateTime.of(2026, 6, 2, 9, 15));
        assertTrue(RelojParticipacion.debeCerrar(corta, LocalDateTime.of(2026, 6, 2, 9, 15)));
    }

    @Test
    @DisplayName("RF-12 registra el fin en el límite y no después")
    void finPorLimite() {
        Participacion participacion = intento(LocalDateTime.of(2026, 6, 2, 9, 0), 10,
                LocalDateTime.of(2026, 6, 2, 9, 8));
        assertEquals(LocalDateTime.of(2026, 6, 2, 9, 8),
                RelojParticipacion.finPorLimite(participacion, LocalDateTime.of(2026, 6, 2, 9, 12)));
    }

    private Participacion intento(LocalDateTime inicio, int minutos, LocalDateTime finSesion) {
        SesionCaso sesion = new SesionCaso();
        sesion.tiempoMaxMin = minutos;
        sesion.fin = finSesion;
        sesion.inicioReal = inicio;
        Participacion participacion = new Participacion();
        participacion.sesion = sesion;
        participacion.inicio = inicio;
        return participacion;
    }
}
