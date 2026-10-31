package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorTiempoMaximo extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.tiempoMaxMin() <= 0) {
            throw new ReglaNegocio("INV-18: el tiempo máximo debe ser mayor que cero.");
        }
        if (c.caso() != null && c.caso().tiempoEstimadoMin != null && c.tiempoMaxMin() > c.caso().tiempoEstimadoMin) {
            throw new ReglaNegocio("RF-18: el tiempo máximo no puede superar el estimado del caso.");
        }
    }
}
