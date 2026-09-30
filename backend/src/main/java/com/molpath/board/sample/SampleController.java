package com.molpath.board.sample;

import com.molpath.board.sample.SampleDtos.HistologyDto;
import com.molpath.board.sample.SampleDtos.HistologyRequest;
import com.molpath.board.sample.SampleDtos.IhcDto;
import com.molpath.board.sample.SampleDtos.IhcRequest;
import com.molpath.board.sample.SampleDtos.SampleDto;
import com.molpath.board.sample.SampleDtos.SampleRequest;
import com.molpath.board.security.Roles;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Muestras, histología e IHQ")
public class SampleController {

    private final SampleService service;

    public SampleController(SampleService service) {
        this.service = service;
    }

    @GetMapping("/cases/{caseId}/samples")
    @Operation(summary = "Muestras del caso ordenadas por fecha de obtención")
    public List<SampleDto> list(@PathVariable UUID caseId) {
        return service.listByCase(caseId);
    }

    @PostMapping("/cases/{caseId}/samples")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public SampleDto create(@PathVariable UUID caseId, @Valid @RequestBody SampleRequest request) {
        return service.create(caseId, request);
    }

    @PutMapping("/samples/{sampleId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public SampleDto update(@PathVariable UUID sampleId, @Valid @RequestBody SampleRequest request) {
        return service.update(sampleId, request);
    }

    @PostMapping("/samples/{sampleId}/histology")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public HistologyDto addHistology(@PathVariable UUID sampleId, @Valid @RequestBody HistologyRequest request) {
        return service.addHistology(sampleId, request);
    }

    @PutMapping("/histology/{histologyId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public HistologyDto updateHistology(@PathVariable UUID histologyId, @Valid @RequestBody HistologyRequest request) {
        return service.updateHistology(histologyId, request);
    }

    @PostMapping("/samples/{sampleId}/ihc")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Registra un marcador IHQ. MolPath no interpreta el resultado como diagnóstico")
    public IhcDto addIhc(@PathVariable UUID sampleId, @Valid @RequestBody IhcRequest request) {
        return service.addIhc(sampleId, request);
    }

    @PutMapping("/ihc/{ihcId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public IhcDto updateIhc(@PathVariable UUID ihcId, @Valid @RequestBody IhcRequest request) {
        return service.updateIhc(ihcId, request);
    }

    @DeleteMapping("/ihc/{ihcId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Elimina un marcador IHQ (el estado previo queda en auditoría)")
    public void deleteIhc(@PathVariable UUID ihcId) {
        service.deleteIhc(ihcId);
    }
}
