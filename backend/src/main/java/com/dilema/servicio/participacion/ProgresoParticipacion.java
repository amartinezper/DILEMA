package com.dilema.servicio.participacion;

import com.dilema.modelo.Participacion;

/** Observer / cálculo de RF-11: el avance sale de las respuestas registradas. */
public final class ProgresoParticipacion {
    private ProgresoParticipacion() {}

    public static int porcentaje(Participacion participacion, int total) {
        if (total <= 0) return 0;
        return (int) Math.round(participacion.respuestas.size() * 100.0 / total);
    }
}
