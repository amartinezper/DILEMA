package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Opcion;
import com.dilema.modelo.Personaje;
import com.dilema.modelo.Pregunta;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;

/**
 * Composite (RF-06). {@code validar} recorre el árbol, {@code presentar} lo describe
 * y {@code esCompleto} mira solo esa rama. El borrador puede guardarse incompleto.
 */
public final class ArbolCaso {
    private ArbolCaso() {}

    public static final class NodoCaso implements ElementoCaso {
        private final Caso caso;
        private final Set<Long> personajesLigados;

        public NodoCaso(Caso caso, Set<Long> personajesLigados) {
            this.caso = caso;
            this.personajesLigados = personajesLigados;
        }

        @Override
        public void validar(List<String> errores) {
            if (Texto.vacio(caso.nombre)) errores.add("Falta el nombre del caso.");
            if (Texto.vacio(caso.desarrolloSituacional)) errores.add("Falta el desarrollo situacional.");
            if (Texto.vacio(caso.contexto)) errores.add("Falta el contexto.");
            if (caso.tiempoEstimadoMin == null || caso.tiempoEstimadoMin <= 0) {
                errores.add("El tiempo estimado debe ser mayor que cero.");
            }
            if (caso.escenarios.isEmpty()) errores.add("RF-05: registra al menos un escenario.");
            if (!caso.personajes.isEmpty()) {
                for (Personaje personaje : caso.personajes) {
                    if (personaje.id == null || !personajesLigados.contains(personaje.id)) {
                        errores.add("Cada personaje debe aparecer en al menos un escenario.");
                        break;
                    }
                }
            }
            for (Escenario escenario : caso.escenarios) new NodoEscenario(escenario).validar(errores);
            BigDecimal suma = BigDecimal.ZERO;
            for (Escenario escenario : caso.escenarios) {
                for (Pregunta pregunta : escenario.preguntas) {
                    if (pregunta.criterio != null && pregunta.criterio.peso != null) suma = suma.add(pregunta.criterio.peso);
                }
            }
            if (suma.compareTo(new BigDecimal("5.0")) != 0) {
                errores.add("INV-09: los pesos de la rúbrica deben sumar 5,0. Ahora suman "
                        + suma.setScale(1, RoundingMode.HALF_UP) + ".");
            }
        }

        @Override
        public String presentar() {
            StringBuilder texto = new StringBuilder();
            texto.append(Texto.limpio(caso.nombre)).append('\n');
            texto.append(Texto.limpio(caso.desarrolloSituacional)).append('\n');
            texto.append(Texto.limpio(caso.contexto)).append('\n');
            for (Escenario escenario : caso.escenarios) texto.append(new NodoEscenario(escenario).presentar());
            return texto.toString();
        }

        @Override
        public boolean esCompleto() {
            if (Texto.vacio(caso.nombre) || Texto.vacio(caso.desarrolloSituacional) || Texto.vacio(caso.contexto)) return false;
            if (caso.tiempoEstimadoMin == null || caso.tiempoEstimadoMin <= 0 || caso.escenarios.isEmpty()) return false;
            for (Escenario escenario : caso.escenarios) {
                if (!new NodoEscenario(escenario).esCompleto()) return false;
            }
            BigDecimal suma = BigDecimal.ZERO;
            for (Escenario escenario : caso.escenarios) {
                for (Pregunta pregunta : escenario.preguntas) {
                    if (pregunta.criterio == null || pregunta.criterio.peso == null) return false;
                    suma = suma.add(pregunta.criterio.peso);
                }
            }
            return suma.compareTo(new BigDecimal("5.0")) == 0;
        }
    }

    public static final class NodoEscenario implements ElementoCaso {
        private final Escenario escenario;

        public NodoEscenario(Escenario escenario) {
            this.escenario = escenario;
        }

        @Override
        public void validar(List<String> errores) {
            if (Texto.vacio(escenario.titulo) || Texto.vacio(escenario.contexto)) {
                errores.add("Cada escenario necesita título y contexto.");
            }
            if (escenario.preguntas.isEmpty()) errores.add("El escenario «" + escenario.titulo + "» no tiene preguntas.");
            for (Pregunta pregunta : escenario.preguntas) new NodoPregunta(pregunta).validar(errores);
        }

        @Override
        public String presentar() {
            StringBuilder texto = new StringBuilder();
            texto.append(Texto.limpio(escenario.titulo)).append('\n');
            texto.append(Texto.limpio(escenario.contexto)).append('\n');
            for (Pregunta pregunta : escenario.preguntas) texto.append(new NodoPregunta(pregunta).presentar());
            return texto.toString();
        }

        @Override
        public boolean esCompleto() {
            if (Texto.vacio(escenario.titulo) || Texto.vacio(escenario.contexto) || escenario.preguntas.isEmpty()) return false;
            for (Pregunta pregunta : escenario.preguntas) {
                if (!new NodoPregunta(pregunta).esCompleto()) return false;
            }
            return true;
        }
    }

    public static final class NodoPregunta implements ElementoCaso {
        private final Pregunta pregunta;

        public NodoPregunta(Pregunta pregunta) {
            this.pregunta = pregunta;
        }

        @Override
        public void validar(List<String> errores) {
            if (Texto.vacio(pregunta.enunciado)) errores.add("Hay una pregunta sin enunciado.");
            if (pregunta.opciones.size() < 2) errores.add("Cada pregunta necesita al menos dos opciones.");
            long correctas = pregunta.opciones.stream().filter(o -> o.esCorrecta).count();
            if (correctas != 1) errores.add("Cada pregunta debe tener exactamente una opción correcta.");
            if (pregunta.criterio == null || Texto.vacio(pregunta.criterio.criterio) || pregunta.criterio.peso == null) {
                errores.add("RF-17: cada pregunta tiene su criterio y su peso.");
            } else if (pregunta.criterio.peso.compareTo(BigDecimal.ZERO) < 0
                    || pregunta.criterio.peso.compareTo(new BigDecimal("5.0")) > 0) {
                errores.add("Cada peso de la rúbrica está entre 0,0 y 5,0.");
            }
            for (Opcion opcion : pregunta.opciones) new NodoOpcion(opcion).validar(errores);
        }

        @Override
        public String presentar() {
            StringBuilder texto = new StringBuilder();
            texto.append(Texto.limpio(pregunta.enunciado)).append('\n');
            if (!Texto.vacio(pregunta.pista)) texto.append(pregunta.pista.trim()).append('\n');
            for (Opcion opcion : pregunta.opciones) texto.append(new NodoOpcion(opcion).presentar());
            return texto.toString();
        }

        @Override
        public boolean esCompleto() {
            if (Texto.vacio(pregunta.enunciado) || pregunta.opciones.size() < 2) return false;
            if (pregunta.opciones.stream().filter(o -> o.esCorrecta).count() != 1) return false;
            if (pregunta.criterio == null || Texto.vacio(pregunta.criterio.criterio) || pregunta.criterio.peso == null) return false;
            if (pregunta.criterio.peso.compareTo(BigDecimal.ZERO) < 0
                    || pregunta.criterio.peso.compareTo(new BigDecimal("5.0")) > 0) return false;
            for (Opcion opcion : pregunta.opciones) {
                if (!new NodoOpcion(opcion).esCompleto()) return false;
            }
            return true;
        }
    }

    public static final class NodoOpcion implements ElementoCaso {
        private final Opcion opcion;

        public NodoOpcion(Opcion opcion) {
            this.opcion = opcion;
        }

        @Override
        public void validar(List<String> errores) {
            if (Texto.vacio(opcion.descripcion) || opcion.retroalimentacion == null
                    || Texto.vacio(opcion.retroalimentacion.explicacion)
                    || Texto.vacio(opcion.retroalimentacion.fundamento)) {
                errores.add("Cada opción necesita texto, la explicación y el fundamento.");
            }
        }

        @Override
        public String presentar() {
            String marca = opcion.esCorrecta ? "correcta" : "incorrecta";
            return "- " + Texto.limpio(opcion.descripcion) + " (" + marca + ")\n";
        }

        @Override
        public boolean esCompleto() {
            return !Texto.vacio(opcion.descripcion) && opcion.retroalimentacion != null
                    && !Texto.vacio(opcion.retroalimentacion.explicacion)
                    && !Texto.vacio(opcion.retroalimentacion.fundamento);
        }
    }
}
