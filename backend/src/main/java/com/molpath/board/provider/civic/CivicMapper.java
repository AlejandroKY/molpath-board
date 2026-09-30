package com.molpath.board.provider.civic;

import com.molpath.board.common.Json;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/**
 * Traducción de registros CIViC al modelo de MolPath.
 * El mapeo de nivel → certeza es una regla documentada (ARCHITECTURE.md, ADR-005);
 * el nivel y la dirección originales se conservan siempre.
 */
public final class CivicMapper {

    private static final Pattern SIMPLE_PROFILE = Pattern.compile("^([A-Za-z0-9.-]+) (\\S+)$");

    private CivicMapper() {
    }

    /** A→STRONG, B→MODERATE, C/D→LIMITED, E→INSUFFICIENT; cualquier otro valor → UNKNOWN. */
    public static Certainty certaintyForLevel(String level) {
        if (level == null) {
            return Certainty.UNKNOWN;
        }
        return switch (level.trim().toUpperCase(Locale.ROOT)) {
            case "A" -> Certainty.STRONG;
            case "B" -> Certainty.MODERATE;
            case "C", "D" -> Certainty.LIMITED;
            case "E" -> Certainty.INSUFFICIENT;
            default -> Certainty.UNKNOWN;
        };
    }

    public static EvidenceType evidenceType(String civicType) {
        if (civicType == null) {
            return null;
        }
        return switch (civicType.toUpperCase(Locale.ROOT)) {
            case "PREDICTIVE" -> EvidenceType.PREDICTIVE;
            case "DIAGNOSTIC" -> EvidenceType.DIAGNOSTIC;
            case "PROGNOSTIC" -> EvidenceType.PROGNOSTIC;
            case "PREDISPOSING" -> EvidenceType.PREDISPOSITION;
            case "ONCOGENIC" -> EvidenceType.ONCOGENIC;
            case "FUNCTIONAL" -> EvidenceType.FUNCTIONAL;
            default -> null;
        };
    }

    public static InterpretationScope scope(String variantOrigin) {
        if (variantOrigin == null) {
            return InterpretationScope.NOT_APPLICABLE;
        }
        String origin = variantOrigin.toUpperCase(Locale.ROOT);
        if (origin.equals("SOMATIC")) {
            return InterpretationScope.SOMATIC;
        }
        if (origin.contains("GERMLINE")) {
            return InterpretationScope.GERMLINE;
        }
        return InterpretationScope.NOT_APPLICABLE;
    }

    /** Devuelve {@code null} si el registro no tiene un tipo de evidencia reconocible. */
    public static EvidenceCandidate toCandidate(JsonNode node) {
        EvidenceType type = evidenceType(Json.text(node, "evidenceType"));
        String description = Text.clean(Json.text(node, "description"));
        Integer id = Json.integer(node, "id");
        if (type == null || description == null || id == null) {
            return null;
        }
        String profile = Json.text(node.path("molecularProfile"), "name");
        String gene = null;
        String descriptor = profile;
        if (profile != null) {
            Matcher m = SIMPLE_PROFILE.matcher(profile);
            if (m.matches()) {
                gene = m.group(1).toUpperCase(Locale.ROOT);
                descriptor = m.group(2);
            }
        }
        List<String> therapies = new ArrayList<>();
        for (JsonNode therapy : node.path("therapies")) {
            String name = Json.text(therapy, "name");
            if (name != null) {
                therapies.add(name);
            }
        }
        JsonNode source = node.path("source");
        String pmid = "PUBMED".equalsIgnoreCase(Json.text(source, "sourceType")) ? Json.text(source, "citationId") : null;
        String level = Json.text(node, "evidenceLevel");
        return new EvidenceCandidate(SourceCodes.CIVIC, "EID" + id, gene, descriptor, profile, type, description,
                Json.text(node.path("disease"), "name"), level, Json.text(node, "evidenceDirection"),
                Json.text(node, "significance"), Json.integer(node, "evidenceRating"), List.copyOf(therapies),
                scope(Json.text(node, "variantOrigin")), certaintyForLevel(level),
                "https://civicdb.org/evidence/" + id + "/summary", pmid, Json.text(source, "citation"),
                Json.integer(source, "publicationYear"));
    }
}
