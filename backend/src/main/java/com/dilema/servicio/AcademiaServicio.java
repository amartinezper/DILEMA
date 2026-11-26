package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.repo.UsuarioRepo;
import com.dilema.servicio.programacion.CierrePorDocente;
import com.dilema.servicio.programacion.CierrePorFecha;
import com.dilema.servicio.programacion.EstadosDeSesion;
import com.dilema.servicio.programacion.FachadaAgendamiento;
import com.dilema.servicio.programacion.NotificadorConvocatoria;
import com.dilema.servicio.programacion.PadronConvocatoria;
import com.dilema.tiempo.Hora;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Módulo 4. Orquesta espacio académico, padrón, estados de sesión y convocatoria.
 * El agendamiento complejo vive en {@link FachadaAgendamiento}.
 */
@Service
public class AcademiaServicio {
    private final GrupoRepo grupos;
    private final SesionRepo sesiones;
    private final UsuarioRepo usuarios;
    private final ParticipacionRepo participaciones;
    private final ParticipacionServicio participacionServicio;
    private final ProxyOperacion proxy;
    private final BitacoraServicio bitacora;
    private final Mapeador mapeador;
    private final NotificadorConvocatoria notificador;
    private final PadronConvocatoria padron;
    private final FachadaAgendamiento fachada;

    public AcademiaServicio(GrupoRepo grupos, SesionRepo sesiones, UsuarioRepo usuarios,
                            ParticipacionRepo participaciones, ParticipacionServicio participacionServicio,
                            ProxyOperacion proxy, BitacoraServicio bitacora, Mapeador mapeador,
                            NotificadorConvocatoria notificador, PadronConvocatoria padron,
                            FachadaAgendamiento fachada) {
        this.grupos = grupos;
        this.sesiones = sesiones;
        this.usuarios = usuarios;
        this.participaciones = participaciones;
        this.participacionServicio = participacionServicio;
        this.proxy = proxy;
        this.bitacora = bitacora;
        this.mapeador = mapeador;
        this.notificador = notificador;
        this.padron = padron;
        this.fachada = fachada;
    }

    @Transactional(readOnly = true)
    public List<Contratos.GrupoVista> listarGrupos(Usuario docente) {
        proxy.revisarGrupo(docente);
        return grupos.findByDocenteId(docente.id).stream().map(mapeador::grupo).toList();
    }

    @Transactional
    public Contratos.GrupoVista crearGrupo(Usuario docente, Contratos.GrupoIn entrada) {
        proxy.gestionarEspacio(docente);
        if (entrada.nombre() == null || entrada.nombre().isBlank() || entrada.espacioAcademico() == null || entrada.espacioAcademico().isBlank()) {
            throw new ReglaNegocio("El grupo necesita nombre y semestre.");
        }
        Grupo grupo = new Grupo();
        grupo.nombre = entrada.nombre().trim();
        grupo.semestre = entrada.espacioAcademico().trim();
        grupo.docente = docente;
        grupos.save(grupo);
        bitacora.auditar(docente, "CREAR_GRUPO", grupo.nombre);
        return mapeador.grupo(grupo);
    }

    @Transactional
    public Contratos.GrupoVista editarGrupo(Usuario docente, Long id, Contratos.GrupoIn entrada) {
        proxy.gestionarEspacio(docente);
        if (entrada.nombre() == null || entrada.nombre().isBlank() || entrada.espacioAcademico() == null || entrada.espacioAcademico().isBlank()) {
            throw new ReglaNegocio("El grupo necesita nombre y semestre.");
        }
        Grupo grupo = propio(docente, id);
        grupo.nombre = entrada.nombre().trim();
        grupo.semestre = entrada.espacioAcademico().trim();
        bitacora.auditar(docente, "EDITAR_GRUPO", grupo.nombre);
        return mapeador.grupo(grupo);
    }

    @Transactional
    public void borrarGrupo(Usuario docente, Long id) {
        proxy.gestionarEspacio(docente);
        Grupo grupo = propio(docente, id);
        List<SesionCaso> convocatorias = sesiones.findByGrupo_Id(grupo.id);
        for (SesionCaso sesion : convocatorias) {
            if (sesion.estado() == Catalogo.EstadoSesion.EN_CURSO) {
                throw new ReglaNegocio("No se puede borrar un grupo con una sesión en curso.");
            }
            if (sesion.estado() == Catalogo.EstadoSesion.FINALIZADO) {
                throw new ReglaNegocio("No se puede borrar un grupo con convocatorias ya cerradas.");
            }
        }
        for (SesionCaso sesion : convocatorias) {
            padron.vaciar(sesion);
            sesiones.delete(sesion);
        }
        grupos.delete(grupo);
        bitacora.auditar(docente, "BORRAR_GRUPO", grupo.nombre);
    }

    @Transactional
    public Contratos.GrupoVista agregarEstudiante(Usuario docente, Long grupoId, String email) {
        proxy.gestionarEspacio(docente);
        Grupo grupo = propio(docente, grupoId);
        String correo = email == null ? "" : email.trim().toLowerCase();
        if (!correo.contains("@") || correo.length() < 5) {
            throw new ReglaNegocio("Indica un correo institucional válido.");
        }
        Usuario encontrado = usuarios.findByEmailIgnoreCase(correo).orElse(null);
        if (encontrado == null) {
            throw new ReglaNegocio("Ese estudiante no está dado de alta. La administración debe matricularlo.");
        }
        if (encontrado.rol != Catalogo.Rol.ESTUDIANTE) {
            throw new ReglaNegocio("Ese correo pertenece a otra cuenta.");
        }
        if (!encontrado.activo) {
            throw new ReglaNegocio("Esa cuenta de estudiante está inactiva.");
        }
        Usuario estudiante = encontrado;
        if (grupo.pertenece(estudiante)) throw new ReglaNegocio("El estudiante ya está en el grupo.");
        grupo.estudiantes.add(estudiante);
        List<SesionCaso> abiertas = sesiones.findByGrupo_IdAndCierreRealIsNull(grupo.id);
        if (abiertas.isEmpty()) {
            notificador.agregadoSinSesion(estudiante, grupo);
        } else {
            for (SesionCaso sesion : abiertas) {
                padron.incluir(sesion, estudiante);
                notificador.convocado(estudiante, sesion);
            }
        }
        bitacora.auditar(docente, "AGREGAR_ESTUDIANTE", estudiante.email);
        return mapeador.grupo(grupo);
    }

    @Transactional(readOnly = true)
    public List<Contratos.PersonaVista> estudiantesActivos(Usuario docente) {
        proxy.gestionarEspacio(docente);
        return usuarios.findByRol(Catalogo.Rol.ESTUDIANTE).stream()
                .filter(estudiante -> estudiante.activo)
                .map(mapeador::persona)
                .toList();
    }

    @Transactional
    public Contratos.GrupoVista retirarEstudiante(Usuario docente, Long grupoId, Long estudianteId) {
        proxy.gestionarEspacio(docente);
        Grupo grupo = propio(docente, grupoId);
        Usuario estudiante = grupo.estudiantes.stream().filter(e -> e.id.equals(estudianteId)).findFirst()
                .orElseThrow(() -> new NoEncontrado("El estudiante no está en el grupo."));
        grupo.estudiantes.remove(estudiante);
        for (SesionCaso sesion : sesiones.findByGrupo_IdAndCierreRealIsNull(grupo.id)) {
            padron.excluir(sesion, estudiante);
        }
        notificador.retirado(estudiante, grupo);
        bitacora.auditar(docente, "RETIRAR_ESTUDIANTE", estudiante.email);
        return mapeador.grupo(grupo);
    }

    @Transactional
    public Contratos.SesionVista agendar(Usuario docente, Contratos.AgendaIn entrada) {
        proxy.revisarGrupo(docente);
        return fachada.agendar(docente, entrada);
    }

    @Transactional(readOnly = true)
    public List<Contratos.SesionVista> sesionesDocente(Usuario docente) {
        proxy.revisarGrupo(docente);
        return sesiones.findByGrupo_Docente_IdOrderByIdDesc(docente.id).stream().map(mapeador::sesion).toList();
    }

    @Transactional
    public Contratos.SesionVista reprogramar(Usuario docente, Long id, Contratos.AgendaIn entrada) {
        proxy.revisarGrupo(docente);
        return fachada.reprogramar(docente, id, entrada);
    }

    @Transactional
    public Contratos.SesionVista iniciar(Usuario docente, Long id) {
        proxy.revisarGrupo(docente);
        SesionCaso sesion = propia(docente, id);
        EstadosDeSesion.de(sesion).iniciar(sesion);
        avisarConvocados(sesion, true);
        bitacora.auditar(docente, "INICIAR_SESION", sesion.codigo);
        return mapeador.sesion(sesion);
    }

    @Transactional
    public Contratos.SesionVista finalizar(Usuario docente, Long id) {
        proxy.revisarGrupo(docente);
        SesionCaso sesion = propia(docente, id);
        new CierrePorDocente(participacionServicio, participaciones, bitacora).cerrar(sesion, citados(sesion));
        avisarConvocados(sesion, false);
        bitacora.auditar(docente, "FINALIZAR_SESION", sesion.codigo);
        return mapeador.sesion(sesion);
    }

    @Transactional
    public void cerrarVencidas() {
        LocalDateTime ahora = Hora.ahora();
        for (SesionCaso sesion : sesiones.findByCierreRealIsNull()) {
            if (EstadosDeSesion.vencioPlazoDeCierre(sesion, ahora)) {
                new CierrePorFecha(participacionServicio, participaciones, bitacora).cerrar(sesion, citados(sesion));
                avisarConvocados(sesion, false);
            }
        }
    }

    private void avisarConvocados(SesionCaso sesion, boolean inicio) {
        for (Usuario estudiante : citados(sesion)) {
            if (inicio) notificador.sesionIniciada(estudiante, sesion);
            else notificador.sesionCerrada(estudiante, sesion);
        }
    }

    private List<Usuario> citados(SesionCaso sesion) {
        List<Usuario> lista = padron.convocados(sesion);
        return lista == null ? List.of() : lista;
    }

    private Grupo propio(Usuario docente, Long id) {
        Grupo grupo = grupos.findById(id).orElseThrow(() -> new NoEncontrado("Grupo no encontrado."));
        if (!grupo.esDirigidoPor(docente)) throw new AccesoDenegado("El grupo no está a tu cargo.");
        return grupo;
    }

    private SesionCaso propia(Usuario docente, Long id) {
        SesionCaso sesion = sesiones.findById(id).orElseThrow(() -> new NoEncontrado("Sesión no encontrada."));
        if (!sesion.grupo.esDirigidoPor(docente)) throw new AccesoDenegado("La sesión no está a tu cargo.");
        return sesion;
    }
}
