package com.dilema.repo;

import com.dilema.modelo.Participacion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ParticipacionRepo extends JpaRepository<Participacion, Long> {
    List<Participacion> findByEstudianteIdAndSesionId(Long estudianteId, Long sesionId);

    /** Participaciones de un caso. Impiden despublicarlo aunque la sesión ya no esté. */
    boolean existsByCasoId(Long casoId);
    List<Participacion> findByEstudianteIdOrderByIdDesc(Long estudianteId);
}
