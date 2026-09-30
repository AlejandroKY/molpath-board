package com.molpath.board.timeline;

import com.molpath.board.security.Roles;
import com.molpath.board.timeline.TimelineService.TimelineEntry;
import com.molpath.board.timeline.TimelineService.TimelineEventDto;
import com.molpath.board.timeline.TimelineService.TimelineEventRequest;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases/{caseId}")
@Tag(name = "Evolución longitudinal")
public class TimelineController {

    private final TimelineService service;

    public TimelineController(TimelineService service) {
        this.service = service;
    }

    @GetMapping("/timeline")
    @Operation(summary = "Línea de tiempo: eventos explícitos + muestras, estudios y snapshots")
    public List<TimelineEntry> timeline(@PathVariable UUID caseId) {
        return service.timeline(caseId);
    }

    @PostMapping("/timeline-events")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public TimelineEventDto createEvent(@PathVariable UUID caseId, @Valid @RequestBody TimelineEventRequest request) {
        return service.createEvent(caseId, request);
    }
}
