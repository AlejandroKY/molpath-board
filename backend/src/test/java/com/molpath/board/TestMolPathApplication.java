package com.molpath.board;

import com.molpath.board.support.DevEmbeddedDatabase;
import java.util.UUID;
import org.springframework.boot.SpringApplication;

/**
 * Arranque local SIN Docker: PostgreSQL embebido persistente en {@code backend/.data/pg}, login de
 * desarrollo y dataset demo. Uso: {@code ./mvnw spring-boot:test-run}.
 */
public class TestMolPathApplication {

    public static void main(String[] args) {
        defaultProperty("molpath.security.dev-login-enabled", "true");
        defaultProperty("molpath.demo.seed", "true");
        defaultProperty("molpath.security.cors-origins", "http://localhost:5173");
        if (System.getenv("MOLPATH_JWT_SECRET") == null) {
            // Sólo desarrollo local: secreto aleatorio en cada arranque (los tokens caducan al reiniciar).
            defaultProperty("molpath.security.jwt-secret", UUID.randomUUID() + "-" + UUID.randomUUID());
        }
        SpringApplication.from(MolPathApplication::main).with(DevEmbeddedDatabase.class).run(args);
    }

    private static void defaultProperty(String key, String value) {
        if (System.getProperty(key) == null) {
            System.setProperty(key, value);
        }
    }
}
