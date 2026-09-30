package com.molpath.board.provider.reactome;

import com.molpath.board.common.Exceptions.ExternalServiceException;
import com.molpath.board.common.Exceptions.ProviderUnavailableException;
import com.molpath.board.common.Json;
import com.molpath.board.common.Text;
import com.molpath.board.config.AppProperties;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.provider.ProviderContracts.GenePathwayResult;
import com.molpath.board.provider.ProviderContracts.PathwayCandidate;
import com.molpath.board.provider.ProviderContracts.PathwayProvider;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import com.molpath.board.provider.VersionCache;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Pertenencia gen → pathway desde Reactome ContentService:
 * símbolo → UniProt (búsqueda exacta de ReferenceGeneProduct humano) → pathways de bajo nivel.
 * No se infieren relaciones gen → gen.
 */
@Component
public class ReactomeProvider implements PathwayProvider {

    private final RestClient http;
    private final ObjectMapper objectMapper;
    private final AppProperties.Reactome config;
    private final VersionCache versionCache = new VersionCache(Duration.ofHours(12));

    public ReactomeProvider(RestClient externalRestClient, ObjectMapper objectMapper, AppProperties properties) {
        this.http = externalRestClient;
        this.objectMapper = objectMapper;
        this.config = properties.providers().reactome();
    }

    @Override
    public ProviderInfo info() {
        return new ProviderInfo(SourceCodes.REACTOME, "Reactome", "Gen → pathways (CC BY 4.0)",
                config.enabled() ? ProviderStatus.ENABLED : ProviderStatus.DISABLED,
                config.enabled() ? "ContentService oficial." : "Desactivado por configuración.",
                "https://reactome.org/ContentService/");
    }

    @Override
    public GenePathwayResult findPathwaysForGene(String geneSymbol) {
        if (!config.enabled()) {
            throw new ProviderUnavailableException(SourceCodes.REACTOME, "desactivado por configuración");
        }
        URI searchUri = UriComponentsBuilder.fromUriString(config.baseUrl()).path("/search/query")
                .queryParam("query", geneSymbol).queryParam("species", "Homo sapiens")
                .queryParam("types", "Protein").queryParam("cluster", "true").encode().build().toUri();
        JsonNode search = getJson(searchUri, true);
        String uniprot = null;
        if (search != null) {
            for (JsonNode group : search.path("results")) {
                for (JsonNode entry : group.path("entries")) {
                    String referenceName = Text.stripHtml(Json.text(entry, "referenceName"));
                    if (geneSymbol.equalsIgnoreCase(referenceName)
                            && "UniProt".equalsIgnoreCase(Json.text(entry, "databaseName"))) {
                        uniprot = Json.text(entry, "referenceIdentifier");
                        break;
                    }
                }
                if (uniprot != null) {
                    break;
                }
            }
        }
        if (uniprot == null) {
            return new GenePathwayResult(geneSymbol, null, List.of(),
                    "Reactome no devolvió una proteína humana con nombre de referencia exacto '" + geneSymbol + "'.");
        }
        URI mappingUri = UriComponentsBuilder.fromUriString(config.baseUrl())
                .path("/data/mapping/UniProt/{acc}/pathways").queryParam("species", "9606")
                .buildAndExpand(uniprot).encode().toUri();
        JsonNode pathways = getJson(mappingUri, true);
        List<PathwayCandidate> candidates = new ArrayList<>();
        if (pathways != null) {
            for (JsonNode p : pathways) {
                String stId = Json.text(p, "stId");
                String name = Text.stripHtml(Json.text(p, "displayName"));
                if (stId != null && name != null) {
                    candidates.add(new PathwayCandidate(stId, name, "https://reactome.org/content/detail/" + stId));
                }
            }
        }
        return new GenePathwayResult(geneSymbol, uniprot, candidates, null);
    }

    @Override
    public String currentVersionLabel() {
        return versionCache.get(() -> {
            try {
                String version = http.get().uri(config.baseUrl() + "/data/database/version").retrieve()
                        .body(String.class);
                return "Reactome v" + (version == null ? "?" : version.trim());
            } catch (RestClientException e) {
                throw new ExternalServiceException(SourceCodes.REACTOME, "No se pudo obtener la versión de Reactome", e);
            }
        });
    }

    private JsonNode getJson(URI uri, boolean notFoundAsEmpty) {
        try {
            String body = http.get().uri(uri).retrieve().body(String.class);
            return body == null ? null : objectMapper.readTree(body);
        } catch (HttpClientErrorException.NotFound e) {
            if (notFoundAsEmpty) {
                return null;
            }
            throw new ExternalServiceException(SourceCodes.REACTOME, "Recurso no encontrado en Reactome", e);
        } catch (RestClientException e) {
            throw new ExternalServiceException(SourceCodes.REACTOME, "No se pudo consultar Reactome", e);
        }
    }
}
