package com.molpath.board.molecular;

import com.molpath.board.molecular.MolecularDtos.BiomarkerDto;
import com.molpath.board.molecular.MolecularDtos.BiomarkerRequest;
import com.molpath.board.molecular.MolecularDtos.CaseVariantView;
import com.molpath.board.molecular.MolecularDtos.MolecularTestDto;
import com.molpath.board.molecular.MolecularDtos.MolecularTestRequest;
import com.molpath.board.molecular.MolecularDtos.VariantDto;
import com.molpath.board.molecular.MolecularDtos.VariantRequest;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Estudios moleculares, variantes y biomarcadores")
public class MolecularController {

    private final MolecularService service;

    public MolecularController(MolecularService service) {
        this.service = service;
    }

    @PostMapping("/samples/{sampleId}/molecular-tests")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public MolecularTestDto createTest(@PathVariable UUID sampleId, @Valid @RequestBody MolecularTestRequest request) {
        return service.createTest(sampleId, request);
    }

    @PutMapping("/molecular-tests/{testId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public MolecularTestDto updateTest(@PathVariable UUID testId, @Valid @RequestBody MolecularTestRequest request) {
        return service.updateTest(testId, request);
    }

    @PostMapping("/molecular-tests/{testId}/variants")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Registra una variante detectada (SNV, indel, CNV, fusión, estructural)")
    public VariantDto addVariant(@PathVariable UUID testId, @Valid @RequestBody VariantRequest request) {
        return service.addVariant(testId, request);
    }

    @PutMapping("/variants/{variantId}")
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    public VariantDto updateVariant(@PathVariable UUID variantId, @Valid @RequestBody VariantRequest request) {
        return service.updateVariant(variantId, request);
    }

    @PostMapping("/molecular-tests/{testId}/biomarkers")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CLINICAL_EDITOR)
    @Operation(summary = "Registra un biomarcador (TMB, MSI, HRD, firma mutacional, expresión RNA)")
    public BiomarkerDto addBiomarker(@PathVariable UUID testId, @Valid @RequestBody BiomarkerRequest request) {
        return service.addBiomarker(testId, request);
    }

    @GetMapping("/cases/{caseId}/variants")
    @Operation(summary = "Variantes del caso con muestra y fecha derivadas")
    public List<CaseVariantView> caseVariants(@PathVariable UUID caseId) {
        return service.caseVariants(caseId);
    }
}
