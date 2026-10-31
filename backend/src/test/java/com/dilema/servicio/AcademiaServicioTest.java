package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Permiso;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.repo.UsuarioRepo;
import com.dilema.servicio.programacion.FachadaAgendamiento;
import com.dilema.servicio.programacion.NotificadorConvocatoria;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AcademiaServicioTest {
    private GrupoRepo grupos;
    private SesionRepo sesiones;
    private UsuarioRepo usuarios;
    private FabricaCuentas fabrica;
    private NotificadorConvocatoria notificador;
    private PadronConvocatoria padron;
    private FachadaAgendamiento fachada;
    private BitacoraServicio bitacora;
    private AcademiaServicio servicio;
    private Usuario docente;

    @BeforeEach
    void preparar() {
        grupos = mock(GrupoRepo.class);
        sesiones = mock(SesionRepo.class);
        usuarios = mock(UsuarioRepo.class);
        ParticipacionRepo participaciones = mock(ParticipacionRepo.class);
        ParticipacionServicio participacionServicio = mock(ParticipacionServicio.class);
        fabrica = mock(FabricaCuentas.class);
        notificador = mock(NotificadorConvocatoria.class);
        padron = mock(PadronConvocatoria.class);
        fachada = mock(FachadaAgendamiento.class);
        bitacora = mock(BitacoraServicio.class);
        servicio = new AcademiaServicio(grupos, sesiones, usuarios, participaciones, participacionServicio,
                new ProxyOperacion(), bitacora, new Mapeador(), fabrica, notificador, padron, fachada);
        docente = docente();
    }

    @Test
    @DisplayName("CU-03 crea el grupo con nombre y semestre")
    void crearGrupo() {
        Contratos.GrupoVista vista = servicio.crearGrupo(docente, new Contratos.GrupoIn("Grupo A", "2026-I"));
        assertEquals("Grupo A", vista.nombre());
        assertEquals("2026-I", vista.espacioAcademico());
        verify(grupos).save(any());
        verify(bitacora).auditar(eq(docente), eq("CREAR_GRUPO"), eq("Grupo A"));
        assertThrows(ReglaNegocio.class, () -> servicio.crearGrupo(docente, new Contratos.GrupoIn(" ", "2026-I")));
    }

    @Test
    @DisplayName("RF-21 convoca al estudiante agregado si hay sesión abierta")
    void agregarEstudiante() {
        Grupo grupo = grupo();
        when(grupos.findById(8L)).thenReturn(Optional.of(grupo));
        Usuario existente = estudiante(9L, "ana@psicosim.edu");
        when(usuarios.findByEmailIgnoreCase("ana@psicosim.edu")).thenReturn(Optional.of(existente));
        SesionCaso sesion = sesionAbierta();
        when(sesiones.findByGrupo_IdAndCierreRealIsNull(8L)).thenReturn(List.of(sesion));

        Contratos.GrupoVista vista = servicio.agregarEstudiante(docente, 8L, "Ana", "ana@psicosim.edu");

        assertEquals(1, vista.estudiantes().size());
        verify(padron).incluir(sesion, existente);
        verify(notificador).convocado(existente, sesion);
        verify(notificador, never()).agregadoSinSesion(any(), any());
    }

    @Test
    @DisplayName("RF-21 avisa alta sin sesión y crea la cuenta si no existe")
    void agregarSinSesion() {
        Grupo grupo = grupo();
        when(grupos.findById(8L)).thenReturn(Optional.of(grupo));
        when(usuarios.findByEmailIgnoreCase("nueva@psicosim.edu")).thenReturn(Optional.empty());
        Usuario creada = estudiante(10L, "nueva@psicosim.edu");
        when(fabrica.nuevoEstudiante("Nueva", "nueva@psicosim.edu")).thenReturn(creada);
        when(sesiones.findByGrupo_IdAndCierreRealIsNull(8L)).thenReturn(List.of());

        servicio.agregarEstudiante(docente, 8L, "Nueva", "nueva@psicosim.edu");

        verify(fabrica).nuevoEstudiante("Nueva", "nueva@psicosim.edu");
        verify(notificador).agregadoSinSesion(creada, grupo);
    }

    @Test
    @DisplayName("RF-21 retira al estudiante del padrón de sesiones abiertas")
    void retirar() {
        Grupo grupo = grupo();
        Usuario estudiante = estudiante(9L, "ana@psicosim.edu");
        grupo.estudiantes.add(estudiante);
        when(grupos.findById(8L)).thenReturn(Optional.of(grupo));
        SesionCaso sesion = sesionAbierta();
        when(sesiones.findByGrupo_IdAndCierreRealIsNull(8L)).thenReturn(List.of(sesion));

        servicio.retirarEstudiante(docente, 8L, 9L);

        verify(padron).excluir(sesion, estudiante);
        verify(notificador).retirado(estudiante, grupo);
        assertEquals(0, grupo.estudiantes.size());
    }

    @Test
    @DisplayName("RF-19 inicia y finaliza la sesión del docente")
    void iniciarYFinalizar() {
        SesionCaso sesion = sesionAbierta();
        sesion.inicioReal = null;
        when(sesiones.findById(4L)).thenReturn(Optional.of(sesion));
        when(sesiones.findByGrupo_IdAndCierreRealIsNull(8L)).thenReturn(List.of());

        Contratos.SesionVista iniciada = servicio.iniciar(docente, 4L);
        assertEquals("EN_CURSO", iniciada.estado());
        assertNotNull(sesion.inicioReal);

        servicio.finalizar(docente, 4L);
        assertNotNull(sesion.cierreReal);
        verify(bitacora).auditar(docente, "INICIAR_SESION", "DL-AB12");
        verify(bitacora).auditar(docente, "FINALIZAR_SESION", "DL-AB12");
    }

    @Test
    @DisplayName("cierra automáticamente las sesiones vencidas")
    void cerrarVencidas() {
        SesionCaso sesion = sesionAbierta();
        sesion.fin = LocalDateTime.now().minusDays(2);
        when(sesiones.findByCierreRealIsNull()).thenReturn(List.of(sesion));
        servicio.cerrarVencidas();
        assertNotNull(sesion.cierreReal);
    }

    private Usuario docente() {
        Usuario docente = new Usuario();
        docente.id = 1L;
        docente.nombre = "Docente";
        docente.email = "docente@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        Permiso ver = new Permiso();
        ver.tipo = FabricaCuentas.VISUALIZAR;
        Permiso espacios = new Permiso();
        espacios.tipo = FabricaCuentas.GESTIONAR_ESPACIOS;
        docente.permisos.add(ver);
        docente.permisos.add(espacios);
        return docente;
    }

    private Usuario estudiante(long id, String email) {
        Usuario estudiante = new Usuario();
        estudiante.id = id;
        estudiante.nombre = "Ana";
        estudiante.email = email;
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        return estudiante;
    }

    private Grupo grupo() {
        Grupo grupo = new Grupo();
        grupo.id = 8L;
        grupo.nombre = "Grupo A";
        grupo.semestre = "2026-I";
        grupo.docente = docente;
        return grupo;
    }

    private SesionCaso sesionAbierta() {
        com.dilema.modelo.Caso caso = new com.dilema.modelo.Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        caso.docente = docente;
        SesionCaso sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.codigo = "DL-AB12";
        sesion.caso = caso;
        sesion.grupo = grupo();
        sesion.inicio = LocalDateTime.now().minusHours(1);
        sesion.fin = LocalDateTime.now().plusHours(1);
        sesion.inicioReal = LocalDateTime.now().minusMinutes(30);
        sesion.tiempoMaxMin = 40;
        sesion.toleranciaMin = 15;
        return sesion;
    }
}
