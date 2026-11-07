package com.dilema.modelo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SesionCasoTest {

    @Test
    @DisplayName("RF-22: sin inicio real no hay ventana ni ingreso")
    void sinInicioRealNoHayVentanaNiIngreso() {
        SesionCaso sesion = sesion();
        LocalDateTime ahora = LocalDateTime.of(2026, 6, 2, 8, 10);
        assertFalse(sesion.ventanaAbierta(ahora));
        assertFalse(sesion.permiteIngreso(ahora));
    }

    @Test
    @DisplayName("RF-22: el ingreso solo cabe dentro de la tolerancia")
    void ingresoSoloDentroDeTolerancia() {
        SesionCaso sesion = sesion();
        sesion.inicioReal = LocalDateTime.of(2026, 6, 2, 8, 0);
        assertTrue(sesion.permiteIngreso(LocalDateTime.of(2026, 6, 2, 8, 10)));
        assertFalse(sesion.permiteIngreso(LocalDateTime.of(2026, 6, 2, 8, 16)));
    }

    @Test
    @DisplayName("RF-23: la ventana cierra en el fin programado")
    void ventanaCierraEnElFinProgramado() {
        SesionCaso sesion = sesion();
        sesion.inicioReal = LocalDateTime.of(2026, 6, 2, 8, 0);
        assertTrue(sesion.ventanaAbierta(LocalDateTime.of(2026, 6, 2, 8, 10)));
        assertFalse(sesion.ventanaAbierta(LocalDateTime.of(2026, 6, 2, 10, 0)));
    }

    @Test
    @DisplayName("RF-23: el límite del intento es el tiempo máximo o el fin de la sesión")
    void limiteDeIntentoPorTiempoOPorFinDeSesion() {
        SesionCaso sesion = sesion();
        sesion.inicioReal = LocalDateTime.of(2026, 6, 2, 8, 0);
        LocalDateTime inicioIntento = LocalDateTime.of(2026, 6, 2, 8, 0);
        assertFalse(sesion.limiteDeIntentoAlcanzado(inicioIntento, LocalDateTime.of(2026, 6, 2, 8, 10)));
        assertTrue(sesion.limiteDeIntentoAlcanzado(inicioIntento, LocalDateTime.of(2026, 6, 2, 8, 30)));
        assertTrue(sesion.limiteDeIntentoAlcanzado(inicioIntento, LocalDateTime.of(2026, 6, 2, 10, 0)));
        assertFalse(sesion.limiteDeIntentoAlcanzado(null, LocalDateTime.of(2026, 6, 2, 8, 10)));
    }

    private SesionCaso sesion() {
        SesionCaso sesion = new SesionCaso();
        sesion.inicio = LocalDateTime.of(2026, 6, 2, 8, 0);
        sesion.fin = LocalDateTime.of(2026, 6, 2, 10, 0);
        sesion.tiempoMaxMin = 30;
        sesion.toleranciaMin = 15;
        return sesion;
    }
}
