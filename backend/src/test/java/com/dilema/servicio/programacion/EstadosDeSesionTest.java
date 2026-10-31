package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EstadosDeSesionTest {

    @Test
    @DisplayName("RF-19: sin iniciar admite iniciar y rechaza finalizar o participar")
    void sinIniciar() {
        SesionCaso sesion = new SesionCaso();
        EstadoSesion estado = EstadosDeSesion.de(sesion);
        assertFalse(estado.permiteParticipar());
        estado.iniciar(sesion);
        assertNotNull(sesion.inicioReal);
        sesion.inicioReal = null;
        assertThrows(ReglaNegocio.class, () -> estado.finalizar(sesion));
    }

    @Test
    @DisplayName("RF-19: en curso admite participar y finalizar, no volver a iniciar")
    void enCurso() {
        SesionCaso sesion = new SesionCaso();
        sesion.inicioReal = LocalDateTime.now();
        EstadoSesion estado = EstadosDeSesion.de(sesion);
        assertTrue(estado.permiteParticipar());
        assertThrows(ReglaNegocio.class, () -> estado.iniciar(sesion));
        estado.finalizar(sesion);
    }

    @Test
    @DisplayName("RF-19: finalizada rechaza iniciar, finalizar y participar")
    void finalizada() {
        SesionCaso sesion = new SesionCaso();
        sesion.inicioReal = LocalDateTime.now().minusHours(2);
        sesion.cierreReal = LocalDateTime.now();
        EstadoSesion estado = EstadosDeSesion.de(sesion);
        assertFalse(estado.permiteParticipar());
        assertThrows(ReglaNegocio.class, () -> estado.iniciar(sesion));
        assertThrows(ReglaNegocio.class, () -> estado.finalizar(sesion));
    }

    @Test
    @DisplayName("RF-19: el cierre automático ocurre un día después del fin, aunque no se haya iniciado")
    void cierreUnDiaDespues() {
        SesionCaso sesion = new SesionCaso();
        sesion.fin = LocalDateTime.of(2026, 6, 2, 10, 0);
        assertFalse(EstadosDeSesion.vencioPlazoDeCierre(sesion, LocalDateTime.of(2026, 6, 2, 18, 0)));
        assertTrue(EstadosDeSesion.vencioPlazoDeCierre(sesion, LocalDateTime.of(2026, 6, 3, 10, 0)));
        sesion.cierreReal = LocalDateTime.of(2026, 6, 3, 10, 0);
        assertFalse(EstadosDeSesion.vencioPlazoDeCierre(sesion, LocalDateTime.of(2026, 6, 4, 10, 0)));
        assertNull(new SesionCaso().inicioReal);
    }
}
