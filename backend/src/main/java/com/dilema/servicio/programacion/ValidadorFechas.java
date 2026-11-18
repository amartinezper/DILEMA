package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorFechas extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.fin() == null || c.inicio() == null || !c.fin().isAfter(c.inicio())) {
            throw new ReglaNegocio("La hora de cierre tiene que ser posterior a la hora de inicio.");
        }
    }
}
