package com.dilema.servicio.participacion;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** RF-21: el estudiante marca avisos de convocatoria y nota como leídos. */
@Component
public class LecturaAvisos {
    private final Map<Long, Set<Long>> leidos = new ConcurrentHashMap<>();

    public void marcar(Long usuarioId, Long avisoId) {
        if (usuarioId == null || avisoId == null) return;
        leidos.computeIfAbsent(usuarioId, k -> ConcurrentHashMap.newKeySet()).add(avisoId);
    }

    public boolean esta(Long usuarioId, Long avisoId) {
        if (usuarioId == null || avisoId == null) return false;
        return leidos.getOrDefault(usuarioId, Set.of()).contains(avisoId);
    }
}
