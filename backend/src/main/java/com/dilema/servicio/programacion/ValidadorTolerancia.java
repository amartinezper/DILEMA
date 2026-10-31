package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorTolerancia extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.toleranciaMin() < 0) {
            throw new ReglaNegocio("INV-18: la tolerancia no puede ser negativa.");
        }
    }
}
