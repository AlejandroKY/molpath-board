package com.molpath.board.provider.civic;

import com.molpath.board.common.Exceptions.ExternalServiceException;
import com.molpath.board.common.Exceptions.ProviderUnavailableException;
import com.molpath.board.common.Json;
import com.molpath.board.config.AppProperties;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import com.molpath.board.provider.ProviderContracts.EvidenceProvider;
import com.molpath.board.provider.ProviderContracts.EvidenceSearchResult;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import com.molpath.board.provider.VersionCache;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Evidencia de variantes oncológicas desde la API GraphQL oficial de CIViC (contenido CC0).
 * Las consultas usan variables GraphQL: el texto del usuario nunca se interpola en la query.
 */
@Component
public class CivicProvider implements EvidenceProvider {

    private static final String EVIDENCE_FIELDS = """
            fragment EvidenceFields on EvidenceItem {
              id name evidenceType evidenceLevel evidenceDirection significance evidenceRating description variantOrigin
              disease { name } therapies { name } molecularProfile { name }
              source { citationId sourceType citation publicationYear }
            }
            """;

    private static final String PROFILE_QUERY =
            "query($name: String!) { molecularProfiles(name: $name, first: 25) { nodes { id name } } }";

    private static final String EVIDENCE_QUERY = """
            query($mp: Int!, $first: Int!, $after: String) {
              evidenceItems(molecularProfileId: $mp, status: ACCEPTED, first: $first, after: $after) {
                totalCount pageInfo { endCursor hasNextPage } nodes { ...EvidenceFields }
              }
            }
            """ + EVIDENCE_FIELDS;

    private static final String EVIDENCE_BY_ID_QUERY =
            "query($id: Int!) { evidenceItem(id: $id) { ...EvidenceFields status } }\n" + EVIDENCE_FIELDS;

    private final RestClient http;
    private final ObjectMapper objectMapper;
    private final AppProperties.Civic config;
    private final VersionCache versionCache = new VersionCache(Duration.ofHours(6));

    public CivicProvider(RestClient externalRestClient, ObjectMapper objectMapper, AppProperties properties) {
        this.http = externalRestClient;
        this.objectMapper = objectMapper;
        this.config = properties.providers().civic();
    }

    @Override
    public ProviderInfo info() {
        return new ProviderInfo(SourceCodes.CIVIC, "CIViC", "Evidencia clínica de variantes en cáncer (CC0)",
                config.enabled() ? ProviderStatus.ENABLED : ProviderStatus.DISABLED,
                config.enabled() ? "API GraphQL oficial." : "Desactivado por configuración.",
                "https://griffithlab.github.io/civic-v2/");
    }

    @Override
    public EvidenceSearchResult search(String geneSymbol, String proteinChange, int size, String cursor) {
        requireEnabled();
        String profileName = geneSymbol + " " + proteinChange;
        JsonNode profiles = query(PROFILE_QUERY, Map.of("name", profileName)).path("molecularProfiles").path("nodes");
        Integer profileId = null;
        String matched = null;
        for (JsonNode profile : profiles) {
            String name = Json.text(profile, "name");
            if (name != null && name.equalsIgnoreCase(profileName)) {
                profileId = Json.integer(profile, "id");
                matched = name;
                break;
            }
        }
        if (profileId == null) {
            return new EvidenceSearchResult(SourceCodes.CIVIC, profileName, null, List.of(), 0, null,
                    "CIViC no tiene un perfil molecular con nombre exacto '" + profileName + "'.");
        }
        Map<String, Object> variables = new HashMap<>();
        variables.put("mp", profileId);
        variables.put("first", Math.max(1, Math.min(size, 50)));
        variables.put("after", cursor);
        JsonNode items = query(EVIDENCE_QUERY, variables).path("evidenceItems");
        List<EvidenceCandidate> candidates = new ArrayList<>();
        for (JsonNode node : items.path("nodes")) {
            EvidenceCandidate candidate = CivicMapper.toCandidate(node);
            if (candidate != null) {
                candidates.add(candidate);
            }
        }
        JsonNode pageInfo = items.path("pageInfo");
        String next = pageInfo.path("hasNextPage").asBoolean(false) ? Json.text(pageInfo, "endCursor") : null;
        return new EvidenceSearchResult(SourceCodes.CIVIC, profileName, matched, candidates,
                Objects.requireNonNullElse(Json.integer(items, "totalCount"), candidates.size()), next,
                "Sólo evidencias con estado ACCEPTED en CIViC.");
    }

    @Override
    public Optional<EvidenceCandidate> fetchById(String externalId) {
        requireEnabled();
        String digits = externalId == null ? "" : externalId.replaceFirst("(?i)^EID", "");
        if (!digits.matches("\\d{1,9}")) {
            throw new IllegalArgumentException("Identificador CIViC no válido: " + externalId);
        }
        JsonNode item = query(EVIDENCE_BY_ID_QUERY, Map.of("id", Integer.valueOf(digits))).path("evidenceItem");
        if (item.isMissingNode() || item.isNull()) {
            return Optional.empty();
        }
        return Optional.ofNullable(CivicMapper.toCandidate(item));
    }

    @Override
    public String currentVersionLabel() {
        return versionCache.get(() -> {
            String latest = null;
            for (JsonNode release : query("{ dataReleases { name } }", Map.of()).path("dataReleases")) {
                String name = Json.text(release, "name");
                if (name != null && !"nightly".equalsIgnoreCase(name)) {
                    latest = name;
                    break;
                }
            }
            return latest == null ? "API GraphQL en vivo"
                    : "API GraphQL en vivo (release mensual más reciente: " + latest + ")";
        });
    }

    private JsonNode query(String query, Map<String, Object> variables) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", query);
        body.put("variables", variables);
        try {
            String response = http.post().uri(config.graphqlUrl()).contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(body)).retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(response == null ? "{}" : response);
            if (root.has("errors") && !root.path("errors").isEmpty()) {
                throw new ExternalServiceException(SourceCodes.CIVIC,
                        "CIViC devolvió un error: " + Json.text(root.path("errors").path(0), "message"));
            }
            return root.path("data");
        } catch (RestClientException e) {
            throw new ExternalServiceException(SourceCodes.CIVIC, "No se pudo consultar CIViC", e);
        }
    }

    private void requireEnabled() {
        if (!config.enabled()) {
            throw new ProviderUnavailableException(SourceCodes.CIVIC, "desactivado por configuración");
        }
    }
}
