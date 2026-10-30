package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Pregunta;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Pruebas unitarias de RF-07. Eligen el constructor con pista o sin ella en memoria,
 * sin base de datos ni Spring.
 * Una pista en blanco no se guarda: equivale a no haber pista.
 * El enunciado vacío se acepta en el borrador y se rechaza cuando la pregunta se trata como terminada.
 */
class AsistenteDePreguntasTest {
    private final AsistenteDePreguntas asistente = new AsistenteDePreguntas();

    @Test
    @DisplayName("con pista y sin pista dejan resultados distintos")
    void conPistaYSinPistaDejanResultadosDistintos() {
        Pregunta conPista = asistente.construir(new Caso(), new Escenario(), pregunta("¿Cómo abres?", "Pide permiso"), 0);
        Pregunta sinPista = asistente.construir(new Caso(), new Escenario(), pregunta("¿Cómo abres?", "  "), 1);

        assertEquals("Pide permiso", conPista.pista);
        assertNull(sinPista.pista);
        assertEquals(0, conPista.orden);
        assertEquals(1, sinPista.orden);
    }

    @Test
    @DisplayName("el borrador admite el enunciado vacío")
    void borradorAdmiteEnunciadoVacio() {
        Pregunta pregunta = asistente.construir(new Caso(), new Escenario(), pregunta("", null), 0);

        assertEquals("", pregunta.enunciado);
        assertNull(pregunta.pista);
    }

    @Test
    @DisplayName("una pregunta terminada rechaza el enunciado vacío")
    void resultadoRechazaEnunciadoVacio() {
        ConstructorPregunta constructor = new ConstructorPreguntaSinPista();
        constructor.enunciado("");

        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> constructor.obtenerResultado(new Caso(), new Escenario(), 0));

        assertEquals("La pregunta necesita enunciado, al menos dos opciones y una sola correcta.", error.getMessage());
    }

    private static Contratos.PreguntaIn pregunta(String enunciado, String pista) {
        Contratos.OpcionIn correcta = new Contratos.OpcionIn(null, "Presentarte", true, "Reconoce", "Consentimiento");
        Contratos.OpcionIn incorrecta = new Contratos.OpcionIn(null, "Instruir", false, "Desplaza", "Sin permiso");
        return new Contratos.PreguntaIn(null, enunciado, pista, "Encuadre", 5.0, List.of(correcta, incorrecta));
    }
}
