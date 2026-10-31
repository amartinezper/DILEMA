package com.dilema.servicio.programacion;

import java.util.concurrent.ThreadLocalRandom;

public class FabricaCodigoAlfanumerico extends FabricaCodigo {
    @Override
    protected String crear() {
        String alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder codigo = new StringBuilder("DL-");
        for (int i = 0; i < 4; i++) {
            codigo.append(alfabeto.charAt(ThreadLocalRandom.current().nextInt(alfabeto.length())));
        }
        return codigo.toString();
    }
}
