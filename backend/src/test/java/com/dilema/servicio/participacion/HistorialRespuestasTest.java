package com.dilema.servicio.participacion;

import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HistorialRespuestasTest {

    @Test
    @DisplayName("RF-10 apila, ignora no-op y deshace en orden inverso")
    void pila() {
        HistorialRespuestas historial = new HistorialRespuestas();
        historial.registrar(7L, new ComandoRespuesta(1L, 2L, 2L));
        historial.registrar(7L, new ComandoRespuesta(1L, null, 3L));
        historial.registrar(7L, new ComandoRespuesta(1L, 3L, 4L));

        assertEquals(4L, historial.deshacer(7L).despues());
        assertEquals(3L, historial.deshacer(7L).despues());
        assertEquals("No hay respuestas para deshacer.",
                assertThrows(ReglaNegocio.class, () -> historial.deshacer(7L)).getMessage());
    }
}
