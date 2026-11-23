package com.dilema.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class Contratos {
    private Contratos() {}

    public record Ingreso(String email, String clave, String codigoAutorizacion, String rol) {}
    public record UsuarioVista(Long id, String nombre, String email, String rol, List<String> permisos, boolean activo) {}
    public record SesionAuth(String token, UsuarioVista usuario, Long sesionId) {}

    public record OpcionIn(Long id, String texto, boolean correcta, String explicacion, String fundamento) {}
    public record PreguntaIn(Long id, String enunciado, String pista, String criterio, Double peso, List<OpcionIn> opciones) {}
    public record BloqueIn(Long id, String nombre, String contexto, List<PreguntaIn> preguntas) {}
    public record PersonajeIn(Long id, String nombre, String descripcion, List<Integer> escenarios) {}
    public record CriterioIn(Long id, String nombre, double peso, String descripcion) {}
    public record CasoIn(String nombre, String desarrolloSituacional, String contexto, Integer tiempoEstimadoMin,
                         boolean sensible, String advertencia, List<BloqueIn> bloques, List<CriterioIn> rubrica,
                         List<PersonajeIn> personajes, String repartoRubrica) {}
    public record CasoVista(Long id, String nombre, String desarrolloSituacional, String contexto, Integer tiempoEstimadoMin,
                            boolean sensible, String advertencia, String estado, Long docenteId,
                            List<BloqueIn> bloques, List<CriterioIn> rubrica, List<PersonajeIn> personajes,
                            String repartoRubrica) {}
    public record CasoResumen(Long id, String nombre, String estado, Integer tiempoEstimadoMin, int bloques, int preguntas) {}

    public record GrupoIn(String nombre, String espacioAcademico) {}
    public record EstudianteIn(String nombre, String email) {}
    public record PersonaVista(Long id, String nombre, String email) {}
    public record GrupoVista(Long id, String nombre, String espacioAcademico, PersonaVista docente, List<PersonaVista> estudiantes) {}

    public record AgendaIn(Long casoId, Long grupoId, String inicio, String fin, int tiempoMaxMin, int toleranciaMin,
                           String lugar, String mensaje) {}
    public record SesionVista(Long id, String codigo, String estado, String inicio, String fin, int tiempoMaxMin,
                              int toleranciaMin, String lugar, String mensaje, Long casoId, String caso,
                              Long grupoId, String grupo, String espacio, String desarrollo, String contexto,
                              boolean sensible, String advertencia, Long participacionId, String participacionEstado,
                              Double nota, Integer progreso, boolean repeticionAutorizada,
                              List<PersonajeIn> personajes, List<EscenarioVista> escenarios) {}
    /** Nombre y contexto de un escenario: el briefing los usa para asignar el mismo elenco que la simulación. */
    public record EscenarioVista(String nombre, String contexto) {}

    public record UsuarioIn(String nombre, String email, String clave, String rol) {}
    public record PermisosIn(List<String> permisos) {}
    public record ActivoIn(boolean activo) {}
    public record PerfilIn(String nombre, String email, String claveActual, String claveNueva) {}

    public record Aviso(Long id, String canal, String titulo, String cuerpo, boolean leida, String fecha) {}

    public record OpcionJuego(Long id, String texto, Boolean correcta, String explicacion, String fundamento) {}
    public record PreguntaJuego(Long id, String bloque, String contexto, String enunciado, String pista, String criterio,
                                Long seleccionId, List<OpcionJuego> opciones, Double puntaje,
                                int bloqueIndice, Double peso) {}
    public record ParticipacionVista(Long id, Long sesionId, String estado, String caso, int progreso, int total,
                                     int segundosMax, long segundosUsados, Double nota, String retroalimentacion,
                                     String estudiante, List<PreguntaJuego> preguntas, boolean repeticionAutorizada,
                                     Integer aciertos, Integer errores, Integer sinResponder,
                                     Long casoId, String desarrollo, String contexto, List<PersonajeIn> personajes) {}
    public record RespuestaIn(Long preguntaId, Long opcionId) {}
    public record TextoIn(String texto) {}
    public record PanelEstudiante(List<SesionVista> sesiones, List<Aviso> avisos, int sinLeer) {}
    public record FilaSeguimiento(Long participacionId, Long estudianteId, String estudiante, String email,
                                  String estado, Double nota, String retroalimentacion, boolean repeticionAutorizada) {}

    public record SesionRealizada(Long id, String caso, String grupo, String inicio, String fin) {}
    public record IntentoConsultado(Long id, String estudiante, int numeroIntento, String estado) {}
    public record RespuestaVigente(String pregunta, String opcion, Boolean acertada, String explicacion, String fundamento) {}
    public record ParticipacionConsultada(Long id, String estudiante, int numeroIntento, String valoracionGeneral,
                                          List<RespuestaVigente> respuestas) {}
}
