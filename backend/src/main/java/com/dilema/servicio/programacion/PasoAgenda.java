package com.dilema.servicio.programacion;

/** Chain of Responsibility (RF-18): cada paso comprueba una regla y sigue. */
public abstract class PasoAgenda {
    private PasoAgenda siguiente;

    public PasoAgenda enlazar(PasoAgenda proximo) {
        this.siguiente = proximo;
        return proximo;
    }

    public final void validar(ContextoAgenda contexto) {
        comprobar(contexto);
        if (siguiente != null) siguiente.validar(contexto);
    }

    protected abstract void comprobar(ContextoAgenda contexto);
}
