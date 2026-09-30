package com.molpath.board.knowledge;

import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceStatus;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.molecular.MolecularDtos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class KnowledgeDtos {

    public static final String PMID_REGEX = "^[0-9]{1,10}$";
    public static final String DOI_REGEX = "^10\\.\\d{4,9}/\\S+$";

    private KnowledgeDtos() {
    }

    public record SourceVersionDto(UUID id, String sourceCode, String versionLabel, Instant retrievedAt) {

        public static SourceVersionDto from(SourceVersion v) {
            return new SourceVersionDto(v.getId(), v.getSourceCode(), v.getVersionLabel(), v.getRetrievedAt());
        }
    }

    public record GeneDto(UUID id, String symbol, String name, String entrezId, String uniprotId, String ncbiUrl,
            UUID sourceVersionId) {

        public static GeneDto from(Gene g) {
            String ncbiUrl = g.getEntrezId() == null ? null
                    : "https://www.ncbi.nlm.nih.gov/gene/" + g.getEntrezId();
            return new GeneDto(g.getId(), g.getSymbol(), g.getName(), g.getEntrezId(), g.getUniprotId(), ncbiUrl,
                    g.getSourceVersionId());
        }
    }

    public record PathwayDto(UUID id, String sourceCode, String externalId, String name, String url,
            UUID sourceVersionId) {

        public static PathwayDto from(Pathway p) {
            String url = "REACTOME".equals(p.getSourceCode())
                    ? "https://reactome.org/content/detail/" + p.getExternalId() : null;
            return new PathwayDto(p.getId(), p.getSourceCode(), p.getExternalId(), p.getName(), url,
                    p.getSourceVersionId());
        }
    }

    public record GenePathwayDto(UUID geneId, UUID pathwayId, UUID sourceVersionId, Instant retrievedAt) {

        public static GenePathwayDto from(Pathway.GenePathway gp) {
            return new GenePathwayDto(gp.getId().geneId(), gp.getId().pathwayId(), gp.getSourceVersionId(),
                    gp.getRetrievedAt());
        }
    }

    public record PublicationDto(UUID id, String pmid, String pubmedUrl, String doi, String doiUrl, String title,
            String authors, String journal, Integer pubYear, String pubDate, String abstractText,
            UUID sourceVersionId, Instant retrievedAt) {

        public static PublicationDto from(Publication p) {
            return new PublicationDto(p.getId(), p.getPmid(), Publication.pubmedUrl(p.getPmid()), p.getDoi(),
                    p.getDoi() == null ? null : "https://doi.org/" + p.getDoi(), p.getTitle(), p.getAuthors(),
                    p.getJournal(), p.getPubYear(), p.getPubDate(), p.getAbstractText(), p.getSourceVersionId(),
                    p.getRetrievedAt());
        }
    }

    public record EvidenceDto(
            UUID id, UUID geneId, String geneSymbol, String variantDescriptor, EvidenceType evidenceType,
            String description, String diseaseContext, Certainty certainty, CertaintyBasis certaintyBasis,
            String sourceLevel, String sourceDirection, String sourceSignificance, Integer sourceRating,
            String sourceTherapies, InterpretationScope interpretationScope, String sourceCode, String externalId,
            String url, UUID publicationId, String pmid, String pubmedUrl, String doi, String publishedDate,
            UUID sourceVersionId, String sourceVersionLabel, Instant retrievedAt, EvidenceStatus status,
            String statusReason, Instant createdAt, Long version) {}

    public record EvidenceLinkDto(UUID variantId, UUID evidenceId, Instant linkedAt, UUID linkedBy, String note) {

        public static EvidenceLinkDto from(Evidence.VariantEvidenceLink l) {
            return new EvidenceLinkDto(l.variantId(), l.evidenceId(), l.getLinkedAt(), l.getLinkedBy(), l.getNote());
        }
    }

    /**
     * Evidencia introducida manualmente. Debe citar al menos PMID, DOI o URL.
     * Si se indica PMID se verifica contra PubMed antes de guardar (no se aceptan PMIDs inexistentes).
     */
    public record ManualEvidenceRequest(
            @Pattern(regexp = MolecularDtos.GENE_SYMBOL_REGEX, message = "símbolo génico no válido") String geneSymbol,
            @Size(max = 200) String variantDescriptor,
            @NotNull EvidenceType evidenceType,
            @NotBlank @Size(max = 10000) String description,
            @Size(max = 300) String diseaseContext,
            Certainty certainty,
            InterpretationScope interpretationScope,
            @Pattern(regexp = PMID_REGEX, message = "PMID numérico") String pmid,
            @Pattern(regexp = DOI_REGEX, message = "DOI con formato 10.xxxx/...") String doi,
            @Size(max = 1000) @Pattern(regexp = "^https?://\\S+$", message = "URL http(s) válida") String url,
            @Size(max = 40) String publishedDate,
            UUID linkToVariantId,
            @Size(max = 1000) String linkNote) {

        public ManualEvidenceRequest {
            geneSymbol = Text.upper(geneSymbol);
            variantDescriptor = Text.clean(variantDescriptor);
            description = Text.clean(description);
            diseaseContext = Text.clean(diseaseContext);
            pmid = Text.clean(pmid);
            doi = Text.clean(doi);
            url = Text.clean(url);
            publishedDate = Text.clean(publishedDate);
            linkNote = Text.clean(linkNote);
        }
    }

    /** Clasificación explícita del usuario (certeza/estado). El contenido de la fuente no se modifica. */
    public record ClassificationRequest(
            @NotNull Certainty certainty,
            @NotNull EvidenceStatus status,
            @Size(max = 2000) String reason,
            Long version) {

        public ClassificationRequest {
            reason = Text.clean(reason);
        }
    }

    public record EvidenceLinkRequest(@NotNull UUID evidenceId, @Size(max = 1000) String note) {

        public EvidenceLinkRequest {
            note = Text.clean(note);
        }
    }

    public record PublicationImportRequest(
            @NotBlank @Pattern(regexp = PMID_REGEX, message = "PMID numérico") String pmid,
            Boolean refresh) {

        public PublicationImportRequest {
            pmid = Text.clean(pmid);
        }
    }
}
