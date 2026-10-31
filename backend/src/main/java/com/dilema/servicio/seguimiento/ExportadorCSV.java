package com.dilema.servicio.seguimiento;

import java.nio.charset.StandardCharsets;

/** Strategy (RF-16). CSV de una fila por intento, sin librería adicional. */
public final class ExportadorCSV implements FormatoReporte {
    static final String ENCABEZADO = "estudiante,estado,puntaje,aciertos,totalPreguntas,nivel,valoracionGeneral";

    @Override
    public ArchivoReporte exportar(DatosReporte datos) {
        StringBuilder csv = new StringBuilder();
        csv.append('\uFEFF').append(ENCABEZADO).append('\n');
        for (LineaReporte linea : datos.lineas()) {
            csv.append(texto(linea.estudiante())).append(',')
                    .append(linea.estado().name()).append(',')
                    .append(linea.puntaje().toPlainString()).append(',')
                    .append(linea.aciertos()).append(',')
                    .append(linea.totalPreguntas()).append(',')
                    .append(linea.nivel().name()).append(',')
                    .append(texto(linea.valoracionGeneral()))
                    .append('\n');
        }
        return new ArchivoReporte(csv.toString().getBytes(StandardCharsets.UTF_8), extension());
    }

    @Override
    public String extension() {
        return "csv";
    }

    private String texto(String valor) {
        if (valor == null) return "";
        return "\"" + valor.replace("\"", "'") + "\"";
    }
}
