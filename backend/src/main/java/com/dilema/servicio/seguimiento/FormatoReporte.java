package com.dilema.servicio.seguimiento;

/**
 * Strategy (RF-16). Cada formato recibe los mismos datos y solo cambia
 * cómo los convierte en archivo. Agregar un formato no toca el generador.
 */
public interface FormatoReporte {
    ArchivoReporte exportar(DatosReporte datos);

    String extension();
}
