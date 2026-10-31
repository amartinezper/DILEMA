package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class EstadoParticipacionTest {

    @Test
    @DisplayName("RF-26 / INV-30 una participación en curso rechaza la valoración general")
    void enCursoRechaza() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion enCurso = new Participacion();
        enCurso.inicio = LocalDateTime.now();

        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> EstadoDeParticipacion.de(enCurso, bitacora).agregarRetroalimentacionGeneral(enCurso, "Buen desempeño"));

        assertEquals("RF-26: la valoración general solo se registra cuando la participación finalizó.", error.getMessage());
        verifyNoInteractions(bitacora);
    }

    @Test
    @DisplayName("RF-26 una participación finalizada guarda la valoración y avisa al estudiante")
    void finalizadaGuardaYAvisa() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.email = "ana@psicosim.edu";
        Participacion finalizada = new Participacion();
        finalizada.estudiante = estudiante;
        finalizada.inicio = LocalDateTime.now().minusMinutes(10);
        finalizada.fin = LocalDateTime.now();

        EstadoDeParticipacion.de(finalizada, bitacora).agregarRetroalimentacionGeneral(finalizada, "Buen desempeño");

        assertEquals("Buen desempeño", finalizada.comentarioDocente());
        verify(bitacora).avisar(eq(estudiante), eq("SISTEMA"), eq("Retroalimentación del docente"), contains("Buen desempeño"));
    }

    @Test
    @DisplayName("RF-26 exige un texto no vacío para la valoración general")
    void exigeTexto() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion finalizada = new Participacion();
        finalizada.inicio = LocalDateTime.now().minusMinutes(10);
        finalizada.fin = LocalDateTime.now();

        assertThrows(ReglaNegocio.class,
                () -> EstadoDeParticipacion.de(finalizada, bitacora).agregarRetroalimentacionGeneral(finalizada, "   "));
        verifyNoInteractions(bitacora);
    }
}
