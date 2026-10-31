package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;

import java.util.function.Predicate;

/**
 * Factory Method (RF-20). {@code emitir} fija unicidad y vigencia;
 * {@code crear} deja el formato a la subclase.
 */
public abstract class FabricaCodigo {
    public String emitir(Predicate<String> yaExiste) {
        for (int i = 0; i < 8; i++) {
            String codigo = crear();
            if (!yaExiste.test(codigo)) return codigo;
        }
        throw new ReglaNegocio("No fue posible emitir un código único.");
    }

    protected abstract String crear();
}
