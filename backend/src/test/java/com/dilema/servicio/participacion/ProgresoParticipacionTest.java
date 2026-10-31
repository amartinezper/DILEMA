package com.dilema.servicio.participacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Respuesta;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProgresoParticipacionTest {

    @Test
    @DisplayName("RF-11 calcula el avance con las respuestas registradas")
    void porcentaje() {
        Participacion participacion = new Participacion();
        assertEquals(0, ProgresoParticipacion.porcentaje(participacion, 0));
        assertEquals(0, ProgresoParticipacion.porcentaje(participacion, 4));
        participacion.respuestas.add(new Respuesta());
        participacion.respuestas.add(new Respuesta());
        assertEquals(50, ProgresoParticipacion.porcentaje(participacion, 4));
    }
}
