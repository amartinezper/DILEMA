package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.SesionCaso;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CalificacionParcialTest {

    @Test
    @DisplayName("RF-13 / INV-20 pone 0 en cada pregunta de la rúbrica sin respuesta")
    void poneCeroEnLoNoRespondido() {
        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        Opcion correctaP1 = opcion(31L, true);
        p1.opciones.add(correctaP1);
        p2.opciones.add(opcion(41L, true));

        Participacion participacion = armarParticipacion(p1, p2);
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = participacion;
        respuesta.pregunta = p1;
        respuesta.opcion = correctaP1;
        participacion.respuestas.add(respuesta); // no respondió p2

        BigDecimal puntaje = new CalificacionParcial().calcularPuntaje(participacion);

        assertEquals(new BigDecimal("3.0"), puntaje);
    }

    @Test
    @DisplayName("RF-24 / INV-20 la ausencia total (sin respuestas) da 0,0")
    void ausenciaTotalDaCero() {
        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        p1.opciones.add(opcion(31L, true));
        p2.opciones.add(opcion(41L, true));
        Participacion ausente = armarParticipacion(p1, p2);

        BigDecimal puntaje = new CalificacionParcial().calcularPuntaje(ausente);

        assertEquals(new BigDecimal("0.0"), puntaje);
    }

    @Test
    @DisplayName("RF-13 / INV-29 la nota de un intento parcial nunca supera 5,0")
    void noSuperaElTotalDeLaRubrica() {
        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        Opcion correctaP1 = opcion(31L, true);
        Opcion correctaP2 = opcion(41L, true);
        p1.opciones.add(correctaP1);
        p2.opciones.add(correctaP2);

        Participacion participacion = armarParticipacion(p1, p2);
        participacion.respuestas.add(respuesta(participacion, p1, correctaP1));
        participacion.respuestas.add(respuesta(participacion, p2, correctaP2));

        BigDecimal puntaje = new CalificacionParcial().calcularPuntaje(participacion);

        assertEquals(new BigDecimal("5.0"), puntaje);
    }

    private Respuesta respuesta(Participacion participacion, Pregunta pregunta, Opcion opcion) {
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = participacion;
        respuesta.pregunta = pregunta;
        respuesta.opcion = opcion;
        return respuesta;
    }

    private Participacion armarParticipacion(Pregunta... preguntas) {
        Caso caso = new Caso();
        caso.nombre = "Crisis";
        Escenario escenario = new Escenario();
        for (Pregunta pregunta : preguntas) escenario.preguntas.add(pregunta);
        caso.escenarios.add(escenario);
        SesionCaso sesion = new SesionCaso();
        sesion.caso = caso;
        Participacion participacion = new Participacion();
        participacion.sesion = sesion;
        return participacion;
    }

    private Pregunta pregunta(long id, BigDecimal peso) {
        Pregunta pregunta = new Pregunta();
        pregunta.id = id;
        CriterioRubrica criterio = new CriterioRubrica();
        criterio.criterio = "Juicio clínico";
        criterio.peso = peso;
        pregunta.criterio = criterio;
        return pregunta;
    }

    private Opcion opcion(long id, boolean esCorrecta) {
        Opcion opcion = new Opcion();
        opcion.id = id;
        opcion.esCorrecta = esCorrecta;
        return opcion;
    }
}
