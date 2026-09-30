package com.molpath.board.casefile;

import com.molpath.board.casefile.CaseDtos.CaseDto;
import com.molpath.board.casefile.CaseDtos.CaseRequest;
import com.molpath.board.casefile.CaseDtos.CaseSummary;
import com.molpath.board.common.PageResponse;
import com.molpath.board.security.Roles;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@RequestMapping("/api/cases")
@Tag(name = "Casos")
public class CaseController {

    private final CaseService service;

    public CaseController(CaseService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Lista paginada de casos, filtrable por texto (código, órgano, tumor, diagnóstico)")
    public PageResponse<CaseSummary> list(@RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return service.list(q, page, size);
    }

    @GetMapping("/{caseId}")
    public CaseDto get(@PathVariable UUID caseId) {
        return service.get(caseId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Crea un caso. En esta fase sólo se admiten datos ficticios")
    public CaseDto create(@Valid @RequestBody CaseRequest request) {
        return service.create(request);
    }

    @PutMapping("/{caseId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Actualiza un caso (bloqueo optimista con 'version')")
    public CaseDto update(@PathVariable UUID caseId, @Valid @RequestBody CaseRequest request) {
        return service.update(caseId, request);
    }
}
