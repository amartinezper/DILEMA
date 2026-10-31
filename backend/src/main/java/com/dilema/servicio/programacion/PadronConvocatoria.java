package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.SesionEstudiante;
import com.dilema.modelo.Usuario;
import com.dilema.repo.SesionEstudianteRepo;
import org.springframework.stereotype.Component;

/** RF-20 / RF-21: el código es de la sesión; el padrón dice quién puede usarlo. */
@Component
public class PadronConvocatoria {
    private final SesionEstudianteRepo autorizados;

    public PadronConvocatoria(SesionEstudianteRepo autorizados) {
        this.autorizados = autorizados;
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

    public boolean esta(SesionCaso sesion, Usuario estudiante) {
        return autorizados.existsBySesionIdAndEstudianteId(sesion.id, estudiante.id);
    }
}
