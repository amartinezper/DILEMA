package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Retroalimentacion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RetroalimentacionProxyTest {

    @Test
    @DisplayName("RF-14 niega la explicación mientras la participación está en curso")
    void niegaMientrasEstaEnCurso() {
        Participacion enCurso = new Participacion();
        enCurso.inicio = LocalDateTime.now();

        RetroalimentacionProxy proxy = new RetroalimentacionProxy(enCurso, new ExplicacionReal(retroalimentacion()));

        assertNull(proxy.mostrar());
    }

    @Test
    @DisplayName("RF-14 entrega la explicación real cuando la participación finalizó")
    void entregaCuandoFinalizo() {
        Participacion finalizada = new Participacion();
        finalizada.inicio = LocalDateTime.now().minusMinutes(10);
        finalizada.fin = LocalDateTime.now();

        RetroalimentacionProxy proxy = new RetroalimentacionProxy(finalizada, new ExplicacionReal(retroalimentacion()));

        assertEquals("Porque prioriza la seguridad del paciente.", proxy.mostrar());
    }

    @Test
    @DisplayName("RF-14 entrega la explicación real cuando el estudiante estuvo ausente")
    void entregaCuandoFueAusencia() {
        Participacion ausente = new Participacion();

        RetroalimentacionProxy proxy = new RetroalimentacionProxy(ausente, new ExplicacionReal(retroalimentacion()));

        assertEquals("Porque prioriza la seguridad del paciente.", proxy.mostrar());
    }

    private Retroalimentacion retroalimentacion() {
        Retroalimentacion retroalimentacion = new Retroalimentacion();
        retroalimentacion.explicacion = "Porque prioriza la seguridad del paciente.";
        return retroalimentacion;
    }
}
