package com.molpath.board.provider;

import com.molpath.board.audit.AuditService;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.Evidence;
import com.molpath.board.knowledge.EvidenceService;
import com.molpath.board.knowledge.Gene;
import com.molpath.board.knowledge.GeneService;
import com.molpath.board.knowledge.KnowledgeAssembler;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkRequest;
import com.molpath.board.knowledge.KnowledgeDtos.PathwayDto;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GenePathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.VariantEvidenceLinkRepository;
import com.molpath.board.knowledge.Pathway;
import com.molpath.board.knowledge.PublicationService;
import com.molpath.board.knowledge.SourceVersion;
import com.molpath.board.knowledge.SourceVersionService;
import com.molpath.board.molecular.ProteinChange;
import com.molpath.board.provider.ProviderContracts.ClinVarRecord;
import com.molpath.board.provider.ProviderContracts.ClinicalSignificanceProvider;
import com.molpath.board.provider.ProviderContracts.Classification;
import com.molpath.board.provider.ProviderContracts.EvidenceCandidate;
import com.molpath.board.provider.ProviderContracts.EvidenceProvider;
import com.molpath.board.provider.ProviderContracts.EvidenceSearchResult;
import com.molpath.board.provider.ProviderContracts.ExternalProvider;
import com.molpath.board.provider.ProviderContracts.GenePathwayResult;
import com.molpath.board.provider.ProviderContracts.PathwayCandidate;
import com.molpath.board.provider.ProviderContracts.PathwayProvider;
import com.molpath.board.provider.ProviderContracts.ProviderInfo;
import com.molpath.board.provider.ProviderContracts.PublicationProvider;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orquesta la consulta a fuentes externas y la importación de sus registros.
 * Regla de trazabilidad: al importar, el servidor vuelve a consultar la fuente por identificador;
 * nunca se guardan datos científicos enviados por el cliente.
 */
@Service
public class ExternalKnowledgeService {

    public enum ClinVarAspect { GERMLINE, ONCOGENICITY }

    public record ExternalEvidenceSearch(EvidenceSearchResult result, Map<String, UUID> importedEvidenceIds) {}

    public record ClinVarSearch(List<ClinVarRecord> records, Map<String, UUID> importedEvidenceIds, String note) {}

    public record PathwaySearch(GenePathwayResult result, Set<String> alreadyLinked) {}

    private static final Pattern GENE_IN_TITLE = Pattern.compile("\\(([A-Z0-9-]+)\\):");

    private final List<EvidenceProvider> evidenceProviders;
    private final List<ExternalProvider> allProviders;
    private final ClinicalSignificanceProvider clinVar;
    private final PathwayProvider pathwayProvider;
    private final EvidenceRepository evidenceRepository;
    private final VariantEvidenceLinkRepository linkRepository;
    private final GeneRepository geneRepository;
    private final PathwayRepository pathwayRepository;
    private final GenePathwayRepository genePathwayRepository;
    private final EvidenceService evidenceService;
    private final GeneService geneService;
    private final PublicationService publicationService;
    private final SourceVersionService sourceVersionService;
    private final KnowledgeAssembler assembler;
    private final AuditService audit;

    public ExternalKnowledgeService(List<EvidenceProvider> evidenceProviders, List<ExternalProvider> allProviders,
            ClinicalSignificanceProvider clinVar, PathwayProvider pathwayProvider,
            EvidenceRepository evidenceRepository, VariantEvidenceLinkRepository linkRepository,
            GeneRepository geneRepository, PathwayRepository pathwayRepository,
            GenePathwayRepository genePathwayRepository, EvidenceService evidenceService, GeneService geneService,
            PublicationService publicationService, SourceVersionService sourceVersionService,
            KnowledgeAssembler assembler, AuditService audit) {
        this.evidenceProviders = evidenceProviders;
        this.allProviders = allProviders;
        this.clinVar = clinVar;
        this.pathwayProvider = pathwayProvider;
        this.evidenceRepository = evidenceRepository;
        this.linkRepository = linkRepository;
        this.geneRepository = geneRepository;
        this.pathwayRepository = pathwayRepository;
        this.genePathwayRepository = genePathwayRepository;
        this.evidenceService = evidenceService;
        this.geneService = geneService;
        this.publicationService = publicationService;
        this.sourceVersionService = sourceVersionService;
        this.assembler = assembler;
        this.audit = audit;
    }

    public List<ProviderInfo> providers() {
        return allProviders.stream().map(ExternalProvider::info)
                .sorted((a, b) -> a.sourceCode().compareTo(b.sourceCode())).toList();
    }

    // ─── evidencia de variantes (CIViC, OncoKB…) ────────────────────────────────

    @Transactional(readOnly = true)
    public ExternalEvidenceSearch searchEvidence(String sourceCode, String gene, String variant, Integer size,
            String cursor) {
        EvidenceProvider provider = evidenceProvider(sourceCode);
        String symbol = requireText(Text.upper(gene), "gen");
        String protein = requireText(ProteinChange.normalize(Text.clean(variant)), "variante");
        EvidenceSearchResult result = provider.search(symbol, protein, size == null ? 20 : size, Text.clean(cursor));
        Map<String, UUID> imported = new LinkedHashMap<>();
        for (EvidenceCandidate candidate : result.items()) {
            evidenceRepository.findBySourceCodeAndExternalId(candidate.sourceCode(), candidate.externalId())
                    .ifPresent(e -> imported.put(candidate.externalId(), e.getId()));
        }
        return new ExternalEvidenceSearch(result, imported);
    }

    @Transactional
    public EvidenceDto importEvidence(String sourceCode, String externalId, UUID variantId, String note) {
        EvidenceProvider provider = evidenceProvider(sourceCode);
        String code = provider.info().sourceCode();
        Evidence evidence = evidenceRepository.findBySourceCodeAndExternalId(code, externalId).orElse(null);
        if (evidence == null) {
            EvidenceCandidate candidate = provider.fetchById(externalId)
                    .orElseThrow(() -> new NotFoundException("Registro " + code, externalId));
            UUID geneId = candidate.geneSymbol() == null ? null
                    : geneService.findOrCreate(candidate.geneSymbol()).getId();
            UUID publicationId = candidate.pmid() == null ? null
                    : publicationService.importByPmid(candidate.pmid(), false).getId();
            SourceVersion version = sourceVersionService.resolve(code, provider.currentVersionLabel());
            Certainty mapped = candidate.mappedCertainty() == null ? Certainty.UNKNOWN : candidate.mappedCertainty();
            String therapies = candidate.therapies() == null || candidate.therapies().isEmpty() ? null
                    : Text.truncate(String.join("; ", candidate.therapies()), 1000);
            evidence = evidenceService.createFromSource(new Evidence.Draft(geneId,
                    ProteinChange.normalize(candidate.variantDescriptor()), candidate.evidenceType(),
                    candidate.description(), Text.truncate(candidate.diseaseContext(), 300), mapped,
                    mapped == Certainty.UNKNOWN ? CertaintyBasis.NONE : CertaintyBasis.SOURCE_MAPPING,
                    candidate.sourceLevel(), candidate.sourceDirection(), candidate.sourceSignificance(),
                    candidate.sourceRating(), therapies, candidate.interpretationScope(), code,
                    candidate.externalId(), candidate.url(), publicationId, null,
                    candidate.publicationYear() == null ? null : String.valueOf(candidate.publicationYear()),
                    version.getId(), Instant.now()));
        }
        linkIfRequested(variantId, evidence.getId(), note);
        return assembler.evidence(evidence);
    }

    // ─── ClinVar ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ClinVarSearch searchClinVar(String gene, String variant) {
        String symbol = requireText(Text.upper(gene), "gen");
        String protein = requireText(ProteinChange.normalize(Text.clean(variant)), "variante");
        List<ClinVarRecord> records = clinVar.search(symbol, protein);
        Map<String, UUID> imported = new LinkedHashMap<>();
        for (ClinVarRecord record : records) {
            for (ClinVarAspect aspect : ClinVarAspect.values()) {
                String externalId = clinVarExternalId(record, aspect);
                evidenceRepository.findBySourceCodeAndExternalId(SourceCodes.CLINVAR, externalId)
                        .ifPresent(e -> imported.put(externalId, e.getId()));
            }
        }
        return new ClinVarSearch(records, imported,
                "Clasificación germinal y somática se muestran por separado. El impacto clínico somático se "
                        + "muestra como referencia y no se importa en esta versión.");
    }

    @Transactional
    public EvidenceDto importClinVar(String uid, ClinVarAspect aspect, UUID variantId, String note) {
        ClinVarRecord record = clinVar.fetch(uid).orElseThrow(() -> new NotFoundException("Registro ClinVar", uid));
        String externalId = clinVarExternalId(record, aspect);
        Evidence evidence = evidenceRepository.findBySourceCodeAndExternalId(SourceCodes.CLINVAR, externalId)
                .orElse(null);
        if (evidence == null) {
            Classification classification = aspect == ClinVarAspect.GERMLINE ? record.germline()
                    : record.oncogenicity();
            if (classification == null || classification.isEmpty()) {
                throw new BusinessRuleException("ClinVar no registra una clasificación "
                        + (aspect == ClinVarAspect.GERMLINE ? "germinal" : "de oncogenicidad") + " para " + record.accession());
            }
            String geneSymbol = geneFromTitle(record.title());
            UUID geneId = geneSymbol == null ? null : geneService.findOrCreate(geneSymbol).getId();
            String protein = record.proteinChange() == null ? null : record.proteinChange().split(",")[0].trim();
            SourceVersion version = sourceVersionService.resolve(SourceCodes.CLINVAR, clinVar.currentVersionLabel());
            String description = "ClinVar " + record.accession() + " · " + record.title() + ". Clasificación "
                    + (aspect == ClinVarAspect.GERMLINE ? "germinal" : "de oncogenicidad (somática)") + ": «"
                    + classification.description() + "». Estado de revisión: " + classification.reviewStatus()
                    + (classification.conditions().isEmpty() ? "" : ". Condiciones: " + String.join("; ", classification.conditions()))
                    + (classification.lastEvaluated() == null ? "" : ". Última evaluación: " + classification.lastEvaluated()) + ".";
            evidence = evidenceService.createFromSource(new Evidence.Draft(geneId, protein,
                    aspect == ClinVarAspect.GERMLINE ? EvidenceType.PREDISPOSITION : EvidenceType.ONCOGENIC,
                    description, Text.truncate(String.join("; ", classification.conditions()), 300),
                    Certainty.UNKNOWN, CertaintyBasis.NONE, Text.truncate(classification.reviewStatus(), 80), null,
                    Text.truncate(classification.description(), 80), null, null,
                    aspect == ClinVarAspect.GERMLINE ? InterpretationScope.GERMLINE : InterpretationScope.SOMATIC,
                    SourceCodes.CLINVAR, externalId, record.url(), null, null, classification.lastEvaluated(),
                    version.getId(), Instant.now()));
        }
        linkIfRequested(variantId, evidence.getId(), note);
        return assembler.evidence(evidence);
    }

    // ─── pathways (Reactome) ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PathwaySearch searchPathways(String gene) {
        String symbol = requireText(Text.upper(gene), "gen");
        GenePathwayResult result = pathwayProvider.findPathwaysForGene(symbol);
        Set<String> linked = new HashSet<>();
        geneRepository.findBySymbol(symbol).ifPresent(g -> {
            List<UUID> pathwayIds = genePathwayRepository.findAllByGeneIds(List.of(g.getId())).stream()
                    .map(gp -> gp.getId().pathwayId()).toList();
            pathwayRepository.findAllByIdIn(pathwayIds).forEach(p -> linked.add(p.getExternalId()));
        });
        return new PathwaySearch(result, linked);
    }

    @Transactional
    public List<PathwayDto> importPathways(String gene, List<String> externalIds) {
        String symbol = requireText(Text.upper(gene), "gen");
        if (externalIds == null || externalIds.isEmpty()) {
            throw new IllegalArgumentException("Indique al menos un pathway a importar");
        }
        GenePathwayResult result = pathwayProvider.findPathwaysForGene(symbol);
        Map<String, PathwayCandidate> verified = result.pathways().stream()
                .collect(Collectors.toMap(PathwayCandidate::externalId, Function.identity(), (a, b) -> a));
        String sourceCode = pathwayProvider.info().sourceCode();
        SourceVersion version = sourceVersionService.resolve(sourceCode, pathwayProvider.currentVersionLabel());
        Gene geneEntity = geneService.findOrCreate(symbol);
        geneEntity.enrich(null, null, result.uniprotId(), version.getId());
        geneRepository.save(geneEntity);
        List<PathwayDto> imported = new ArrayList<>();
        for (String externalId : externalIds) {
            PathwayCandidate candidate = verified.get(externalId);
            if (candidate == null) {
                throw new BusinessRuleException(sourceCode + " no asocia " + externalId + " a " + symbol
                        + ": no se importa una relación no verificada.");
            }
            Pathway pathway = pathwayRepository.findBySourceCodeAndExternalId(sourceCode, externalId)
                    .orElseGet(() -> pathwayRepository.save(
                            new Pathway(null, sourceCode, externalId, candidate.name(), version.getId())));
            Pathway.GenePathway.Key key = new Pathway.GenePathway.Key(geneEntity.getId(), pathway.getId());
            if (!genePathwayRepository.existsById(key)) {
                genePathwayRepository.save(new Pathway.GenePathway(geneEntity.getId(), pathway.getId(),
                        version.getId(), Instant.now()));
                audit.record(AuditService.IMPORT, "GENE_PATHWAY", symbol + ":" + externalId, null, null,
                        Map.of("gene", symbol, "pathway", externalId, "source", sourceCode,
                                "version", version.getVersionLabel()));
            }
            imported.add(PathwayDto.from(pathway));
        }
        return imported;
    }

    // ─── utilidades ─────────────────────────────────────────────────────────────

    private void linkIfRequested(UUID variantId, UUID evidenceId, String note) {
        if (variantId == null) {
            return;
        }
        boolean alreadyLinked = linkRepository.existsById(
                new Evidence.VariantEvidenceLink.Key(variantId, evidenceId));
        if (!alreadyLinked) {
            evidenceService.link(variantId, new EvidenceLinkRequest(evidenceId, Text.clean(note)));
        }
    }

    private EvidenceProvider evidenceProvider(String sourceCode) {
        String code = Text.upper(sourceCode);
        return evidenceProviders.stream().filter(p -> p.info().sourceCode().equals(code)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Fuente de evidencia desconocida: " + sourceCode
                        + ". Disponibles: " + evidenceProviders.stream().map(p -> p.info().sourceCode()).toList()));
    }

    private static String clinVarExternalId(ClinVarRecord record, ClinVarAspect aspect) {
        return record.accession() + ":" + aspect.name();
    }

    private static String geneFromTitle(String title) {
        if (title == null) {
            return null;
        }
        Matcher m = GENE_IN_TITLE.matcher(title);
        return m.find() ? m.group(1).toUpperCase(Locale.ROOT) : null;
    }

    private static String requireText(String value, String field) {
        if (value == null) {
            throw new IllegalArgumentException("Parámetro obligatorio: " + field);
        }
        return value;
    }
}
