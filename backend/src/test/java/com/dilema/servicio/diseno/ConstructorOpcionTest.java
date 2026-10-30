package com.dilema.servicio.diseno;

import com.dilema.modelo.Opcion;
import com.dilema.modelo.Pregunta;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pruebas unitarias de RF-08. Guardan la explicación y el fundamento por separado,
 * en memoria y sin base de datos ni Spring.
 * Si {@code explicar} los uniera en un solo texto, la prueba del campo fundamento fallaría.
 * El borrador puede dejar el fundamento vacío. El resultado terminado no.
 */
class ConstructorOpcionTest {

    @Test
    @DisplayName("explicar deja el mensaje y el fundamento en campos distintos")
    void explicarSeparaMensajeYFundamento() {
        Opcion opcion = new ConstructorOpcionCorrecta()
                .texto("Presentarte")
                .explicar("  Reconoce  ", "  Consentimiento  ")
                .obtenerBorrador(new Pregunta());

        assertTrue(opcion.esCorrecta);
        assertEquals("Presentarte", opcion.descripcion);
        assertEquals("Reconoce", opcion.retroalimentacion.explicacion);
        assertEquals("Consentimiento", opcion.retroalimentacion.fundamento);
    }

    @Test
    @DisplayName("la variante incorrecta no marca la opción como correcta")
    void varianteIncorrectaNoMarcaCorrecta() {
        Opcion opcion = new ConstructorOpcionIncorrecta()
                .texto("Instruir")
                .explicar("Desplaza", "Sin permiso")
                .obtenerBorrador(new Pregunta());

        assertFalse(opcion.esCorrecta);
        assertEquals("Desplaza", opcion.retroalimentacion.explicacion);
        assertEquals("Sin permiso", opcion.retroalimentacion.fundamento);
    }

    @Test
    @DisplayName("el borrador puede omitir el fundamento y el resultado terminado no")
    void borradorOmiteFundamentoYResultadoNo() {
        ConstructorOpcion constructor = new ConstructorOpcionIncorrecta().texto("Instruir").explicar("Desplaza", "");
        Pregunta pregunta = new Pregunta();

        Opcion borrador = constructor.obtenerBorrador(pregunta);
        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> constructor.obtenerResultado(pregunta));

        assertEquals("Cada opción necesita texto, la explicación y el fundamento.", error.getMessage());
        assertEquals("", borrador.retroalimentacion.fundamento);
    }
}
