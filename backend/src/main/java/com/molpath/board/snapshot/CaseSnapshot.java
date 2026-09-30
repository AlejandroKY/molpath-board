package com.molpath.board.snapshot;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Snapshot científico inmutable: el JSON se guarda tal cual para poder verificar su SHA-256. */
@Entity
@Immutable
@Table(name = "case_snapshot")
public class CaseSnapshot extends BaseEntity {

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(nullable = false, length = 200, updatable = false)
    private String label;

    @Column(updatable = false)
    private String note;

    @Column(name = "schema_version", nullable = false, updatable = false)
    private int schemaVersion;

    @Column(nullable = false, updatable = false)
    private String content;

    @Column(name = "content_sha256", nullable = false, length = 64, updatable = false)
    private String contentSha256;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    protected CaseSnapshot() {
    }

    public CaseSnapshot(UUID caseId, String label, String note, int schemaVersion, String content,
            String contentSha256, Instant createdAt, UUID createdBy) {
        super(null);
        this.caseId = caseId;
        this.label = label;
        this.note = note;
        this.schemaVersion = schemaVersion;
        this.content = content;
        this.contentSha256 = contentSha256;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }

    public UUID getCaseId() {
        return caseId;
    }

    public String getLabel() {
        return label;
    }

    public String getNote() {
        return note;
    }

    public int getSchemaVersion() {
        return schemaVersion;
    }

    public String getContent() {
        return content;
    }

    public String getContentSha256() {
        return contentSha256;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }
}
