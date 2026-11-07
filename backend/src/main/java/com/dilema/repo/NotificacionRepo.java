package com.dilema.repo;

import com.dilema.modelo.Notificacion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificacionRepo extends JpaRepository<Notificacion, Long> {
    List<Notificacion> findByUsuarioIdOrderByFechaDescIdDesc(Long usuarioId);
    Optional<Notificacion> findByUsuarioIdAndReferencia(Long usuarioId, String referencia);
}
