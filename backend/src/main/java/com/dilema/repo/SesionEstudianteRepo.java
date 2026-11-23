package com.dilema.repo;

import com.dilema.modelo.SesionEstudiante;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SesionEstudianteRepo extends JpaRepository<SesionEstudiante, SesionEstudiante.Clave> {
    boolean existsBySesionIdAndEstudianteId(Long sesionId, Long estudianteId);
    List<SesionEstudiante> findBySesionId(Long sesionId);
    void deleteBySesionIdAndEstudianteId(Long sesionId, Long estudianteId);
    void deleteBySesionId(Long sesionId);

    /** El estudiante está convocado a alguna sesión de ese caso (para ver su portada). */
    @Query("select count(se) > 0 from SesionEstudiante se, SesionCaso s where s.id = se.sesionId and s.caso.id = :casoId and se.estudianteId = :estudianteId")
    boolean estaConvocadoAlCaso(@Param("casoId") Long casoId, @Param("estudianteId") Long estudianteId);
}
