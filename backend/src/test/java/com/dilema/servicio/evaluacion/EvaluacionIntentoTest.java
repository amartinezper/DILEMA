package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;

class EvaluacionIntentoTest {

    @Test
    @DisplayName("RF-13 la nota se guarda sobre 5,0 asociada al intento")
    void notaAsociadaAlIntento() {
        Participacion participacion = new Participacion();

        participacion.fijarNota(new BigDecimal("4.5"));

        assertNotNull(participacion.evaluacion);
        assertSame(participacion, participacion.evaluacion.participacion);
        assertEquals(4.5, participacion.nota());
    }

    @Test
    @DisplayName("RF-13 varios intentos del mismo estudiante conservan su propia nota")
    void cadaIntentoConservaSuNota() {
        Participacion primerIntento = intento(1);
        Participacion segundoIntento = intento(2);

        primerIntento.fijarNota(new BigDecimal("4.0"));
        segundoIntento.fijarNota(new BigDecimal("2.0"));

        assertNotSame(primerIntento.evaluacion, segundoIntento.evaluacion);
        assertEquals(4.0, primerIntento.nota());
        assertEquals(2.0, segundoIntento.nota());
    }

    private Participacion intento(int numeroIntento) {
        Participacion participacion = new Participacion();
        participacion.numeroIntento = numeroIntento;
        return participacion;
    }
}
