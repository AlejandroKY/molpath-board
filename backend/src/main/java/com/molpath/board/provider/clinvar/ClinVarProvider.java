package com.molpath.board.provider.clinvar;

import com.molpath.board.common.Json;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.molecular.ProteinChange;
import com.molpath.board.provider.ProviderContracts.ClinVarRecord;
import com.molpath.board.provider.ProviderContracts.ClinicalSignificanceProvider;
import com.molpath.board.provider.ProviderContracts.Classification;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.ProviderStatus;
import com.molpath.board.provider.VersionCache;
import com.molpath.board.provider.ncbi.NcbiClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Clasificaciones de ClinVar vía E-utilities (esearch + esummary, db=clinvar).
 * La clasificación germinal, el impacto clínico somático y la oncogenicidad se devuelven por separado
 * y nunca se fusionan.
 */
@Component
public class ClinVarProvider implements ClinicalSignificanceProvider {

    private static final int MAX_RESULTS = 20;

    private final NcbiClient ncbi;
    private final ObjectMapper objectMapper;
    private final VersionCache versionCache = new VersionCache(Duration.ofHours(1));

    public ClinVarProvider(NcbiClient ncbi, ObjectMapper objectMapper) {
        this.ncbi = ncbi;
        this.objectMapper = objectMapper;
    }

    @Override
    public ProviderInfo info() {
        return new ProviderInfo(SourceCodes.CLINVAR, "ClinVar (NCBI E-utilities)",
                "Clasificación germinal, impacto clínico somático y oncogenicidad (separados)",
                ProviderStatus.ENABLED, "API oficial de NCBI.", "https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/");
    }

    @Override
    public List<ClinVarRecord> search(String geneSymbol, String proteinChange) {
        String normalized = ProteinChange.normalize(proteinChange);
        String threeLetter = ProteinChange.toThreeLetter(normalized);
        String term = geneSymbol + "[gene] AND \"" + (threeLetter != null ? threeLetter : normalized) + "\"";
        JsonNode search = objectMapper.readTree(ncbi.get(SourceCodes.CLINVAR, "esearch.fcgi",
                Map.of("db", "clinvar", "term", term, "retmode", "json", "retmax", String.valueOf(MAX_RESULTS))));
        List<String> ids = new ArrayList<>();
        for (JsonNode id : search.path("esearchresult").path("idlist")) {
            ids.add(id.asString());
        }
        if (ids.isEmpty()) {
            return List.of();
        }
        List<ClinVarRecord> records = summaries(ids);
        String needleOne = normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
        return records.stream().filter(r -> matches(r, needleOne, threeLetter)).toList();
    }

    @Override
    public Optional<ClinVarRecord> fetch(String uid) {
        if (uid == null || !uid.matches("\\d{1,12}")) {
            throw new IllegalArgumentException("UID de ClinVar no válido: " + uid);
        }
        return summaries(List.of(uid)).stream().findFirst();
    }

    @Override
    public String currentVersionLabel() {
        return versionCache.get(() -> {
            JsonNode info = objectMapper.readTree(ncbi.get(SourceCodes.CLINVAR, "einfo.fcgi",
                    Map.of("db", "clinvar", "retmode", "json")));
            String lastUpdate = Json.text(info.path("einforesult").path("dbinfo").path(0), "lastupdate");
            return "NCBI E-utilities (ClinVar lastupdate " + (lastUpdate == null ? "desconocido" : lastUpdate) + ")";
        });
    }

    private List<ClinVarRecord> summaries(List<String> ids) {
        JsonNode result = objectMapper.readTree(ncbi.get(SourceCodes.CLINVAR, "esummary.fcgi",
                Map.of("db", "clinvar", "id", String.join(",", ids), "retmode", "json"))).path("result");
        return parseSummaries(result);
    }

    /** Visible para pruebas: interpreta el nodo {@code result} de esummary. */
    public static List<ClinVarRecord> parseSummaries(JsonNode result) {
        List<ClinVarRecord> records = new ArrayList<>();
        for (JsonNode uidNode : result.path("uids")) {
            String uid = uidNode.asString();
            JsonNode doc = result.path(uid);
            if (doc.isMissingNode()) {
                continue;
            }
            records.add(new ClinVarRecord(uid, Json.text(doc, "accession"), Json.text(doc, "title"),
                    Json.text(doc, "protein_change"), "https://www.ncbi.nlm.nih.gov/clinvar/variation/" + uid + "/",
                    classification(doc.path("germline_classification")),
                    classification(doc.path("clinical_impact_classification")),
                    classification(doc.path("oncogenicity_classification"))));
        }
        return records;
    }

    private static Classification classification(JsonNode node) {
        List<String> conditions = new ArrayList<>();
        for (JsonNode trait : node.path("trait_set")) {
            String name = Json.text(trait, "trait_name");
            if (name != null) {
                conditions.add(name);
            }
        }
        String lastEvaluated = Json.text(node, "last_evaluated");
        if (lastEvaluated != null && lastEvaluated.startsWith("1/01/01")) {
            lastEvaluated = null; // valor centinela de NCBI para "sin fecha"
        }
        return new Classification(Json.text(node, "description"), Json.text(node, "review_status"), lastEvaluated,
                List.copyOf(conditions));
    }

    private static boolean matches(ClinVarRecord record, String oneLetter, String threeLetter) {
        String protein = record.proteinChange() == null ? "" : record.proteinChange().toUpperCase(Locale.ROOT);
        String title = record.title() == null ? "" : record.title();
        boolean byOne = oneLetter != null && List.of(protein.split(",\\s*")).contains(oneLetter);
        boolean byThree = threeLetter != null && title.contains("p." + threeLetter + ")");
        return byOne || byThree;
    }
}
