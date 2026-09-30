package com.molpath.board.knowledge;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceStatus;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Registro de evidencia científica (capa de conocimiento), siempre con fuente.
 * El contenido procedente de la fuente no se edita: sólo la clasificación de certeza y el estado,
 * y cada cambio queda auditado.
 */
@Entity
@Table(name = "evidence")
public class Evidence extends BaseEntity {

    @Column(name = "gene_id")
    private UUID geneId;

    @Column(name = "variant_descriptor", length = 200)
    private String variantDescriptor;

    @Enumerated(EnumType.STRING)
    @Column(name = "evidence_type", nullable = false, length = 20)
    private EvidenceType evidenceType;

    @Column(nullable = false)
    private String description;

    @Column(name = "disease_context", length = 300)
    private String diseaseContext;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Certainty certainty = Certainty.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Column(name = "certainty_basis", nullable = false, length = 20)
    private CertaintyBasis certaintyBasis = CertaintyBasis.NONE;

    @Column(name = "source_level", length = 80)
    private String sourceLevel;

    @Column(name = "source_direction", length = 40)
    private String sourceDirection;

    @Column(name = "source_significance", length = 80)
    private String sourceSignificance;

    @Column(name = "source_rating")
    private Integer sourceRating;

    @Column(name = "source_therapies", length = 1000)
    private String sourceTherapies;

    @Enumerated(EnumType.STRING)
    @Column(name = "interpretation_scope", nullable = false, length = 20)
    private InterpretationScope interpretationScope = InterpretationScope.NOT_APPLICABLE;

    @Column(name = "source_code", nullable = false, length = 32)
    private String sourceCode;

    @Column(name = "external_id", length = 80)
    private String externalId;

    @Column(length = 1000)
    private String url;

    @Column(name = "publication_id")
    private UUID publicationId;

    @Column(length = 200)
    private String doi;

    @Column(name = "published_date", length = 40)
    private String publishedDate;

    @Column(name = "source_version_id")
    private UUID sourceVersionId;

    @Column(name = "retrieved_at")
    private Instant retrievedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EvidenceStatus status = EvidenceStatus.ACTIVE;

    @Column(name = "status_reason")
    private String statusReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    protected Evidence() {
    }

    /** Datos de procedencia y contenido con los que nace un registro de evidencia. */
    public record Draft(UUID geneId, String variantDescriptor, EvidenceType evidenceType, String description,
            String diseaseContext, Certainty certainty, CertaintyBasis certaintyBasis, String sourceLevel,
            String sourceDirection, String sourceSignificance, Integer sourceRating, String sourceTherapies,
            InterpretationScope interpretationScope, String sourceCode, String externalId, String url,
            UUID publicationId, String doi, String publishedDate, UUID sourceVersionId, Instant retrievedAt) {}

    public Evidence(UUID id, Draft d, UUID createdBy) {
        super(id);
        this.geneId = d.geneId();
        this.variantDescriptor = d.variantDescriptor();
        this.evidenceType = Objects.requireNonNull(d.evidenceType());
        this.description = Objects.requireNonNull(d.description());
        this.diseaseContext = d.diseaseContext();
        this.sourceLevel = d.sourceLevel();
        this.sourceDirection = d.sourceDirection();
        this.sourceSignificance = d.sourceSignificance();
        this.sourceRating = d.sourceRating();
        this.sourceTherapies = d.sourceTherapies();
        this.interpretationScope = d.interpretationScope() == null ? InterpretationScope.NOT_APPLICABLE
                : d.interpretationScope();
        this.sourceCode = Objects.requireNonNull(d.sourceCode(), "Toda evidencia requiere una fuente");
        this.externalId = d.externalId();
        this.url = d.url();
        this.publicationId = d.publicationId();
        this.doi = d.doi();
        this.publishedDate = d.publishedDate();
        this.sourceVersionId = d.sourceVersionId();
        this.retrievedAt = d.retrievedAt();
        this.createdBy = createdBy;
        classify(d.certainty() == null ? Certainty.UNKNOWN : d.certainty(),
                d.certaintyBasis() == null ? CertaintyBasis.NONE : d.certaintyBasis());
    }

    /** Regla ADR-005: una certeza distinta de UNKNOWN exige una base declarada. */
    public final void classify(Certainty newCertainty, CertaintyBasis basis) {
        if (newCertainty != Certainty.UNKNOWN && basis == CertaintyBasis.NONE) {
            throw new BusinessRuleException(
                    "La certeza '" + newCertainty + "' requiere una base: mapeo de la fuente o asignación explícita del usuario.");
        }
        this.certainty = newCertainty;
        this.certaintyBasis = newCertainty == Certainty.UNKNOWN ? CertaintyBasis.NONE : basis;
    }

    public void changeStatus(EvidenceStatus newStatus, String reason) {
        if (newStatus != EvidenceStatus.ACTIVE && (reason == null || reason.isBlank())) {
            throw new BusinessRuleException("Retirar o sustituir una evidencia requiere indicar el motivo.");
        }
        this.status = newStatus;
        this.statusReason = reason;
    }

    /** Sólo para la siembra demo: conserva la fecha de consulta registrada en el dataset. */
    public void overrideCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getGeneId() {
        return geneId;
    }

    public String getVariantDescriptor() {
        return variantDescriptor;
    }

    public EvidenceType getEvidenceType() {
        return evidenceType;
    }

    public String getDescription() {
        return description;
    }

    public String getDiseaseContext() {
        return diseaseContext;
    }

    public Certainty getCertainty() {
        return certainty;
    }

    public CertaintyBasis getCertaintyBasis() {
        return certaintyBasis;
    }

    public String getSourceLevel() {
        return sourceLevel;
    }

    public String getSourceDirection() {
        return sourceDirection;
    }

    public String getSourceSignificance() {
        return sourceSignificance;
    }

    public Integer getSourceRating() {
        return sourceRating;
    }

    public String getSourceTherapies() {
        return sourceTherapies;
    }

    public InterpretationScope getInterpretationScope() {
        return interpretationScope;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getUrl() {
        return url;
    }

    public UUID getPublicationId() {
        return publicationId;
    }

    public String getDoi() {
        return doi;
    }

    public String getPublishedDate() {
        return publishedDate;
    }

    public UUID getSourceVersionId() {
        return sourceVersionId;
    }

    public Instant getRetrievedAt() {
        return retrievedAt;
    }

    public EvidenceStatus getStatus() {
        return status;
    }

    public String getStatusReason() {
        return statusReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getVersion() {
        return version;
    }

    /** Enlace de una variante del caso con un registro de evidencia. */
    @Entity(name = "VariantEvidenceLink")
    @Table(name = "variant_evidence_link")
    public static class VariantEvidenceLink {

        @EmbeddedId
        private Key id;

        @Column(name = "linked_at", nullable = false)
        private Instant linkedAt;

        @Column(name = "linked_by")
        private UUID linkedBy;

        @Column(length = 1000)
        private String note;

        protected VariantEvidenceLink() {
        }

        public VariantEvidenceLink(UUID variantId, UUID evidenceId, UUID linkedBy, String note, Instant linkedAt) {
            this.id = new Key(variantId, evidenceId);
            this.linkedBy = linkedBy;
            this.note = note;
            this.linkedAt = linkedAt == null ? Instant.now() : linkedAt;
        }

        public UUID variantId() {
            return id.variantId;
        }

        public UUID evidenceId() {
            return id.evidenceId;
        }

        public Key getId() {
            return id;
        }

        public Instant getLinkedAt() {
            return linkedAt;
        }

        public UUID getLinkedBy() {
            return linkedBy;
        }

        public String getNote() {
            return note;
        }

        @Embeddable
        public static class Key implements Serializable {

            @Column(name = "variant_id")
            private UUID variantId;

            @Column(name = "evidence_id")
            private UUID evidenceId;

            protected Key() {
            }

            public Key(UUID variantId, UUID evidenceId) {
                this.variantId = variantId;
                this.evidenceId = evidenceId;
            }

            @Override
            public boolean equals(Object o) {
                return o instanceof Key k && Objects.equals(variantId, k.variantId)
                        && Objects.equals(evidenceId, k.evidenceId);
            }

            @Override
            public int hashCode() {
                return Objects.hash(variantId, evidenceId);
            }
        }
    }
}
