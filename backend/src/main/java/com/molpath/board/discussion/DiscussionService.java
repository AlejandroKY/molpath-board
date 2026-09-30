package com.molpath.board.discussion;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.casefile.CaseTargets;
import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.casefile.TumorCase;
import com.molpath.board.casefile.TumorCaseRepository;
import com.molpath.board.common.Exceptions.ForbiddenException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.PageResponse;
import com.molpath.board.common.Text;
import com.molpath.board.security.CurrentUser;
import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import com.molpath.board.user.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DiscussionService {

    public interface CommentRepository extends JpaRepository<DiscussionComment, UUID> {

        Page<DiscussionComment> findAllByCaseId(UUID caseId, Pageable pageable);

        Page<DiscussionComment> findAllByCaseIdAndTargetTypeAndTargetId(UUID caseId, TargetType targetType,
                String targetId, Pageable pageable);

        @Query("select c.targetType, c.targetId, count(c) from DiscussionComment c where c.caseId = :caseId group by c.targetType, c.targetId")
        List<Object[]> countByTarget(@Param("caseId") UUID caseId);
    }

    public interface RevisionRepository extends JpaRepository<DiscussionComment.Revision, UUID> {
        List<DiscussionComment.Revision> findAllByCommentIdOrderByRevisedAtAsc(UUID commentId);
    }

    public record CommentRequest(@NotNull TargetType targetType, @NotBlank @Size(max = 80) String targetId,
            @NotBlank @Size(max = 5000) String body) {

        public CommentRequest {
            targetId = Text.clean(targetId);
            body = Text.clean(body);
        }
    }

    public record CommentEditRequest(@NotBlank @Size(max = 5000) String body) {

        public CommentEditRequest {
            body = Text.clean(body);
        }
    }

    public record CommentDto(UUID id, UUID caseId, String caseCode, TargetType targetType, String targetId,
            UUID authorId, String authorName, UserRole authorRole, String authorRoleLabel, String body,
            Instant createdAt, Instant editedAt) {}

    public record RevisionDto(UUID id, String body, Instant revisedAt, UUID revisedBy) {}

    private final CommentRepository comments;
    private final RevisionRepository revisions;
    private final CaseService caseService;
    private final CaseTargets targets;
    private final TumorCaseRepository cases;
    private final AppUserRepository users;
    private final CurrentUser currentUser;
    private final AuditService audit;

    public DiscussionService(CommentRepository comments, RevisionRepository revisions, CaseService caseService,
            CaseTargets targets, TumorCaseRepository cases, AppUserRepository users, CurrentUser currentUser,
            AuditService audit) {
        this.comments = comments;
        this.revisions = revisions;
        this.caseService = caseService;
        this.targets = targets;
        this.cases = cases;
        this.users = users;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<CommentDto> list(UUID caseId, TargetType targetType, String targetId, Integer page,
            Integer size) {
        Pageable pageable = PageResponse.pageable(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<DiscussionComment> result;
        if (caseId == null) {
            result = comments.findAll(pageable);
        } else if (targetType != null && targetId != null) {
            result = comments.findAllByCaseIdAndTargetTypeAndTargetId(caseId, targetType, targetId, pageable);
        } else {
            result = comments.findAllByCaseId(caseId, pageable);
        }
        List<CommentDto> dtos = toDtos(result.getContent());
        return new PageResponse<>(dtos, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages());
    }

    public CommentDto create(UUID caseId, CommentRequest request) {
        caseService.requireCase(caseId);
        targets.validate(caseId, request.targetType(), request.targetId());
        AppUser author = currentUser.require();
        DiscussionComment saved = comments.saveAndFlush(new DiscussionComment(null, caseId, request.targetType(),
                request.targetId(), author.getId(), author.getRole(), request.body(), Instant.now()));
        CommentDto dto = toDtos(List.of(saved)).getFirst();
        audit.record(AuditService.CREATE, "COMMENT", saved.getId(), caseId, null, dto);
        return dto;
    }

    /** Sólo el autor (o ADMIN) puede editar; la versión anterior se conserva como revisión. */
    public CommentDto edit(UUID commentId, CommentEditRequest request) {
        DiscussionComment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Comentario", commentId));
        AppUser editor = currentUser.require();
        if (!comment.getAuthorId().equals(editor.getId()) && editor.getRole() != UserRole.ADMIN) {
            throw new ForbiddenException("Sólo el autor o un administrador pueden editar este comentario.");
        }
        if (comment.getBody().equals(request.body())) {
            return toDtos(List.of(comment)).getFirst();
        }
        revisions.save(new DiscussionComment.Revision(commentId, comment.getBody(), editor.getId()));
        CommentDto before = toDtos(List.of(comment)).getFirst();
        comment.edit(request.body());
        CommentDto after = toDtos(List.of(comments.saveAndFlush(comment))).getFirst();
        audit.record(AuditService.UPDATE, "COMMENT", commentId, comment.getCaseId(), before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public List<RevisionDto> revisions(UUID commentId) {
        if (!comments.existsById(commentId)) {
            throw new NotFoundException("Comentario", commentId);
        }
        return revisions.findAllByCommentIdOrderByRevisedAtAsc(commentId).stream()
                .map(r -> new RevisionDto(r.getId(), r.getBody(), r.getRevisedAt(), r.getRevisedBy())).toList();
    }

    /** Número de comentarios por elemento ("TIPO:id") para mostrarlo en la pizarra. */
    @Transactional(readOnly = true)
    public Map<String, Long> countsByTarget(UUID caseId) {
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : comments.countByTarget(caseId)) {
            counts.put(row[0] + ":" + row[1], ((Number) row[2]).longValue());
        }
        return counts;
    }

    private List<CommentDto> toDtos(List<DiscussionComment> items) {
        Map<UUID, AppUser> authors = users.findAllByIdIn(items.stream().map(DiscussionComment::getAuthorId)
                .distinct().toList()).stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
        Map<UUID, String> caseCodes = cases.findAllByIdIn(items.stream().map(DiscussionComment::getCaseId)
                .distinct().toList()).stream().collect(Collectors.toMap(TumorCase::getId, TumorCase::getCaseCode));
        return items.stream().map(c -> {
            AppUser author = authors.get(c.getAuthorId());
            return new CommentDto(c.getId(), c.getCaseId(), caseCodes.get(c.getCaseId()), c.getTargetType(),
                    c.getTargetId(), c.getAuthorId(), author == null ? null : author.getDisplayName(),
                    c.getAuthorRole(), c.getAuthorRole().label(), c.getBody(), c.getCreatedAt(), c.getEditedAt());
        }).toList();
    }
}
