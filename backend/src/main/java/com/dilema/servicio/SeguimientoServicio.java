package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.seguimiento.ArchivoReporte;
import com.dilema.servicio.seguimiento.ConsultaSeguimiento;
import com.dilema.servicio.seguimiento.ExportadorCSV;
import com.dilema.servicio.seguimiento.ExportadorPDF;
import com.dilema.servicio.seguimiento.ExportadorXLSX;
import com.dilema.servicio.seguimiento.FormatoReporte;
import com.dilema.servicio.seguimiento.GeneradorReporte;
import com.dilema.servicio.seguimiento.HistorialSesiones;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Módulo 7. RF-15 recorre las sesiones finalizadas y sus participaciones.
 * RF-16 arma el reporte de una sesión en el formato pedido.
 */
@Service
public class SeguimientoServicio {
    private final SesionRepo sesiones;
    private final ParticipacionRepo participaciones;
    private final ProxyOperacion proxy;
    private final ConsultaSeguimiento consulta = new ConsultaSeguimiento();

    public SeguimientoServicio(SesionRepo sesiones, ParticipacionRepo participaciones, ProxyOperacion proxy) {
        this.sesiones = sesiones;
        this.participaciones = participaciones;
        this.proxy = proxy;
    }

    @Transactional(readOnly = true)
    public List<Contratos.SesionRealizada> realizadas(Usuario docente) {
        proxy.revisarGrupo(docente);
        HistorialSesiones historial = new HistorialSesiones(docente, sesiones.findByGrupo_Docente_IdOrderByIdDesc(docente.id));
        List<Contratos.SesionRealizada> salida = new ArrayList<>();
        for (SesionCaso sesion : consulta.navegarCasosRealizados(historial)) {
            String caso = sesion.caso == null ? "" : sesion.caso.nombre;
            String grupo = sesion.grupo == null ? "" : sesion.grupo.nombre;
            salida.add(new Contratos.SesionRealizada(sesion.id, caso, grupo,
                    sesion.inicio == null ? "" : sesion.inicio.toString(),
                    sesion.fin == null ? "" : sesion.fin.toString()));
        }
        return salida;
    }

    @Transactional(readOnly = true)
    public List<Contratos.IntentoConsultado> participaciones(Usuario docente, Long sesionId) {
        SesionCaso sesion = exigirSesion(docente, sesionId);
        List<Participacion> recorridas = consulta.participacionesDe(participaciones.findBySesion_Id(sesion.id));
        List<Contratos.IntentoConsultado> salida = new ArrayList<>();
        for (Participacion participacion : recorridas) {
            String estudiante = participacion.estudiante == null ? "" : participacion.estudiante.nombre;
            salida.add(new Contratos.IntentoConsultado(participacion.id, estudiante,
                    participacion.numeroIntento, participacion.estadoNombre()));
        }
        return salida;
    }

    @Transactional(readOnly = true)
    public Contratos.ParticipacionConsultada ver(Usuario docente, Long participacionId) {
        proxy.revisarGrupo(docente);
        Participacion participacion = participaciones.findById(participacionId)
                .orElseThrow(() -> new NoEncontrado("Participación no encontrada."));
        if (participacion.sesion == null || participacion.sesion.grupo == null
                || !participacion.sesion.grupo.esDirigidoPor(docente)) {
            throw new AccesoDenegado("RF-15: la sesión es de un grupo que no diriges.");
        }
        return consulta.verParticipacion(participacion);
    }

    @Transactional(readOnly = true)
    public ArchivoReporte reporte(Usuario docente, Long sesionId, String formato) {
        proxy.revisarGrupo(docente);
        SesionCaso sesion = sesiones.findById(sesionId).orElseThrow(() -> new NoEncontrado("Sesión no encontrada."));
        GeneradorReporte generador = new GeneradorReporte();
        generador.setFormato(formatoDe(formato));
        List<Participacion> deLaSesion = participaciones.findBySesion_Id(sesion.id);
        return generador.generar(docente, sesion, deLaSesion == null ? List.of() : deLaSesion);
    }

    private SesionCaso exigirSesion(Usuario docente, Long sesionId) {
        proxy.revisarGrupo(docente);
        SesionCaso sesion = sesiones.findById(sesionId).orElseThrow(() -> new NoEncontrado("Sesión no encontrada."));
        if (sesion.grupo == null || !sesion.grupo.esDirigidoPor(docente)) {
            throw new AccesoDenegado("RF-15: la sesión es de un grupo que no diriges.");
        }
        return sesion;
    }

    private FormatoReporte formatoDe(String formato) {
        String pedido = formato == null ? "csv" : formato.trim().toLowerCase();
        return switch (pedido) {
            case "pdf" -> new ExportadorPDF();
            case "xlsx", "excel" -> new ExportadorXLSX();
            case "csv" -> new ExportadorCSV();
            default -> throw new ReglaNegocio("RF-16: el formato debe ser pdf, xlsx o csv.");
        };
    }
}
