package com.molpath.board.snapshot;

import com.molpath.board.audit.AuditService;
import com.molpath.board.board.CaseBoardService;
import com.molpath.board.board.CaseBoardService.CaseBoard;
import com.molpath.board.casefile.TumorCase;
import com.molpath.board.casefile.TumorCaseRepository;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.PageResponse;
import com.molpath.board.common.Text;
import com.molpath.board.security.CurrentUser;
import com.molpath.board.snapshot.SnapshotRepository.SnapshotHeader;
import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Snapshots científicos: congelan el agregado del caso (datos, evidencias, publicaciones, versiones de
 * fuentes, interpretaciones y estado del grafo). Son inmutables y verificables con SHA-256.
 */
@Service
@Transactional
public class SnapshotService {

    private static final int MAX_GRAPH_STATE_CHARS = 50_000;

    public record SnapshotRequest(@NotBlank @Size(max = 200) String label, @Size(max = 5000) String note,
            JsonNode graphState) {

        public SnapshotRequest {
            label = Text.clean(label);
            note = Text.clean(note);
        }
    }

    /** Documento congelado. */
    public record SnapshotContent(int schemaVersion, Instant capturedAt, String label, String note, CaseBoard board,
            JsonNode graphState) {}

    public record SnapshotSummary(UUID id, UUID caseId, String caseCode, String label, String note,
            int schemaVersion, String contentSha256, Instant createdAt, UUID createdBy, String createdByName) {}

    public record SnapshotDetail(SnapshotSummary summary, JsonNode content, boolean integrityVerified) {}

    private final SnapshotRepository snapshots;
    private final CaseBoardService boardService;
    private final TumorCaseRepository cases;
    private final AppUserRepository users;
    private final CurrentUser currentUser;
    private final ObjectMapper objectMapper;
    private final AuditService audit;

    public SnapshotService(SnapshotRepository snapshots, CaseBoardService boardService, TumorCaseRepository cases,
            AppUserRepository users, CurrentUser currentUser, ObjectMapper objectMapper, AuditService audit) {
        this.snapshots = snapshots;
        this.boardService = boardService;
        this.cases = cases;
        this.users = users;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
        this.audit = audit;
    }

    public SnapshotSummary create(UUID caseId, SnapshotRequest request) {
        CaseBoard board = boardService.load(caseId, false);
        if (request.graphState() != null
                && objectMapper.writeValueAsString(request.graphState()).length() > MAX_GRAPH_STATE_CHARS) {
            throw new BusinessRuleException("El estado del grafo supera el tamaño máximo admitido.");
        }
        Instant now = Instant.now();
        String content = objectMapper.writeValueAsString(new SnapshotContent(CaseBoardService.SCHEMA_VERSION, now,
                request.label(), request.note(), board, request.graphState()));
        CaseSnapshot saved = snapshots.saveAndFlush(new CaseSnapshot(caseId, request.label(), request.note(),
                CaseBoardService.SCHEMA_VERSION, content, sha256(content), now, currentUser.id().orElse(null)));
        SnapshotSummary summary = toSummary(saved.getId(), saved.getCaseId(), saved.getLabel(), saved.getNote(),
                saved.getSchemaVersion(), saved.getContentSha256(), saved.getCreatedAt(), saved.getCreatedBy(),
                Map.of(caseId, board.caseRecord().caseCode()), usersById(List.of(saved.getCreatedBy())));
        audit.record(AuditService.CREATE, "SNAPSHOT", saved.getId(), caseId, null, summary);
        return summary;
    }

    @Transactional(readOnly = true)
    public List<SnapshotSummary> forCase(UUID caseId) {
        List<SnapshotHeader> headers = snapshots.findHeadersByCaseId(caseId);
        return toSummaries(headers);
    }

    @Transactional(readOnly = true)
    public PageResponse<SnapshotSummary> all(Integer page, Integer size) {
        Page<SnapshotHeader> result = snapshots.findAllHeaders(
                PageResponse.pageable(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new PageResponse<>(toSummaries(result.getContent()), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public SnapshotDetail get(UUID snapshotId) {
        CaseSnapshot s = snapshots.findById(snapshotId).orElseThrow(() -> new NotFoundException("Snapshot", snapshotId));
        String caseCode = cases.findById(s.getCaseId()).map(TumorCase::getCaseCode).orElse(null);
        SnapshotSummary summary = toSummary(s.getId(), s.getCaseId(), s.getLabel(), s.getNote(), s.getSchemaVersion(),
                s.getContentSha256(), s.getCreatedAt(), s.getCreatedBy(), Map.of(s.getCaseId(), Objects.toString(caseCode, "")),
                usersById(s.getCreatedBy() == null ? List.of() : List.of(s.getCreatedBy())));
        boolean verified = sha256(s.getContent()).equals(s.getContentSha256());
        return new SnapshotDetail(summary, objectMapper.readTree(s.getContent()), verified);
    }

    static String sha256(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private List<SnapshotSummary> toSummaries(List<SnapshotHeader> headers) {
        Map<UUID, String> caseCodes = cases.findAllByIdIn(headers.stream().map(SnapshotHeader::getCaseId).distinct()
                .toList()).stream().collect(Collectors.toMap(TumorCase::getId, TumorCase::getCaseCode));
        Map<UUID, AppUser> authors = usersById(headers.stream().map(SnapshotHeader::getCreatedBy)
                .filter(Objects::nonNull).toList());
        return headers.stream().map(h -> toSummary(h.getId(), h.getCaseId(), h.getLabel(), h.getNote(),
                h.getSchemaVersion(), h.getContentSha256(), h.getCreatedAt(), h.getCreatedBy(), caseCodes, authors))
                .toList();
    }

    private Map<UUID, AppUser> usersById(List<UUID> ids) {
        List<UUID> clean = ids.stream().filter(Objects::nonNull).distinct().toList();
        return clean.isEmpty() ? Map.of() : users.findAllByIdIn(clean).stream()
                .collect(Collectors.toMap(AppUser::getId, Function.identity()));
    }

    private static SnapshotSummary toSummary(UUID id, UUID caseId, String label, String note, int schemaVersion,
            String sha, Instant createdAt, UUID createdBy, Map<UUID, String> caseCodes, Map<UUID, AppUser> authors) {
        AppUser author = createdBy == null ? null : authors.get(createdBy);
        return new SnapshotSummary(id, caseId, caseCodes.get(caseId), label, note, schemaVersion, sha, createdAt,
                createdBy, author == null ? null : author.getDisplayName());
    }
}
