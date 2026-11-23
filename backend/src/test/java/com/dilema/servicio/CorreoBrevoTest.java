package com.dilema.servicio;

import com.dilema.modelo.Usuario;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * PRUEBA DE: envío de correos por la API HTTPS de Brevo.
 * PATRÓN: BitacoraServicio elige Brevo si hay clave y SMTP si no; un fallo solo queda en el log.
 * REQUISITO: RF-27 (avisos por correo).
 * COMANDO: mvn -f backend/pom.xml test -Dtest=CorreoBrevoTest
 */
class CorreoBrevoTest {
    private final ObjectMapper json = new ObjectMapper();
    private HttpServer servidor;

    @AfterEach
    void apagar() {
        if (servidor != null) servidor.stop(0);
    }

    @Test
    @DisplayName("RF-27 envía a Brevo el remitente, destinatario, asunto y texto con la clave")
    void enviaPostConClaveYJson() throws Exception {
        // RF-27 · Qué prueba: el POST que recibe Brevo.
        // Esperado: cabecera api-key y JSON con sender, to, subject y textContent.
        // ARRANGE
        AtomicReference<String> clave = new AtomicReference<>();
        AtomicReference<String> cuerpo = new AtomicReference<>();
        URI api = levantar(201, "{\"messageId\":\"<abc@brevo>\"}", clave, cuerpo);
        CorreoBrevo brevo = new CorreoBrevo("clave-prueba", json, api);

        // ACT
        brevo.enviar("dilema@psicosim.edu", "ana@uni.edu", "Convocatoria", "Hola, Ana").get(5, TimeUnit.SECONDS);

        // ASSERT
        assertEquals("clave-prueba", clave.get());
        JsonNode enviado = json.readTree(cuerpo.get());
        assertEquals("dilema@psicosim.edu", enviado.at("/sender/email").asText());
        assertEquals("ana@uni.edu", enviado.at("/to/0/email").asText());
        assertEquals("Convocatoria", enviado.get("subject").asText());
        assertEquals("Hola, Ana", enviado.get("textContent").asText());
    }

    @Test
    @DisplayName("RF-27 si Brevo responde error o no hay red, el envío no lanza excepción")
    void falloDeBrevoNoRompe() throws Exception {
        // RF-27 · Qué prueba: respuesta 500 y servidor inexistente.
        // Esperado: el futuro termina normal y el fallo queda en el log.
        // ARRANGE
        URI api = levantar(500, "{\"code\":\"error\"}", new AtomicReference<>(), new AtomicReference<>());
        CorreoBrevo conError = new CorreoBrevo("clave", json, api);
        CorreoBrevo sinRed = new CorreoBrevo("clave", json, URI.create("http://127.0.0.1:1/v3/smtp/email"));

        // ACT + ASSERT
        assertDoesNotThrow(() -> conError.enviar("a@x.edu", "b@x.edu", "T", "C").get(5, TimeUnit.SECONDS));
        assertDoesNotThrow(() -> sinRed.enviar("a@x.edu", "b@x.edu", "T", "C").get(15, TimeUnit.SECONDS));
    }

    @Test
    @DisplayName("RF-27 con clave usa Brevo y no SMTP; sin clave usa SMTP como antes")
    void bitacoraEligeCanal() throws Exception {
        // RF-27 · Qué prueba: la elección entre Brevo y JavaMailSender.
        // Esperado: con clave no se toca SMTP; con clave vacía sí.
        // ARRANGE
        AtomicReference<String> cuerpo = new AtomicReference<>();
        URI api = levantar(201, "{}", new AtomicReference<>(), cuerpo);
        JavaMailSender smtpConBrevo = mock(JavaMailSender.class);
        JavaMailSender smtpSinBrevo = mock(JavaMailSender.class);
        BitacoraServicio conBrevo = new BitacoraServicio(smtpConBrevo, "d@x.edu", null, new CorreoBrevo("clave", json, api));
        BitacoraServicio sinBrevo = new BitacoraServicio(smtpSinBrevo, "d@x.edu", null, new CorreoBrevo("  ", json, api));
        Usuario estudiante = new Usuario();
        estudiante.email = "e@x.edu";

        // ACT
        conBrevo.avisar(estudiante, "CORREO", "Nota", "cuerpo");
        sinBrevo.avisar(estudiante, "CORREO", "Nota", "cuerpo");

        // ASSERT
        verifyNoInteractions(smtpConBrevo);
        verify(smtpSinBrevo).send(any(SimpleMailMessage.class));
        long limite = System.currentTimeMillis() + 5000;   // el envío por Brevo es asíncrono
        while (cuerpo.get() == null && System.currentTimeMillis() < limite) Thread.onSpinWait();
        assertTrue(cuerpo.get() != null && cuerpo.get().contains("e@x.edu"));
        assertFalse(new CorreoBrevo(null, json).activo());
    }

    private URI levantar(int estado, String respuesta, AtomicReference<String> clave, AtomicReference<String> cuerpo) throws Exception {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/v3/smtp/email", intercambio -> {
            clave.set(intercambio.getRequestHeaders().getFirst("api-key"));
            cuerpo.set(new String(intercambio.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = respuesta.getBytes(StandardCharsets.UTF_8);
            intercambio.sendResponseHeaders(estado, bytes.length);
            intercambio.getResponseBody().write(bytes);
            intercambio.close();
        });
        servidor.start();
        return URI.create("http://127.0.0.1:" + servidor.getAddress().getPort() + "/v3/smtp/email");
    }
}
