package com.dilema.servicio.diseno;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.EstadoDelCaso;
import com.dilema.servicio.ReglaNegocio;

/**
 * Arma el objeto de estado a partir del enum guardado en la base.
 * Este recorrido solo elige la clase. Las reglas de publicar, despublicar
 * y archivar están dentro de cada estado, no aquí.
 */
public final class EstadosDelCaso {
    private EstadosDelCaso() {}

    public static EstadoDelCaso de(Catalogo.EstadoCaso estado, UsoDelCaso uso) {
        if (estado == null || uso == null) {
            throw new ReglaNegocio("RF-09: no se puede resolver el estado del caso.");
        }
        return switch (estado) {
            case BORRADOR -> new Borrador(uso);
            case PUBLICADO -> new Publicado(uso);
            case ARCHIVADO -> new Archivado(uso);
        };
    }
}
