package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorTiempoMaximo extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.tiempoMaxMin() <= 0) {
            throw new ReglaNegocio("El tiempo máximo de la sesión tiene que ser mayor que cero.");
        }
        if (c.caso() != null && c.caso().tiempoEstimadoMin != null && c.tiempoMaxMin() > c.caso().tiempoEstimadoMin) {
            throw new ReglaNegocio("El tiempo de la sesión no puede ser mayor que el tiempo estimado del caso.");
        }
    }
}
