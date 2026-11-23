package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.*;
import com.dilema.repo.EscenarioPersonajeRepo;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.evaluacion.EstadoDeParticipacion;
import com.dilema.servicio.evaluacion.EstrategiaCalificacion;
import com.dilema.servicio.evaluacion.ExplicacionReal;
import com.dilema.servicio.evaluacion.ResumenIntento;
import com.dilema.servicio.evaluacion.RetroalimentacionProxy;
import com.dilema.servicio.participacion.ComandoRespuesta;
import com.dilema.servicio.participacion.FinalizadorParticipacion;
import com.dilema.servicio.participacion.HistorialRespuestas;
import com.dilema.servicio.participacion.ProgresoParticipacion;
import com.dilema.servicio.participacion.ProxyParticipacion;
import com.dilema.servicio.participacion.RelojParticipacion;
import com.dilema.servicio.programacion.NotificadorConvocatoria;
import com.dilema.servicio.programacion.PadronConvocatoria;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final NotificadorConvocatoria notificador;
    /** Vínculos escenario-personaje: la novela del estudiante muestra a cada personaje solo en sus escenarios. */
    private final EscenarioPersonajeRepo vinculos;
    private final HistorialRespuestas historial = new HistorialRespuestas();
    private final ProxyParticipacion puerta = new ProxyParticipacion();

    public ParticipacionServicio(ParticipacionRepo participaciones, SesionRepo sesiones, PadronConvocatoria padron,
                                 ProxyOperacion proxy, Mapeador mapeador, BitacoraServicio bitacora) {
        this(participaciones, sesiones, padron, proxy, mapeador, bitacora, null, null);
    }

    @Autowired
    public ParticipacionServicio(ParticipacionRepo participaciones, SesionRepo sesiones, PadronConvocatoria padron,
                                 ProxyOperacion proxy, Mapeador mapeador, BitacoraServicio bitacora,
                                 NotificadorConvocatoria notificador, EscenarioPersonajeRepo vinculos) {
        this.participaciones = participaciones;
        this.sesiones = sesiones;
        this.padron = padron;
        this.proxy = proxy;
        this.mapeador = mapeador;
        this.bitacora = bitacora;
        this.notificador = notificador;
        this.vinculos = vinculos;
    }

    /**
     * RF-27: los avisos del panel son notificaciones guardadas. "Caso asignado" y
     * "Recordatorio de vencimiento" se registran una sola vez por sesión para tener id real.
     */
    @Transactional
    public Contratos.PanelEstudiante panel(Usuario estudiante) {
        proxy.participar(estudiante);
        List<SesionCaso> propias = sesiones.delEstudiante(estudiante.id);
        List<Contratos.SesionVista> sesionesVista = propias.stream().map(sesion -> {
            Participacion ultima = participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id).stream()
                    .max(Comparator.comparing(p -> p.id)).orElse(null);
            return mapeador.sesion(sesion, ultima, vinculosDe(sesion.caso));
        }).toList();
        for (SesionCaso sesion : propias) {
            bitacora.registrarUnaVez(estudiante, "sesion:" + sesion.id + ":asignado", "CORREO", "Caso asignado",
                    sesion.caso.nombre + ". " + (sesion.mensaje == null ? "" : sesion.mensaje), sesion.inicio);
            if (sesion.estado() == Catalogo.EstadoSesion.EN_CURSO) {
                bitacora.registrarUnaVez(estudiante, "sesion:" + sesion.id + ":recordatorio", "SISTEMA",
                        "Recordatorio de vencimiento",
                        "La convocatoria sigue en curso. Tiempo máximo: " + sesion.tiempoMaxMin + " minutos.",
                        sesion.inicioReal == null ? sesion.inicio : sesion.inicioReal);
            }
        }
        List<Contratos.Aviso> avisos = bitacora.avisosDe(estudiante).stream()
                .map(n -> new Contratos.Aviso(n.id, n.canal, n.titulo, n.cuerpo, n.leida,
                        n.fecha == null ? "" : n.fecha.toString()))
                .toList();
        int sinLeer = (int) avisos.stream().filter(a -> !a.leida()).count();
        return new Contratos.PanelEstudiante(sesionesVista, avisos, sinLeer);
    }

    @Transactional
    public void leerAviso(Usuario estudiante, Long id) {
        proxy.participar(estudiante);
        bitacora.marcarLeido(estudiante, id);
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
            throw new AccesoDenegado("Solo el docente que creó el caso puede autorizar otro intento.");
        }
        if (participacion.sesion.estado() != Catalogo.EstadoSesion.EN_CURSO) {
            throw new ReglaNegocio("No se puede autorizar otro intento porque la sesión no está en curso.");
        }
        if (!participacion.finalizada()) throw new ReglaNegocio("Solo se autoriza repetir un intento ya terminado.");
        Participacion ultima = participaciones.findByEstudianteIdAndSesionId(participacion.estudiante.id, participacion.sesion.id)
                .stream().max(Comparator.comparing(p -> p.id)).orElse(participacion);
        if (!ultima.id.equals(participacion.id)) {
            throw new ReglaNegocio("La autorización solo aplica al último intento de ese estudiante.");
        }
        if (participacion.autorizacion != null) {
            throw new ReglaNegocio("Ese intento ya tiene permiso para repetirse.");
        }
        AutorizacionRepeticion permiso = new AutorizacionRepeticion();
        permiso.participacion = participacion;
        permiso.fechaAutorizacion = LocalDateTime.now();
        participacion.autorizacion = permiso;
        if (notificador != null) notificador.repeticion(participacion.estudiante, participacion.sesion);
        bitacora.avisar(participacion.estudiante, "SISTEMA", "Repetición autorizada",
                "El docente autorizó un nuevo intento de " + participacion.sesion.caso.nombre + ".");
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
        if (usuario.rol == Catalogo.Rol.PROFESOR && participacion.sesion.grupo != null
                && participacion.sesion.grupo.esDirigidoPor(usuario)) return participacion;
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

    private List<EscenarioPersonaje> vinculosDe(Caso caso) {
        return vinculos == null ? List.of() : vinculos.findByCasoId(caso.id);
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
                BigDecimal puntaje = RetroalimentacionProxy.visible(participacion) ? participacion.puntajeDe(pregunta) : null;
                // El peso es de la rúbrica (no revela la opción correcta); al final se muestra "obtenido / peso".
                Double peso = pregunta.criterio == null || pregunta.criterio.peso == null ? null : pregunta.criterio.peso.doubleValue();
                preguntas.add(new Contratos.PreguntaJuego(pregunta.id, escenario.titulo, escenario.contexto,
                        pregunta.enunciado, pregunta.pista, criterio, seleccion, opciones,
                        puntaje == null ? null : puntaje.doubleValue(), escenario.orden, peso));
            }
        }
        LocalDateTime hasta = participacion.fin == null ? LocalDateTime.now() : participacion.fin;
        long usados = participacion.inicio == null ? 0 : Math.max(0, Duration.between(participacion.inicio, hasta).getSeconds());
        int total = preguntas.size();
        int progreso = ProgresoParticipacion.porcentaje(participacion, total);
        ResumenIntento resumen = ResumenIntento.de(participacion);
        Caso caso = participacion.sesion.caso;
        // Cada personaje solo en los escenarios donde el docente lo puso (EscenarioPersonaje), como en su vista previa.
        List<Contratos.PersonajeIn> personajes = caso.personajes == null ? List.of() : mapeador.personajes(caso, vinculosDe(caso));
        return new Contratos.ParticipacionVista(participacion.id, participacion.sesion.id, participacion.estadoNombre(),
                caso.nombre, progreso, total,
                participacion.sesion.tiempoMaxMin * 60, usados, participacion.nota(),
                participacion.comentarioDocente(), participacion.estudiante.nombre, preguntas,
                participacion.autorizacion != null,
                resumen == null ? null : resumen.aciertos(),
                resumen == null ? null : resumen.errores(),
                resumen == null ? null : resumen.sinResponder(),
                caso.id, caso.desarrolloSituacional, caso.contexto, personajes);
    }

    /** RF-14: delega en el Proxy de protección la decisión de revelar el resultado al estudiante. */
    class ProxyResultado {
        boolean revelar(Usuario usuario, Participacion participacion) {
            return usuario.rol != Catalogo.Rol.ESTUDIANTE || RetroalimentacionProxy.visible(participacion);
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

}
