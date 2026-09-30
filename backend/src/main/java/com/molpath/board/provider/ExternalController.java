package com.molpath.board.provider;

import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeDtos.PathwayDto;
import com.molpath.board.provider.ExternalKnowledgeService.ClinVarAspect;
import com.molpath.board.provider.ExternalKnowledgeService.ClinVarSearch;
import com.molpath.board.provider.ExternalKnowledgeService.ExternalEvidenceSearch;
import com.molpath.board.provider.ExternalKnowledgeService.PathwaySearch;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.security.Roles;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/external")
@Tag(name = "Fuentes externas", description = "CIViC, ClinVar, PubMed, Reactome, OncoKB (desactivado)")
public class ExternalController {

    private final ExternalKnowledgeService service;

    public ExternalController(ExternalKnowledgeService service) {
        this.service = service;
    }

    public record ImportEvidenceRequest(@NotBlank @Size(max = 32) String source,
            @NotBlank @Size(max = 80) String externalId, UUID variantId, @Size(max = 1000) String note) {}

    public record ImportClinVarRequest(@NotBlank @Pattern(regexp = "^\\d{1,12}$") String uid,
            @NotNull ClinVarAspect aspect, UUID variantId, @Size(max = 1000) String note) {}

    public record ImportPathwaysRequest(@NotBlank @Size(max = 40) String gene,
            @NotEmpty @Size(max = 100) List<@Pattern(regexp = "^[A-Za-z0-9-]{1,60}$") String> externalIds) {}

    @GetMapping("/providers")
    @Operation(summary = "Estado de cada proveedor externo (activo, desactivado, pendiente de licencia)")
    public List<ProviderInfo> providers() {
        return service.providers();
    }

    @GetMapping("/evidence")
    @Operation(summary = "Consulta evidencia de una variante en una fuente externa (sin guardar)")
    public ExternalEvidenceSearch searchEvidence(@RequestParam(defaultValue = "CIVIC") String source,
            @RequestParam String gene, @RequestParam String variant, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String cursor) {
        return service.searchEvidence(source, gene, variant, size, cursor);
    }

    @PostMapping("/evidence/import")
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Importa un registro verificándolo de nuevo en la fuente y opcionalmente lo enlaza a una variante")
    public EvidenceDto importEvidence(@Valid @RequestBody ImportEvidenceRequest request) {
        return service.importEvidence(request.source(), Text.clean(request.externalId()), request.variantId(),
                request.note());
    }

    @GetMapping("/clinvar")
    @Operation(summary = "Clasificaciones ClinVar (germinal y somática separadas)")
    public ClinVarSearch searchClinVar(@RequestParam String gene, @RequestParam String variant) {
        return service.searchClinVar(gene, variant);
    }

    @PostMapping("/clinvar/import")
    @PreAuthorize(Roles.CONTRIBUTOR)
    public EvidenceDto importClinVar(@Valid @RequestBody ImportClinVarRequest request) {
        return service.importClinVar(request.uid(), request.aspect(), request.variantId(), request.note());
    }

    @GetMapping("/pathways")
    @Operation(summary = "Pathways de Reactome que contienen el producto del gen")
    public PathwaySearch searchPathways(@RequestParam String gene) {
        return service.searchPathways(gene);
    }

    @PostMapping("/pathways/import")
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Importa relaciones gen→pathway verificadas en Reactome")
    public List<PathwayDto> importPathways(@Valid @RequestBody ImportPathwaysRequest request) {
        return service.importPathways(request.gene(), request.externalIds());
    }
}
