package com.dilema.servicio.participacion;

import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ComandoRespuestaTest {

    @Test
    @DisplayName("RF-10 registra, cambia y deshace sin duplicar la pregunta")
    void registrarCambiarYDeshacer() {
        Participacion participacion = new Participacion();
        participacion.casoId = 1L;
        Pregunta pregunta = new Pregunta();
        pregunta.id = 8L;
        Opcion una = opcion(1L);
        Opcion dos = opcion(2L);
        pregunta.opciones.add(una);
        pregunta.opciones.add(dos);

        ComandoRespuesta alta = new ComandoRespuesta(8L, null, 1L);
        alta.ejecutar(participacion, pregunta, una, null);
        assertEquals(1, participacion.respuestas.size());
        assertEquals(1L, participacion.respuestas.get(0).opcion.id);

        Respuesta actual = participacion.respuestas.get(0);
        ComandoRespuesta cambio = new ComandoRespuesta(8L, 1L, 2L);
        cambio.ejecutar(participacion, pregunta, dos, actual);
        assertEquals(1, participacion.respuestas.size());
        assertEquals(2L, actual.opcion.id);

        cambio.revertir(participacion, id -> pregunta);
        assertEquals(1L, actual.opcion.id);

        alta.revertir(participacion, id -> pregunta);
        assertTrue(participacion.respuestas.isEmpty());
    }

    @Test
    @DisplayName("RF-10 ignora elegir de nuevo la misma opción")
    void noOp() {
        assertTrue(new ComandoRespuesta(1L, 4L, 4L).esNoOp());
    }

    private Opcion opcion(long id) {
        Opcion opcion = new Opcion();
        opcion.id = id;
        return opcion;
    }
}
