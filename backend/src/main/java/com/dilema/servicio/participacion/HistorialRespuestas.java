package com.dilema.servicio.participacion;

import com.dilema.servicio.ReglaNegocio;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Command (RF-10): historial de la participación en curso para deshacer. */
public class HistorialRespuestas {
    private final Map<Long, List<ComandoRespuesta>> pilas = new ConcurrentHashMap<>();

    public void registrar(Long participacionId, ComandoRespuesta comando) {
        if (comando.esNoOp()) return;
        pilas.computeIfAbsent(participacionId, k -> new ArrayList<>()).add(comando);
    }

    public ComandoRespuesta deshacer(Long participacionId) {
        List<ComandoRespuesta> pila = pilas.getOrDefault(participacionId, new ArrayList<>());
        if (pila.isEmpty()) throw new ReglaNegocio("No hay respuestas para deshacer.");
        return pila.remove(pila.size() - 1);
    }
}
