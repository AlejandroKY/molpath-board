package com.molpath.board.discussion;

import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.common.PageResponse;
import com.molpath.board.discussion.DiscussionService.CommentDto;
import com.molpath.board.discussion.DiscussionService.CommentEditRequest;
import com.molpath.board.discussion.DiscussionService.CommentRequest;
import com.molpath.board.discussion.DiscussionService.RevisionDto;
import com.molpath.board.security.Roles;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Discusión multidisciplinaria")
public class DiscussionController {

    private final DiscussionService service;

    public DiscussionController(DiscussionService service) {
        this.service = service;
    }

    @GetMapping("/comments")
    @Operation(summary = "Comentarios paginados; sin caseId devuelve la actividad global reciente")
    public PageResponse<CommentDto> list(@RequestParam(required = false) UUID caseId,
            @RequestParam(required = false) TargetType targetType, @RequestParam(required = false) String targetId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return service.list(caseId, targetType, targetId, page, size);
    }

    @PostMapping("/cases/{caseId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CONTRIBUTOR)
    public CommentDto create(@PathVariable UUID caseId, @Valid @RequestBody CommentRequest request) {
        return service.create(caseId, request);
    }

    @PutMapping("/comments/{commentId}")
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Edita un comentario propio; la versión anterior queda en el historial")
    public CommentDto edit(@PathVariable UUID commentId, @Valid @RequestBody CommentEditRequest request) {
        return service.edit(commentId, request);
    }

    @GetMapping("/comments/{commentId}/revisions")
    public List<RevisionDto> revisions(@PathVariable UUID commentId) {
        return service.revisions(commentId);
    }
}
