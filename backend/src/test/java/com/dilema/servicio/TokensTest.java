package com.dilema.servicio;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokensTest {

    @Test
    @DisplayName("emite, lee y revoca un token de sesión")
    void ciclo() {
        Tokens tokens = new Tokens();
        String token = tokens.emitir(7L);
        assertEquals(7L, tokens.leer(token).orElseThrow());
        assertTrue(tokens.leer(" ").isEmpty());
        tokens.revocar(token);
        assertTrue(tokens.leer(token).isEmpty());
    }
}
