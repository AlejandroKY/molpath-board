package com.molpath.board.board;

import com.molpath.board.casefile.CaseDtos.CaseDto;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.discussion.DiscussionService;
import com.molpath.board.interpretation.InterpretationService;
import com.molpath.board.interpretation.InterpretationService.InterpretationDto;
import com.molpath.board.knowledge.Evidence;
import com.molpath.board.knowledge.Gene;
import com.molpath.board.knowledge.KnowledgeAssembler;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkDto;
import com.molpath.board.knowledge.KnowledgeDtos.GeneDto;
import com.molpath.board.knowledge.KnowledgeDtos.GenePathwayDto;
import com.molpath.board.knowledge.KnowledgeDtos.PathwayDto;
import com.molpath.board.knowledge.KnowledgeDtos.PublicationDto;
import com.molpath.board.knowledge.KnowledgeDtos.SourceVersionDto;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GenePathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.SourceVersionRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.VariantEvidenceLinkRepository;
import com.molpath.board.knowledge.Pathway;
import com.molpath.board.knowledge.Publication;
import com.molpath.board.molecular.MolecularDtos.BiomarkerDto;
import com.molpath.board.molecular.MolecularDtos.MolecularTestDto;
import com.molpath.board.molecular.MolecularDtos.VariantDto;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.MolecularTest;
import com.molpath.board.molecular.Variant;
import com.molpath.board.sample.Sample;
import com.molpath.board.sample.SampleDtos.HistologyDto;
import com.molpath.board.sample.SampleDtos.IhcDto;
import com.molpath.board.sample.SampleDtos.SampleDto;
import com.molpath.board.sample.SampleRepositories.HistologyFindingRepository;
import com.molpath.board.sample.SampleRepositories.IhcResultRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.timeline.TimelineService;
import com.molpath.board.timeline.TimelineService.TimelineEventDto;
import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Construye el agregado completo de un caso ({@link CaseBoard}) con cargas por lotes (sin N+1).
 * Es la base de la pizarra, de la comparación longitudinal y de los snapshots.
 */
@Service
@Transactional(readOnly = true)
public class CaseBoardService {

    public static final int SCHEMA_VERSION = 1;

    /** Agregado del caso. {@code schemaVersion} permite comparar snapshots de forma reproducible. */
    public record CaseBoard(int schemaVersion, Instant generatedAt, CaseDto caseRecord, List<SampleDto> samples,
            List<HistologyDto> histology, List<IhcDto> ihc, List<MolecularTestDto> molecularTests,
            List<VariantDto> variants, List<BiomarkerDto> biomarkers, List<GeneDto> genes, List<PathwayDto> pathways,
            List<GenePathwayDto> genePathways, List<EvidenceDto> evidence, List<EvidenceLinkDto> evidenceLinks,
            List<PublicationDto> publications, List<SourceVersionDto> sourceVersions,
            List<InterpretationDto> interpretations, List<TimelineEventDto> timelineEvents,
            Map<String, Long> commentCounts) {}

    private final CaseService caseService;
    private final SampleRepository samples;
    private final HistologyFindingRepository histology;
    private final IhcResultRepository ihc;
    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final GeneRepository genes;
    private final PathwayRepository pathways;
    private final GenePathwayRepository genePathways;
    private final EvidenceRepository evidence;
    private final VariantEvidenceLinkRepository links;
    private final PublicationRepository publications;
    private final SourceVersionRepository sourceVersions;
    private final KnowledgeAssembler assembler;
    private final InterpretationService interpretationService;
    private final TimelineService timelineService;
    private final DiscussionService discussionService;

    public CaseBoardService(CaseService caseService, SampleRepository samples, HistologyFindingRepository histology,
            IhcResultRepository ihc, MolecularTestRepository tests, VariantRepository variants,
            BiomarkerResultRepository biomarkers, GeneRepository genes, PathwayRepository pathways,
            GenePathwayRepository genePathways, EvidenceRepository evidence, VariantEvidenceLinkRepository links,
            PublicationRepository publications, SourceVersionRepository sourceVersions, KnowledgeAssembler assembler,
            InterpretationService interpretationService, TimelineService timelineService,
            DiscussionService discussionService) {
        this.caseService = caseService;
        this.samples = samples;
        this.histology = histology;
        this.ihc = ihc;
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.genes = genes;
        this.pathways = pathways;
        this.genePathways = genePathways;
        this.evidence = evidence;
        this.links = links;
        this.publications = publications;
        this.sourceVersions = sourceVersions;
        this.assembler = assembler;
        this.interpretationService = interpretationService;
        this.timelineService = timelineService;
        this.discussionService = discussionService;
    }

    /**
     * @param includeDiscussion si es {@code false} (snapshots) no se incluyen recuentos de comentarios:
     *                          el snapshot congela el estado científico, no la conversación.
     */
    public CaseBoard load(UUID caseId, boolean includeDiscussion) {
        CaseDto caseRecord = caseService.get(caseId);
        List<Sample> caseSamples = samples.findAllByCaseIdOrderByCollectionDateAscCreatedAtAsc(caseId);
        List<UUID> sampleIds = caseSamples.stream().map(Sample::getId).toList();
        List<MolecularTest> caseTests = sampleIds.isEmpty() ? List.of()
                : tests.findAllBySampleIdInOrderByTestDateAscCreatedAtAsc(sampleIds);
        List<UUID> testIds = caseTests.stream().map(MolecularTest::getId).toList();
        List<Variant> caseVariants = testIds.isEmpty() ? List.of()
                : variants.findAllByMolecularTestIdInOrderByCreatedAtAsc(testIds);
        List<UUID> variantIds = caseVariants.stream().map(Variant::getId).toList();

        List<Evidence.VariantEvidenceLink> caseLinks = variantIds.isEmpty() ? List.of()
                : links.findAllByVariantIds(variantIds);
        List<Evidence> caseEvidence = evidence.findAllByIdIn(
                caseLinks.stream().map(Evidence.VariantEvidenceLink::evidenceId).distinct().toList());

        Set<UUID> geneIds = new LinkedHashSet<>();
        caseVariants.forEach(v -> geneIds.add(v.getGeneId()));
        caseEvidence.stream().map(Evidence::getGeneId).filter(Objects::nonNull).forEach(geneIds::add);
        List<Gene> caseGenes = genes.findAllByIdIn(geneIds);
        Map<UUID, String> symbolById = caseGenes.stream().collect(Collectors.toMap(Gene::getId, Gene::getSymbol));

        List<Pathway.GenePathway> caseGenePathways = geneIds.isEmpty() ? List.of()
                : genePathways.findAllByGeneIds(geneIds);
        List<Pathway> casePathways = pathways.findAllByIdIn(
                caseGenePathways.stream().map(gp -> gp.getId().pathwayId()).distinct().toList());
        List<Publication> casePublications = publications.findAllByIdIn(
                caseEvidence.stream().map(Evidence::getPublicationId).filter(Objects::nonNull).distinct().toList());

        Set<UUID> versionIds = new HashSet<>();
        caseEvidence.forEach(e -> versionIds.add(e.getSourceVersionId()));
        casePublications.forEach(p -> versionIds.add(p.getSourceVersionId()));
        casePathways.forEach(p -> versionIds.add(p.getSourceVersionId()));
        caseGenePathways.forEach(gp -> versionIds.add(gp.getSourceVersionId()));
        caseGenes.forEach(g -> versionIds.add(g.getSourceVersionId()));
        versionIds.remove(null);

        return new CaseBoard(SCHEMA_VERSION, Instant.now(), caseRecord,
                caseSamples.stream().map(SampleDto::from).toList(),
                sampleIds.isEmpty() ? List.of()
                        : histology.findAllBySampleIdInOrderByCreatedAtAsc(sampleIds).stream().map(HistologyDto::from).toList(),
                sampleIds.isEmpty() ? List.of()
                        : ihc.findAllBySampleIdInOrderByCreatedAtAsc(sampleIds).stream().map(IhcDto::from).toList(),
                caseTests.stream().map(MolecularTestDto::from).toList(),
                caseVariants.stream().map(v -> VariantDto.from(v, symbolById.get(v.getGeneId()))).toList(),
                testIds.isEmpty() ? List.of()
                        : biomarkers.findAllByMolecularTestIdInOrderByCreatedAtAsc(testIds).stream().map(BiomarkerDto::from).toList(),
                caseGenes.stream().map(GeneDto::from).toList(),
                casePathways.stream().map(PathwayDto::from).toList(),
                caseGenePathways.stream().map(GenePathwayDto::from).toList(),
                assembler.evidence(caseEvidence),
                caseLinks.stream().map(EvidenceLinkDto::from).toList(),
                casePublications.stream().map(PublicationDto::from).toList(),
                sourceVersions.findAllByIdIn(versionIds).stream().map(SourceVersionDto::from).toList(),
                interpretationService.forCase(caseId),
                timelineService.events(caseId),
                includeDiscussion ? discussionService.countsByTarget(caseId) : Map.of());
    }
}
