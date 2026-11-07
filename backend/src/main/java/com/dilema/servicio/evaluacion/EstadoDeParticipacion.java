package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.servicio.BitacoraServicio;

/**
 * State (RF-26): decide si la participación admite la valoración general del docente.
 * La participación delega esta operación en su estado actual (en curso o finalizada);
 * no implementa el resto del comportamiento de estado de la participación (RF-23),
 * que pertenece al Módulo 5.
 */
public interface EstadoDeParticipacion {
    void agregarRetroalimentacionGeneral(Participacion participacion, String texto);

    /** RF-26 / INV-30: la valoración general solo se admite si la participación finalizó. */
    static EstadoDeParticipacion de(Participacion participacion, BitacoraServicio bitacora) {
        return participacion.finalizada() ? new ParticipacionFinalizada(bitacora) : new ParticipacionEnCurso();
    }
}
