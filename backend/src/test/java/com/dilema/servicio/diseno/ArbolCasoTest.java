package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Pregunta;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pruebas unitarias de RF-06. Recorren el árbol en memoria,
 * sin base de datos ni Spring.
 * {@code esCompleto} de la opción no consulta el nombre del caso: si lo hiciera,
 * una opción terminada fallaría solo porque el borrador todavía no tiene título.
 * {@code validar} junta los errores en vez de detenerse en el primero.
 */
class ArbolCasoTest {

    @Test
    @DisplayName("una opción completa sigue completa aunque el caso no tenga nombre")
    void opcionCompletaNoDependeDelNombreDelCaso() {
        Opcion opcion = new ConstructorOpcionCorrecta().texto("Presentarte").explicar("Reconoce", "Consentimiento").obtenerBorrador(new Pregunta());
        Caso caso = new Caso();
        caso.nombre = "";

        assertTrue(new ArbolCaso.NodoOpcion(opcion).esCompleto());
        assertFalse(new ArbolCaso.NodoCaso(caso, Set.of()).esCompleto());
    }

    @Test
    @DisplayName("validar junta los errores del árbol, incluida la suma distinta de 5,0")
    void validarJuntaLosErroresDelArbol() {
        Caso caso = new Caso();
        List<String> errores = new ArrayList<>();

        new ArbolCaso.NodoCaso(caso, Set.of()).validar(errores);

        assertTrue(errores.contains("Falta el nombre del caso."));
        assertTrue(errores.contains("Falta el desarrollo situacional."));
        assertTrue(errores.contains("Falta el contexto."));
        assertTrue(errores.contains("El tiempo estimado debe ser mayor que cero."));
        assertTrue(errores.contains("RF-05: registra al menos un escenario."));
        assertTrue(errores.contains("INV-09: los pesos de la rúbrica deben sumar 5,0. Ahora suman 0.0."));
        assertFalse(new ArbolCaso.NodoCaso(caso, Set.of()).esCompleto());
    }

    @Test
    @DisplayName("un árbol terminado no produce errores")
    void arbolTerminadoNoProduceErrores() {
        Caso caso = casoTerminado();
        List<String> errores = new ArrayList<>();

        new ArbolCaso.NodoCaso(caso, Set.of()).validar(errores);

        assertTrue(errores.isEmpty());
        assertTrue(new ArbolCaso.NodoCaso(caso, Set.of()).esCompleto());
        assertTrue(new ArbolCaso.NodoCaso(caso, Set.of()).presentar().contains("correcta"));
    }

    private static Caso casoTerminado() {
        Opcion correcta = new ConstructorOpcionCorrecta().texto("Presentarte").explicar("Reconoce", "Consentimiento").obtenerBorrador(new Pregunta());
        Opcion incorrecta = new ConstructorOpcionIncorrecta().texto("Dar la instrucción").explicar("Desplaza", "Sin permiso").obtenerBorrador(new Pregunta());
        Pregunta pregunta = new Pregunta();
        pregunta.enunciado = "¿Cómo abres?";
        pregunta.opciones.add(correcta);
        pregunta.opciones.add(incorrecta);
        CriterioRubrica criterio = new CriterioRubrica();
        criterio.pregunta = pregunta;
        criterio.criterio = "Encuadre";
        criterio.peso = new BigDecimal("5.0");
        pregunta.criterio = criterio;
        Escenario escenario = new Escenario();
        escenario.titulo = "Sala";
        escenario.contexto = "El grupo llega.";
        escenario.preguntas.add(pregunta);
        Caso caso = new Caso();
        caso.nombre = "Encuadre";
        caso.desarrolloSituacional = "La práctica empieza.";
        caso.contexto = "Aula.";
        caso.tiempoEstimadoMin = 30;
        caso.escenarios.add(escenario);
        return caso;
    }
}
