package com.molpath.board.interpretation;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.casefile.CaseTargets;
import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.security.CurrentUser;
import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import com.molpath.board.user.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InterpretationService {

    public interface InterpretationRepository extends JpaRepository<Interpretation, UUID> {
        List<Interpretation> findAllByCaseIdOrderByCreatedAtAsc(UUID caseId);
    }

    public record InterpretationRequest(
            @NotNull TargetType targetType,
            @NotBlank @Size(max = 80) String targetId,
            @NotBlank @Size(max = 10000) String statement,
            @NotNull Certainty certainty,
            UUID supersedesId) {

        public InterpretationRequest {
            targetId = Text.clean(targetId);
            statement = Text.clean(statement);
        }
    }

    public record InterpretationDto(UUID id, UUID caseId, TargetType targetType, String targetId, String statement,
            Certainty certainty, Interpretation.Status status, UUID supersedesId, UUID authorId, String authorName,
            UserRole authorRole, Instant createdAt) {}

    private final InterpretationRepository repository;
    private final CaseService caseService;
    private final CaseTargets targets;
    private final CurrentUser currentUser;
    private final AppUserRepository users;
    private final AuditService audit;

    public InterpretationService(InterpretationRepository repository, CaseService caseService, CaseTargets targets,
            CurrentUser currentUser, AppUserRepository users, AuditService audit) {
        this.repository = repository;
        this.caseService = caseService;
        this.targets = targets;
        this.currentUser = currentUser;
        this.users = users;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<InterpretationDto> forCase(UUID caseId) {
        return toDtos(repository.findAllByCaseIdOrderByCreatedAtAsc(caseId));
    }

    public InterpretationDto create(UUID caseId, InterpretationRequest request) {
        caseService.requireCase(caseId);
        targets.validate(caseId, request.targetType(), request.targetId());
        AppUser author = currentUser.require();
        if (request.supersedesId() != null) {
            Interpretation previous = repository.findById(request.supersedesId())
                    .orElseThrow(() -> new NotFoundException("Interpretación", request.supersedesId()));
            if (!previous.getCaseId().equals(caseId) || previous.getStatus() != Interpretation.Status.CURRENT) {
                throw new BusinessRuleException("Sólo puede sustituirse una interpretación vigente del mismo caso.");
            }
            previous.markSuperseded();
            repository.save(previous);
        }
        Interpretation saved = repository.saveAndFlush(new Interpretation(null, caseId, request.targetType(),
                request.targetId(), request.statement(), request.certainty(), request.supersedesId(), author.getId(),
                author.getRole(), Instant.now()));
        InterpretationDto dto = toDtos(List.of(saved)).getFirst();
        audit.record(AuditService.CREATE, "INTERPRETATION", saved.getId(), caseId, null, dto);
        return dto;
    }

    public List<InterpretationDto> toDtos(List<Interpretation> items) {
        Map<UUID, AppUser> authors = users.findAllByIdIn(items.stream().map(Interpretation::getAuthorId).distinct()
                .toList()).stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
        return items.stream().map(i -> new InterpretationDto(i.getId(), i.getCaseId(), i.getTargetType(),
                i.getTargetId(), i.getStatement(), i.getCertainty(), i.getStatus(), i.getSupersedesId(),
                i.getAuthorId(), authors.containsKey(i.getAuthorId()) ? authors.get(i.getAuthorId()).getDisplayName()
                        : null,
                i.getAuthorRole(), i.getCreatedAt())).toList();
    }
}
