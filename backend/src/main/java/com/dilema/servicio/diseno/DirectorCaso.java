package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Personaje;
import com.dilema.modelo.Pregunta;
import com.dilema.servicio.ReglaNegocio;

import java.util.List;

/**
 * Builder (RF-05). El director recorre nombre, desarrollo, contexto, escenarios y tiempo.
 * {@code obtenerBorrador} entrega el caso aunque el árbol esté incompleto.
 * La validez completa la revisa el Composite al publicar.
 */
public class DirectorCaso {
    public Caso construirNuevo(com.dilema.modelo.Usuario docente, Contratos.CasoIn entrada) {
        ConstructorCasoNuevo constructor = new ConstructorCasoNuevo();
        constructor.iniciar(docente);
        llenar(constructor, entrada);
        return constructor.obtenerBorrador();
    }

    public void reconstruir(Caso caso, Contratos.CasoIn entrada) {
        if (caso.estado != Catalogo.EstadoCaso.BORRADOR) {
            throw new ReglaNegocio("RF-09: solo se edita un caso en borrador.");
        }
        ConstructorCasoNuevo constructor = new ConstructorCasoNuevo();
        constructor.sobre(caso);
        llenar(constructor, entrada);
        constructor.obtenerBorrador();
    }

    /** La copia nace en borrador, sin sesiones ni participaciones (INV-12). */
    public Caso duplicar(com.dilema.modelo.Usuario docente, Caso origen) {
        return new ConstructorCasoDuplicado().copiar(docente, origen).obtenerBorrador();
    }

    private void llenar(ConstructorCaso constructor, Contratos.CasoIn entrada) {
        constructor.datos(entrada.nombre(), entrada.desarrolloSituacional(), entrada.contexto(), entrada.tiempoEstimadoMin());
        constructor.escenarios(entrada.bloques() == null ? List.of() : entrada.bloques());
        constructor.personajes(entrada.personajes() == null ? List.of() : entrada.personajes());
        constructor.rubrica(entrada);
    }
}

abstract class ConstructorCaso {
    protected Caso caso;

    void datos(String nombre, String desarrollo, String contexto, Integer tiempo) {
        caso.nombre = nombre;
        caso.desarrolloSituacional = desarrollo;
        caso.contexto = contexto;
        caso.tiempoEstimadoMin = tiempo == null ? 1 : tiempo;
    }

    void escenarios(List<Contratos.BloqueIn> bloques) {
        int ordenEscenario = 0;
        for (Contratos.BloqueIn bloque : bloques) {
            Escenario escenario = new Escenario();
            escenario.caso = caso;
            escenario.titulo = bloque.nombre();
            escenario.contexto = bloque.contexto() == null ? "" : bloque.contexto();
            escenario.orden = ordenEscenario++;
            int ordenPregunta = 0;
            AsistenteDePreguntas asistente = new AsistenteDePreguntas();
            for (Contratos.PreguntaIn pregunta : bloque.preguntas() == null ? List.<Contratos.PreguntaIn>of() : bloque.preguntas()) {
                escenario.preguntas.add(asistente.construir(caso, escenario, pregunta, ordenPregunta++));
            }
            caso.escenarios.add(escenario);
        }
    }

    void personajes(List<Contratos.PersonajeIn> pedidos) {
        for (Contratos.PersonajeIn pedido : pedidos) {
            if (pedido.nombre() == null || pedido.nombre().isBlank()) continue;
            Personaje personaje = new Personaje();
            personaje.caso = caso;
            personaje.nombre = pedido.nombre().trim();
            personaje.descripcion = pedido.descripcion();
            caso.personajes.add(personaje);
        }
    }

    void rubrica(Contratos.CasoIn entrada) {
        ConstructorRubrica constructor = "EQUITATIVA".equalsIgnoreCase(entrada.repartoRubrica())
                ? new ConstructorRubricaEquitativa()
                : new ConstructorRubricaPonderada();
        caso.repartoRubrica = constructor.nombre();
        constructor.construir(caso, entrada);
    }

    /** El borrador exige nombre. El resto puede llegar incompleto. */
    Caso obtenerBorrador() {
        if (Texto.vacio(caso.nombre)) throw new ReglaNegocio("El borrador necesita al menos un nombre.");
        return caso;
    }
}

/** Alta de un caso nuevo. */
class ConstructorCasoNuevo extends ConstructorCaso {
    void iniciar(com.dilema.modelo.Usuario docente) {
        caso = new Caso();
        caso.docente = docente;
        caso.estado = Catalogo.EstadoCaso.BORRADOR;
        caso.tiempoEstimadoMin = 1;
    }

    void sobre(Caso existente) {
        caso = existente;
    }
}

/** Copia en borrador de un caso ya guardado. */
class ConstructorCasoDuplicado extends ConstructorCaso {
    ConstructorCasoDuplicado copiar(com.dilema.modelo.Usuario docente, Caso origen) {
        caso = new Caso();
        caso.docente = docente;
        caso.estado = Catalogo.EstadoCaso.BORRADOR;
        String nombre = origen.nombre + " (copia)";
        caso.nombre = nombre.length() > 200 ? origen.nombre : nombre;
        caso.desarrolloSituacional = origen.desarrolloSituacional;
        caso.contexto = origen.contexto;
        caso.tiempoEstimadoMin = origen.tiempoEstimadoMin;
        caso.repartoRubrica = origen.repartoRubrica == null ? "PONDERADA" : origen.repartoRubrica;
        for (Escenario escenario : origen.escenarios) {
            Escenario nuevo = new Escenario();
            nuevo.caso = caso;
            nuevo.orden = escenario.orden;
            nuevo.titulo = escenario.titulo;
            nuevo.contexto = escenario.contexto;
            AsistenteDePreguntas asistente = new AsistenteDePreguntas();
            for (Pregunta pregunta : escenario.preguntas) {
                nuevo.preguntas.add(asistente.copiar(caso, nuevo, pregunta));
            }
            caso.escenarios.add(nuevo);
        }
        for (Personaje personaje : origen.personajes) {
            Personaje nuevo = new Personaje();
            nuevo.caso = caso;
            nuevo.nombre = personaje.nombre;
            nuevo.descripcion = personaje.descripcion;
            caso.personajes.add(nuevo);
        }
        return this;
    }
}
