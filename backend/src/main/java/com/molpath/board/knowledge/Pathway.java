package com.molpath.board.knowledge;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pathway")
public class Pathway extends BaseEntity {

    @Column(name = "source_code", nullable = false, length = 32)
    private String sourceCode;

    @Column(name = "external_id", nullable = false, length = 60)
    private String externalId;

    @Column(nullable = false, length = 400)
    private String name;

    @Column(name = "source_version_id")
    private UUID sourceVersionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Pathway() {
    }

    public Pathway(UUID id, String sourceCode, String externalId, String name, UUID sourceVersionId) {
        super(id);
        this.sourceCode = sourceCode;
        this.externalId = externalId;
        this.name = name;
        this.sourceVersionId = sourceVersionId;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getName() {
        return name;
    }

    public UUID getSourceVersionId() {
        return sourceVersionId;
    }

    /** Relación gen → pathway con su procedencia. */
    @Entity(name = "GenePathway")
    @Table(name = "gene_pathway")
    public static class GenePathway {

        @EmbeddedId
        private Key id;

        @Column(name = "source_version_id")
        private UUID sourceVersionId;

        @Column(name = "retrieved_at", nullable = false)
        private Instant retrievedAt;

        protected GenePathway() {
        }

        public GenePathway(UUID geneId, UUID pathwayId, UUID sourceVersionId, Instant retrievedAt) {
            this.id = new Key(geneId, pathwayId);
            this.sourceVersionId = sourceVersionId;
            this.retrievedAt = retrievedAt;
        }

        public Key getId() {
            return id;
        }

        public UUID getSourceVersionId() {
            return sourceVersionId;
        }

        public Instant getRetrievedAt() {
            return retrievedAt;
        }

        @Embeddable
        public static class Key implements Serializable {

            @Column(name = "gene_id")
            private UUID geneId;

            @Column(name = "pathway_id")
            private UUID pathwayId;

            protected Key() {
            }

            public Key(UUID geneId, UUID pathwayId) {
                this.geneId = geneId;
                this.pathwayId = pathwayId;
            }

            public UUID geneId() {
                return geneId;
            }

            public UUID pathwayId() {
                return pathwayId;
            }

            @Override
            public boolean equals(Object o) {
                return o instanceof Key k && java.util.Objects.equals(geneId, k.geneId)
                        && java.util.Objects.equals(pathwayId, k.pathwayId);
            }

            @Override
            public int hashCode() {
                return java.util.Objects.hash(geneId, pathwayId);
            }
        }
    }
}
