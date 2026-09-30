package com.molpath.board.interpretation;

import com.molpath.board.interpretation.InterpretationService.InterpretationDto;
import com.molpath.board.interpretation.InterpretationService.InterpretationRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases/{caseId}/interpretations")
@Tag(name = "Interpretaciones documentadas")
public class InterpretationController {

    private final InterpretationService service;

    public InterpretationController(InterpretationService service) {
        this.service = service;
    }

    @GetMapping
    public List<InterpretationDto> list(@PathVariable UUID caseId) {
        return service.forCase(caseId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Documenta una interpretación humana con certeza explícita; puede sustituir a una anterior")
    public InterpretationDto create(@PathVariable UUID caseId, @Valid @RequestBody InterpretationRequest request) {
        return service.create(caseId, request);
    }
}
