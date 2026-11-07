package com.dilema.servicio.seguimiento;

/** RF-16. El archivo ya exportado y la extensión que le corresponde. */
public record ArchivoReporte(byte[] contenido, String extension) {}
