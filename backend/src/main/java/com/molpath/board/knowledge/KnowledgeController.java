package com.molpath.board.knowledge;

import com.molpath.board.common.PageResponse;
import com.molpath.board.knowledge.EvidenceService.CaseEvidence;
import com.molpath.board.knowledge.EvidenceService.EvidenceFilter;
import com.molpath.board.knowledge.EvidenceService.EvidenceHistoryEntry;
import com.molpath.board.knowledge.GeneService.GeneDetail;
import com.molpath.board.knowledge.KnowledgeDtos.ClassificationRequest;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkRequest;
import com.molpath.board.knowledge.KnowledgeDtos.ManualEvidenceRequest;
import com.molpath.board.knowledge.KnowledgeDtos.PublicationDto;
import com.molpath.board.knowledge.KnowledgeDtos.PublicationImportRequest;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceStatus;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Tag(name = "Conocimiento: evidencias, publicaciones y genes")
public class KnowledgeController {

    private final EvidenceService evidenceService;
    private final PublicationService publicationService;
    private final GeneService geneService;

    public KnowledgeController(EvidenceService evidenceService, PublicationService publicationService,
            GeneService geneService) {
        this.evidenceService = evidenceService;
        this.publicationService = publicationService;
        this.geneService = geneService;
    }

    @GetMapping("/evidence")
    @Operation(summary = "Biblioteca de evidencias paginada y filtrable")
    public PageResponse<EvidenceDto> searchEvidence(@RequestParam(required = false) String gene,
            @RequestParam(required = false) String variant, @RequestParam(required = false) EvidenceType type,
            @RequestParam(required = false) Certainty certainty, @RequestParam(required = false) String source,
            @RequestParam(required = false) EvidenceStatus status, @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return evidenceService.search(new EvidenceFilter(gene, variant, type, certainty, source, status, q), page,
                size);
    }

    @GetMapping("/evidence/{evidenceId}")
    public EvidenceDto getEvidence(@PathVariable UUID evidenceId) {
        return evidenceService.get(evidenceId);
    }

    @GetMapping("/evidence/{evidenceId}/history")
    @Operation(summary = "Historial auditado de la evidencia (estados anteriores)")
    public List<EvidenceHistoryEntry> evidenceHistory(@PathVariable UUID evidenceId) {
        return evidenceService.history(evidenceId);
    }

    @PostMapping("/evidence")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Registra evidencia manual citando PMID (verificado en PubMed), DOI o URL")
    public EvidenceDto createEvidence(@Valid @RequestBody ManualEvidenceRequest request) {
        return evidenceService.createManual(request);
    }

    @PutMapping("/evidence/{evidenceId}/classification")
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Clasificación explícita del usuario (certeza/estado). Queda auditada")
    public EvidenceDto classify(@PathVariable UUID evidenceId, @Valid @RequestBody ClassificationRequest request) {
        return evidenceService.classify(evidenceId, request);
    }

    @GetMapping("/cases/{caseId}/evidence")
    @Operation(summary = "Evidencias enlazadas a variantes del caso")
    public CaseEvidence caseEvidence(@PathVariable UUID caseId) {
        return evidenceService.forCase(caseId);
    }

    @PostMapping("/variants/{variantId}/evidence-links")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(Roles.CONTRIBUTOR)
    public EvidenceLinkDto link(@PathVariable UUID variantId, @Valid @RequestBody EvidenceLinkRequest request) {
        return evidenceService.link(variantId, request);
    }

    @DeleteMapping("/variants/{variantId}/evidence-links/{evidenceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(Roles.CONTRIBUTOR)
    public void unlink(@PathVariable UUID variantId, @PathVariable UUID evidenceId) {
        evidenceService.unlink(variantId, evidenceId);
    }

    @GetMapping("/publications")
    public PageResponse<PublicationDto> publications(@RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return publicationService.list(q, page, size);
    }

    @GetMapping("/publications/{pmid}")
    public PublicationDto publication(@PathVariable String pmid) {
        return publicationService.getByPmid(pmid);
    }

    @PostMapping("/publications/import")
    @PreAuthorize(Roles.CONTRIBUTOR)
    @Operation(summary = "Importa o refresca una publicación por PMID desde PubMed (NCBI E-utilities)")
    public PublicationDto importPublication(@Valid @RequestBody PublicationImportRequest request) {
        return PublicationDto.from(publicationService.importByPmid(request.pmid(), Boolean.TRUE.equals(request.refresh())));
    }

    @GetMapping("/genes/{symbol}")
    @Operation(summary = "Gen con sus pathways trazables y número de variantes registradas")
    public GeneDetail gene(@PathVariable String symbol) {
        return geneService.detail(symbol);
    }
}
