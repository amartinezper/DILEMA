package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorGrupoDelProfesor extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.grupo() == null || !c.grupo().esDirigidoPor(c.docente())) {
            throw new ReglaNegocio("Solo puedes programar una sesión en un grupo que esté a tu cargo.");
        }
        if (c.grupo().estudiantes.isEmpty()) {
            throw new ReglaNegocio("Agrega al menos un estudiante al grupo antes de programar la sesión.");
        }
    }
}
