package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.CriterioRubrica;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Pregunta;
import com.dilema.servicio.ReglaNegocio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Builder (RF-17). Solo construye la rúbrica de un caso en borrador.
 * Hay un criterio por pregunta. Cada peso va de 0,0 a 5,0.
 * La suma distinta de 5,0 no impide guardar el borrador: esa comprobación es del Composite.
 * La subclase decide de dónde sale cada peso.
 */
public abstract class ConstructorRubrica {
    public final void construir(Caso caso, Contratos.CasoIn entrada) {
        if (caso.estado != Catalogo.EstadoCaso.BORRADOR) {
            throw new ReglaNegocio("RF-17: la rúbrica solo se construye en borrador.");
        }
        List<Pregunta> preguntas = new ArrayList<>();
        for (Escenario escenario : caso.escenarios) preguntas.addAll(escenario.preguntas);
        List<Contratos.PreguntaIn> pedidos = new ArrayList<>();
        for (Contratos.BloqueIn bloque : entrada.bloques() == null ? List.<Contratos.BloqueIn>of() : entrada.bloques()) {
            if (bloque.preguntas() != null) pedidos.addAll(bloque.preguntas());
        }
        aplicar(preguntas, pedidos);
    }

    public abstract String nombre();

    protected abstract void aplicar(List<Pregunta> preguntas, List<Contratos.PreguntaIn> pedidos);

    protected CriterioRubrica criterioDe(Pregunta pregunta, String texto, BigDecimal peso) {
        CriterioRubrica criterio = pregunta.criterio == null ? new CriterioRubrica() : pregunta.criterio;
        criterio.pregunta = pregunta;
        criterio.criterio = texto == null ? "" : texto;
        criterio.peso = peso;
        pregunta.criterio = criterio;
        return criterio;
    }
}

/** Usa el peso que escribió el docente, redondeado a un decimal. */
class ConstructorRubricaPonderada extends ConstructorRubrica {
    @Override
    public String nombre() { return "PONDERADA"; }

    @Override
    protected void aplicar(List<Pregunta> preguntas, List<Contratos.PreguntaIn> pedidos) {
        for (int i = 0; i < preguntas.size(); i++) {
            Contratos.PreguntaIn pedido = i < pedidos.size() ? pedidos.get(i) : null;
            String texto = pedido == null || pedido.criterio() == null ? "" : pedido.criterio();
            double peso = pedido == null || pedido.peso() == null ? 0 : pedido.peso();
            criterioDe(preguntas.get(i), texto, BigDecimal.valueOf(peso).setScale(1, RoundingMode.HALF_UP));
        }
    }
}

/**
 * Reparte 5,0 entre las preguntas, truncando cada parte a un decimal.
 * La última pregunta recibe lo que falta para que la suma sea exactamente 5,0.
 * Con tres preguntas eso es 1,6, 1,6 y 1,8.
 */
class ConstructorRubricaEquitativa extends ConstructorRubrica {
    @Override
    public String nombre() { return "EQUITATIVA"; }

    @Override
    protected void aplicar(List<Pregunta> preguntas, List<Contratos.PreguntaIn> pedidos) {
        int n = preguntas.size();
        if (n == 0) return;
        BigDecimal total = new BigDecimal("5.0");
        BigDecimal parte = total.divide(BigDecimal.valueOf(n), 1, RoundingMode.DOWN);
        BigDecimal acumulado = BigDecimal.ZERO;
        for (int i = 0; i < n; i++) {
            BigDecimal peso = i == n - 1 ? total.subtract(acumulado) : parte;
            acumulado = acumulado.add(peso);
            Contratos.PreguntaIn pedido = i < pedidos.size() ? pedidos.get(i) : null;
            String texto = pedido == null || pedido.criterio() == null ? "" : pedido.criterio();
            criterioDe(preguntas.get(i), texto, peso);
        }
    }
}
