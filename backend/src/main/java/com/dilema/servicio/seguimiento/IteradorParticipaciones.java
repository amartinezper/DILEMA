package com.dilema.servicio.seguimiento;

import com.dilema.modelo.Participacion;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Iterator (RF-15). Recorre las participaciones de una sesión, intento por intento.
 * Un recorrido distinto (solo ausentes, por nivel) sería otra clase; esta no se toca.
 */
public final class IteradorParticipaciones implements Iterador<Participacion> {
    private final List<Participacion> participaciones;
    private int posicion;

    public IteradorParticipaciones(List<Participacion> participaciones) {
        this.participaciones = new ArrayList<>();
        if (participaciones != null) {
            for (Participacion participacion : participaciones) {
                if (participacion != null) this.participaciones.add(participacion);
            }
        }
        this.participaciones.sort(Comparator
                .comparing((Participacion p) -> p.estudiante == null || p.estudiante.nombre == null ? "" : p.estudiante.nombre)
                .thenComparingInt(p -> p.numeroIntento)
                .thenComparing(p -> p.id == null ? Long.MAX_VALUE : p.id));
    }

    @Override
    public boolean haySiguiente() {
        return posicion < participaciones.size();
    }

    @Override
    public Participacion siguiente() {
        if (!haySiguiente()) {
            throw new NoSuchElementException("RF-15: no hay más participaciones en el recorrido.");
        }
        return participaciones.get(posicion++);
    }

    @Override
    public void reiniciar() {
        posicion = 0;
    }
}
