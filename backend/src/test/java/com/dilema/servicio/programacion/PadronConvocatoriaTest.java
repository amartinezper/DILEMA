package com.dilema.servicio.programacion;

import com.dilema.modelo.Grupo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.SesionEstudiante;
import com.dilema.modelo.Usuario;
import com.dilema.repo.SesionEstudianteRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PadronConvocatoriaTest {
    private SesionEstudianteRepo repo;
    private PadronConvocatoria padron;

    @BeforeEach
    void preparar() {
        repo = mock(SesionEstudianteRepo.class);
        padron = new PadronConvocatoria(repo);
    }

    @Test
    @DisplayName("RF-20 no duplica el padrón y registra al estudiante de la sesión")
    void incluir() {
        SesionCaso sesion = sesion();
        Usuario estudiante = estudiante();
        when(repo.existsBySesionIdAndEstudianteId(4L, 9L)).thenReturn(false);

        padron.incluir(sesion, estudiante);

        ArgumentCaptor<SesionEstudiante> captor = ArgumentCaptor.forClass(SesionEstudiante.class);
        verify(repo).save(captor.capture());
        assertEquals(4L, captor.getValue().sesionId);
        assertEquals(9L, captor.getValue().estudianteId);
        assertEquals(3L, captor.getValue().grupoId);

        when(repo.existsBySesionIdAndEstudianteId(4L, 9L)).thenReturn(true);
        padron.incluir(sesion, estudiante);
        verify(repo).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("RF-21 excluye al estudiante retirado y consulta si está autorizado")
    void excluirYConsultar() {
        when(repo.existsBySesionIdAndEstudianteId(4L, 9L)).thenReturn(true);
        assertTrue(padron.esta(sesion(), estudiante()));
        padron.excluir(sesion(), estudiante());
        verify(repo).deleteBySesionIdAndEstudianteId(4L, 9L);
        padron.incluir(sesion(), estudiante());
        verify(repo, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private SesionCaso sesion() {
        Grupo grupo = new Grupo();
        grupo.id = 3L;
        SesionCaso sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.grupo = grupo;
        return sesion;
    }

    private Usuario estudiante() {
        Usuario estudiante = new Usuario();
        estudiante.id = 9L;
        return estudiante;
    }
}
