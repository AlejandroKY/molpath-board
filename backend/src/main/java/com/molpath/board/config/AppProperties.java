package com.molpath.board.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuración tipada de MolPath Board. Todos los secretos llegan por variables de entorno. */
@ConfigurationProperties(prefix = "molpath")
public record AppProperties(App app, Security security, Demo demo, Providers providers) {

    public record App(String name) {}

    public record Security(String jwtSecret, long jwtTtlMinutes, boolean devLoginEnabled, List<String> corsOrigins) {}

    public record Demo(boolean seed) {}

    public record Providers(Duration timeout, Ncbi ncbi, Civic civic, Reactome reactome, OncoKb oncokb) {}

    public record Ncbi(String baseUrl, String apiKey, String contactEmail, String tool) {
        public boolean hasApiKey() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record Civic(String graphqlUrl, boolean enabled) {}

    public record Reactome(String baseUrl, boolean enabled) {}

    public record OncoKb(boolean enabled) {}
}
