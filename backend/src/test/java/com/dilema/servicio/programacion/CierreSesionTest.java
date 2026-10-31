package com.dilema.servicio.programacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.servicio.ParticipacionServicio;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CierreSesionTest {

    @Test
    @DisplayName("RF-19 y RF-24: el docente cierra incompletos y registra ausencias en 0,0")
    void cierrePorDocente() {
        ParticipacionServicio servicio = mock(ParticipacionServicio.class);
        ParticipacionRepo repo = mock(ParticipacionRepo.class);
        SesionCaso sesion = sesionEnCurso();
        Usuario presente = estudiante(2L);
        Usuario ausente = estudiante(3L);
        sesion.grupo.estudiantes.add(presente);
        sesion.grupo.estudiantes.add(ausente);
        Participacion enCurso = new Participacion();
        enCurso.inicio = LocalDateTime.now().minusMinutes(10);
        when(repo.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of(enCurso));
        when(repo.findByEstudianteIdAndSesionId(3L, 4L)).thenReturn(List.of());

        new CierrePorDocente(servicio, repo).cerrar(sesion);

        verify(servicio).cerrarPorTiempo(enCurso);
        ArgumentCaptor<Participacion> captor = ArgumentCaptor.forClass(Participacion.class);
        verify(repo).save(captor.capture());
        assertEquals(0.0, captor.getValue().nota());
        assertEquals(3L, captor.getValue().estudiante.id);
        assertNotNull(sesion.cierreReal);
    }

    @Test
    @DisplayName("RF-19 no finaliza una sesión que todavía no inició")
    void noCierraSinIniciar() {
        assertThrows(ReglaNegocio.class, () -> new CierrePorDocente(mock(ParticipacionServicio.class), mock(ParticipacionRepo.class))
                .cerrar(new SesionCaso()));
    }

    @Test
    @DisplayName("el cierre por fecha espera un día después del fin previsto")
    void cierrePorFecha() {
        ParticipacionServicio servicio = mock(ParticipacionServicio.class);
        ParticipacionRepo repo = mock(ParticipacionRepo.class);
        SesionCaso sesion = sesionEnCurso();
        sesion.fin = LocalDateTime.now().minusDays(2);
        when(repo.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of());
        sesion.grupo.estudiantes.add(estudiante(2L));

        new CierrePorFecha(servicio, repo).cerrar(sesion);

        verify(repo).save(org.mockito.ArgumentMatchers.any());
        assertNotNull(sesion.cierreReal);
    }

    @Test
    @DisplayName("el cierre por fecha no actúa si todavía no venció el plazo")
    void noCierraSiNoVencio() {
        ParticipacionServicio servicio = mock(ParticipacionServicio.class);
        ParticipacionRepo repo = mock(ParticipacionRepo.class);
        SesionCaso sesion = sesionEnCurso();
        sesion.fin = LocalDateTime.now().plusHours(2);
        new CierrePorFecha(servicio, repo).cerrar(sesion);
        verify(repo, never()).save(org.mockito.ArgumentMatchers.any());
        assertNull(sesion.cierreReal);
    }

    private SesionCaso sesionEnCurso() {
        Caso caso = new Caso();
        caso.id = 5L;
        Grupo grupo = new Grupo();
        grupo.id = 8L;
        SesionCaso sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.inicioReal = LocalDateTime.now().minusHours(1);
        sesion.fin = LocalDateTime.now().plusHours(1);
        return sesion;
    }

    private Usuario estudiante(long id) {
        Usuario estudiante = new Usuario();
        estudiante.id = id;
        estudiante.nombre = "E" + id;
        return estudiante;
    }
}
