package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.SesionEstudiante;
import com.dilema.modelo.Usuario;
import com.dilema.repo.SesionEstudianteRepo;
import com.dilema.repo.UsuarioRepo;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/** RF-20 / RF-21: el código es de la sesión; el padrón dice quién puede usarlo. */
@Component
public class PadronConvocatoria {
    private final SesionEstudianteRepo autorizados;
    private final UsuarioRepo usuarios;

    public PadronConvocatoria(SesionEstudianteRepo autorizados, UsuarioRepo usuarios) {
        this.autorizados = autorizados;
        this.usuarios = usuarios;
    }

    /** Quienes fueron citados a esta sesión, no la matrícula actual del grupo. */
    public List<Usuario> convocados(SesionCaso sesion) {
        if (sesion == null || sesion.id == null) return List.of();
        List<Long> ids = autorizados.findBySesionId(sesion.id).stream()
                .map(fila -> fila.estudianteId)
                .toList();
        if (ids.isEmpty()) return List.of();
        List<Usuario> citados = new java.util.ArrayList<>(usuarios.findAllById(ids));
        citados.sort(Comparator.comparing(usuario -> usuario.nombre == null ? "" : usuario.nombre, String.CASE_INSENSITIVE_ORDER));
        return citados;
    }

    public void incluir(SesionCaso sesion, Usuario estudiante) {
        if (autorizados.existsBySesionIdAndEstudianteId(sesion.id, estudiante.id)) return;
        SesionEstudiante fila = new SesionEstudiante();
        fila.sesionId = sesion.id;
        fila.estudianteId = estudiante.id;
        fila.grupoId = sesion.grupo.id;
        autorizados.save(fila);
    }

    public void excluir(SesionCaso sesion, Usuario estudiante) {
        autorizados.deleteBySesionIdAndEstudianteId(sesion.id, estudiante.id);
    }

    public void vaciar(SesionCaso sesion) {
        autorizados.deleteBySesionId(sesion.id);
    }

    public boolean esta(SesionCaso sesion, Usuario estudiante) {
        return autorizados.existsBySesionIdAndEstudianteId(sesion.id, estudiante.id);
    }
}
