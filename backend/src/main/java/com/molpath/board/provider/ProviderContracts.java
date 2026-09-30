package com.molpath.board.provider;

import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import java.util.List;
import java.util.Optional;

/**
 * Puertos de la capa de proveedores externos (patrón Adapter). La aplicación depende de estas
 * interfaces, nunca de una API concreta. Cada adaptador informa su estado y la versión de la fuente.
 */
public final class ProviderContracts {

    private ProviderContracts() {
    }

    public enum ProviderStatus { ENABLED, DISABLED, LICENSE_REVIEW_REQUIRED }

    public record ProviderInfo(String sourceCode, String name, String capability, ProviderStatus status,
            String statusDetail, String documentationUrl) {}

    public interface ExternalProvider {
        ProviderInfo info();

        /** Etiqueta de versión observada en la fuente (p. ej. "Reactome v97"). */
        String currentVersionLabel();
    }

    // ─── publicaciones ───────────────────────────────────────────────────────────

    public record PublicationRecord(String pmid, String doi, String title, String authors, String journal,
            Integer pubYear, String pubDate, String abstractText) {}

    public interface PublicationProvider extends ExternalProvider {
        /** Vacío si el PMID no existe en la fuente. Nunca se fabrica un registro. */
        Optional<PublicationRecord> fetchByPmid(String pmid);
    }

    // ─── evidencia de variantes ─────────────────────────────────────────────────

    public record EvidenceCandidate(
            String sourceCode, String externalId, String geneSymbol, String variantDescriptor,
            String molecularProfile, EvidenceType evidenceType, String description, String diseaseContext,
            String sourceLevel, String sourceDirection, String sourceSignificance, Integer sourceRating,
            List<String> therapies, InterpretationScope interpretationScope, Certainty mappedCertainty,
            String url, String pmid, String citation, Integer publicationYear) {}

    public record EvidenceSearchResult(String sourceCode, String query, String matchedProfile,
            List<EvidenceCandidate> items, int totalCount, String nextCursor, String note) {}

    public interface EvidenceProvider extends ExternalProvider {
        EvidenceSearchResult search(String geneSymbol, String proteinChange, int size, String cursor);

        Optional<EvidenceCandidate> fetchById(String externalId);
    }

    // ─── significado clínico (ClinVar) ──────────────────────────────────────────

    public record Classification(String description, String reviewStatus, String lastEvaluated,
            List<String> conditions) {

        public boolean isEmpty() {
            return description == null || description.isBlank();
        }
    }

    /** Las clasificaciones germinal y somáticas se mantienen separadas. */
    public record ClinVarRecord(String uid, String accession, String title, String proteinChange, String url,
            Classification germline, Classification somaticClinicalImpact, Classification oncogenicity) {}

    public interface ClinicalSignificanceProvider extends ExternalProvider {
        List<ClinVarRecord> search(String geneSymbol, String proteinChange);

        Optional<ClinVarRecord> fetch(String uid);
    }

    // ─── pathways ───────────────────────────────────────────────────────────────

    public record PathwayCandidate(String externalId, String name, String url) {}

    public record GenePathwayResult(String geneSymbol, String uniprotId, List<PathwayCandidate> pathways,
            String note) {}

    public interface PathwayProvider extends ExternalProvider {
        GenePathwayResult findPathwaysForGene(String geneSymbol);
    }
}
