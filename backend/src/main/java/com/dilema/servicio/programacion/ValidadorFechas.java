package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorFechas extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.fin() == null || c.inicio() == null || !c.fin().isAfter(c.inicio())) {
            throw new ReglaNegocio("INV-18: el fin debe ser posterior al inicio.");
        }
    }
}
