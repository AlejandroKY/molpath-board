package com.molpath.board.discussion;

import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.common.BaseEntity;
import com.molpath.board.user.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "discussion_comment")
public class DiscussionComment extends BaseEntity {

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20, updatable = false)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false, length = 80, updatable = false)
    private String targetId;

    @Column(name = "author_id", nullable = false, updatable = false)
    private UUID authorId;

    /** Rol del autor en el momento de comentar (se conserva aunque el usuario cambie de rol). */
    @Enumerated(EnumType.STRING)
    @Column(name = "author_role", nullable = false, length = 32, updatable = false)
    private UserRole authorRole;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "edited_at")
    private Instant editedAt;

    protected DiscussionComment() {
    }

    public DiscussionComment(UUID id, UUID caseId, TargetType targetType, String targetId, UUID authorId,
            UserRole authorRole, String body, Instant createdAt) {
        super(id);
        this.caseId = caseId;
        this.targetType = targetType;
        this.targetId = targetId;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.body = body;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
    }

    void edit(String newBody) {
        this.body = newBody;
        this.editedAt = Instant.now();
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

    public UUID getAuthorId() {
        return authorId;
    }

    public UserRole getAuthorRole() {
        return authorRole;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }

    /** Versión anterior de un comentario, conservada al editarlo. */
    @Entity(name = "DiscussionCommentRevision")
    @Table(name = "discussion_comment_revision")
    public static class Revision extends BaseEntity {

        @Column(name = "comment_id", nullable = false, updatable = false)
        private UUID commentId;

        @Column(nullable = false, updatable = false)
        private String body;

        @Column(name = "revised_at", nullable = false, updatable = false)
        private Instant revisedAt;

        @Column(name = "revised_by", updatable = false)
        private UUID revisedBy;

        protected Revision() {
        }

        public Revision(UUID commentId, String previousBody, UUID revisedBy) {
            super(null);
            this.commentId = commentId;
            this.body = previousBody;
            this.revisedAt = Instant.now();
            this.revisedBy = revisedBy;
        }

        public UUID getCommentId() {
            return commentId;
        }

        public String getBody() {
            return body;
        }

        public Instant getRevisedAt() {
            return revisedAt;
        }

        public UUID getRevisedBy() {
            return revisedBy;
        }
    }
}
