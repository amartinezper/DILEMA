package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pruebas unitarias de RF-17. Reparten la rúbrica en memoria,
 * sin base de datos ni Spring.
 * Con tres preguntas la equitativa no puede dejar tres partes iguales, porque 5,0 no se divide en tercios de un decimal.
 * La última absorbe el resto. Fuera de borrador no se escribe ningún criterio.
 */
class ConstructorRubricaTest {
    private final DirectorCaso director = new DirectorCaso();

    @Test
    @DisplayName("la equitativa con tres preguntas deja 1,6, 1,6 y 1,8")
    void equitativaConTresPreguntasAjustaLaUltima() {
        Caso caso = director.construirNuevo(docente(), entrada("EQUITATIVA", List.of(
                pregunta("Encuadre", 0.0), pregunta("Turno", 0.0), pregunta("Cierre", 0.0))));

        List<Pregunta> preguntas = caso.escenarios.get(0).preguntas;
        assertEquals(0, preguntas.get(0).criterio.peso.compareTo(new BigDecimal("1.6")));
        assertEquals(0, preguntas.get(1).criterio.peso.compareTo(new BigDecimal("1.6")));
        assertEquals(0, preguntas.get(2).criterio.peso.compareTo(new BigDecimal("1.8")));
        assertEquals("EQUITATIVA", caso.repartoRubrica);
    }

    @Test
    @DisplayName("la ponderada respeta el peso del docente")
    void ponderadaRespetaElPesoDelDocente() {
        Caso caso = director.construirNuevo(docente(), entrada("PONDERADA", List.of(
                pregunta("Encuadre", 2.0), pregunta("Cierre", 3.0))));

        List<Pregunta> preguntas = caso.escenarios.get(0).preguntas;
        assertEquals(0, preguntas.get(0).criterio.peso.compareTo(new BigDecimal("2.0")));
        assertEquals(0, preguntas.get(1).criterio.peso.compareTo(new BigDecimal("3.0")));
        assertEquals("PONDERADA", caso.repartoRubrica);
    }

    @Test
    @DisplayName("construir la rúbrica fuera de borrador se rechaza y el caso no cambia")
    void fueraDeBorradorSeRechaza() {
        Caso caso = new Caso();
        caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        caso.nombre = "Encuadre";
        Contratos.CasoIn entrada = entrada("EQUITATIVA", List.of(pregunta("Encuadre", 5.0)));

        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> new ConstructorRubricaEquitativa().construir(caso, entrada));

        assertEquals("RF-17: la rúbrica solo se construye en borrador.", error.getMessage());
        assertEquals(Catalogo.EstadoCaso.PUBLICADO, caso.estado);
        assertTrue(caso.escenarios.isEmpty());
    }

    @Test
    @DisplayName("una suma distinta de 5,0 no impide guardar el borrador")
    void sumaDistintaNoImpideElBorrador() {
        Caso caso = director.construirNuevo(docente(), entrada("PONDERADA", List.of(
                pregunta("Encuadre", 1.0), pregunta("Cierre", 1.0))));
        List<String> errores = new ArrayList<>();

        new ArbolCaso.NodoCaso(caso, Set.of()).validar(errores);

        assertEquals(Catalogo.EstadoCaso.BORRADOR, caso.estado);
        assertTrue(errores.stream().anyMatch(error -> error.startsWith("INV-09")));
    }

    private static Usuario docente() {
        Usuario docente = new Usuario();
        docente.id = 2L;
        return docente;
    }

    private static Contratos.PreguntaIn pregunta(String criterio, double peso) {
        return new Contratos.PreguntaIn(null, "", null, criterio, peso, List.of());
    }

    private static Contratos.CasoIn entrada(String reparto, List<Contratos.PreguntaIn> preguntas) {
        Contratos.BloqueIn bloque = new Contratos.BloqueIn(null, "Sala", "El grupo llega.", preguntas);
        return new Contratos.CasoIn("Encuadre", "Desarrollo", "Contexto", 30, false, "", List.of(bloque), null, null, reparto);
    }
}
