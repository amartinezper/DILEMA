package com.dilema.servicio.seguimiento;

import java.math.BigDecimal;

/**
 * RF-16. Bajo de 0,0 a 2,9; básico de 3,0 a 3,9; alto de 4,0 a 4,5; superior de 4,6 a 5,0.
 */
public enum NivelDesempeno {
    BAJO, BASICO, ALTO, SUPERIOR;

    public static NivelDesempeno de(BigDecimal nota) {
        if (nota == null) return BAJO;
        if (nota.compareTo(new BigDecimal("4.6")) >= 0) return SUPERIOR;
        if (nota.compareTo(new BigDecimal("4.0")) >= 0) return ALTO;
        if (nota.compareTo(new BigDecimal("3.0")) >= 0) return BASICO;
        return BAJO;
    }
}
