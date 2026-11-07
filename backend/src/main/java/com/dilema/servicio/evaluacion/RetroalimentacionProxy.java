package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;

/**
 * Proxy de protección (RF-14): guarda la participación y consulta su estado antes de
 * delegar en la explicación real. Mientras el intento está en curso niega la explicación;
 * cuando ya finalizó o fue ausencia, delega en la explicación real. Quien pide la vista
 * del estudiante no sabe que pasa por este control.
 */
public class RetroalimentacionProxy implements Explicacion {
    private final Participacion participacion;
    private final Explicacion real;

    public RetroalimentacionProxy(Participacion participacion, Explicacion real) {
        this.participacion = participacion;
        this.real = real;
    }

    @Override
    public String mostrar() {
        if (!visible(participacion)) return null;
        return real == null ? null : real.mostrar();
    }

    /** RF-14: el resultado solo se revela cuando el intento terminó (finalizado o ausente). */
    public static boolean visible(Participacion participacion) {
        return participacion.finalizada() || participacion.ausente();
    }
}
