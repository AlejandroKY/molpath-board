package com.molpath.board.knowledge;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Versión de una base de conocimiento tal como se observó al consultarla (p. ej. "Reactome v97"). */
@Entity
@Table(name = "source_version")
public class SourceVersion extends BaseEntity {

    @Column(name = "source_code", nullable = false, length = 32)
    private String sourceCode;

    @Column(name = "version_label", nullable = false, length = 200)
    private String versionLabel;

    @Column(name = "retrieved_at", nullable = false)
    private Instant retrievedAt;

    protected SourceVersion() {
    }

    public SourceVersion(UUID id, String sourceCode, String versionLabel, Instant retrievedAt) {
        super(id);
        this.sourceCode = sourceCode;
        this.versionLabel = versionLabel;
        this.retrievedAt = retrievedAt;
    }

    public String getSourceCode() {
        return sourceCode;
    }

    public String getVersionLabel() {
        return versionLabel;
    }

    public Instant getRetrievedAt() {
        return retrievedAt;
    }
}
