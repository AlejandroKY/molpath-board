package com.molpath.board.knowledge;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Gen de referencia. Se crea por símbolo al registrar una variante; nombre e identificadores
 * sólo se rellenan desde una fuente (NCBI Gene / Reactome) con su versión.
 */
@Entity
@Table(name = "gene")
public class Gene extends BaseEntity {

    @Column(nullable = false, unique = true, length = 40)
    private String symbol;

    @Column(length = 300)
    private String name;

    @Column(name = "entrez_id", length = 20)
    private String entrezId;

    @Column(name = "uniprot_id", length = 20)
    private String uniprotId;

    @Column(name = "source_version_id")
    private UUID sourceVersionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Gene() {
    }

    public Gene(UUID id, String symbol) {
        super(id);
        this.symbol = symbol;
    }

    /** Completa metadatos procedentes de una fuente; nunca borra valores existentes. */
    public void enrich(String name, String entrezId, String uniprotId, UUID sourceVersionId) {
        if (name != null) {
            this.name = name;
        }
        if (entrezId != null) {
            this.entrezId = entrezId;
        }
        if (uniprotId != null) {
            this.uniprotId = uniprotId;
        }
        if (sourceVersionId != null) {
            this.sourceVersionId = sourceVersionId;
        }
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getSymbol() {
        return symbol;
    }

    public String getName() {
        return name;
    }

    public String getEntrezId() {
        return entrezId;
    }

    public String getUniprotId() {
        return uniprotId;
    }

    public UUID getSourceVersionId() {
        return sourceVersionId;
    }
}
