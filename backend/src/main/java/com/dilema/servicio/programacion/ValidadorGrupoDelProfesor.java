package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

public class ValidadorGrupoDelProfesor extends PasoAgenda {
    @Override
    protected void comprobar(ContextoAgenda c) {
        if (c.grupo() == null || !c.grupo().esDirigidoPor(c.docente())) {
            throw new ReglaNegocio("INV-17: el grupo debe estar a cargo del docente.");
        }
        if (c.grupo().estudiantes.isEmpty()) {
            throw new ReglaNegocio("RF-04: asocia al menos un estudiante autorizado.");
        }
    }
}
