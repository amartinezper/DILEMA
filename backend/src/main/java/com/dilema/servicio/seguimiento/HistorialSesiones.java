package com.dilema.servicio.seguimiento;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;

import java.util.ArrayList;
import java.util.List;

/**
 * Iterator (RF-15). Guarda las sesiones finalizadas de los grupos que dirige el profesor
 * (INV-22) y entrega un iterador para recorrerlas. El caso ya realizado es esa sesión.
 */
public final class HistorialSesiones {
    private final List<SesionCaso> sesionesFinalizadas;

    public HistorialSesiones(Usuario profesor, List<SesionCaso> sesiones) {
        this.sesionesFinalizadas = new ArrayList<>();
        if (sesiones == null) return;
        for (SesionCaso sesion : sesiones) {
            if (sesion == null || sesion.grupo == null) continue;
            if (sesion.estado() != Catalogo.EstadoSesion.FINALIZADO) continue;
            if (!sesion.grupo.esDirigidoPor(profesor)) continue;
            sesionesFinalizadas.add(sesion);
        }
    }

    public Iterador<SesionCaso> crearIterador() {
        return new IteradorSesiones(sesionesFinalizadas);
    }
}
