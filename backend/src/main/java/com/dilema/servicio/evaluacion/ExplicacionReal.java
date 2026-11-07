package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Retroalimentacion;

/** Proxy de protección (RF-14): expone el texto real de la retroalimentación de una opción. */
public class ExplicacionReal implements Explicacion {
    private final Retroalimentacion retroalimentacion;

    public ExplicacionReal(Retroalimentacion retroalimentacion) {
        this.retroalimentacion = retroalimentacion;
    }

    @Override
    public String mostrar() {
        return retroalimentacion == null ? null : retroalimentacion.explicacion;
    }
}
