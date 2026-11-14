package com.dilema.servicio.participacion;

import com.dilema.modelo.AutorizacionRepeticion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProxyParticipacionTest {
    private final ProxyParticipacion proxy = new ProxyParticipacion();

    @Test
    @DisplayName("RF-19: rechaza participar si la sesión no inició")
    void rechazaParticiparSiLaSesionNoInicio() {
        SesionCaso sesion = new SesionCaso();
        assertEquals("La sesión todavía no está en curso.",
                assertThrows(ReglaNegocio.class, () -> proxy.sesionAbierta(sesion, LocalDateTime.of(2026, 6, 2, 9, 10))).getMessage());
    }

    @Test
    @DisplayName("RF-22: admite el primer ingreso dentro de la tolerancia")
    void admiteIngresoDentroDeTolerancia() {
        SesionCaso sesion = sesionEnCurso();
        LocalDateTime ahora = LocalDateTime.of(2026, 6, 2, 9, 10);
        assertDoesNotThrow(() -> proxy.sesionAbierta(sesion, ahora));
        assertDoesNotThrow(() -> proxy.ingresoTardio(sesion, ahora));
    }

    @Test
    @DisplayName("RF-22: rechaza el ingreso fuera de la tolerancia")
    void rechazaIngresoFueraDeTolerancia() {
        SesionCaso sesion = sesionEnCurso();
        LocalDateTime ahora = LocalDateTime.of(2026, 6, 2, 9, 10);
        assertEquals("RF-22: ya pasó el tiempo definido por el docente para iniciar.",
                assertThrows(ReglaNegocio.class, () -> proxy.ingresoTardio(sesion, ahora.plusMinutes(20))).getMessage());
    }

    @Test
    @DisplayName("RF-23: rechaza el ingreso si la ventana de la sesión ya cerró")
    void rechazaIngresoSiLaVentanaCerro() {
        SesionCaso sesion = sesionEnCurso();
        assertEquals("RF-23: la ventana de la sesión ya cerró.",
                assertThrows(ReglaNegocio.class, () -> proxy.sesionAbierta(sesion, LocalDateTime.of(2026, 6, 2, 11, 0))).getMessage());
    }

    @Test
    @DisplayName("RF-25: rechaza participar si la sesión ya finalizó")
    void rechazaParticiparSiLaSesionFinalizo() {
        SesionCaso sesion = sesionEnCurso();
        LocalDateTime ahora = LocalDateTime.of(2026, 6, 2, 9, 10);
        sesion.cierreReal = ahora;
        assertEquals("RF-25: la sesión ya finalizó y no admite participación.",
                assertThrows(ReglaNegocio.class, () -> proxy.sesionAbierta(sesion, ahora)).getMessage());
    }

    @Test
    @DisplayName("RF-25: repetir exige autorización del docente sobre el intento anterior")
    void exigeAutorizacionParaRepetir() {
        Participacion previa = new Participacion();
        previa.fin = LocalDateTime.now();
        assertEquals("RF-25: ya registraste una participación. Solo el docente creador puede autorizar otra.",
                assertThrows(ReglaNegocio.class, () -> proxy.puedeRepetir(previa)).getMessage());
        previa.autorizacion = new AutorizacionRepeticion();
        assertDoesNotThrow(() -> proxy.puedeRepetir(previa));
        assertDoesNotThrow(() -> proxy.puedeRepetir(null));
    }

    private SesionCaso sesionEnCurso() {
        SesionCaso sesion = new SesionCaso();
        sesion.inicioReal = LocalDateTime.of(2026, 6, 2, 9, 0);
        sesion.fin = LocalDateTime.of(2026, 6, 2, 11, 0);
        sesion.toleranciaMin = 15;
        return sesion;
    }
}
