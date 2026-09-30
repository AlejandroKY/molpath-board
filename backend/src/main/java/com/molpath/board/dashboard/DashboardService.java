package com.molpath.board.dashboard;

import com.molpath.board.casefile.CaseDtos.CaseSummary;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.common.PageResponse;
import com.molpath.board.discussion.DiscussionService;
import com.molpath.board.discussion.DiscussionService.CommentDto;
import com.molpath.board.knowledge.KnowledgeAssembler;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.molecular.MolecularDtos.CaseVariantView;
import com.molpath.board.molecular.MolecularDtos.VariantDto;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.MolecularService;
import com.molpath.board.molecular.Variant;
import com.molpath.board.molecular.VariantContext;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.snapshot.SnapshotRepository;
import com.molpath.board.snapshot.SnapshotService;
import com.molpath.board.snapshot.SnapshotService.SnapshotSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    public record Dashboard(Map<String, Long> counts, List<CaseSummary> recentCases,
            List<CaseVariantView> recentVariants, List<EvidenceDto> recentEvidence,
            List<SnapshotSummary> recentSnapshots, List<CommentDto> recentComments) {}

    private final CaseService caseService;
    private final SampleRepository samples;
    private final VariantRepository variants;
    private final EvidenceRepository evidence;
    private final PublicationRepository publications;
    private final SnapshotRepository snapshots;
    private final SnapshotService snapshotService;
    private final DiscussionService discussionService;
    private final MolecularService molecularService;
    private final KnowledgeAssembler assembler;

    public DashboardService(CaseService caseService, SampleRepository samples, VariantRepository variants,
            EvidenceRepository evidence, PublicationRepository publications, SnapshotRepository snapshots,
            SnapshotService snapshotService, DiscussionService discussionService, MolecularService molecularService,
            KnowledgeAssembler assembler) {
        this.caseService = caseService;
        this.samples = samples;
        this.variants = variants;
        this.evidence = evidence;
        this.publications = publications;
        this.snapshots = snapshots;
        this.snapshotService = snapshotService;
        this.discussionService = discussionService;
        this.molecularService = molecularService;
        this.assembler = assembler;
    }

    public Dashboard load() {
        Map<String, Long> counts = new LinkedHashMap<>();
        PageResponse<CaseSummary> recentCases = caseService.list(null, 0, 5);
        counts.put("cases", recentCases.totalItems());
        counts.put("samples", samples.count());
        counts.put("variants", variants.count());
        counts.put("evidence", evidence.count());
        counts.put("publications", publications.count());
        counts.put("snapshots", snapshots.count());
        PageResponse<CommentDto> recentComments = discussionService.list(null, null, null, 0, 6);
        counts.put("comments", recentComments.totalItems());
        return new Dashboard(counts, recentCases.items(), recentVariants(),
                assembler.evidence(evidence.findTop8ByOrderByCreatedAtDesc()), snapshotService.all(0, 5).items(),
                recentComments.items());
    }

    private List<CaseVariantView> recentVariants() {
        List<Variant> recent = variants.findTop8ByOrderByCreatedAtDesc();
        Map<UUID, String> symbols = molecularService.symbolsOf(recent.stream().map(Variant::getGeneId).toList());
        Map<UUID, VariantContext> contexts = variants.findContexts(recent.stream().map(Variant::getId).toList())
                .stream().collect(Collectors.toMap(VariantContext::variantId, Function.identity()));
        return recent.stream().filter(v -> contexts.containsKey(v.getId())).map(v -> {
            VariantContext ctx = contexts.get(v.getId());
            return new CaseVariantView(VariantDto.from(v, symbols.get(v.getGeneId())), ctx.caseId(), ctx.caseCode(),
                    ctx.sampleId(), ctx.sampleLabel(), ctx.testDate());
        }).toList();
    }

    @RestController
    @RequestMapping("/api/dashboard")
    @Tag(name = "Dashboard")
    public static class DashboardController {

        private final DashboardService service;

        public DashboardController(DashboardService service) {
            this.service = service;
        }

        @GetMapping
        @Operation(summary = "Casos recientes, variantes, evidencias nuevas, snapshots y actividad de discusión")
        public Dashboard dashboard() {
            return service.load();
        }
    }
}
