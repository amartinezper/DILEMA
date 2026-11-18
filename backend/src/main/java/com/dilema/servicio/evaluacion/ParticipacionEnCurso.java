package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.servicio.ReglaNegocio;

/** State (RF-26) / INV-30: mientras el intento está en curso no admite valoración general. */
public class ParticipacionEnCurso implements EstadoDeParticipacion {
    @Override
    public void agregarRetroalimentacionGeneral(Participacion participacion, String texto) {
        throw new ReglaNegocio("La valoración del docente se escribe cuando el estudiante ya terminó el intento.");
    }
}
