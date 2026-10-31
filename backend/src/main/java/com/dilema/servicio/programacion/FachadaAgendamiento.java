package com.dilema.servicio.programacion;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.Mapeador;
import com.dilema.servicio.NoEncontrado;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Facade (RF-04) + Chain (RF-18) + Factory Method (RF-20) + Observer (RF-21).
 * El docente agenda en una sola operación; la cadena valida; el código nace único;
 * cada estudiante autorizado recibe el correo.
 */
@Component
public class FachadaAgendamiento {
    private final CasoRepo casos;
    private final GrupoRepo grupos;
    private final SesionRepo sesiones;
    private final PadronConvocatoria padron;
    private final NotificadorConvocatoria notificador;
    private final BitacoraServicio bitacora;
    private final Mapeador mapeador;
    private final CadenaAgendamiento cadena = new CadenaAgendamiento();
    private final FabricaCodigo fabricaCodigo = new FabricaCodigoAlfanumerico();

    public FachadaAgendamiento(CasoRepo casos, GrupoRepo grupos, SesionRepo sesiones, PadronConvocatoria padron,
                               NotificadorConvocatoria notificador, BitacoraServicio bitacora, Mapeador mapeador) {
        this.casos = casos;
        this.grupos = grupos;
        this.sesiones = sesiones;
        this.padron = padron;
        this.notificador = notificador;
        this.bitacora = bitacora;
        this.mapeador = mapeador;
    }

    @Transactional
    public Contratos.SesionVista agendar(Usuario docente, Contratos.AgendaIn entrada) {
        Caso caso = casos.findById(entrada.casoId()).orElseThrow(() -> new NoEncontrado("Caso no encontrado."));
        Grupo grupo = grupos.findById(entrada.grupoId()).orElseThrow(() -> new NoEncontrado("Grupo no encontrado."));
        LocalDateTime inicio = AgendaFechas.parse(entrada.inicio());
        LocalDateTime fin = AgendaFechas.parse(entrada.fin());
        cadena.validar(new ContextoAgenda(docente, caso, grupo, inicio, fin, entrada.tiempoMaxMin(), entrada.toleranciaMin()));
        SesionCaso sesion = new SesionCaso();
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.inicio = inicio;
        sesion.fin = fin;
        sesion.tiempoMaxMin = entrada.tiempoMaxMin();
        sesion.toleranciaMin = entrada.toleranciaMin();
        sesion.lugar = entrada.lugar() == null ? "" : entrada.lugar().trim();
        sesion.mensaje = entrada.mensaje();
        sesion.codigo = fabricaCodigo.emitir(valor -> sesiones.findByCodigoIgnoreCase(valor).isPresent());
        sesiones.save(sesion);
        for (Usuario estudiante : grupo.estudiantes) {
            padron.incluir(sesion, estudiante);
            notificador.convocado(estudiante, sesion);
        }
        bitacora.auditar(docente, "AGENDAR", caso.nombre + " / " + sesion.codigo);
        return mapeador.sesion(sesion);
    }
}
