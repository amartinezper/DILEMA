package com.dilema.servicio.seguimiento;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;

import java.awt.Color;
import java.io.ByteArrayOutputStream;

/** Strategy (RF-16). Los mismos datos del reporte, en una tabla PDF con título y encabezado. */
public final class ExportadorPDF implements FormatoReporte {
    private static final Color TINTA = new Color(27, 36, 55);
    private static final Color ENCABEZADO = new Color(37, 55, 90);
    private static final Font TITULO = new Font(Font.HELVETICA, 16, Font.BOLD, TINTA);
    private static final Font SUBTITULO = new Font(Font.HELVETICA, 10, Font.NORMAL, new Color(71, 85, 105));
    private static final Font COLUMNA = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
    private static final Font DATO = new Font(Font.HELVETICA, 9, Font.NORMAL, TINTA);

    @Override
    public ArchivoReporte exportar(DatosReporte datos) {
        try {
            Document documento = new Document(PageSize.A4.rotate(), 36, 36, 40, 36);
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            PdfWriter.getInstance(documento, salida);
            documento.open();
            documento.add(new Paragraph(PresentacionReporte.titulo(datos), TITULO));
            documento.add(new Paragraph(PresentacionReporte.periodo(datos), SUBTITULO));
            documento.add(new Paragraph(" "));
            documento.add(tabla(datos));
            documento.close();
            return new ArchivoReporte(salida.toByteArray(), extension());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo generar el PDF. Inténtalo de nuevo.", e);
        }
    }

    @Override
    public String extension() {
        return "pdf";
    }

    private PdfPTable tabla(DatosReporte datos) {
        PdfPTable tabla = new PdfPTable(new float[] {22, 12, 10, 10, 14, 12, 20});
        tabla.setWidthPercentage(100);
        tabla.setHeaderRows(1);
        tabla.setSpacingBefore(8);
        for (String columna : ColumnasReporte.NOMBRES) {
            tabla.addCell(encabezado(columna));
        }
        for (LineaReporte linea : datos.lineas()) {
            for (String valor : PresentacionReporte.valores(linea)) {
                tabla.addCell(dato(valor));
            }
        }
        return tabla;
    }

    private PdfPCell encabezado(String texto) {
        PdfPCell celda = new PdfPCell(new Phrase(texto, COLUMNA));
        celda.setBackgroundColor(ENCABEZADO);
        celda.setPadding(7);
        celda.setBorderColor(ENCABEZADO);
        celda.setHorizontalAlignment(Element.ALIGN_LEFT);
        return celda;
    }

    private PdfPCell dato(String texto) {
        PdfPCell celda = new PdfPCell(new Phrase(texto, DATO));
        celda.setPadding(6);
        celda.setBorderColor(new Color(226, 232, 240));
        return celda;
    }
}
