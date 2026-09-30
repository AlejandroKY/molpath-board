package com.molpath.board.casefile;

import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.molecular.MolecularRepositories.BiomarkerResultRepository;
import com.molpath.board.molecular.MolecularRepositories.MolecularTestRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.VariantContext;
import com.molpath.board.sample.SampleRepositories.HistologyFindingRepository;
import com.molpath.board.sample.SampleRepositories.IhcResultRepository;
import com.molpath.board.sample.SampleRepositories.SampleRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Elementos de un caso a los que se puede asociar un comentario o una interpretación, y validación
 * de que el elemento existe y pertenece al caso (las referencias son polimórficas y no tienen FK).
 */
@Component
public class CaseTargets {

    public enum TargetType {
        CASE, SAMPLE, HISTOLOGY, IHC, MOLECULAR_TEST, VARIANT, BIOMARKER, EVIDENCE, GENE, PATHWAY, PUBLICATION,
        INTERPRETATION, GRAPH_NODE
    }

    private static final String GRAPH_NODE_ID = "^[a-z_]{2,20}:[A-Za-z0-9:._-]{1,70}$";

    private final SampleRepository samples;
    private final HistologyFindingRepository histology;
    private final IhcResultRepository ihc;
    private final MolecularTestRepository tests;
    private final VariantRepository variants;
    private final BiomarkerResultRepository biomarkers;
    private final EvidenceRepository evidence;
    private final GeneRepository genes;
    private final PathwayRepository pathways;
    private final PublicationRepository publications;

    public CaseTargets(SampleRepository samples, HistologyFindingRepository histology, IhcResultRepository ihc,
            MolecularTestRepository tests, VariantRepository variants, BiomarkerResultRepository biomarkers,
            EvidenceRepository evidence, GeneRepository genes, PathwayRepository pathways,
            PublicationRepository publications) {
        this.samples = samples;
        this.histology = histology;
        this.ihc = ihc;
        this.tests = tests;
        this.variants = variants;
        this.biomarkers = biomarkers;
        this.evidence = evidence;
        this.genes = genes;
        this.pathways = pathways;
        this.publications = publications;
    }

    @Transactional(readOnly = true)
    public void validate(UUID caseId, TargetType type, String targetId) {
        if (targetId == null || targetId.isBlank() || targetId.length() > 80) {
            throw new BusinessRuleException("Identificador de elemento no válido.");
        }
        boolean valid = switch (type) {
            case CASE -> caseId.toString().equals(targetId);
            case GRAPH_NODE -> targetId.matches(GRAPH_NODE_ID);
            case INTERPRETATION -> uuid(targetId).isPresent();
            default -> uuid(targetId).map(id -> belongs(caseId, type, id)).orElse(false);
        };
        if (!valid) {
            throw new BusinessRuleException("El elemento " + type + " " + targetId + " no existe o no pertenece al caso.");
        }
    }

    private boolean belongs(UUID caseId, TargetType type, UUID id) {
        return switch (type) {
            case SAMPLE -> samples.findById(id).map(s -> s.getCaseId().equals(caseId)).orElse(false);
            case HISTOLOGY -> histology.findById(id).map(h -> sampleInCase(h.getSampleId(), caseId)).orElse(false);
            case IHC -> ihc.findById(id).map(r -> sampleInCase(r.getSampleId(), caseId)).orElse(false);
            case MOLECULAR_TEST -> tests.findById(id).map(t -> sampleInCase(t.getSampleId(), caseId)).orElse(false);
            case VARIANT -> variantInCase(id, caseId);
            case BIOMARKER -> biomarkers.findById(id)
                    .flatMap(b -> tests.findById(b.getMolecularTestId()))
                    .map(t -> sampleInCase(t.getSampleId(), caseId)).orElse(false);
            case EVIDENCE -> evidence.existsById(id);
            case GENE -> genes.existsById(id);
            case PATHWAY -> pathways.existsById(id);
            case PUBLICATION -> publications.existsById(id);
            default -> false;
        };
    }

    private boolean sampleInCase(UUID sampleId, UUID caseId) {
        return samples.findById(sampleId).map(s -> s.getCaseId().equals(caseId)).orElse(false);
    }

    private boolean variantInCase(UUID variantId, UUID caseId) {
        List<VariantContext> contexts = variants.findContexts(List.of(variantId));
        return !contexts.isEmpty() && contexts.getFirst().caseId().equals(caseId);
    }

    private static Optional<UUID> uuid(String value) {
        try {
            return Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
