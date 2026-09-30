package com.molpath.board.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Path;

/**
 * PostgreSQL real embebido (sin Docker) compartido por todas las pruebas de integración de la JVM.
 * También lo usa {@code TestMolPathApplication} para desarrollo local con datos persistentes.
 */
public final class EmbeddedPg {

    private static EmbeddedPostgres instance;

    private EmbeddedPg() {
    }

    public static synchronized String jdbcUrl() {
        if (instance == null) {
            instance = start(null, 0);
        }
        return instance.getJdbcUrl("postgres", "postgres");
    }

    static EmbeddedPostgres start(Path dataDirectory, int port) {
        try {
            EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
            if (dataDirectory != null) {
                builder.setDataDirectory(dataDirectory).setCleanDataDirectory(false);
            }
            if (port > 0) {
                builder.setPort(port);
            }
            EmbeddedPostgres pg = builder.start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    pg.close();
                } catch (IOException ignored) {
                    // apagado de la JVM
                }
            }));
            return pg;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo iniciar PostgreSQL embebido", e);
        }
    }
}
