package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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

    private Usuario estudiante() {
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.email = "ana@psicosim.edu";
        return estudiante;
    }
}
