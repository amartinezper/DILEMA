package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Notificacion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.NotificacionRepo;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.AccesoDenegado;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.Mapeador;
import com.dilema.servicio.ParticipacionServicio;
import com.dilema.servicio.ProxyOperacion;
import com.dilema.servicio.ReglaNegocio;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** RF-27 (Observer): el sujeto notifica a sus observadores por el canal correspondiente. */
class NotificacionObserverTest {

    @Test
    @DisplayName("RF-27 al publicar la nota, el estudiante es notificado por CORREO")
    void notaPublicadaPorCorreo() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Usuario estudiante = estudiante();
        SujetoNotificador sujeto = new SujetoNotificador();
        sujeto.agregar(new ObservadorEstudiante(estudiante, bitacora));

        sujeto.notificar("NOTA_PUBLICADA", "Crisis: 4,5 / 5,0.", "CORREO");

        verify(bitacora).avisar(eq(estudiante), eq("CORREO"), eq("Nota del caso"), contains("4,5"));
    }

    @Test
    @DisplayName("RF-27 al agregar la retroalimentación general, el estudiante es avisado por SISTEMA")
    void retroalimentacionAgregadaPorSistema() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Usuario estudiante = estudiante();
        SujetoNotificador sujeto = new SujetoNotificador();
        sujeto.agregar(new ObservadorEstudiante(estudiante, bitacora));

        sujeto.notificar("RETROALIMENTACION_AGREGADA", "Buen desempeño", "SISTEMA");

        verify(bitacora).avisar(eq(estudiante), eq("SISTEMA"), eq("Retroalimentación del docente"), contains("Buen desempeño"));
    }

    @Test
    @DisplayName("RF-27 sin nota nueva no hay aviso: un intento ya finalizado no vuelve a notificar")
    void sinNotaNuevaNoHayAviso() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion yaFinalizada = new Participacion();
        yaFinalizada.inicio = LocalDateTime.now().minusMinutes(20);
        yaFinalizada.fin = LocalDateTime.now().minusMinutes(10);

        new com.dilema.servicio.participacion.FinalizadorParticipacion.PorEstudiante(bitacora, p -> java.math.BigDecimal.ONE)
                .finalizar(yaFinalizada);

        verifyNoInteractions(bitacora);
    }

    @Test
    @DisplayName("RF-27 sin comentario nuevo no hay aviso: una participación en curso no admite ni guarda la valoración")
    void sinComentarioNuevoNoHayAviso() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        Participacion enCurso = new Participacion();
        enCurso.inicio = LocalDateTime.now();

        assertThrows(ReglaNegocio.class,
                () -> EstadoDeParticipacion.de(enCurso, bitacora).agregarRetroalimentacionGeneral(enCurso, "texto"));

        verifyNoInteractions(bitacora);
    }

    @Test
    @DisplayName("RF-27 si el correo falla, la operación continúa sin romperse")
    void correoFallaYLaOperacionContinua() {
        JavaMailSender mockSender = mock(JavaMailSender.class);
        doThrow(new RuntimeException("SMTP caído")).when(mockSender).send(any(SimpleMailMessage.class));
        BitacoraServicio bitacora = new BitacoraServicio(mockSender, "no-reply@dilema");
        Usuario usuario = estudiante();

        assertDoesNotThrow(() -> bitacora.avisar(usuario, "CORREO", "Nota", "cuerpo"));

        verify(mockSender).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("RF-27 el aviso por SISTEMA se guarda como Notificacion no leída")
    void avisoSistemaSeGuarda() {
        List<Notificacion> guardadas = new ArrayList<>();
        BitacoraServicio bitacora = new BitacoraServicio(mock(JavaMailSender.class), "no-reply@dilema", repo(guardadas));
        Usuario estudiante = estudiante();

        bitacora.avisar(estudiante, "SISTEMA", "Retroalimentación del docente", "Buen desempeño");

        assertEquals(1, guardadas.size());
        Notificacion n = guardadas.get(0);
        assertEquals("SISTEMA", n.canal);
        assertEquals("Retroalimentación del docente", n.titulo);
        assertEquals("Buen desempeño", n.cuerpo);
        assertFalse(n.leida);
        assertEquals(estudiante.id, n.usuario.id);
    }

    @Test
    @DisplayName("RF-27 la nota publicada llega por CORREO y queda guardada como aviso de SISTEMA")
    void notaPublicadaPorCorreoYSistema() {
        List<Notificacion> guardadas = new ArrayList<>();
        JavaMailSender correo = mock(JavaMailSender.class);
        BitacoraServicio bitacora = new BitacoraServicio(correo, "no-reply@dilema", repo(guardadas));
        Participacion participacion = participacionDe(estudiante());
        participacion.inicio = LocalDateTime.now().minusMinutes(5);

        new com.dilema.servicio.participacion.FinalizadorParticipacion.PorEstudiante(bitacora, p -> new BigDecimal("4.5"))
                .finalizar(participacion);

        verify(correo).send(any(SimpleMailMessage.class));
        assertEquals(1, guardadas.size());
        assertEquals("Nota del caso", guardadas.get(0).titulo);
        assertTrue(guardadas.get(0).cuerpo.contains("4.5"));
    }

    @Test
    @DisplayName("RF-27 marcar un aviso como leído baja sinLeer; Caso asignado tiene id real y no se duplica")
    void leerAvisoBajaSinLeer() {
        List<Notificacion> guardadas = new ArrayList<>();
        BitacoraServicio bitacora = new BitacoraServicio(mock(JavaMailSender.class), "no-reply@dilema", repo(guardadas));
        Usuario estudiante = estudiante();
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        SesionRepo sesiones = mock(SesionRepo.class);
        ParticipacionRepo participaciones = mock(ParticipacionRepo.class);
        SesionCaso sesion = participacionDe(estudiante).sesion;
        when(sesiones.delEstudiante(estudiante.id)).thenReturn(List.of(sesion));
        when(participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id)).thenReturn(List.of());
        ParticipacionServicio servicio = new ParticipacionServicio(participaciones, sesiones, mock(PadronConvocatoria.class),
                new ProxyOperacion(), new Mapeador(), bitacora);
        bitacora.avisar(estudiante, "SISTEMA", "Retroalimentación del docente", "Buen desempeño");

        var antes = servicio.panel(estudiante);
        var asignado = antes.avisos().stream().filter(a -> a.titulo().equals("Caso asignado")).findFirst().orElseThrow();
        assertEquals("Crisis. Prepárate", asignado.cuerpo());
        assertTrue(antes.avisos().stream().anyMatch(a -> a.titulo().equals("Retroalimentación del docente") && !a.leida()));
        int sinLeerAntes = antes.sinLeer();

        servicio.leerAviso(estudiante, asignado.id());
        var despues = servicio.panel(estudiante);

        assertEquals(sinLeerAntes - 1, despues.sinLeer());
        assertEquals(antes.avisos().size(), despues.avisos().size(), "el panel no vuelve a crear Caso asignado");
        assertTrue(despues.avisos().stream().anyMatch(a -> a.id().equals(asignado.id()) && a.leida()));
    }

    @Test
    @DisplayName("RF-27 un estudiante no puede marcar como leído el aviso de otro")
    void avisoAjenoNoSeMarca() {
        List<Notificacion> guardadas = new ArrayList<>();
        BitacoraServicio bitacora = new BitacoraServicio(mock(JavaMailSender.class), "no-reply@dilema", repo(guardadas));
        Usuario duena = estudiante();
        Usuario otro = new Usuario();
        otro.id = 9L;
        bitacora.avisar(duena, "SISTEMA", "Nota del caso", "Crisis: 4.0 / 5,0.");

        assertThrows(AccesoDenegado.class, () -> bitacora.marcarLeido(otro, guardadas.get(0).id));
        assertFalse(guardadas.get(0).leida);
    }

    /** Repositorio en memoria: guarda, busca por id, por usuario y por referencia. */
    private NotificacionRepo repo(List<Notificacion> guardadas) {
        NotificacionRepo repo = mock(NotificacionRepo.class);
        when(repo.save(any(Notificacion.class))).thenAnswer(inv -> {
            Notificacion n = inv.getArgument(0);
            if (n.id == null) {
                n.id = 100L + guardadas.size();
                guardadas.add(n);
            }
            return n;
        });
        when(repo.findById(any())).thenAnswer(inv -> guardadas.stream()
                .filter(n -> n.id.equals(inv.getArgument(0))).findFirst());
        when(repo.findByUsuarioIdOrderByFechaDescIdDesc(any())).thenAnswer(inv -> guardadas.stream()
                .filter(n -> n.usuario.id.equals(inv.getArgument(0)))
                .sorted(Comparator.comparing((Notificacion n) -> n.fecha).reversed()).toList());
        when(repo.findByUsuarioIdAndReferencia(any(), any())).thenAnswer(inv -> guardadas.stream()
                .filter(n -> n.usuario.id.equals(inv.getArgument(0)) && inv.getArgument(1).equals(n.referencia))
                .findFirst());
        return repo;
    }

    private Participacion participacionDe(Usuario estudiante) {
        Caso caso = new Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        SesionCaso sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.caso = caso;
        sesion.grupo = new Grupo();
        sesion.inicio = LocalDateTime.now().minusMinutes(30);
        sesion.fin = LocalDateTime.now().plusHours(1);
        sesion.tiempoMaxMin = 40;
        sesion.mensaje = "Prepárate";
        Participacion participacion = new Participacion();
        participacion.id = 11L;
        participacion.estudiante = estudiante;
        participacion.sesion = sesion;
        participacion.casoId = caso.id;
        return participacion;
    }

    private Usuario estudiante() {
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.email = "ana@psicosim.edu";
        return estudiante;
    }
}
