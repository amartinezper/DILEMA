package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.Mapeador;
import com.dilema.servicio.ParticipacionServicio;
import com.dilema.servicio.ProxyOperacion;
import com.dilema.servicio.programacion.CierrePorDocente;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF-24 (Template Method): verifica que CierreSesion, al cerrar, calcula la nota
 * parcial de un intento en curso y registra en 0,0 a quien no tuvo participación,
 * apoyándose en la Strategy de RF-13 (no en lógica propia duplicada).
 */
class CierreSesionModulo6Test {

    @Test
    @DisplayName("RF-24 el cierre calcula la nota parcial del intento en curso y 0,0 para el ausente")
    void cierreUsaLaStrategyDeRf13() {
        ParticipacionRepo participaciones = mock(ParticipacionRepo.class);
        SesionRepo sesiones = mock(SesionRepo.class);
        PadronConvocatoria padron = mock(PadronConvocatoria.class);
        BitacoraServicio bitacora = mock(BitacoraServicio.class);
        ParticipacionServicio servicio = new ParticipacionServicio(participaciones, sesiones, padron,
                new ProxyOperacion(), new Mapeador(), bitacora);

        Pregunta p1 = pregunta(21L, new BigDecimal("3.0"));
        Pregunta p2 = pregunta(22L, new BigDecimal("2.0"));
        Opcion correctaP1 = opcion(31L, true);
        p1.opciones.add(correctaP1);
        p2.opciones.add(opcion(41L, true));

        Caso caso = new Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        Escenario escenario = new Escenario();
        escenario.preguntas.add(p1);
        escenario.preguntas.add(p2);
        caso.escenarios.add(escenario);

        Grupo grupo = new Grupo();
        grupo.id = 8L;
        Usuario enCursoEstudiante = estudiante(2L, "ana@psicosim.edu");
        Usuario ausenteEstudiante = estudiante(3L, "luis@psicosim.edu");
        grupo.estudiantes.add(enCursoEstudiante);
        grupo.estudiantes.add(ausenteEstudiante);

        SesionCaso sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.inicioReal = LocalDateTime.now().minusHours(1);
        sesion.fin = LocalDateTime.now().plusHours(1);
        sesion.tiempoMaxMin = 40;

        Participacion enCurso = new Participacion();
        enCurso.estudiante = enCursoEstudiante;
        enCurso.sesion = sesion;
        enCurso.casoId = caso.id;
        enCurso.inicio = LocalDateTime.now().minusMinutes(10);
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = enCurso;
        respuesta.pregunta = p1;
        respuesta.opcion = correctaP1;
        enCurso.respuestas.add(respuesta); // solo respondió p1: intento incompleto

        when(participaciones.findByEstudianteIdAndSesionId(enCursoEstudiante.id, sesion.id)).thenReturn(List.of(enCurso));
        when(participaciones.findByEstudianteIdAndSesionId(ausenteEstudiante.id, sesion.id)).thenReturn(List.of());

        new CierrePorDocente(servicio, participaciones).cerrar(sesion);

        assertNotNull(enCurso.fin);
        assertEquals(3.0, enCurso.nota(), "la nota parcial solo suma el peso de lo respondido correctamente");
        verify(bitacora).avisar(eq(enCursoEstudiante), eq("CORREO"), eq("Nota del caso"), any());

        ArgumentCaptor<Participacion> captor = ArgumentCaptor.forClass(Participacion.class);
        verify(participaciones).save(captor.capture());
        assertEquals(0.0, captor.getValue().nota());
        assertEquals(ausenteEstudiante.id, captor.getValue().estudiante.id);
        assertNotNull(sesion.cierreReal);
    }

    private Usuario estudiante(long id, String email) {
        Usuario estudiante = new Usuario();
        estudiante.id = id;
        estudiante.email = email;
        return estudiante;
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
