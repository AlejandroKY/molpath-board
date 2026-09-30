package com.molpath.board.interpretation;

import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.common.BaseEntity;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.user.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Razonamiento humano documentado. No se edita: una interpretación nueva sustituye a la anterior,
 * que queda visible como {@code SUPERSEDED}.
 */
@Entity
@Table(name = "interpretation")
public class Interpretation extends BaseEntity {

    public enum Status { CURRENT, SUPERSEDED }

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20, updatable = false)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 80, updatable = false)
    private String targetId;

    @Column(nullable = false, updatable = false)
    private String statement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private Certainty certainty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.CURRENT;

    @Column(name = "supersedes_id", updatable = false)
    private UUID supersedesId;

    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "author_role", nullable = false, length = 32, updatable = false)
    private UserRole authorRole;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Interpretation() {
    }

    public Interpretation(UUID id, UUID caseId, TargetType targetType, String targetId, String statement,
            Certainty certainty, UUID supersedesId, UUID authorId, UserRole authorRole, Instant createdAt) {
        super(id);
        this.caseId = caseId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.statement = statement;
        this.certainty = certainty;
        this.supersedesId = supersedesId;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
    }

    void markSuperseded() {
        this.status = Status.SUPERSEDED;
    }

    public UUID getCaseId() {
        return caseId;
    }

    public TargetType getTargetType() {
        return targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public String getStatement() {
        return statement;
    }

    public Certainty getCertainty() {
        return certainty;
    }

    public Status getStatus() {
        return status;
    }

    public UUID getSupersedesId() {
        return supersedesId;
    }

    public UUID getAuthorId() {
        return authorId;
    }

    public UserRole getAuthorRole() {
        return authorRole;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
