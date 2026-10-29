package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Pregunta;
import com.dilema.servicio.ReglaNegocio;

import java.util.ArrayList;
import java.util.List;

/**
 * Builder (RF-07). El asistente elige el constructor con pista o sin ella.
 * Una pregunta terminada tiene enunciado, al menos dos opciones y una sola correcta.
 * El borrador puede guardar el enunciado vacío.
 */
public class AsistenteDePreguntas {
    public Pregunta construir(Caso caso, Escenario escenario, Contratos.PreguntaIn entrada, int orden) {
        boolean conPista = !Texto.vacio(entrada.pista());
        ConstructorPregunta constructor = conPista ? new ConstructorPreguntaConPista() : new ConstructorPreguntaSinPista();
        constructor.enunciado(entrada.enunciado());
        if (conPista) constructor.pista(entrada.pista());
        int i = 0;
        for (Contratos.OpcionIn opcion : entrada.opciones() == null ? List.<Contratos.OpcionIn>of() : entrada.opciones()) {
            ConstructorOpcion pieza = opcion.correcta() ? new ConstructorOpcionCorrecta() : new ConstructorOpcionIncorrecta();
            pieza.texto(opcion.texto()).explicar(opcion.explicacion(), opcion.fundamento()).orden(i++);
            constructor.agregar(pieza);
        }
        return constructor.obtenerBorrador(caso, escenario, orden);
    }

    public Pregunta copiar(Caso caso, Escenario escenario, Pregunta origen) {
        boolean conPista = !Texto.vacio(origen.pista);
        ConstructorPregunta constructor = conPista ? new ConstructorPreguntaConPista() : new ConstructorPreguntaSinPista();
        constructor.enunciado(origen.enunciado);
        if (conPista) constructor.pista(origen.pista);
        constructor.criterio(origen.criterio);
        for (var opcion : origen.opciones) {
            String explicacion = opcion.retroalimentacion == null ? "" : opcion.retroalimentacion.explicacion;
            String fundamento = opcion.retroalimentacion == null ? "" : opcion.retroalimentacion.fundamento;
            ConstructorOpcion pieza = opcion.esCorrecta ? new ConstructorOpcionCorrecta() : new ConstructorOpcionIncorrecta();
            pieza.texto(opcion.descripcion).explicar(explicacion, fundamento).orden(opcion.orden);
            constructor.agregar(pieza);
        }
        return constructor.obtenerBorrador(caso, escenario, origen.orden);
    }
}

abstract class ConstructorPregunta {
    private String enunciado = "";
    private String pista;
    private CriterioRubrica criterioOrigen;
    private final List<ConstructorOpcion> opciones = new ArrayList<>();

    void enunciado(String valor) { this.enunciado = valor == null ? "" : valor; }

    void pista(String valor) { this.pista = valor; }

    void criterio(CriterioRubrica origen) { this.criterioOrigen = origen; }

    void agregar(ConstructorOpcion opcion) { opciones.add(opcion); }

    Pregunta obtenerBorrador(Caso caso, Escenario escenario, int orden) {
        Pregunta pregunta = new Pregunta();
        pregunta.escenario = escenario;
        pregunta.casoId = caso.id == null ? 0L : caso.id;
        pregunta.enunciado = enunciado;
        pregunta.pista = pista;
        pregunta.orden = orden;
        if (criterioOrigen != null) {
            CriterioRubrica criterio = new CriterioRubrica();
            criterio.pregunta = pregunta;
            criterio.criterio = criterioOrigen.criterio;
            criterio.peso = criterioOrigen.peso;
            pregunta.criterio = criterio;
        }
        for (ConstructorOpcion opcion : opciones) pregunta.opciones.add(opcion.obtenerBorrador(pregunta));
        return pregunta;
    }

    /** Una pregunta terminada no admite enunciado vacío, menos de dos opciones ni más de una correcta. */
    Pregunta obtenerResultado(Caso caso, Escenario escenario, int orden) {
        Pregunta pregunta = obtenerBorrador(caso, escenario, orden);
        if (!new ArbolCaso.NodoPregunta(pregunta).esCompleto()) {
            throw new ReglaNegocio("La pregunta necesita enunciado, al menos dos opciones y una sola correcta.");
        }
        return pregunta;
    }
}

class ConstructorPreguntaConPista extends ConstructorPregunta {}

class ConstructorPreguntaSinPista extends ConstructorPregunta {}
