package com.dilema.servicio.programacion;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.servicio.ParticipacionServicio;
import com.dilema.servicio.evaluacion.CalificacionParcial;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Template Method (RF-24, disparado por RF-19): cierra incompletos y registra ausencias en 0,0.
 */
public abstract class CierreSesion {
    private final ParticipacionServicio participacionesSrv;
    private final ParticipacionRepo participaciones;

    protected CierreSesion(ParticipacionServicio participacionesSrv, ParticipacionRepo participaciones) {
        this.participacionesSrv = participacionesSrv;
        this.participaciones = participaciones;
    }

    public final void cerrar(SesionCaso sesion) {
        if (!puedeCerrar(sesion)) return;
        if (sesion.estado() == Catalogo.EstadoSesion.FINALIZADO) return;
        for (Usuario estudiante : new ArrayList<>(sesion.grupo.estudiantes)) {
            List<Participacion> propias = participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id);
            Participacion enCurso = propias.stream().filter(Participacion::enCurso).findFirst().orElse(null);
            if (enCurso != null) {
                participacionesSrv.cerrarPorTiempo(enCurso);
            } else if (propias.stream().noneMatch(p -> p.finalizada() || p.ausente())) {
                Participacion ausencia = new Participacion();
                ausencia.estudiante = estudiante;
                ausencia.sesion = sesion;
                ausencia.casoId = sesion.caso.id;
                ausencia.numeroIntento = 1;
                ausencia.fijarNota(new CalificacionParcial().calcularPuntaje(ausencia));
                participaciones.save(ausencia);
            }
        }
        sesion.cierreReal = LocalDateTime.now();
    }

    protected abstract boolean puedeCerrar(SesionCaso sesion);
}
