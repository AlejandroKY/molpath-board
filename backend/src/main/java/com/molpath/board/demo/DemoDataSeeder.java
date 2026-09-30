package com.molpath.board.demo;

import com.molpath.board.casefile.CaseTargets.TargetType;
import com.molpath.board.casefile.TumorCase;
import com.molpath.board.casefile.TumorCaseRepository;
import com.molpath.board.config.AppProperties;
import com.molpath.board.discussion.DiscussionComment;
import com.molpath.board.discussion.DiscussionService.CommentRepository;
import com.molpath.board.interpretation.Interpretation;
import com.molpath.board.interpretation.InterpretationService.InterpretationRepository;
import com.molpath.board.knowledge.Evidence;
import com.molpath.board.knowledge.Gene;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.InterpretationScope;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GenePathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.SourceVersionRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.VariantEvidenceLinkRepository;
import com.molpath.board.knowledge.Pathway;
import com.molpath.board.knowledge.Publication;
import com.molpath.board.knowledge.SourceVersion;
import com.molpath.board.molecular.BiomarkerResult;
import com.molpath.board.molecular.MolecularDtos.BiomarkerRequest;
import com.molpath.board.molecular.MolecularDtos.MolecularTestRequest;
import com.molpath.board.molecular.MolecularDtos.VariantRequest;
import com.molpath.board.molecular.MolecularEnums.BiomarkerType;
import com.molpath.board.molecular.MolecularEnums.MolecularTestType;
import com.molpath.board.molecular.MolecularEnums.VariantOrigin;
import com.molpath.board.molecular.MolecularEnums.VariantType;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.MolecularTest;
import com.molpath.board.molecular.Variant;
import com.molpath.board.sample.HistologyFinding;
import com.molpath.board.sample.IhcResult;
import com.molpath.board.sample.Sample;
import com.molpath.board.sample.SampleDtos.HistologyRequest;
import com.molpath.board.sample.SampleDtos.IhcRequest;
import com.molpath.board.sample.SampleDtos.SampleRequest;
import com.molpath.board.sample.SampleEnums.IhcIntensity;
import com.molpath.board.sample.SampleEnums.IhcResultValue;
import com.molpath.board.sample.SampleEnums.NucleicAcidQuality;
import com.molpath.board.sample.SampleEnums.SampleType;
import com.molpath.board.sample.SampleRepositories.HistologyFindingRepository;
import com.molpath.board.sample.SampleRepositories.IhcResultRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import com.molpath.board.timeline.TimelineEvent;
import com.molpath.board.timeline.TimelineService.TimelineEventRepository;
import com.molpath.board.user.AppUser;
import com.molpath.board.user.AppUserRepository;
import com.molpath.board.user.UserRole;
import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Siembra el dataset demo compartido ({@code /demo-data/demo-dataset.json}) si
 * {@code MOLPATH_DEMO_SEED=true} y la base de datos no tiene usuarios. Todos los casos son ficticios;
 * los registros científicos conservan la procedencia y fecha de consulta del dataset.
 */
@Component
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    public static final String DATASET = "demo/demo-dataset.json";

    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final EntityManager em;
    private final AppUserRepository users;
    private final SourceVersionRepository sourceVersions;
    private final GeneRepository genes;
    private final PathwayRepository pathways;
    private final GenePathwayRepository genePathways;
    private final PublicationRepository publications;
    private final EvidenceRepository evidence;
    private final TumorCaseRepository cases;
    private final SampleRepository samples;
    private final HistologyFindingRepository histology;
    private final IhcResultRepository ihc;
    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final TimelineEventRepository timeline;
    private final VariantEvidenceLinkRepository links;
    private final InterpretationRepository interpretations;
    private final CommentRepository comments;

    public DemoDataSeeder(AppProperties properties, ObjectMapper objectMapper, EntityManager em,
            AppUserRepository users, SourceVersionRepository sourceVersions, GeneRepository genes,
            PathwayRepository pathways, GenePathwayRepository genePathways, PublicationRepository publications,
            EvidenceRepository evidence, TumorCaseRepository cases, SampleRepository samples,
            HistologyFindingRepository histology, IhcResultRepository ihc, MolecularTestRepository tests,
            VariantRepository variants, BiomarkerResultRepository biomarkers, TimelineEventRepository timeline,
            VariantEvidenceLinkRepository links, InterpretationRepository interpretations,
            CommentRepository comments) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.em = em;
        this.users = users;
        this.sourceVersions = sourceVersions;
        this.genes = genes;
        this.pathways = pathways;
        this.genePathways = genePathways;
        this.publications = publications;
        this.evidence = evidence;
        this.cases = cases;
        this.samples = samples;
        this.histology = histology;
        this.ihc = ihc;
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.timeline = timeline;
        this.links = links;
        this.interpretations = interpretations;
        this.comments = comments;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (!properties.demo().seed()) {
            return;
        }
        if (users.count() > 0) {
            log.info("Dataset demo no sembrado: la base de datos ya contiene usuarios.");
            return;
        }
        JsonNode root;
        try (InputStream in = new ClassPathResource(DATASET).getInputStream()) {
            root = objectMapper.readTree(in);
        }
        seed(root);
        log.info("Dataset demo sembrado: {} casos ficticios.", root.path("cases").size());
    }

    void seed(JsonNode root) {
        Map<UUID, UserRole> roles = new HashMap<>();
        for (JsonNode u : root.path("users")) {
            AppUser user = new AppUser(uuid(u, "id"), text(u, "username"), text(u, "displayName"),
                    UserRole.valueOf(text(u, "role")));
            users.save(user);
            roles.put(user.getId(), user.getRole());
        }
        for (JsonNode v : root.path("sourceVersions")) {
            sourceVersions.save(new SourceVersion(uuid(v, "id"), text(v, "sourceCode"), text(v, "versionLabel"),
                    instant(v, "retrievedAt")));
        }
        em.flush();
        Map<String, UUID> geneBySymbol = new HashMap<>();
        for (JsonNode g : root.path("genes")) {
            Gene gene = new Gene(uuid(g, "id"), text(g, "symbol"));
            gene.enrich(text(g, "name"), text(g, "entrezId"), text(g, "uniprotId"), uuid(g, "sourceVersionId"));
            genes.save(gene);
            geneBySymbol.put(gene.getSymbol(), gene.getId());
        }
        for (JsonNode p : root.path("pathways")) {
            pathways.save(new Pathway(uuid(p, "id"), text(p, "sourceCode"), text(p, "externalId"), text(p, "name"),
                    uuid(p, "sourceVersionId")));
        }
        for (JsonNode p : root.path("publications")) {
            Publication pub = new Publication(uuid(p, "id"), text(p, "pmid"));
            pub.refresh(text(p, "doi"), text(p, "title"), text(p, "authors"), text(p, "journal"),
                    p.path("pubYear").isNumber() ? p.path("pubYear").asInt() : null, text(p, "pubDate"),
                    text(p, "abstractText"), uuid(p, "sourceVersionId"), instant(p, "retrievedAt"));
            publications.save(pub);
        }
        em.flush();
        for (JsonNode gp : root.path("genePathways")) {
            genePathways.save(new Pathway.GenePathway(uuid(gp, "geneId"), uuid(gp, "pathwayId"),
                    uuid(gp, "sourceVersionId"), instant(gp, "retrievedAt")));
        }
        for (JsonNode e : root.path("evidence")) {
            Evidence item = new Evidence(uuid(e, "id"), new Evidence.Draft(uuid(e, "geneId"),
                    text(e, "variantDescriptor"), EvidenceType.valueOf(text(e, "evidenceType")),
                    text(e, "description"), text(e, "diseaseContext"), Certainty.valueOf(text(e, "certainty")),
                    CertaintyBasis.valueOf(text(e, "certaintyBasis")), text(e, "sourceLevel"),
                    text(e, "sourceDirection"), text(e, "sourceSignificance"),
                    e.path("sourceRating").isNumber() ? e.path("sourceRating").asInt() : null, null,
                    InterpretationScope.valueOf(text(e, "interpretationScope")), text(e, "sourceCode"),
                    text(e, "externalId"), text(e, "url"), uuid(e, "publicationId"), null, null,
                    uuid(e, "sourceVersionId"), instant(e, "retrievedAt")), null);
            item.overrideCreatedAt(instant(e, "retrievedAt"));
            evidence.save(item);
        }
        em.flush();
        for (JsonNode c : root.path("cases")) {
            seedCase(c, geneBySymbol, roles);
        }
        em.flush();
    }

    private void seedCase(JsonNode c, Map<String, UUID> geneBySymbol, Map<UUID, UserRole> roles) {
        UUID caseId = uuid(c, "id");
        TumorCase tumorCase = new TumorCase(caseId, text(c, "caseCode"), uuid(c, "createdBy"));
        tumorCase.describe(text(c, "organ"), text(c, "tumorType"), text(c, "diagnosis"),
                text(c, "histologicSubtype"), text(c, "grade"), text(c, "notes"));
        tumorCase.overrideCreatedAt(instant(c, "createdAt"));
        cases.save(tumorCase);
        em.flush();
        for (JsonNode s : c.path("samples")) {
            Sample sample = new Sample(uuid(s, "id"), caseId);
            sample.apply(new SampleRequest(text(s, "label"), SampleType.valueOf(text(s, "sampleType")),
                    text(s, "anatomicSite"), date(s, "collectionDate"), decimal(s, "tumorCellularityPct"),
                    decimal(s, "necrosisPct"), bool(s, "dnaAvailable"), bool(s, "rnaAvailable"),
                    en(s, "dnaQuality", NucleicAcidQuality::valueOf), en(s, "rnaQuality", NucleicAcidQuality::valueOf),
                    text(s, "observations"), null));
            samples.save(sample);
            em.flush();
            for (JsonNode h : s.path("histology")) {
                HistologyFinding finding = new HistologyFinding(uuid(h, "id"), sample.getId());
                finding.apply(new HistologyRequest(text(h, "diagnosis"), text(h, "histologicSubtype"), text(h, "grade"),
                        text(h, "growthPattern"), text(h, "description")));
                histology.save(finding);
            }
            for (JsonNode r : s.path("ihc")) {
                IhcResult result = new IhcResult(uuid(r, "id"), sample.getId());
                result.apply(new IhcRequest(text(r, "marker"), IhcResultValue.valueOf(text(r, "result")),
                        decimal(r, "percentage"), en(r, "intensity", IhcIntensity::valueOf), text(r, "score"),
                        text(r, "method"), text(r, "observations")));
                ihc.save(result);
            }
            for (JsonNode t : s.path("molecularTests")) {
                seedTest(t, sample.getId(), geneBySymbol);
            }
        }
        em.flush();
        for (JsonNode e : c.path("timelineEvents")) {
            timeline.save(new TimelineEvent(uuid(e, "id"), caseId, TimelineEvent.EventType.valueOf(text(e, "eventType")),
                    date(e, "eventDate"), text(e, "title"), text(e, "description"), uuid(e, "sampleId"), null));
        }
        for (JsonNode l : c.path("evidenceLinks")) {
            links.save(new Evidence.VariantEvidenceLink(uuid(l, "variantId"), uuid(l, "evidenceId"), null,
                    text(l, "note"), instant(c, "createdAt")));
        }
        for (JsonNode i : c.path("interpretations")) {
            UUID author = uuid(i, "authorId");
            interpretations.save(new Interpretation(uuid(i, "id"), caseId, TargetType.valueOf(text(i, "targetType")),
                    text(i, "targetId"), text(i, "statement"), Certainty.valueOf(text(i, "certainty")), null, author,
                    roles.get(author), instant(i, "createdAt")));
        }
        for (JsonNode m : c.path("comments")) {
            UUID author = uuid(m, "authorId");
            comments.save(new DiscussionComment(uuid(m, "id"), caseId, TargetType.valueOf(text(m, "targetType")),
                    text(m, "targetId"), author, roles.get(author), text(m, "body"), instant(m, "createdAt")));
        }
    }

    private void seedTest(JsonNode t, UUID sampleId, Map<String, UUID> geneBySymbol) {
        MolecularTest test = new MolecularTest(uuid(t, "id"), sampleId);
        List<String> genesAnalyzed = new ArrayList<>();
        t.path("genesAnalyzed").forEach(g -> genesAnalyzed.add(g.asString()));
        test.apply(new MolecularTestRequest(MolecularTestType.valueOf(text(t, "testType")), text(t, "laboratory"),
                text(t, "platform"), text(t, "panelName"), genesAnalyzed,
                t.path("meanDepth").isNumber() ? t.path("meanDepth").asInt() : null, decimal(t, "limitOfDetectionPct"),
                date(t, "testDate"), text(t, "notes")), genesAnalyzed);
        tests.save(test);
        em.flush();
        for (JsonNode v : t.path("variants")) {
            String symbol = text(v, "geneSymbol");
            UUID geneId = geneBySymbol.computeIfAbsent(symbol, s -> genes.save(new Gene(null, s)).getId());
            Variant variant = new Variant(uuid(v, "id"), test.getId());
            variant.apply(new VariantRequest(symbol, VariantType.valueOf(text(v, "variantType")), text(v, "transcript"),
                    text(v, "hgvsC"), text(v, "hgvsP"), decimal(v, "vaf"),
                    v.path("coverage").isNumber() ? v.path("coverage").asInt() : null, decimal(v, "copyNumber"),
                    text(v, "fusionPartnerSymbol"), en(v, "origin", VariantOrigin::valueOf), text(v, "classification"),
                    text(v, "classificationSystem"), text(v, "observations")), geneId);
            em.flush();
            variants.save(variant);
        }
        for (JsonNode b : t.path("biomarkers")) {
            BiomarkerResult biomarker = new BiomarkerResult(uuid(b, "id"), test.getId());
            biomarker.apply(new BiomarkerRequest(BiomarkerType.valueOf(text(b, "biomarkerType")), text(b, "name"),
                    decimal(b, "valueNumeric"), text(b, "valueText"), text(b, "unit"), text(b, "observations")));
            biomarkers.save(biomarker);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asString();
    }

    private static UUID uuid(JsonNode n, String field) {
        String v = text(n, field);
        return v == null ? null : UUID.fromString(v);
    }

    private static Instant instant(JsonNode n, String field) {
        String v = text(n, field);
        return v == null ? null : Instant.parse(v);
    }

    private static LocalDate date(JsonNode n, String field) {
        String v = text(n, field);
        return v == null ? null : LocalDate.parse(v);
    }

    private static BigDecimal decimal(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isNumber() ? v.decimalValue() : null;
    }

    private static Boolean bool(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isBoolean() ? v.asBoolean() : null;
    }

    private static <E> E en(JsonNode n, String field, Function<String, E> parser) {
        String v = text(n, field);
        return v == null ? null : parser.apply(v);
    }
}
