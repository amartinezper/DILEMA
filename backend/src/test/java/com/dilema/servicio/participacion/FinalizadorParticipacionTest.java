package com.dilema.servicio.participacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class FinalizadorParticipacionTest {

    @Test
    @DisplayName("RF-12 cierra el intento, calcula la nota y avisa por correo")
    void porEstudiante() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion participacion = enCurso();
        new FinalizadorParticipacion.PorEstudiante(bitacora, p -> new BigDecimal("4.5")).finalizar(participacion);

        assertNotNull(participacion.fin);
        assertEquals(4.5, participacion.nota());
        verify(bitacora).avisar(eq(participacion.estudiante), eq("CORREO"), eq("Nota del caso"), contains("4.5"));
    }

    @Test
    @DisplayName("RF-12 no vuelve a cerrar un intento ya finalizado")
    void ignoraFinalizada() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion participacion = enCurso();
        participacion.fin = LocalDateTime.now();
        new FinalizadorParticipacion.PorLimite(bitacora, p -> new BigDecimal("1.0")).finalizar(participacion);
        assertNull(participacion.nota());
        verifyNoInteractions(bitacora);
    }

    @Test
    @DisplayName("RF-23 el cierre por límite no pasa del fin de la sesión")
    void porLimiteRespetaVentana() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion participacion = enCurso();
        participacion.inicio = LocalDateTime.now().minusMinutes(5);
        participacion.sesion.fin = LocalDateTime.now().minusMinutes(1);
        participacion.sesion.tiempoMaxMin = 40;
        new FinalizadorParticipacion.PorLimite(bitacora, p -> new BigDecimal("2.0")).finalizar(participacion);
        assertEquals(participacion.sesion.fin, participacion.fin);
    }

    private Participacion enCurso() {
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.email = "ana@psicosim.edu";
        Caso caso = new Caso();
        caso.nombre = "Crisis";
        SesionCaso sesion = new SesionCaso();
        sesion.caso = caso;
        sesion.tiempoMaxMin = 40;
        sesion.fin = LocalDateTime.now().plusHours(1);
        Participacion participacion = new Participacion();
        participacion.id = 11L;
        participacion.estudiante = estudiante;
        participacion.sesion = sesion;
        participacion.inicio = LocalDateTime.now().minusMinutes(5);
        return participacion;
    }
}
