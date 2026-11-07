package com.dilema.servicio.seguimiento;

import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import java.io.ByteArrayOutputStream;

/** Strategy (RF-16). El mismo contenido del CSV, en una tabla PDF. */
public final class ExportadorPDF implements FormatoReporte {
    @Override
    public ArchivoReporte exportar(DatosReporte datos) {
        try {
            Document documento = new Document();
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            PdfWriter.getInstance(documento, salida);
            documento.open();
            documento.add(new Paragraph(datos.nombreCaso() + " — " + datos.nombreGrupo()));
            PdfPTable tabla = new PdfPTable(7);
            tabla.setWidthPercentage(100);
            for (String columna : ExportadorCSV.ENCABEZADO.split(",")) tabla.addCell(columna);
            for (LineaReporte linea : datos.lineas()) {
                tabla.addCell(linea.estudiante() == null ? "" : linea.estudiante());
                tabla.addCell(linea.estado().name());
                tabla.addCell(linea.puntaje().toPlainString());
                tabla.addCell(Integer.toString(linea.aciertos()));
                tabla.addCell(Integer.toString(linea.totalPreguntas()));
                tabla.addCell(linea.nivel().name());
                tabla.addCell(linea.valoracionGeneral() == null ? "" : linea.valoracionGeneral());
            }
            documento.add(tabla);
            documento.close();
            return new ArchivoReporte(salida.toByteArray(), extension());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("RF-16: no se pudo escribir el PDF.", e);
        }
    }

    @Override
    public String extension() {
        return "pdf";
    }
}
