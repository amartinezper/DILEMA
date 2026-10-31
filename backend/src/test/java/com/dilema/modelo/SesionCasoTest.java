package com.dilema.modelo;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SesionCasoTest {

    @Test
    @DisplayName("RF-22 y RF-23: ventana, tolerancia y límite de intento")
    void ventanaToleranciaYLimite() {
        SesionCaso sesion = new SesionCaso();
        sesion.inicio = LocalDateTime.of(2026, 6, 2, 8, 0);
        sesion.fin = LocalDateTime.of(2026, 6, 2, 10, 0);
        sesion.tiempoMaxMin = 30;
        sesion.toleranciaMin = 15;
        LocalDateTime ahora = LocalDateTime.of(2026, 6, 2, 8, 10);

        assertFalse(sesion.ventanaAbierta(ahora));
        assertFalse(sesion.permiteIngreso(ahora));

        sesion.inicioReal = LocalDateTime.of(2026, 6, 2, 8, 0);
        assertTrue(sesion.ventanaAbierta(ahora));
        assertTrue(sesion.permiteIngreso(ahora));
        assertFalse(sesion.permiteIngreso(LocalDateTime.of(2026, 6, 2, 8, 16)));
        assertFalse(sesion.ventanaAbierta(LocalDateTime.of(2026, 6, 2, 10, 0)));

        LocalDateTime inicioIntento = LocalDateTime.of(2026, 6, 2, 8, 0);
        assertFalse(sesion.limiteDeIntentoAlcanzado(inicioIntento, ahora));
        assertTrue(sesion.limiteDeIntentoAlcanzado(inicioIntento, LocalDateTime.of(2026, 6, 2, 8, 30)));
        assertTrue(sesion.limiteDeIntentoAlcanzado(inicioIntento, LocalDateTime.of(2026, 6, 2, 10, 0)));
        assertFalse(sesion.limiteDeIntentoAlcanzado(null, ahora));
    }
}
