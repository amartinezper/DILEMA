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

class CalificacionCompletaTest {

    @Test
    @DisplayName("RF-13 suma solo el peso de las preguntas respondidas correctamente")
    void sumaSoloLosAciertos() {
        Participacion participacion = participacionConRespuestas();

        BigDecimal puntaje = new CalificacionCompleta().calcularPuntaje(participacion);

        assertEquals(new BigDecimal("3.0"), puntaje);
    }

    @Test
    @DisplayName("RF-13 / INV-29 la nota nunca supera 5,0, aunque todas las respuestas sean correctas")
    void noSuperaElTotalDeLaRubrica() {
        Participacion participacion = participacionConTodoCorrecto();

        BigDecimal puntaje = new CalificacionCompleta().calcularPuntaje(participacion);

        assertEquals(new BigDecimal("5.0"), puntaje);
    }

    private Participacion participacionConRespuestas() {
        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        Opcion correctaP1 = opcion(31L, true);
        Opcion incorrectaP2 = opcion(42L, false);
        p1.opciones.add(correctaP1);
        p2.opciones.add(opcion(41L, true));
        p2.opciones.add(incorrectaP2);

        Participacion participacion = armarParticipacion(p1, p2);
        participacion.respuestas.add(respuesta(participacion, p1, correctaP1));
        participacion.respuestas.add(respuesta(participacion, p2, incorrectaP2));
        return participacion;
    }

    private Participacion participacionConTodoCorrecto() {
        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        Opcion correctaP1 = opcion(31L, true);
        Opcion correctaP2 = opcion(41L, true);
        p1.opciones.add(correctaP1);
        p2.opciones.add(correctaP2);

        Participacion participacion = armarParticipacion(p1, p2);
        participacion.respuestas.add(respuesta(participacion, p1, correctaP1));
        participacion.respuestas.add(respuesta(participacion, p2, correctaP2));
        return participacion;
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

    private Respuesta respuesta(Participacion participacion, Pregunta pregunta, Opcion opcion) {
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = participacion;
        respuesta.pregunta = pregunta;
        respuesta.opcion = opcion;
        return respuesta;
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
