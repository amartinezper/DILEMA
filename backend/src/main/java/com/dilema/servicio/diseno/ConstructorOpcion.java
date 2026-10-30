package com.dilema.servicio.diseno;

import com.dilema.modelo.Opcion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Retroalimentacion;
import com.dilema.servicio.ReglaNegocio;

/**
 * Builder (RF-08). {@code explicar} guarda el mensaje y el fundamento en campos distintos.
 * No los concatena. La subclase fija si la opción es correcta o incorrecta.
 * {@code obtenerBorrador} acepta texto, explicación o fundamento vacíos.
 * {@code obtenerResultado} exige los tres.
 */
public abstract class ConstructorOpcion {
    private final Opcion opcion = new Opcion();
    private final Retroalimentacion retro = new Retroalimentacion();

    public ConstructorOpcion texto(String texto) {
        opcion.descripcion = texto == null ? "" : texto;
        return this;
    }

    public ConstructorOpcion explicar(String mensaje, String fundamento) {
        retro.explicacion = mensaje == null ? "" : mensaje.trim();
        retro.fundamento = fundamento == null ? "" : fundamento.trim();
        return this;
    }

    public ConstructorOpcion orden(int orden) {
        opcion.orden = orden;
        return this;
    }

    public Opcion obtenerBorrador(Pregunta pregunta) {
        opcion.pregunta = pregunta;
        opcion.esCorrecta = esCorrecta();
        retro.opcion = opcion;
        opcion.retroalimentacion = retro;
        return opcion;
    }

    public Opcion obtenerResultado(Pregunta pregunta) {
        Opcion lista = obtenerBorrador(pregunta);
        if (!new ArbolCaso.NodoOpcion(lista).esCompleto()) {
            throw new ReglaNegocio("Cada opción necesita texto, la explicación y el fundamento.");
        }
        return lista;
    }

    protected abstract boolean esCorrecta();
}

/** La opción queda marcada como la única respuesta correcta de su pregunta. */
class ConstructorOpcionCorrecta extends ConstructorOpcion {
    @Override
    protected boolean esCorrecta() { return true; }
}

/** La opción queda marcada como incorrecta. No decide cuál es la correcta. */
class ConstructorOpcionIncorrecta extends ConstructorOpcion {
    @Override
    protected boolean esCorrecta() { return false; }
}
