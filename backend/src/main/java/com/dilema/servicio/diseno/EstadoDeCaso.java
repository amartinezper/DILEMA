package com.dilema.servicio.diseno;

import com.dilema.modelo.EstadoDelCaso;

/**
 * Base de los tres estados. Solo guarda el acceso a la validación y a las sesiones.
 * No decide transiciones: eso queda en Borrador, Publicado y Archivado.
 */
abstract class EstadoDeCaso implements EstadoDelCaso {
    private final UsoDelCaso uso;

    protected EstadoDeCaso(UsoDelCaso uso) {
        this.uso = uso;
    }

    protected final UsoDelCaso uso() {
        return uso;
    }
}
