package com.dilema.servicio.evaluacion;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Permiso;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.FabricaCuentas;
import com.dilema.servicio.Mapeador;
import com.dilema.servicio.ParticipacionServicio;
import com.dilema.servicio.ProxyOperacion;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** RF-14: resumen de aciertos, errores y sin responder, protegido por el mismo criterio del Proxy. */
class ResumenIntentoTest {
    private ParticipacionRepo participaciones;
    private ParticipacionServicio servicio;
    private Usuario docente;
    private Usuario estudiante;
    private SesionCaso sesion;
    private Pregunta p1;
    private Pregunta p2;

    @BeforeEach
    void preparar() {
        participaciones = mock(ParticipacionRepo.class);
        servicio = new ParticipacionServicio(participaciones, mock(SesionRepo.class), mock(PadronConvocatoria.class),
                new ProxyOperacion(), new Mapeador(), mock(BitacoraServicio.class));
        docente = usuario(1L, Catalogo.Rol.PROFESOR);
        Permiso ver = new Permiso();
        ver.tipo = FabricaCuentas.VISUALIZAR;
        docente.permisos.add(ver);
        estudiante = usuario(2L, Catalogo.Rol.ESTUDIANTE);

        p1 = pregunta(21L, "2.0", opcion(31L, true), opcion(32L, false));
        p2 = pregunta(22L, "2.0", opcion(41L, true), opcion(42L, false));
        Pregunta p3 = pregunta(23L, "1.0", opcion(51L, true), opcion(52L, false));
        Caso caso = new Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        caso.docente = docente;
        Escenario escenario = new Escenario();
        escenario.titulo = "Urgencias";
        escenario.preguntas.add(p1);
        escenario.preguntas.add(p2);
        escenario.preguntas.add(p3);
        caso.escenarios.add(escenario);
        Grupo grupo = new Grupo();
        grupo.id = 8L;
        grupo.docente = docente;
        sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.inicio = LocalDateTime.now().minusMinutes(10);
        sesion.inicioReal = sesion.inicio;
        sesion.fin = LocalDateTime.now().plusHours(1);
        sesion.tiempoMaxMin = 40;
    }

    @Test
    @DisplayName("RF-14 en curso no anticipa nada: aciertos, errores y sin responder van en null")
    void enCursoNoRevela() {
        Participacion participacion = intento();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        Contratos.ParticipacionVista vista = servicio.ver(estudiante, 11L);

        assertNull(vista.aciertos());
        assertNull(vista.errores());
        assertNull(vista.sinResponder());
        assertNull(ResumenIntento.de(participacion));
    }

    @Test
    @DisplayName("RF-14 al finalizar cuenta 1 acierto, 1 error y 1 sin responder de 3")
    void finalizadaCuenta() {
        Participacion participacion = intento();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        Contratos.ParticipacionVista vista = servicio.finalizar(estudiante, 11L);

        assertEquals(3, vista.total());
        assertEquals(1, vista.aciertos());
        assertEquals(1, vista.errores());
        assertEquals(1, vista.sinResponder());
    }

    @Test
    @DisplayName("RF-14 el docente ve el resumen del intento finalizado")
    void docenteVeResumen() {
        Participacion participacion = intento();
        participacion.fin = LocalDateTime.now();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        Contratos.ParticipacionVista vista = servicio.ver(docente, 11L);

        assertEquals(1, vista.aciertos());
        assertEquals(1, vista.errores());
        assertEquals(1, vista.sinResponder());
    }

    @Test
    @DisplayName("RF-14 el ausente tiene 0 aciertos, 0 errores y todas sin responder")
    void ausente() {
        Participacion ausente = new Participacion();
        ausente.estudiante = estudiante;
        ausente.sesion = sesion;

        ResumenIntento resumen = ResumenIntento.de(ausente);

        assertEquals(new ResumenIntento(0, 0, 3), resumen);
    }

    /** Intento en curso: p1 bien, p2 mal, p3 sin responder. */
    private Participacion intento() {
        Participacion participacion = new Participacion();
        participacion.id = 11L;
        participacion.estudiante = estudiante;
        participacion.sesion = sesion;
        participacion.casoId = 5L;
        participacion.inicio = LocalDateTime.now().minusMinutes(5);
        participacion.respuestas.add(respuesta(participacion, p1, p1.opciones.get(0)));
        participacion.respuestas.add(respuesta(participacion, p2, p2.opciones.get(1)));
        return participacion;
    }

    private Respuesta respuesta(Participacion participacion, Pregunta pregunta, Opcion opcion) {
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = participacion;
        respuesta.pregunta = pregunta;
        respuesta.opcion = opcion;
        return respuesta;
    }

    private Pregunta pregunta(long id, String peso, Opcion... opciones) {
        Pregunta pregunta = new Pregunta();
        pregunta.id = id;
        pregunta.enunciado = "Pregunta " + id;
        CriterioRubrica criterio = new CriterioRubrica();
        criterio.criterio = "Juicio";
        criterio.peso = new BigDecimal(peso);
        pregunta.criterio = criterio;
        for (Opcion opcion : opciones) pregunta.opciones.add(opcion);
        return pregunta;
    }

    private Opcion opcion(long id, boolean esCorrecta) {
        Opcion opcion = new Opcion();
        opcion.id = id;
        opcion.descripcion = "opción " + id;
        opcion.esCorrecta = esCorrecta;
        return opcion;
    }

    private Usuario usuario(long id, Catalogo.Rol rol) {
        Usuario usuario = new Usuario();
        usuario.id = id;
        usuario.nombre = "Usuario " + id;
        usuario.email = "u" + id + "@psicosim.edu";
        usuario.rol = rol;
        return usuario;
    }
}
