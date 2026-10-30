package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.servicio.ReglaNegocio;

import java.util.List;

/**
 * State (RF-09). Aquí está la única condición para llegar a Publicado.
 * Borrador y Archivado publican por este método. Ninguno repite el llamado a validar().
 */
public abstract class EstadoConPublicacion extends EstadoDeCaso {
    protected EstadoConPublicacion(UsoDelCaso uso) {
        super(uso);
    }

    /**
     * Publica el caso si validar() no devuelve errores de estructura ni de rúbrica.
     * Si hay errores, lanza la regla y el caso permanece en su estado actual.
     */
    protected final void pasarAPublicado(Caso caso) {
        List<String> errores = uso().validar(caso);
        if (!errores.isEmpty()) {
            throw new ReglaNegocio("RF-09: no se puede publicar. " + String.join(" ", errores));
        }
        caso.cambiarEstado(new Publicado(uso()));
    }
}
