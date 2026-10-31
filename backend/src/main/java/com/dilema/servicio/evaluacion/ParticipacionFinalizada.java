package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.RetroalimentacionDocente;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.ReglaNegocio;

/**
 * State (RF-26): la participación finalizada admite la valoración general del docente,
 * la guarda en RetroalimentacionDocente y avisa al estudiante dentro del sistema (RF-27).
 */
public class ParticipacionFinalizada implements EstadoDeParticipacion {
    private final BitacoraServicio bitacora;

    public ParticipacionFinalizada(BitacoraServicio bitacora) {
        this.bitacora = bitacora;
    }

    @Override
    public void agregarRetroalimentacionGeneral(Participacion participacion, String texto) {
        if (texto == null || texto.isBlank()) throw new ReglaNegocio("Escribe la valoración general.");
        if (participacion.retroalimentacionDocente == null) {
            RetroalimentacionDocente comentario = new RetroalimentacionDocente();
            comentario.participacion = participacion;
            participacion.retroalimentacionDocente = comentario;
        }
        participacion.retroalimentacionDocente.comentario = texto.trim();

        SujetoNotificador sujeto = new SujetoNotificador();
        sujeto.agregar(new ObservadorEstudiante(participacion.estudiante, bitacora));
        sujeto.notificar("RETROALIMENTACION_AGREGADA", participacion.retroalimentacionDocente.comentario, "SISTEMA");
    }
}
