package com.dilema.servicio.evaluacion;

/**
 * Proxy de protección (RF-14): contrato común entre la explicación real de una opción
 * y el proxy que controla cuándo se puede mostrar.
 */
public interface Explicacion {
    String mostrar();
}
