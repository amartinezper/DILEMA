package com.dilema.servicio.programacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class NotificadorConvocatoriaTest {

    @Test
    @DisplayName("RF-21 incluye mensaje, código, URL y lugar en la convocatoria")
    void convocado() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        NotificadorConvocatoria notificador = new NotificadorConvocatoria(bitacora, "http://localhost:4200");
        Usuario estudiante = new Usuario();
        estudiante.email = "ana@psicosim.edu";
        Caso caso = new Caso();
        caso.nombre = "Crisis en urgencias";
        SesionCaso sesion = new SesionCaso();
        sesion.caso = caso;
        sesion.codigo = "DL-AB12";
        sesion.mensaje = "Llega 10 minutos antes.";
        sesion.lugar = "Aula 204";
        sesion.inicio = LocalDateTime.of(2026, 6, 2, 8, 0);
        sesion.fin = LocalDateTime.of(2026, 6, 2, 10, 0);

        notificador.convocado(estudiante, sesion);

        ArgumentCaptor<String> cuerpo = ArgumentCaptor.forClass(String.class);
        verify(bitacora).avisar(eq(estudiante), eq("CORREO"), eq("Convocatoria: Crisis en urgencias"), cuerpo.capture());
        assertTrue(cuerpo.getValue().contains("DL-AB12"));
        assertTrue(cuerpo.getValue().contains("http://localhost:4200/ingreso"));
        assertTrue(cuerpo.getValue().contains("Llega 10 minutos antes."));
        assertTrue(cuerpo.getValue().contains("Aula 204"));
    }

    @Test
    @DisplayName("RF-21 avisa alta sin sesión y retiro del grupo")
    void altaYRetiro() {
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        NotificadorConvocatoria notificador = new NotificadorConvocatoria(bitacora, "http://localhost:4200");
        Usuario estudiante = new Usuario();
        estudiante.email = "ana@psicosim.edu";
        Grupo grupo = new Grupo();
        grupo.nombre = "Psicología social 3";

        notificador.agregadoSinSesion(estudiante, grupo);
        notificador.retirado(estudiante, grupo);

        verify(bitacora).avisar(eq(estudiante), eq("CORREO"), eq("Convocatoria actualizada"),
                org.mockito.ArgumentMatchers.contains("Psicología social 3"));
        verify(bitacora).avisar(eq(estudiante), eq("CORREO"), eq("Cambio de convocatoria"),
                org.mockito.ArgumentMatchers.contains("Fuiste retirado"));
    }
}
