package com.dilema.servicio.seguimiento;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.modelo.Retroalimentacion;
import com.dilema.modelo.RetroalimentacionDocente;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.AccesoDenegado;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SeguimientoTest {

    @Test
    @DisplayName("el iterador recorre, se agota y al reiniciar vuelve al inicio")
    void iteradorRecorreYReinicia() {
        SesionCaso primera = new SesionCaso();
        primera.id = 1L;
        SesionCaso segunda = new SesionCaso();
        segunda.id = 2L;
        Iterador<SesionCaso> iterador = new IteradorSesiones(List.of(primera, segunda));

        assertEquals(1L, iterador.siguiente().id);
        assertEquals(2L, iterador.siguiente().id);
        assertFalse(iterador.haySiguiente());
        assertThrows(NoSuchElementException.class, iterador::siguiente);

        iterador.reiniciar();
        assertEquals(1L, iterador.siguiente().id);
    }

    @Test
    @DisplayName("un recorrido vacío no entrega un siguiente")
    void iteradorVacio() {
        Iterador<SesionCaso> iterador = new IteradorSesiones(List.of());
        assertFalse(iterador.haySiguiente());
        assertThrows(NoSuchElementException.class, iterador::siguiente);
    }

    @Test
    @DisplayName("el historial solo deja las sesiones finalizadas de los grupos del profesor")
    void historialFiltra() {
        Usuario profesor = usuario(1L, "Profe");
        Usuario otro = usuario(9L, "Otro");
        SesionCaso suya = sesionDe(profesor, true);
        suya.id = 10L;
        SesionCaso enCurso = sesionDe(profesor, false);
        enCurso.id = 11L;
        SesionCaso ajena = sesionDe(otro, true);
        ajena.id = 12L;

        HistorialSesiones historial = new HistorialSesiones(profesor, List.of(suya, enCurso, ajena));
        Iterador<SesionCaso> iterador = historial.crearIterador();

        assertEquals(10L, iterador.siguiente().id);
        assertFalse(iterador.haySiguiente());
    }

    @Test
    @DisplayName("el iterador interno entrega cada intento, no solo el último")
    void todosLosIntentos() {
        EscenarioSesion escenario = new EscenarioSesion();
        Participacion primero = intento(escenario, escenario.ana, 1, true);
        Participacion segundo = intento(escenario, escenario.ana, 2, false);

        Iterador<Participacion> iterador = new IteradorParticipaciones(List.of(segundo, primero));
        assertEquals(1, iterador.siguiente().numeroIntento);
        assertEquals(2, iterador.siguiente().numeroIntento);
        assertFalse(iterador.haySiguiente());
    }

    @Test
    @DisplayName("abrir una participación muestra la opción vigente, su explicación y la valoración")
    void verParticipacion() {
        EscenarioSesion escenario = new EscenarioSesion();
        Participacion intento = intento(escenario, escenario.ana, 1, false);
        intento.respuestas.add(respuesta(intento, escenario.primera, escenario.correcta));
        RetroalimentacionDocente valoracion = new RetroalimentacionDocente();
        valoracion.comentario = "Revisar el segundo criterio";
        intento.retroalimentacionDocente = valoracion;

        Contratos.ParticipacionConsultada consulta = new ConsultaSeguimiento().verParticipacion(intento);

        assertEquals("Revisar el segundo criterio", consulta.valoracionGeneral());
        assertEquals(2, consulta.respuestas().size());
        Contratos.RespuestaVigente vigente = consulta.respuestas().get(0);
        assertEquals("¿Qué haces?", vigente.pregunta());
        assertEquals("contener", vigente.opcion());
        assertEquals(true, vigente.acertada());
        assertEquals("Porque prioriza la contención", vigente.explicacion());
        assertEquals("Guía de crisis", vigente.fundamento());
        assertNull(consulta.respuestas().get(1).opcion());
    }

    @Test
    @DisplayName("una sesión sin participaciones se informa y no se recorre en silencio")
    void sinParticipaciones() {
        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> new ConsultaSeguimiento().participacionesDe(List.of()));
        assertTrue(error.getMessage().contains("no tiene participaciones"));
    }

    @Test
    @DisplayName("dos intentos son dos filas y quien no participó sale ausente en 0,0 aunque la sesión siga en curso")
    void reportePorIntentoYAusenciaEnCurso() {
        EscenarioSesion escenario = new EscenarioSesion();
        Participacion completo = intento(escenario, escenario.ana, 1, true);
        completo.fijarNota(new BigDecimal("4.6"));
        RetroalimentacionDocente valoracion = new RetroalimentacionDocente();
        valoracion.comentario = "Sólido";
        completo.retroalimentacionDocente = valoracion;
        Participacion parcial = intento(escenario, escenario.ana, 2, false);

        GeneradorReporte generador = new GeneradorReporte();
        DatosReporte datos = generador.recolectarDatos(escenario.sesion, List.of(parcial, completo));

        assertEquals(3, datos.lineas().size());
        LineaReporte primera = datos.lineas().get(0);
        assertEquals("Ana", primera.estudiante());
        assertEquals(1, primera.numeroIntento());
        assertEquals(EstadoLinea.COMPLETA, primera.estado());
        assertEquals(new BigDecimal("4.6"), primera.puntaje());
        assertEquals(2, primera.aciertos());
        assertEquals(2, primera.totalPreguntas());
        assertEquals(NivelDesempeno.SUPERIOR, primera.nivel());
        assertEquals("Sólido", primera.valoracionGeneral());

        LineaReporte segunda = datos.lineas().get(1);
        assertEquals(2, segunda.numeroIntento());
        assertEquals(EstadoLinea.PARCIAL, segunda.estado());
        assertEquals(new BigDecimal("3.0"), segunda.puntaje());
        assertEquals(1, segunda.aciertos());
        assertEquals(NivelDesempeno.BASICO, segunda.nivel());

        LineaReporte ausencia = datos.lineas().get(2);
        assertEquals("Luis", ausencia.estudiante());
        assertEquals(EstadoLinea.AUSENTE, ausencia.estado());
        assertEquals(new BigDecimal("0.0"), ausencia.puntaje());
        assertEquals(0, ausencia.aciertos());
        assertEquals(NivelDesempeno.BAJO, ausencia.nivel());
        assertEquals("", ausencia.valoracionGeneral());

        byte[] csv = new ExportadorCSV().exportar(datos).contenido();
        byte[] pdf = new ExportadorPDF().exportar(datos).contenido();
        byte[] xlsx = new ExportadorXLSX().exportar(datos).contenido();
        String texto = new String(csv, StandardCharsets.UTF_8);
        assertTrue(texto.contains(ExportadorCSV.ENCABEZADO));
        assertTrue(texto.contains("COMPLETA"));
        assertTrue(texto.contains("PARCIAL"));
        assertTrue(texto.contains("AUSENTE"));
        assertEquals(4, texto.lines().count());
        assertTrue(new String(pdf, 0, 4, StandardCharsets.US_ASCII).startsWith("%PDF"));
        assertEquals('P', (char) xlsx[0]);
        assertEquals('K', (char) xlsx[1]);
    }

    @Test
    @DisplayName("sin convocados no se arma el archivo")
    void sinConvocadosNoExporta() {
        EscenarioSesion escenario = new EscenarioSesion();
        escenario.sesion.grupo.estudiantes.clear();
        FormatoEspia formato = new FormatoEspia();
        GeneradorReporte generador = new GeneradorReporte();
        generador.setFormato(formato);

        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> generador.generar(escenario.profesor, escenario.sesion, List.of()));
        assertTrue(error.getMessage().contains("no tiene convocados"));
        assertFalse(formato.exporto);
    }

    @Test
    @DisplayName("un docente que no dirige el grupo no descarga el reporte")
    void otroDocenteNoDescarga() {
        EscenarioSesion escenario = new EscenarioSesion();
        FormatoEspia formato = new FormatoEspia();
        GeneradorReporte generador = new GeneradorReporte();
        generador.setFormato(formato);

        AccesoDenegado error = assertThrows(AccesoDenegado.class,
                () -> generador.generar(usuario(9L, "Ajeno"), escenario.sesion, List.of()));
        assertTrue(error.getMessage().contains("no diriges"));
        assertFalse(formato.exporto);
    }

    @ParameterizedTest(name = "nota {0} es {1}")
    @CsvSource({
            "0.0, BAJO",
            "2.9, BAJO",
            "3.0, BASICO",
            "3.9, BASICO",
            "4.0, ALTO",
            "4.5, ALTO",
            "4.51, ALTO",
            "4.59, ALTO",
            "4.6, SUPERIOR",
            "5.0, SUPERIOR"
    })
    @DisplayName("el nivel sale de los rangos de la nota")
    void niveles(String nota, String nivel) {
        assertEquals(NivelDesempeno.valueOf(nivel), NivelDesempeno.de(new BigDecimal(nota)));
    }

    private static Usuario usuario(Long id, String nombre) {
        Usuario usuario = new Usuario();
        usuario.id = id;
        usuario.nombre = nombre;
        return usuario;
    }

    private static SesionCaso sesionDe(Usuario profesor, boolean finalizada) {
        Grupo grupo = new Grupo();
        grupo.docente = profesor;
        grupo.nombre = "Grupo";
        SesionCaso sesion = new SesionCaso();
        sesion.grupo = grupo;
        sesion.inicioReal = LocalDateTime.now();
        if (finalizada) sesion.cierreReal = LocalDateTime.now();
        return sesion;
    }

    private static Participacion intento(EscenarioSesion escenario, Usuario estudiante, int numero, boolean completo) {
        Participacion participacion = new Participacion();
        participacion.id = (long) numero;
        participacion.sesion = escenario.sesion;
        participacion.estudiante = estudiante;
        participacion.numeroIntento = numero;
        participacion.inicio = LocalDateTime.now().minusMinutes(5);
        participacion.fin = LocalDateTime.now();
        participacion.respuestas.add(respuesta(participacion, escenario.primera, escenario.correcta));
        if (completo) {
            participacion.respuestas.add(respuesta(participacion, escenario.segunda, escenario.otraCorrecta));
        }
        return participacion;
    }

    private static Respuesta respuesta(Participacion participacion, Pregunta pregunta, Opcion opcion) {
        Respuesta respuesta = new Respuesta();
        respuesta.participacion = participacion;
        respuesta.pregunta = pregunta;
        respuesta.opcion = opcion;
        respuesta.casoId = 5L;
        return respuesta;
    }

    private static final class FormatoEspia implements FormatoReporte {
        private boolean exporto;

        @Override
        public ArchivoReporte exportar(DatosReporte datos) {
            exporto = true;
            return new ArchivoReporte(new byte[0], extension());
        }

        @Override
        public String extension() {
            return "csv";
        }
    }

    private static final class EscenarioSesion {
        private final Usuario profesor = usuario(1L, "Profe");
        private final Usuario ana = usuario(2L, "Ana");
        private final Usuario luis = usuario(3L, "Luis");
        private final SesionCaso sesion = new SesionCaso();
        private final Pregunta primera = pregunta(21L, "¿Qué haces?", "3.0");
        private final Pregunta segunda = pregunta(22L, "¿A quién llamas?", "2.0");
        private final Opcion correcta = opcion("contener", true, "Porque prioriza la contención", "Guía de crisis");
        private final Opcion otraCorrecta = opcion("al equipo", true, "Activa la red", "Protocolo");

        private EscenarioSesion() {
            Caso caso = new Caso();
            caso.id = 5L;
            caso.nombre = "Crisis";
            Escenario bloque = new Escenario();
            bloque.preguntas.add(primera);
            bloque.preguntas.add(segunda);
            caso.escenarios.add(bloque);

            Grupo grupo = new Grupo();
            grupo.nombre = "Grupo A";
            grupo.docente = profesor;
            grupo.estudiantes.add(ana);
            grupo.estudiantes.add(luis);

            sesion.id = 4L;
            sesion.caso = caso;
            sesion.grupo = grupo;
            sesion.inicio = LocalDateTime.now().minusHours(1);
            sesion.fin = LocalDateTime.now().plusHours(1);
            sesion.inicioReal = LocalDateTime.now().minusMinutes(20);
        }

        private static Pregunta pregunta(long id, String enunciado, String peso) {
            Pregunta pregunta = new Pregunta();
            pregunta.id = id;
            pregunta.enunciado = enunciado;
            CriterioRubrica criterio = new CriterioRubrica();
            criterio.peso = new BigDecimal(peso);
            pregunta.criterio = criterio;
            return pregunta;
        }

        private static Opcion opcion(String texto, boolean acertada, String explicacion, String fundamento) {
            Opcion opcion = new Opcion();
            opcion.descripcion = texto;
            opcion.esCorrecta = acertada;
            Retroalimentacion retro = new Retroalimentacion();
            retro.explicacion = explicacion;
            retro.fundamento = fundamento;
            opcion.retroalimentacion = retro;
            return opcion;
        }
    }
}
