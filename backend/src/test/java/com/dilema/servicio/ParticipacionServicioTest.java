package com.dilema.servicio;

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
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ParticipacionServicioTest {
    private ParticipacionRepo participaciones;
    private SesionRepo sesiones;
    private PadronConvocatoria padron;
    private BitacoraServicio bitacora;
    private ParticipacionServicio servicio;
    private Usuario docente;
    private Usuario estudiante;
    private SesionCaso sesion;
    private Pregunta pregunta;
    private Opcion correcta;
    private Opcion incorrecta;

    @BeforeEach
    void preparar() {
        participaciones = mock(ParticipacionRepo.class);
        sesiones = mock(SesionRepo.class);
        padron = mock(PadronConvocatoria.class);
        bitacora = mock(BitacoraServicio.class);
        servicio = new ParticipacionServicio(participaciones, sesiones, padron, new ProxyOperacion(), new Mapeador(), bitacora);
        docente = docente();
        estudiante = estudiante();
        armarCaso();
        when(sesiones.findById(4L)).thenReturn(Optional.of(sesion));
        when(padron.esta(sesion, estudiante)).thenReturn(true);
        when(participaciones.save(any())).thenAnswer(inv -> {
            Participacion p = inv.getArgument(0);
            if (p.id == null) p.id = 11L;
            return p;
        });
    }

    @Test
    @DisplayName("RF-11 inicia el primer intento dentro de la ventana")
    void iniciar() {
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of());
        Contratos.ParticipacionVista vista = servicio.iniciar(estudiante, 4L);
        assertEquals("EN_CURSO", vista.estado());
        assertEquals("Crisis", vista.caso());
        assertEquals(2, vista.total());
        verify(participaciones).save(any());
    }

    @Test
    @DisplayName("RF-22 rechaza el ingreso tardío")
    void ingresoTardio() {
        sesion.inicioReal = LocalDateTime.now().minusMinutes(40);
        sesion.toleranciaMin = 10;
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of());
        assertEquals("RF-22: ya pasó el tiempo definido por el docente para iniciar.",
                assertThrows(ReglaNegocio.class, () -> servicio.iniciar(estudiante, 4L)).getMessage());
    }

    @Test
    @DisplayName("RF-25 exige autorización para un segundo intento")
    void noRepiteSinAutorizacion() {
        Participacion previa = enCurso();
        previa.fin = LocalDateTime.now();
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of(previa));
        assertThrows(ReglaNegocio.class, () -> servicio.iniciar(estudiante, 4L));
    }

    @Test
    @DisplayName("RF-10 responde, cambia y deshace")
    void responderYDeshacer() {
        Participacion participacion = enCurso();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        servicio.responder(estudiante, 11L, 21L, 31L);
        assertEquals(1, participacion.respuestas.size());
        assertEquals(31L, participacion.respuestas.get(0).opcion.id);

        servicio.responder(estudiante, 11L, 21L, 32L);
        assertEquals(1, participacion.respuestas.size());
        assertEquals(32L, participacion.respuestas.get(0).opcion.id);

        servicio.deshacer(estudiante, 11L);
        assertEquals(31L, participacion.respuestas.get(0).opcion.id);
        servicio.deshacer(estudiante, 11L);
        assertTrue(participacion.respuestas.isEmpty());
    }

    @Test
    @DisplayName("RF-12 finaliza, calcula la nota ponderada y avisa")
    void finalizarCalculaNota() {
        Participacion participacion = enCurso();
        Respuesta respuesta = new Respuesta();
        respuesta.pregunta = pregunta;
        respuesta.opcion = correcta;
        participacion.respuestas.add(respuesta);
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        Contratos.ParticipacionVista vista = servicio.finalizar(estudiante, 11L);

        assertEquals("FINALIZADA", vista.estado());
        assertEquals(3.0, vista.nota());
        assertTrue(vista.preguntas().get(0).opciones().get(0).correcta());
        verify(bitacora).avisar(any(), org.mockito.ArgumentMatchers.eq("CORREO"), org.mockito.ArgumentMatchers.eq("Nota del caso"), any());
    }

    @Test
    @DisplayName("RF-25 solo el docente creador autoriza el último intento en curso")
    void autorizarRepeticion() {
        Participacion participacion = enCurso();
        participacion.fin = LocalDateTime.now();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of(participacion));

        servicio.autorizarRepeticion(docente, 11L);
        assertNotNull(participacion.autorizacion);

        assertThrows(ReglaNegocio.class, () -> servicio.autorizarRepeticion(docente, 11L));
        sesion.cierreReal = LocalDateTime.now();
        participacion.autorizacion = null;
        assertThrows(ReglaNegocio.class, () -> servicio.autorizarRepeticion(docente, 11L));
    }

    @Test
    @DisplayName("RF-11 el panel del estudiante incluye convocatoria y nota")
    void panel() {
        when(sesiones.delEstudiante(2L)).thenReturn(List.of(sesion));
        Participacion participacion = enCurso();
        participacion.fin = LocalDateTime.now();
        participacion.fijarNota(new BigDecimal("4.0"));
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of(participacion));
        when(participaciones.findByEstudianteIdOrderByIdDesc(2L)).thenReturn(List.of(participacion));

        Contratos.PanelEstudiante panel = servicio.panel(estudiante);
        assertEquals(1, panel.sesiones().size());
        assertTrue(panel.avisos().stream().anyMatch(a -> a.titulo().equals("Caso asignado")));
        assertTrue(panel.avisos().stream().anyMatch(a -> a.titulo().equals("Nota del caso")));
    }

    @Test
    @DisplayName("el seguimiento marca ausente en 0,0 si la sesión ya cerró")
    void seguimiento() {
        sesion.cierreReal = LocalDateTime.now();
        sesion.grupo.estudiantes.add(estudiante);
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of());

        List<Contratos.FilaSeguimiento> filas = servicio.seguimiento(docente, 4L);
        assertEquals("AUSENTE", filas.get(0).estado());
        assertEquals(0.0, filas.get(0).nota());
        assertTrue(servicio.reporte(docente, 4L).contains("AUSENTE"));
    }

    @Test
    @DisplayName("ver no revela la clave al estudiante en curso y sí al docente")
    void verRevelaSegunRol() {
        Participacion participacion = enCurso();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));
        Contratos.ParticipacionVista delEstudiante = servicio.ver(estudiante, 11L);
        assertNull(delEstudiante.preguntas().get(0).opciones().get(0).correcta());
        Contratos.ParticipacionVista delDocente = servicio.ver(docente, 11L);
        assertTrue(delDocente.preguntas().get(0).opciones().get(0).correcta());
        assertFalse(delDocente.preguntas().get(0).opciones().get(1).correcta());
    }

    private Participacion enCurso() {
        Participacion participacion = new Participacion();
        participacion.id = 11L;
        participacion.estudiante = estudiante;
        participacion.sesion = sesion;
        participacion.casoId = 5L;
        participacion.inicio = LocalDateTime.now().minusMinutes(5);
        return participacion;
    }

    private void armarCaso() {
        Caso caso = new Caso();
        caso.id = 5L;
        caso.nombre = "Crisis";
        caso.docente = docente;
        caso.desarrolloSituacional = "";
        caso.contexto = "";
        Escenario escenario = new Escenario();
        escenario.id = 6L;
        escenario.titulo = "Urgencias";
        escenario.contexto = "Llega un paciente";
        escenario.caso = caso;
        pregunta = pregunta(21L, "¿Qué haces?", new BigDecimal("3.0"));
        Pregunta otra = pregunta(22L, "¿A quién llamas?", new BigDecimal("2.0"));
        correcta = opcion(31L, true);
        incorrecta = opcion(32L, false);
        pregunta.opciones.add(correcta);
        pregunta.opciones.add(incorrecta);
        Opcion otraCorrecta = opcion(41L, true);
        otra.opciones.add(otraCorrecta);
        escenario.preguntas.add(pregunta);
        escenario.preguntas.add(otra);
        caso.escenarios.add(escenario);

        Grupo grupo = new Grupo();
        grupo.id = 8L;
        grupo.nombre = "Grupo A";
        grupo.semestre = "2026-I";
        grupo.docente = docente;
        sesion = new SesionCaso();
        sesion.id = 4L;
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.codigo = "DL-AB12";
        sesion.inicio = LocalDateTime.now().minusMinutes(10);
        sesion.fin = LocalDateTime.now().plusHours(2);
        sesion.inicioReal = LocalDateTime.now().minusMinutes(10);
        sesion.tiempoMaxMin = 40;
        sesion.toleranciaMin = 20;
        sesion.mensaje = "Prepárate";
    }

    private Pregunta pregunta(long id, String enunciado, BigDecimal peso) {
        Pregunta pregunta = new Pregunta();
        pregunta.id = id;
        pregunta.enunciado = enunciado;
        pregunta.pista = "";
        CriterioRubrica criterio = new CriterioRubrica();
        criterio.criterio = "Juicio";
        criterio.peso = peso;
        pregunta.criterio = criterio;
        return pregunta;
    }

    private Opcion opcion(long id, boolean esCorrecta) {
        Opcion opcion = new Opcion();
        opcion.id = id;
        opcion.descripcion = "opción " + id;
        opcion.esCorrecta = esCorrecta;
        return opcion;
    }

    private Usuario docente() {
        Usuario docente = new Usuario();
        docente.id = 1L;
        docente.nombre = "Docente";
        docente.email = "docente@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        Permiso ver = new Permiso();
        ver.tipo = FabricaCuentas.VISUALIZAR;
        docente.permisos.add(ver);
        return docente;
    }

    private Usuario estudiante() {
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.nombre = "Ana";
        estudiante.email = "ana@psicosim.edu";
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        return estudiante;
    }
}
