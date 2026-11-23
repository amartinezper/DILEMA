package com.dilema.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Envía correos por la API HTTPS de Brevo cuando existe BREVO_API_KEY
 * (Railway bloquea el SMTP de salida). Sin clave, BitacoraServicio sigue usando SMTP.
 */
@Component
public class CorreoBrevo {
    private static final Logger log = LoggerFactory.getLogger(CorreoBrevo.class);
    private final String clave;
    private final URI api;
    private final ObjectMapper json;
    private final HttpClient http;

    @Autowired
    public CorreoBrevo(@Value("${BREVO_API_KEY:}") String clave, ObjectMapper json) {
        this(clave, json, URI.create("https://api.brevo.com/v3/smtp/email"));
    }

    /** Las pruebas apuntan a un servidor local. */
    CorreoBrevo(String clave, ObjectMapper json, URI api) {
        this.clave = clave == null ? "" : clave.trim();
        this.json = json;
        this.api = api;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public boolean activo() {
        return !clave.isEmpty();
    }

    /** Envía en segundo plano: vuelve de inmediato y deja el resultado en el log. */
    public CompletableFuture<Void> enviar(String desde, String para, String asunto, String texto) {
        try {
            String cuerpo = json.writeValueAsString(Map.of(
                    "sender", Map.of("email", desde),
                    "to", List.of(Map.of("email", para)),
                    "subject", asunto,
                    "textContent", texto));
            HttpRequest pedido = HttpRequest.newBuilder(api)
                    .timeout(Duration.ofSeconds(10))
                    .header("api-key", clave)
                    .header("accept", "application/json")
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(cuerpo, StandardCharsets.UTF_8))
                    .build();
            return http.sendAsync(pedido, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(respuesta -> {
                        if (respuesta.statusCode() / 100 == 2) {
                            log.info("Brevo aceptó el correo a {} (HTTP {}): {}", para, respuesta.statusCode(), respuesta.body());
                        } else {
                            log.warn("Brevo rechazó el correo a {} (HTTP {}): {}", para, respuesta.statusCode(), respuesta.body());
                        }
                    })
                    .exceptionally(error -> {
                        log.warn("No se pudo enviar el correo a {} por Brevo: {}", para, error.getMessage());
                        return null;
                    });
        } catch (RuntimeException | JsonProcessingException error) {
            log.warn("No se pudo preparar el correo a {} para Brevo: {}", para, error.getMessage());
            return CompletableFuture.completedFuture(null);
        }
    }
}
