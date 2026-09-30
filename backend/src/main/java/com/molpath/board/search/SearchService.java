package com.molpath.board.search;

import com.molpath.board.casefile.TumorCase;
import com.molpath.board.casefile.TumorCaseRepository;
import com.molpath.board.knowledge.Evidence;
import com.molpath.board.knowledge.Gene;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.molecular.BiomarkerResult;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.MolecularTest;
import com.molpath.board.molecular.Variant;
import com.molpath.board.molecular.VariantContext;
import com.molpath.board.sample.IhcResult;
import com.molpath.board.sample.Sample;
import com.molpath.board.sample.SampleRepositories.IhcResultRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.search.QueryClassifier.ClassifiedQuery;
import com.molpath.board.search.QueryClassifier.EntityKind;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SearchService {

    public record SearchHit(EntityKind kind, String id, String title, String subtitle, UUID caseId, String caseCode,
            String route) {}

    public record SearchGroup(EntityKind kind, String label, List<SearchHit> items) {}

    public record SearchResponse(String query, List<EntityKind> interpretedAs, String geneSymbol,
            String proteinChange, String pmid, List<SearchGroup> groups) {}

    private static final int MAX_LIMIT = 50;

    private final TumorCaseRepository cases;
    private final SampleRepository samples;
    private final IhcResultRepository ihc;
    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final GeneRepository genes;
    private final PathwayRepository pathways;
    private final PublicationRepository publications;
    private final EvidenceRepository evidence;

    public SearchService(TumorCaseRepository cases, SampleRepository samples, IhcResultRepository ihc,
            MolecularTestRepository tests, VariantRepository variants, BiomarkerResultRepository biomarkers,
            GeneRepository genes, PathwayRepository pathways, PublicationRepository publications,
            EvidenceRepository evidence) {
        this.cases = cases;
        this.samples = samples;
        this.ihc = ihc;
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.genes = genes;
        this.pathways = pathways;
        this.publications = publications;
        this.evidence = evidence;
    }

    public SearchResponse search(String query, Integer limitParam) {
        int limit = limitParam == null ? 10 : Math.max(1, Math.min(limitParam, MAX_LIMIT));
        ClassifiedQuery cq = QueryClassifier.classify(query);
        Map<EntityKind, SearchGroup> groups = new LinkedHashMap<>();
        if (cq.kinds().isEmpty()) {
            return new SearchResponse(cq.normalized(), List.of(), null, null, null, List.of());
        }
        Pageable page = PageRequest.of(0, limit);
        String pattern = "%" + cq.normalized().toLowerCase(Locale.ROOT) + "%";
        for (EntityKind kind : cq.kinds()) {
            List<SearchHit> hits = switch (kind) {
                case PMID -> searchPmid(cq.pmid());
                case VARIANT -> searchVariants(cq, page);
                case GENE -> searchGenes(cq, page);
                case IHC_MARKER -> searchIhc(pattern, page);
                case BIOMARKER -> searchBiomarkers(pattern, page);
                case CASE, TUMOR -> searchCases(pattern, page);
                case PATHWAY -> pathways.search(pattern, page).stream()
                        .map(p -> new SearchHit(EntityKind.PATHWAY, p.getId().toString(), p.getName(),
                                p.getSourceCode() + " · " + p.getExternalId(), null, null,
                                "REACTOME".equals(p.getSourceCode()) ? "https://reactome.org/content/detail/" + p.getExternalId() : null))
                        .toList();
                case EVIDENCE -> evidenceHits(evidence.searchText(pattern, page));
            };
            EntityKind groupKind = kind == EntityKind.TUMOR ? EntityKind.CASE : kind;
            if (!hits.isEmpty() && !groups.containsKey(groupKind)) {
                groups.put(groupKind, new SearchGroup(groupKind, label(groupKind), hits));
            }
        }
        return new SearchResponse(cq.normalized(), cq.kinds(), cq.geneSymbol(), cq.proteinChange(), cq.pmid(),
                List.copyOf(groups.values()));
    }

    private List<SearchHit> searchPmid(String pmid) {
        return publications.findByPmid(pmid)
                .map(p -> List.of(new SearchHit(EntityKind.PMID, p.getPmid(), p.getTitle(),
                        "PMID " + p.getPmid() + (p.getJournal() == null ? "" : " · " + p.getJournal())
                                + (p.getPubYear() == null ? "" : " · " + p.getPubYear()),
                        null, null, "/literature?pmid=" + p.getPmid())))
                .orElseGet(() -> List.of(new SearchHit(EntityKind.PMID, pmid, "PMID " + pmid + " no importado",
                        "Puede consultarse en PubMed e importarse desde Literatura", null, null,
                        "/literature?pmid=" + pmid)));
    }

    private List<SearchHit> searchVariants(ClassifiedQuery cq, Pageable page) {
        List<UUID> geneIds = genes.findBySymbol(cq.geneSymbol()).map(g -> List.of(g.getId())).orElse(List.of());
        List<Variant> found;
        if (geneIds.isEmpty()) {
            found = List.of();
        } else if (cq.proteinChange() != null) {
            found = variants.findByGenesAndProteinChange(geneIds, cq.proteinChange(), page);
        } else {
            found = variants.searchByHgvsC("%" + cq.hgvsC().toLowerCase(Locale.ROOT) + "%", page).stream()
                    .filter(v -> geneIds.contains(v.getGeneId())).toList();
        }
        List<SearchHit> hits = new ArrayList<>(variantHits(found, cq.geneSymbol()));
        if (!geneIds.isEmpty() && cq.proteinChange() != null) {
            hits.addAll(evidenceHits(evidence.findByGenesAndDescriptor(geneIds, cq.proteinChange(), page)));
        }
        return hits;
    }

    private List<SearchHit> searchGenes(ClassifiedQuery cq, Pageable page) {
        String symbol = cq.geneSymbol();
        List<Gene> matches = genes.search("%" + symbol.toLowerCase(Locale.ROOT) + "%", page);
        List<SearchHit> hits = new ArrayList<>();
        for (Gene g : matches) {
            long count = variants.countByGeneId(g.getId());
            hits.add(new SearchHit(EntityKind.GENE, g.getId().toString(), g.getSymbol(),
                    (g.getName() == null ? "Nombre pendiente de fuente verificada" : g.getName()) + " · " + count
                            + " variante(s) registradas",
                    null, null, "/evidence?gene=" + g.getSymbol()));
        }
        matches.stream().filter(g -> g.getSymbol().equals(symbol)).findFirst().ifPresent(g ->
                hits.addAll(variantHits(variants.findAllByGeneIdIn(List.of(g.getId()),
                        PageRequest.of(0, page.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"))), g.getSymbol())));
        return hits;
    }

    private List<SearchHit> searchIhc(String pattern, Pageable page) {
        List<IhcResult> results = ihc.searchByMarker(pattern, page);
        Map<UUID, Sample> sampleById = samples.findAllById(results.stream().map(IhcResult::getSampleId).distinct()
                .toList()).stream().collect(Collectors.toMap(Sample::getId, Function.identity()));
        Map<UUID, TumorCase> caseById = casesOf(sampleById.values().stream().map(Sample::getCaseId).toList());
        return results.stream().map(r -> {
            Sample s = sampleById.get(r.getSampleId());
            TumorCase c = s == null ? null : caseById.get(s.getCaseId());
            String detail = r.getResult() + (r.getScore() != null ? " · " + r.getScore()
                    : r.getPercentage() != null ? " · " + r.getPercentage().stripTrailingZeros().toPlainString() + "%" : "");
            return new SearchHit(EntityKind.IHC_MARKER, r.getId().toString(), r.getMarker() + " — " + detail,
                    (c == null ? "" : c.getCaseCode() + " · ") + (s == null ? "" : s.getLabel()),
                    c == null ? null : c.getId(), c == null ? null : c.getCaseCode(),
                    c == null ? null : "/cases/" + c.getId());
        }).toList();
    }

    private List<SearchHit> searchBiomarkers(String pattern, Pageable page) {
        List<BiomarkerResult> results = biomarkers.search(pattern, page);
        Map<UUID, MolecularTest> testById = tests.findAllById(results.stream().map(BiomarkerResult::getMolecularTestId)
                .distinct().toList()).stream().collect(Collectors.toMap(MolecularTest::getId, Function.identity()));
        Map<UUID, Sample> sampleById = samples.findAllById(testById.values().stream().map(MolecularTest::getSampleId)
                .distinct().toList()).stream().collect(Collectors.toMap(Sample::getId, Function.identity()));
        Map<UUID, TumorCase> caseById = casesOf(sampleById.values().stream().map(Sample::getCaseId).toList());
        return results.stream().map(b -> {
            MolecularTest t = testById.get(b.getMolecularTestId());
            Sample s = t == null ? null : sampleById.get(t.getSampleId());
            TumorCase c = s == null ? null : caseById.get(s.getCaseId());
            String value = b.getValueNumeric() != null
                    ? b.getValueNumeric().stripTrailingZeros().toPlainString() + (b.getUnit() == null ? "" : " " + b.getUnit())
                    : b.getValueText();
            return new SearchHit(EntityKind.BIOMARKER, b.getId().toString(), b.getBiomarkerType() + " — " + value,
                    b.getName() + (c == null ? "" : " · " + c.getCaseCode()), c == null ? null : c.getId(),
                    c == null ? null : c.getCaseCode(), c == null ? null : "/cases/" + c.getId());
        }).toList();
    }

    private List<SearchHit> searchCases(String pattern, Pageable page) {
        return cases.search(pattern, page).getContent().stream()
                .map(c -> new SearchHit(EntityKind.CASE, c.getId().toString(), c.getCaseCode() + " · " + c.getTumorType(),
                        c.getOrgan() + (c.getDiagnosis() == null ? "" : " · " + c.getDiagnosis()), c.getId(),
                        c.getCaseCode(), "/cases/" + c.getId()))
                .toList();
    }

    private List<SearchHit> variantHits(List<Variant> found, String geneSymbol) {
        if (found.isEmpty()) {
            return List.of();
        }
        Map<UUID, VariantContext> contexts = variants.findContexts(found.stream().map(Variant::getId).toList())
                .stream().collect(Collectors.toMap(VariantContext::variantId, Function.identity()));
        return found.stream().map(v -> {
            VariantContext ctx = contexts.get(v.getId());
            String change = v.getHgvsP() != null ? v.getHgvsP() : v.getHgvsC() != null ? v.getHgvsC() : v.getVariantType().name();
            String vaf = v.getVaf() == null ? "" : " · VAF " + v.getVaf().stripTrailingZeros().toPlainString() + "%";
            return new SearchHit(EntityKind.VARIANT, v.getId().toString(), geneSymbol + " " + change,
                    (ctx == null ? "" : ctx.caseCode() + " · " + ctx.sampleLabel()) + vaf,
                    ctx == null ? null : ctx.caseId(), ctx == null ? null : ctx.caseCode(),
                    ctx == null ? null : "/cases/" + ctx.caseId() + "/board?node=variant:" + v.getId());
        }).toList();
    }

    private List<SearchHit> evidenceHits(List<Evidence> items) {
        return items.stream().map(e -> new SearchHit(EntityKind.EVIDENCE, e.getId().toString(),
                e.getSourceCode() + (e.getExternalId() == null ? "" : " " + e.getExternalId()) + " · " + e.getEvidenceType(),
                truncate(e.getDescription(), 160), null, null, "/evidence?id=" + e.getId())).toList();
    }

    private Map<UUID, TumorCase> casesOf(List<UUID> ids) {
        return cases.findAllByIdIn(ids.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(TumorCase::getId, Function.identity()));
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static String label(EntityKind kind) {
        return switch (kind) {
            case PMID -> "Publicación (PMID)";
            case VARIANT -> "Variantes y evidencia";
            case GENE -> "Genes";
            case IHC_MARKER -> "Inmunohistoquímica";
            case BIOMARKER -> "Biomarcadores";
            case CASE, TUMOR -> "Casos (tumor, órgano, diagnóstico)";
            case PATHWAY -> "Pathways";
            case EVIDENCE -> "Evidencias";
        };
    }
}
