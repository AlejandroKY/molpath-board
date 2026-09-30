package com.molpath.board.molecular;

import com.molpath.board.audit.AuditService;
import com.molpath.board.casefile.CaseService;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.knowledge.Gene;
import com.molpath.board.knowledge.GeneService;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.molecular.MolecularDtos.BiomarkerDto;
import com.molpath.board.molecular.MolecularDtos.BiomarkerRequest;
import com.molpath.board.molecular.MolecularDtos.CaseVariantView;
import com.molpath.board.molecular.MolecularDtos.MolecularTestDto;
import com.molpath.board.molecular.MolecularDtos.MolecularTestRequest;
import com.molpath.board.molecular.MolecularDtos.VariantDto;
import com.molpath.board.molecular.MolecularDtos.VariantRequest;
import com.molpath.board.molecular.MolecularEnums.VariantType;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.sample.Sample;
import com.molpath.board.sample.SampleService;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MolecularService {

    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final GeneRepository genes;
    private final GeneService geneService;
    private final SampleService sampleService;
    private final CaseService caseService;
    private final AuditService audit;

    public MolecularService(MolecularTestRepository tests, VariantRepository variants,
            BiomarkerResultRepository biomarkers, GeneRepository genes, GeneService geneService,
            SampleService sampleService, CaseService caseService, AuditService audit) {
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.genes = genes;
        this.geneService = geneService;
        this.sampleService = sampleService;
        this.caseService = caseService;
        this.audit = audit;
    }

    public MolecularTestDto createTest(UUID sampleId, MolecularTestRequest request) {
        Sample sample = sampleService.requireSample(sampleId);
        MolecularTest test = new MolecularTest(null, sampleId);
        test.apply(request, normalizeGenes(request.genesAnalyzed()));
        MolecularTestDto created = MolecularTestDto.from(tests.saveAndFlush(test));
        audit.record(AuditService.CREATE, "MOLECULAR_TEST", created.id(), sample.getCaseId(), null, created);
        return created;
    }

    public MolecularTestDto updateTest(UUID testId, MolecularTestRequest request) {
        MolecularTest test = requireTest(testId);
        MolecularTestDto before = MolecularTestDto.from(test);
        test.apply(request, normalizeGenes(request.genesAnalyzed()));
        MolecularTestDto after = MolecularTestDto.from(tests.saveAndFlush(test));
        audit.record(AuditService.UPDATE, "MOLECULAR_TEST", testId, caseIdOfTest(test), before, after);
        return after;
    }

    public VariantDto addVariant(UUID testId, VariantRequest request) {
        MolecularTest test = requireTest(testId);
        validateVariant(request);
        Gene gene = geneService.findOrCreate(request.geneSymbol());
        Variant variant = new Variant(null, testId);
        variant.apply(request, gene.getId());
        VariantDto created = VariantDto.from(variants.saveAndFlush(variant), gene.getSymbol());
        audit.record(AuditService.CREATE, "VARIANT", created.id(), caseIdOfTest(test), null, created);
        return created;
    }

    public VariantDto updateVariant(UUID variantId, VariantRequest request) {
        Variant variant = variants.findById(variantId).orElseThrow(() -> new NotFoundException("Variante", variantId));
        validateVariant(request);
        VariantDto before = VariantDto.from(variant, symbolOf(variant.getGeneId()));
        Gene gene = geneService.findOrCreate(request.geneSymbol());
        variant.apply(request, gene.getId());
        VariantDto after = VariantDto.from(variants.saveAndFlush(variant), gene.getSymbol());
        audit.record(AuditService.UPDATE, "VARIANT", variantId, caseIdOfTest(requireTest(variant.getMolecularTestId())),
                before, after);
        return after;
    }

    public BiomarkerDto addBiomarker(UUID testId, BiomarkerRequest request) {
        MolecularTest test = requireTest(testId);
        if (request.valueNumeric() == null && request.valueText() == null) {
            throw new BusinessRuleException("Indique un valor numérico o textual para el biomarcador.");
        }
        BiomarkerResult biomarker = new BiomarkerResult(null, testId);
        biomarker.apply(request);
        BiomarkerDto created = BiomarkerDto.from(biomarkers.save(biomarker));
        audit.record(AuditService.CREATE, "BIOMARKER", created.id(), caseIdOfTest(test), null, created);
        return created;
    }

    @Transactional(readOnly = true)
    public List<CaseVariantView> caseVariants(UUID caseId) {
        caseService.requireCase(caseId);
        List<Variant> found = variants.findAllByCaseId(caseId);
        Map<UUID, String> symbols = symbolsOf(found.stream().map(Variant::getGeneId).toList());
        Map<UUID, VariantContext> contexts = variants.findContexts(found.stream().map(Variant::getId).toList())
                .stream().collect(Collectors.toMap(VariantContext::variantId, Function.identity()));
        return found.stream().map(v -> {
            VariantContext ctx = contexts.get(v.getId());
            return new CaseVariantView(VariantDto.from(v, symbols.get(v.getGeneId())), ctx.caseId(), ctx.caseCode(),
                    ctx.sampleId(), ctx.sampleLabel(), ctx.testDate());
        }).toList();
    }

    public Map<UUID, String> symbolsOf(Collection<UUID> geneIds) {
        return genes.findAllByIdIn(geneIds.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(Gene::getId, Gene::getSymbol));
    }

    /** Reglas mínimas de coherencia por tipo de variante. */
    static void validateVariant(VariantRequest r) {
        VariantType type = r.variantType();
        switch (type) {
            case SNV, INDEL -> {
                if (r.hgvsC() == null && r.hgvsP() == null) {
                    throw new BusinessRuleException("Una variante " + type + " requiere HGVS c. o HGVS p.");
                }
            }
            case CNV -> {
                if (r.copyNumber() == null && r.observations() == null) {
                    throw new BusinessRuleException("Una CNV requiere número de copias u observaciones que la describan.");
                }
            }
            case FUSION -> {
                if (r.fusionPartnerSymbol() == null) {
                    throw new BusinessRuleException("Una fusión requiere el gen compañero.");
                }
            }
            case STRUCTURAL -> {
                if (r.hgvsC() == null && r.observations() == null) {
                    throw new BusinessRuleException("Una variante estructural requiere HGVS u observaciones.");
                }
            }
            default -> throw new IllegalStateException("Tipo no soportado: " + type);
        }
        if (r.hgvsC() != null && !r.hgvsC().toLowerCase(Locale.ROOT).matches("^([a-z]{2}_\\d+(\\.\\d+)?:)?[cgnr]\\..+")) {
            throw new BusinessRuleException("HGVS c. debe comenzar por 'c.' (p. ej. c.2573T>G).");
        }
        if (r.hgvsP() != null && !r.hgvsP().startsWith("p.")) {
            throw new BusinessRuleException("HGVS p. debe comenzar por 'p.' (p. ej. p.L858R o p.Leu858Arg).");
        }
    }

    private static List<String> normalizeGenes(List<String> genes) {
        return genes.stream().map(g -> g.trim().toUpperCase(Locale.ROOT)).filter(g -> !g.isEmpty()).distinct()
                .toList();
    }

    private String symbolOf(UUID geneId) {
        return genes.findById(geneId).map(Gene::getSymbol).orElse(null);
    }

    private MolecularTest requireTest(UUID testId) {
        return tests.findById(testId).orElseThrow(() -> new NotFoundException("Estudio molecular", testId));
    }

    private UUID caseIdOfTest(MolecularTest test) {
        return sampleService.requireSample(test.getSampleId()).getCaseId();
    }
}
