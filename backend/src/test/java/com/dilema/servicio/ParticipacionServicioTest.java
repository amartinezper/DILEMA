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
        assertEquals("Ya pasó el tiempo que el docente dejó para entrar. Pídele que amplíe el plazo si todavía debes participar.",
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
    @DisplayName("RF-11 / RF-27 el panel del estudiante lista los avisos guardados y cuenta solo los no leídos")
    void panel() {
        when(sesiones.delEstudiante(2L)).thenReturn(List.of(sesion));
        Participacion participacion = enCurso();
        participacion.fin = LocalDateTime.now();
        participacion.fijarNota(new BigDecimal("4.0"));
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of(participacion));
        when(participaciones.findByEstudianteIdOrderByIdDesc(2L)).thenReturn(List.of(participacion));

        com.dilema.modelo.Notificacion asignado = notificacion(70L, "Caso asignado", true);
        com.dilema.modelo.Notificacion nota = notificacion(71L, "Nota del caso", false);
        when(bitacora.avisosDe(estudiante)).thenReturn(List.of(nota, asignado));

        Contratos.PanelEstudiante panel = servicio.panel(estudiante);
        assertEquals(1, panel.sesiones().size());
        verify(bitacora).registrarUnaVez(org.mockito.ArgumentMatchers.eq(estudiante),
                org.mockito.ArgumentMatchers.eq("sesion:4:asignado"), org.mockito.ArgumentMatchers.eq("CORREO"),
                org.mockito.ArgumentMatchers.eq("Caso asignado"), any(), any());
        assertTrue(panel.avisos().stream().anyMatch(a -> a.titulo().equals("Caso asignado") && a.id() == 70L));
        assertTrue(panel.avisos().stream().anyMatch(a -> a.titulo().equals("Nota del caso") && a.id() == 71L));
        assertEquals(1, panel.sinLeer(), "solo cuenta los avisos no leídos");
    }

    private com.dilema.modelo.Notificacion notificacion(long id, String titulo, boolean leida) {
        com.dilema.modelo.Notificacion n = new com.dilema.modelo.Notificacion();
        n.id = id;
        n.usuario = estudiante;
        n.canal = "SISTEMA";
        n.titulo = titulo;
        n.cuerpo = "";
        n.leida = leida;
        return n;
    }

    @Test
    @DisplayName("el seguimiento marca ausente en 0,0 si la sesión ya cerró")
    void seguimiento() {
        sesion.cierreReal = LocalDateTime.now();
        sesion.grupo.estudiantes.add(estudiante);
        when(padron.convocados(sesion)).thenReturn(List.of(estudiante));
        when(participaciones.findByEstudianteIdAndSesionId(2L, 4L)).thenReturn(List.of());

        List<Contratos.FilaSeguimiento> filas = servicio.seguimiento(docente, 4L);
        assertEquals("AUSENTE", filas.get(0).estado());
        assertEquals(0.0, filas.get(0).nota());
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

    @Test
    @DisplayName("la novela del estudiante recibe cada personaje solo en sus escenarios y nada de la correcta en curso")
    void novelaDelEstudiante() {
        Escenario segundo = new Escenario();
        segundo.id = 7L;
        segundo.orden = 1;
        segundo.titulo = "Comisaría";
        segundo.contexto = "Quince días después";
        segundo.caso = sesion.caso;
        Pregunta tercera = pregunta(23L, "¿Qué medida?", new BigDecimal("1.0"));
        tercera.opciones.add(opcion(51L, true));
        segundo.preguntas.add(tercera);
        sesion.caso.escenarios.add(segundo);
        com.dilema.modelo.Personaje madre = personaje(61L, "Madre", "Mujer, 50 años");
        com.dilema.modelo.Personaje comisaria = personaje(62L, "Comisaria", "Mujer, 40 años");
        com.dilema.repo.EscenarioPersonajeRepo vinculos = mock(com.dilema.repo.EscenarioPersonajeRepo.class);
        when(vinculos.findByCasoId(5L)).thenReturn(List.of(vinculo(6L, 61L), vinculo(7L, 62L)));
        ParticipacionServicio conVinculos = new ParticipacionServicio(participaciones, sesiones, padron,
                new ProxyOperacion(), new Mapeador(), bitacora, null, vinculos);
        Participacion participacion = enCurso();
        when(participaciones.findById(11L)).thenReturn(Optional.of(participacion));

        Contratos.ParticipacionVista vista = conVinculos.ver(estudiante, 11L);

        assertEquals(5L, vista.casoId());
        assertEquals(List.of(0), vista.personajes().get(0).escenarios(), "la madre solo en el primer escenario");
        assertEquals(List.of(1), vista.personajes().get(1).escenarios(), "la comisaria solo en el segundo");
        assertEquals(List.of(0, 0, 1), vista.preguntas().stream().map(Contratos.PreguntaJuego::bloqueIndice).toList());
        assertEquals(3.0, vista.preguntas().get(0).peso());
        assertTrue(vista.preguntas().stream().flatMap(q -> q.opciones().stream())
                .allMatch(o -> o.correcta() == null && o.explicacion() == null && o.fundamento() == null),
                "en curso no viaja la correcta ni su explicación");
        assertTrue(madre.id != null && comisaria.id != null);
    }

    private com.dilema.modelo.Personaje personaje(long id, String nombre, String descripcion) {
        com.dilema.modelo.Personaje personaje = new com.dilema.modelo.Personaje();
        personaje.id = id;
        personaje.nombre = nombre;
        personaje.descripcion = descripcion;
        personaje.caso = sesion.caso;
        sesion.caso.personajes.add(personaje);
        return personaje;
    }

    private com.dilema.modelo.EscenarioPersonaje vinculo(long escenarioId, long personajeId) {
        com.dilema.modelo.EscenarioPersonaje vinculo = new com.dilema.modelo.EscenarioPersonaje();
        vinculo.escenarioId = escenarioId;
        vinculo.personajeId = personajeId;
        vinculo.casoId = 5L;
        return vinculo;
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
