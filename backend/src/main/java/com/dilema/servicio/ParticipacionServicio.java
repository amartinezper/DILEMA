package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.*;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.evaluacion.EstadoDeParticipacion;
import com.dilema.servicio.evaluacion.EstrategiaCalificacion;
import com.dilema.servicio.evaluacion.ExplicacionReal;
import com.dilema.servicio.evaluacion.RetroalimentacionProxy;
import com.dilema.servicio.participacion.ComandoRespuesta;
import com.dilema.servicio.participacion.FinalizadorParticipacion;
import com.dilema.servicio.participacion.HistorialRespuestas;
import com.dilema.servicio.participacion.ProgresoParticipacion;
import com.dilema.servicio.participacion.ProxyParticipacion;
import com.dilema.servicio.participacion.RelojParticipacion;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Módulo 5. Participar, responder, controlar tiempo y autorizar una repetición.
 */
@Service
public class ParticipacionServicio {
    private final ParticipacionRepo participaciones;
    private final SesionRepo sesiones;
    private final PadronConvocatoria padron;
    private final ProxyOperacion proxy;
    private final Mapeador mapeador;
    private final BitacoraServicio bitacora;
    private final HistorialRespuestas historial = new HistorialRespuestas();
    private final ProxyParticipacion puerta = new ProxyParticipacion();

    public ParticipacionServicio(ParticipacionRepo participaciones, SesionRepo sesiones, PadronConvocatoria padron,
                                 ProxyOperacion proxy, Mapeador mapeador, BitacoraServicio bitacora) {
        this.participaciones = participaciones;
        this.sesiones = sesiones;
        this.padron = padron;
        this.proxy = proxy;
        this.mapeador = mapeador;
        this.bitacora = bitacora;
    }

    @Transactional(readOnly = true)
    public Contratos.PanelEstudiante panel(Usuario estudiante) {
        proxy.participar(estudiante);
        List<SesionCaso> propias = sesiones.delEstudiante(estudiante.id);
        List<Contratos.SesionVista> sesionesVista = propias.stream().map(sesion -> {
            Participacion ultima = participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id).stream()
                    .max(Comparator.comparing(p -> p.id)).orElse(null);
            return mapeador.sesion(sesion, ultima);
        }).toList();
        List<Contratos.Aviso> avisos = new ArrayList<>();
        for (SesionCaso sesion : propias) {
            avisos.add(new Contratos.Aviso(sesion.id, "CORREO", "Caso asignado",
                    sesion.caso.nombre + ". " + (sesion.mensaje == null ? "" : sesion.mensaje),
                    false, sesion.inicio.toString()));
            if (sesion.estado() == Catalogo.EstadoSesion.EN_CURSO) {
                avisos.add(new Contratos.Aviso(sesion.id + 10000, "SISTEMA", "Recordatorio de vencimiento",
                        "La convocatoria sigue en curso. Tiempo máximo: " + sesion.tiempoMaxMin + " minutos.",
                        false, sesion.inicioReal == null ? sesion.inicio.toString() : sesion.inicioReal.toString()));
            }
        }
        for (Participacion participacion : participaciones.findByEstudianteIdOrderByIdDesc(estudiante.id)) {
            new SujetoParticipacion().notificar(participacion, avisos);
        }
        return new Contratos.PanelEstudiante(sesionesVista, avisos, avisos.size());
    }

    @Transactional
    public void leerAviso(Usuario estudiante, Long id) {
        proxy.participar(estudiante);
    }

    @Transactional
    public Contratos.ParticipacionVista iniciar(Usuario estudiante, Long sesionId) {
        proxy.participar(estudiante);
        SesionCaso sesion = sesiones.findById(sesionId).orElseThrow(() -> new NoEncontrado("Sesión no encontrada."));
        if (!padron.esta(sesion, estudiante)) {
            throw new AccesoDenegado("No estás autorizado en esta convocatoria.");
        }
        LocalDateTime ahora = LocalDateTime.now();
        puerta.sesionAbierta(sesion, ahora);
        List<Participacion> propias = participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id);
        Participacion enCurso = propias.stream().filter(Participacion::enCurso).findFirst().orElse(null);
        if (enCurso != null) {
            if (cerrarSiVencio(enCurso, ahora)) return vista(enCurso, true);
            return vista(enCurso, false);
        }
        Participacion previa = propias.stream().filter(Participacion::finalizada).max(Comparator.comparing(p -> p.id)).orElse(null);
        puerta.puedeRepetir(previa);
        if (previa == null) puerta.ingresoTardio(sesion, ahora);
        Participacion nueva = new Participacion();
        nueva.estudiante = estudiante;
        nueva.sesion = sesion;
        nueva.casoId = sesion.caso.id;
        nueva.numeroIntento = previa == null ? 1 : previa.numeroIntento + 1;
        nueva.inicio = ahora;
        participaciones.save(nueva);
        return vista(nueva, false);
    }

    @Transactional
    public Contratos.ParticipacionVista ver(Usuario usuario, Long id) {
        Participacion participacion = propiaODocente(usuario, id);
        if (usuario.rol == Catalogo.Rol.ESTUDIANTE) cerrarSiVencio(participacion, LocalDateTime.now());
        boolean revelar = new ProxyResultado().revelar(usuario, participacion);
        return vista(participacion, revelar);
    }

    @Transactional
    public Contratos.ParticipacionVista responder(Usuario estudiante, Long id, Long preguntaId, Long opcionId) {
        proxy.participar(estudiante);
        Participacion participacion = enCurso(estudiante, id);
        if (cerrarSiVencio(participacion, LocalDateTime.now())) return vista(participacion, true);
        Pregunta pregunta = buscarPregunta(participacion.sesion.caso, preguntaId);
        Opcion opcion = pregunta.opciones.stream().filter(o -> o.id.equals(opcionId)).findFirst()
                .orElseThrow(() -> new ReglaNegocio("La opción no pertenece a la pregunta."));
        Respuesta actual = participacion.respuestas.stream().filter(r -> r.pregunta.id.equals(preguntaId)).findFirst().orElse(null);
        Long antes = actual == null ? null : actual.opcion.id;
        ComandoRespuesta comando = new ComandoRespuesta(preguntaId, antes, opcionId);
        comando.ejecutar(participacion, pregunta, opcion, actual);
        historial.registrar(participacion.id, comando);
        return vista(participacion, false);
    }

    @Transactional
    public Contratos.ParticipacionVista deshacer(Usuario estudiante, Long id) {
        proxy.participar(estudiante);
        Participacion participacion = enCurso(estudiante, id);
        if (cerrarSiVencio(participacion, LocalDateTime.now())) return vista(participacion, true);
        ComandoRespuesta comando = historial.deshacer(participacion.id);
        comando.revertir(participacion, preguntaId -> buscarPregunta(participacion.sesion.caso, preguntaId));
        return vista(participacion, false);
    }

    @Transactional
    public Contratos.ParticipacionVista finalizar(Usuario estudiante, Long id) {
        proxy.participar(estudiante);
        Participacion participacion = enCurso(estudiante, id);
        new FinalizadorParticipacion.PorEstudiante(bitacora, this::calcularNota).finalizar(participacion);
        return vista(participacion, true);
    }

    @Transactional
    public void cerrarPorTiempo(Participacion participacion) {
        new FinalizadorParticipacion.PorLimite(bitacora, this::calcularNota).finalizar(participacion);
    }

    @Transactional
    public void retroalimentar(Usuario docente, Long id, String texto) {
        proxy.revisarGrupo(docente);
        Participacion participacion = participaciones.findById(id).orElseThrow(() -> new NoEncontrado("Participación no encontrada."));
        if (!participacion.sesion.caso.docente.id.equals(docente.id)) throw new AccesoDenegado("Solo el docente del caso puede valorarla.");
        EstadoDeParticipacion.de(participacion, bitacora).agregarRetroalimentacionGeneral(participacion, texto);
    }

    @Transactional
    public void autorizarRepeticion(Usuario docente, Long id) {
        proxy.revisarGrupo(docente);
        Participacion participacion = participaciones.findById(id).orElseThrow(() -> new NoEncontrado("Participación no encontrada."));
        if (!participacion.sesion.caso.docente.id.equals(docente.id)) {
            throw new AccesoDenegado("RF-25: solo el docente creador del caso autoriza la repetición.");
        }
        if (participacion.sesion.estado() != Catalogo.EstadoSesion.EN_CURSO) {
            throw new ReglaNegocio("RF-25: no se autoriza repetición si la sesión no está en curso.");
        }
        if (!participacion.finalizada()) throw new ReglaNegocio("Solo se autoriza repetir un intento ya terminado.");
        Participacion ultima = participaciones.findByEstudianteIdAndSesionId(participacion.estudiante.id, participacion.sesion.id)
                .stream().max(Comparator.comparing(p -> p.id)).orElse(participacion);
        if (!ultima.id.equals(participacion.id)) {
            throw new ReglaNegocio("RF-25: la autorización aplica al último intento del estudiante.");
        }
        if (participacion.autorizacion != null) {
            throw new ReglaNegocio("RF-25: ese intento ya tiene una repetición autorizada.");
        }
        AutorizacionRepeticion permiso = new AutorizacionRepeticion();
        permiso.participacion = participacion;
        permiso.fechaAutorizacion = LocalDateTime.now();
        participacion.autorizacion = permiso;
    }

    @Transactional(readOnly = true)
    public List<Contratos.FilaSeguimiento> seguimiento(Usuario docente, Long sesionId) {
        proxy.revisarGrupo(docente);
        SesionCaso sesion = sesiones.findById(sesionId).orElseThrow(() -> new NoEncontrado("Sesión no encontrada."));
        if (!sesion.grupo.esDirigidoPor(docente)) throw new AccesoDenegado("La sesión no está a tu cargo.");
        List<Contratos.FilaSeguimiento> filas = new ArrayList<>();
        IteradorCohorte iterador = new IteradorCohorte(sesion.grupo.estudiantes);
        while (iterador.hasNext()) {
            Usuario estudiante = iterador.next();
            Participacion ultima = participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id).stream()
                    .max(Comparator.comparing(p -> p.id)).orElse(null);
            if (ultima == null) {
                Double nota = sesion.estado() == Catalogo.EstadoSesion.FINALIZADO ? 0.0 : null;
                filas.add(new Contratos.FilaSeguimiento(null, estudiante.id, estudiante.nombre, estudiante.email,
                        sesion.estado() == Catalogo.EstadoSesion.FINALIZADO ? "AUSENTE" : "SIN_INICIAR", nota, "", false));
            } else {
                filas.add(new Contratos.FilaSeguimiento(ultima.id, estudiante.id, estudiante.nombre, estudiante.email,
                        ultima.estadoNombre(), ultima.nota(), ultima.comentarioDocente(), ultima.autorizacion != null));
            }
        }
        return filas;
    }

    @Transactional(readOnly = true)
    public String reporte(Usuario docente, Long sesionId) {
        List<Contratos.FilaSeguimiento> filas = seguimiento(docente, sesionId);
        return new ReporteCsv().generar(filas);
    }

    private boolean cerrarSiVencio(Participacion participacion, LocalDateTime ahora) {
        if (!RelojParticipacion.debeCerrar(participacion, ahora)) return false;
        new FinalizadorParticipacion.PorLimite(bitacora, this::calcularNota).finalizar(participacion);
        return true;
    }

    private Participacion enCurso(Usuario estudiante, Long id) {
        Participacion participacion = participaciones.findById(id).orElseThrow(() -> new NoEncontrado("Participación no encontrada."));
        if (!participacion.estudiante.id.equals(estudiante.id)) throw new AccesoDenegado("Esta participación no es tuya.");
        if (!participacion.enCurso()) throw new ReglaNegocio("La participación ya finalizó.");
        return participacion;
    }

    private Participacion propiaODocente(Usuario usuario, Long id) {
        Participacion participacion = participaciones.findById(id).orElseThrow(() -> new NoEncontrado("Participación no encontrada."));
        if (usuario.rol == Catalogo.Rol.ESTUDIANTE && participacion.estudiante.id.equals(usuario.id)) return participacion;
        if (usuario.rol == Catalogo.Rol.PROFESOR && participacion.sesion.caso.docente.id.equals(usuario.id)) return participacion;
        throw new AccesoDenegado("No puedes consultar esta participación.");
    }

    BigDecimal calcularNota(Participacion participacion) {
        return EstrategiaCalificacion.paraEstadoDe(participacion).calcularPuntaje(participacion);
    }

    private List<Pregunta> preguntas(Caso caso) {
        List<Pregunta> todas = new ArrayList<>();
        for (Escenario escenario : caso.escenarios) todas.addAll(escenario.preguntas);
        return todas;
    }

    private Pregunta buscarPregunta(Caso caso, Long id) {
        return preguntas(caso).stream().filter(p -> p.id.equals(id)).findFirst()
                .orElseThrow(() -> new ReglaNegocio("La pregunta no pertenece a este caso."));
    }

    private Contratos.ParticipacionVista vista(Participacion participacion, boolean revelar) {
        List<Contratos.PreguntaJuego> preguntas = new ArrayList<>();
        for (Escenario escenario : participacion.sesion.caso.escenarios) {
            for (Pregunta pregunta : escenario.preguntas) {
                Long seleccion = participacion.respuestas.stream().filter(r -> r.pregunta.id.equals(pregunta.id))
                        .map(r -> r.opcion.id).findFirst().orElse(null);
                List<Contratos.OpcionJuego> opciones = pregunta.opciones.stream()
                        .map(o -> new Contratos.OpcionJuego(o.id, o.descripcion,
                                revelar ? o.esCorrecta : null,
                                new RetroalimentacionProxy(participacion, new ExplicacionReal(o.retroalimentacion)).mostrar(),
                                RetroalimentacionProxy.visible(participacion) && o.retroalimentacion != null ? o.retroalimentacion.fundamento : null))
                        .toList();
                String criterio = pregunta.criterio == null ? "" : pregunta.criterio.criterio;
                preguntas.add(new Contratos.PreguntaJuego(pregunta.id, escenario.titulo, escenario.contexto,
                        pregunta.enunciado, pregunta.pista, criterio, seleccion, opciones));
            }
        }
        LocalDateTime hasta = participacion.fin == null ? LocalDateTime.now() : participacion.fin;
        long usados = participacion.inicio == null ? 0 : Math.max(0, Duration.between(participacion.inicio, hasta).getSeconds());
        int total = preguntas.size();
        int progreso = ProgresoParticipacion.porcentaje(participacion, total);
        return new Contratos.ParticipacionVista(participacion.id, participacion.sesion.id, participacion.estadoNombre(),
                participacion.sesion.caso.nombre, progreso, total,
                participacion.sesion.tiempoMaxMin * 60, usados, participacion.nota(),
                participacion.comentarioDocente(), participacion.estudiante.nombre, preguntas,
                participacion.autorizacion != null);
    }

    /** RF-14: delega en el Proxy de protección la decisión de revelar el resultado al estudiante. */
    class ProxyResultado {
        boolean revelar(Usuario usuario, Participacion participacion) {
            return usuario.rol != Catalogo.Rol.ESTUDIANTE || RetroalimentacionProxy.visible(participacion);
        }
    }

    interface ObservadorAviso { void actualizar(Participacion participacion, List<Contratos.Aviso> destino); }

    class SujetoParticipacion {
        private final List<ObservadorAviso> observadores = List.of(new ObservadorNota(), new ObservadorFeedback());
        void notificar(Participacion participacion, List<Contratos.Aviso> destino) {
            for (ObservadorAviso observador : observadores) observador.actualizar(participacion, destino);
        }
    }

    class ObservadorNota implements ObservadorAviso {
        public void actualizar(Participacion participacion, List<Contratos.Aviso> destino) {
            if (participacion.nota() == null) return;
            destino.add(new Contratos.Aviso(participacion.id + 20000, "SISTEMA", "Nota del caso",
                    participacion.sesion.caso.nombre + ": " + participacion.nota() + " / 5,0.",
                    false, participacion.fin == null ? "" : participacion.fin.toString()));
        }
    }

    class ObservadorFeedback implements ObservadorAviso {
        public void actualizar(Participacion participacion, List<Contratos.Aviso> destino) {
            if (participacion.comentarioDocente() == null) return;
            destino.add(new Contratos.Aviso(participacion.id + 30000, "DOCENTE", "Feedback del docente",
                    participacion.comentarioDocente(), false, ""));
        }
    }

    class IteradorCohorte implements java.util.Iterator<Usuario> {
        private final List<Usuario> lista;
        private int indice = 0;
        IteradorCohorte(java.util.Collection<Usuario> estudiantes) {
            this.lista = estudiantes.stream().sorted(Comparator.comparing(u -> u.nombre == null ? "" : u.nombre)).toList();
        }
        public boolean hasNext() { return indice < lista.size(); }
        public Usuario next() { return lista.get(indice++); }
    }

    class ReporteCsv {
        String generar(List<Contratos.FilaSeguimiento> filas) {
            StringBuilder csv = new StringBuilder("\uFEFFestudiante,email,estado,nota,retroalimentacion\n");
            for (Contratos.FilaSeguimiento fila : filas) {
                csv.append(esc(fila.estudiante())).append(',')
                        .append(esc(fila.email())).append(',')
                        .append(fila.estado()).append(',')
                        .append(fila.nota() == null ? "" : fila.nota()).append(',')
                        .append(esc(fila.retroalimentacion()))
                        .append('\n');
            }
            return csv.toString();
        }
    }

    private static String esc(String valor) {
        if (valor == null) return "";
        return "\"" + valor.replace("\"", "'") + "\"";
    }
}
