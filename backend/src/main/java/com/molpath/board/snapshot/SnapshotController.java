package com.molpath.board.snapshot;

import com.molpath.board.common.PageResponse;
import com.molpath.board.security.Roles;
import com.molpath.board.snapshot.SnapshotService.SnapshotDetail;
import com.molpath.board.snapshot.SnapshotService.SnapshotRequest;
import com.molpath.board.snapshot.SnapshotService.SnapshotSummary;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Snapshots científicos")
public class SnapshotController {

    private final SnapshotService service;

    public SnapshotController(SnapshotService service) {
        this.service = service;
    }

    @PostMapping("/cases/{caseId}/snapshots")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Congela el estado científico del caso (inmutable, con SHA-256)")
    public SnapshotSummary create(@PathVariable UUID caseId, @Valid @RequestBody SnapshotRequest request) {
        return service.create(caseId, request);
    }

    @GetMapping("/cases/{caseId}/snapshots")
    public List<SnapshotSummary> forCase(@PathVariable UUID caseId) {
        return service.forCase(caseId);
    }

    @GetMapping("/snapshots")
    public PageResponse<SnapshotSummary> all(@RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return service.all(page, size);
    }

    @GetMapping("/snapshots/{snapshotId}")
    @Operation(summary = "Contenido del snapshot y verificación de integridad")
    public SnapshotDetail get(@PathVariable UUID snapshotId) {
        return service.get(snapshotId);
    }
}
