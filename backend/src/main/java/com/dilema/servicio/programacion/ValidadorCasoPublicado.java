package com.dilema.servicio.programacion;

import com.dilema.modelo.Catalogo;
import com.dilema.servicio.ReglaNegocio;

public class ValidadorCasoPublicado extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.caso() == null || c.caso().estado != Catalogo.EstadoCaso.PUBLICADO) {
            throw new ReglaNegocio("INV-17: el caso debe estar publicado para agendarlo.");
        }
    }
}
