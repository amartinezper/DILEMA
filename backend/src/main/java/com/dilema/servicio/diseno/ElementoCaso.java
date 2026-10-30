package com.dilema.servicio.diseno;

import java.util.List;

/**
 * Composite (RF-06). Caso, escenario y pregunta son compuestos; la opción es la hoja.
 * {@code validar} acumula los errores de esa rama y de sus hijos.
 * {@code presentar} describe la rama para leerla. {@code esCompleto} mira solo esa rama,
 * no a sus ancestros: una pregunta puede estar incompleta aunque el caso ya tenga nombre.
 * Las listas del modelo siguen siendo Escenario, Pregunta y Opcion.
 */
public interface ElementoCaso {
    void validar(List<String> errores);

    String presentar();

    boolean esCompleto();
}
