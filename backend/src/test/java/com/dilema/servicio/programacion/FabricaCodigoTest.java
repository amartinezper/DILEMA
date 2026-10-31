package com.dilema.servicio.programacion;

import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FabricaCodigoTest {

    @Test
    @DisplayName("RF-20 emite un código alfanumérico único con prefijo DL-")
    void emiteCodigoUnico() {
        String codigo = new FabricaCodigoAlfanumerico().emitir(valor -> false);
        assertTrue(codigo.startsWith("DL-"));
        assertEquals(7, codigo.length());
    }

    @Test
    @DisplayName("RF-20 reintenta si el código ya existe y falla si no hay unicidad")
    void reintentaHastaUnicidad() {
        Set<String> usados = new HashSet<>();
        AtomicInteger intentos = new AtomicInteger();
        FabricaCodigo fabrica = new FabricaCodigo() {
            @Override protected String crear() {
                return intentos.incrementAndGet() < 3 ? "DL-AAAA" : "DL-BBBB";
            }
        };
        usados.add("DL-AAAA");
        assertEquals("DL-BBBB", fabrica.emitir(usados::contains));

        FabricaCodigo saturada = new FabricaCodigo() {
            @Override protected String crear() { return "DL-AAAA"; }
        };
        assertThrows(ReglaNegocio.class, () -> saturada.emitir(valor -> true));
    }
}
