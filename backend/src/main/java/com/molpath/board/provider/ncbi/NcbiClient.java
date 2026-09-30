package com.molpath.board.provider.ncbi;

import com.molpath.board.common.Exceptions.ExternalServiceException;
import com.molpath.board.config.AppProperties;
import java.net.URI;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Cliente de NCBI E-utilities compartido (PubMed, ClinVar, Gene).
 * Respeta el límite publicado por NCBI: 3 peticiones/s sin API key, 10 con API key.
 * Envía {@code tool} y {@code email} como recomienda NCBI.
 */
@Component
public class NcbiClient {

    private final RestClient http;
    private final AppProperties.Ncbi config;
    private long lastRequestAt;

    public NcbiClient(RestClient externalRestClient, AppProperties properties) {
        this.http = externalRestClient;
        this.config = properties.providers().ncbi();
    }

    public String get(String sourceCode, String utility, Map<String, String> params) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(config.baseUrl()).path("/" + utility);
        params.forEach(builder::queryParam);
        builder.queryParam("tool", config.tool());
        if (config.contactEmail() != null && !config.contactEmail().isBlank()) {
            builder.queryParam("email", config.contactEmail());
        }
        if (config.hasApiKey()) {
            builder.queryParam("api_key", config.apiKey());
        }
        URI uri = builder.encode().build().toUri();
        throttle();
        try {
            String body = http.get().uri(uri).retrieve().body(String.class);
            if (body == null) {
                throw new ExternalServiceException(sourceCode, "Respuesta vacía de NCBI E-utilities");
            }
            return body;
        } catch (RestClientException e) {
            throw new ExternalServiceException(sourceCode, "No se pudo consultar NCBI E-utilities (" + utility + ")", e);
        }
    }

    private synchronized void throttle() {
        long minGapMs = config.hasApiKey() ? 110 : 350;
        long wait = lastRequestAt + minGapMs - System.currentTimeMillis();
        if (wait > 0) {
            try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastRequestAt = System.currentTimeMillis();
    }
}
