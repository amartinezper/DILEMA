package com.dilema.servicio.programacion;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Usuario;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.Mapeador;
import com.dilema.servicio.NoEncontrado;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FachadaAgendamientoTest {
    private CasoRepo casos;
    private GrupoRepo grupos;
    private SesionRepo sesiones;
    private PadronConvocatoria padron;
    private NotificadorConvocatoria notificador;
    private BitacoraServicio bitacora;
    private FachadaAgendamiento fachada;
    private Usuario docente;
    private Caso caso;
    private Grupo grupo;
    private Usuario estudiante;

    @BeforeEach
    void preparar() {
        casos = mock(CasoRepo.class);
        grupos = mock(GrupoRepo.class);
        sesiones = mock(SesionRepo.class);
        padron = mock(PadronConvocatoria.class);
        notificador = mock(NotificadorConvocatoria.class);
        bitacora = mock(BitacoraServicio.class);
        fachada = new FachadaAgendamiento(casos, grupos, sesiones, padron, notificador, bitacora, new Mapeador());
        docente = new Usuario();
        docente.id = 1L;
        docente.nombre = "Docente";
        docente.email = "docente@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.nombre = "Ana";
        estudiante.email = "ana@psicosim.edu";
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        caso = new Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        caso.tiempoEstimadoMin = 45;
        caso.docente = docente;
        grupo = new Grupo();
        grupo.id = 8L;
        grupo.nombre = "Grupo A";
        grupo.semestre = "2026-I";
        grupo.docente = docente;
        grupo.estudiantes.add(estudiante);
        when(casos.findById(5L)).thenReturn(Optional.of(caso));
        when(grupos.findById(8L)).thenReturn(Optional.of(grupo));
        when(sesiones.findByCodigoIgnoreCase(any())).thenReturn(Optional.empty());
        when(sesiones.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("RF-04 agenda, emite código y notifica a cada estudiante")
    void agendaYNotifica() {
        Contratos.SesionVista vista = fachada.agendar(docente, agenda());

        assertEquals("SIN_INICIAR", vista.estado());
        assertTrue(vista.codigo().startsWith("DL-"));
        assertEquals("Aula 1", vista.lugar());
        verify(padron).incluir(any(), org.mockito.ArgumentMatchers.eq(estudiante));
        verify(notificador).convocado(org.mockito.ArgumentMatchers.eq(estudiante), any());
        verify(bitacora).auditar(org.mockito.ArgumentMatchers.eq(docente), org.mockito.ArgumentMatchers.eq("AGENDAR"), any());
        verify(sesiones).save(any());
        assertNotNull(vista.caso());
    }

    @Test
    @DisplayName("no agenda un caso inexistente ni un caso en borrador")
    void rechaza() {
        when(casos.findById(5L)).thenReturn(Optional.empty());
        assertThrows(NoEncontrado.class, () -> fachada.agendar(docente, agenda()));
        when(casos.findById(5L)).thenReturn(Optional.of(caso));
        caso.estado = Catalogo.EstadoCaso.BORRADOR;
        assertThrows(ReglaNegocio.class, () -> fachada.agendar(docente, agenda()));
    }

    private Contratos.AgendaIn agenda() {
        return new Contratos.AgendaIn(5L, 8L, "2026-06-02T08:00", "2026-06-02T10:00", 30, 10, "Aula 1", "Prepárate");
    }
}
