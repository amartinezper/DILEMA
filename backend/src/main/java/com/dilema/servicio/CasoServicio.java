package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.*;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.EscenarioPersonajeRepo;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.diseno.ArbolCaso;
import com.dilema.servicio.diseno.DirectorCaso;
import com.dilema.servicio.diseno.EstadosDelCaso;
import com.dilema.servicio.diseno.UsoDelCaso;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CasoServicio {
    private final CasoRepo casos;
    private final EscenarioPersonajeRepo vinculos;
    private final SesionRepo sesiones;
    private final ParticipacionRepo participaciones;
    private final ProxyOperacion proxy;
    private final Mapeador mapeador;
    private final EntityManager em;

    public CasoServicio(CasoRepo casos, EscenarioPersonajeRepo vinculos,
                        SesionRepo sesiones, ParticipacionRepo participaciones,
                        ProxyOperacion proxy, Mapeador mapeador, EntityManager em) {
        this.casos = casos;
        this.vinculos = vinculos;
        this.sesiones = sesiones;
        this.participaciones = participaciones;
        this.proxy = proxy;
        this.mapeador = mapeador;
        this.em = em;
    }

    @Transactional(readOnly = true)
    public List<Contratos.CasoResumen> listar(Usuario docente) {
        proxy.revisarGrupo(docente);
        return casos.findByDocenteIdOrderByIdDesc(docente.id).stream().map(mapeador::resumen).toList();
    }

    @Transactional(readOnly = true)
    public Contratos.CasoVista obtener(Usuario docente, Long id) {
        proxy.revisarGrupo(docente);
        Caso caso = propio(docente, id);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista crear(Usuario docente, Contratos.CasoIn entrada) {
        proxy.crearCaso(docente);
        Caso caso = new DirectorCaso().construirNuevo(docente, entrada);
        casos.save(caso);
        em.flush();
        fijarCasoId(caso);
        enlazar(caso, entrada);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista actualizar(Usuario docente, Long id, Contratos.CasoIn entrada) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        exigirEditable(caso);
        vinculos.deleteByCasoId(caso.id);
        caso.escenarios.clear();
        caso.personajes.clear();
        em.flush();
        new DirectorCaso().reconstruir(caso, entrada);
        em.flush();
        fijarCasoId(caso);
        enlazar(caso, entrada);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    /** INV-12: la copia nace en borrador, sin sesiones ni participaciones. */
    @Transactional
    public Contratos.CasoVista duplicar(Usuario docente, Long id) {
        proxy.crearCaso(docente);
        Caso origen = propio(docente, id);
        Caso copia = new DirectorCaso().duplicar(docente, origen);
        casos.save(copia);
        em.flush();
        fijarCasoId(copia);
        copiarVinculos(origen, copia);
        return mapeador.caso(copia, vinculos.findByCasoId(copia.id));
    }

    /**
     * RF-09. El caso delega en su estado. Borrador y Archivado publican
     * solo si validar() no devuelve errores. Publicado rechaza la operación.
     */
    @Transactional
    public Contratos.CasoVista publicar(Usuario docente, Long id) {
        return transicionar(docente, id, Caso::publicar);
    }

    /**
     * RF-09. Solo un caso publicado y sin sesiones ni participaciones vuelve a borrador.
     */
    @Transactional
    public Contratos.CasoVista despublicar(Usuario docente, Long id) {
        return transicionar(docente, id, Caso::despublicar);
    }

    /**
     * RF-09. Solo un caso publicado pasa a archivado, aunque ya tenga sesiones.
     */
    @Transactional
    public Contratos.CasoVista archivar(Usuario docente, Long id) {
        return transicionar(docente, id, Caso::archivar);
    }

    private Contratos.CasoVista transicionar(Usuario docente, Long id, java.util.function.Consumer<Caso> operacion) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        colocar(caso);
        operacion.accept(caso);
        casos.save(caso);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    /** RF-09: la edición entra solo si el estado actual lo permite. */
    private void exigirEditable(Caso caso) {
        colocar(caso);
        if (!caso.permiteEdicion()) {
            throw new ReglaNegocio("RF-09: solo se edita un caso en borrador.");
        }
    }

    /**
     * Reconstruye el objeto de estado desde el enum guardado y lo deja en el caso.
     * Las reglas no se deciden en este método.
     */
    private void colocar(Caso caso) {
        caso.colocarEstado(EstadosDelCaso.de(caso.estado, new UsoGuardado()));
    }

    /** Lleva al estado la validación ya existente y la existencia de sesiones o participaciones. */
    private final class UsoGuardado implements UsoDelCaso {
        @Override
        public List<String> validar(Caso caso) {
            return CasoServicio.this.validar(caso);
        }

        @Override
        public boolean tieneSesiones(Caso caso) {
            return caso.id != null && sesiones.existsByCaso_Id(caso.id);
        }

        @Override
        public boolean tieneParticipaciones(Caso caso) {
            return caso.id != null && participaciones.existsByCasoId(caso.id);
        }
    }

    private void copiarVinculos(Caso origen, Caso copia) {
        for (EscenarioPersonaje vinculo : vinculos.findByCasoId(origen.id)) {
            Escenario escenarioOrigen = origen.escenarios.stream().filter(e -> e.id.equals(vinculo.escenarioId)).findFirst().orElse(null);
            Personaje personajeOrigen = origen.personajes.stream().filter(p -> p.id.equals(vinculo.personajeId)).findFirst().orElse(null);
            if (escenarioOrigen == null || personajeOrigen == null) continue;
            int indice = origen.personajes.indexOf(personajeOrigen);
            Escenario escenarioNuevo = copia.escenarios.stream().filter(e -> e.orden == escenarioOrigen.orden).findFirst().orElse(null);
            if (escenarioNuevo == null || indice < 0 || indice >= copia.personajes.size()) continue;
            EscenarioPersonaje nuevo = new EscenarioPersonaje();
            nuevo.escenarioId = escenarioNuevo.id;
            nuevo.personajeId = copia.personajes.get(indice).id;
            nuevo.casoId = copia.id;
            em.persist(nuevo);
        }
    }

    public Caso propio(Usuario docente, Long id) {
        Caso caso = casos.findById(id).orElseThrow(() -> new NoEncontrado("Caso no encontrado."));
        if (!caso.docente.id.equals(docente.id)) throw new AccesoDenegado("Este caso pertenece a otro docente.");
        return caso;
    }

    private void fijarCasoId(Caso caso) {
        for (Escenario escenario : caso.escenarios) {
            for (Pregunta pregunta : escenario.preguntas) pregunta.casoId = caso.id;
        }
    }

    private void enlazar(Caso caso, Contratos.CasoIn entrada) {
        List<Contratos.PersonajeIn> pedidos = entrada.personajes() == null ? List.of() : entrada.personajes();
        for (int i = 0; i < pedidos.size() && i < caso.personajes.size(); i++) {
            Personaje personaje = caso.personajes.get(i);
            List<Integer> ordenes = pedidos.get(i).escenarios() == null ? List.of() : pedidos.get(i).escenarios();
            for (Integer orden : ordenes) {
                Escenario escenario = caso.escenarios.stream().filter(e -> e.orden == orden).findFirst().orElse(null);
                if (escenario == null || escenario.id == null || personaje.id == null) continue;
                EscenarioPersonaje vinculo = new EscenarioPersonaje();
                vinculo.escenarioId = escenario.id;
                vinculo.personajeId = personaje.id;
                vinculo.casoId = caso.id;
                em.persist(vinculo);
            }
        }
    }

    /** Composite (RF-06): Caso, Escenario, Pregunta y Opción se validan como un solo árbol. */
    public List<String> validar(Caso caso) {
        List<String> errores = new java.util.ArrayList<>();
        java.util.Set<Long> ligados = vinculos.findByCasoId(caso.id).stream()
                .map(v -> v.personajeId).collect(Collectors.toSet());
        new ArbolCaso.NodoCaso(caso, ligados).validar(errores);
        return errores;
    }
}
