package com.molpath.board.knowledge;

import com.molpath.board.audit.AuditEventRepository;
import com.molpath.board.audit.AuditService;
import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Exceptions.ConflictException;
import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.PageResponse;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.Evidence.VariantEvidenceLink;
import com.molpath.board.knowledge.KnowledgeDtos.ClassificationRequest;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkDto;
import com.molpath.board.knowledge.KnowledgeDtos.EvidenceLinkRequest;
import com.molpath.board.knowledge.KnowledgeDtos.ManualEvidenceRequest;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceStatus;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import com.molpath.board.knowledge.KnowledgeEnums.SourceCodes;
import com.molpath.board.knowledge.KnowledgeRepositories.EvidenceRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.VariantEvidenceLinkRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import com.molpath.board.molecular.ProteinChange;
import com.molpath.board.molecular.Variant;
import com.molpath.board.molecular.VariantContext;
import com.molpath.board.security.CurrentUser;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class EvidenceService {

    public record EvidenceFilter(String geneSymbol, String variant, EvidenceType type, Certainty certainty,
            String sourceCode, EvidenceStatus status, String q) {}

    public record CaseEvidence(List<EvidenceDto> evidence, List<EvidenceLinkDto> links) {}

    public record EvidenceHistoryEntry(Instant occurredAt, String action, UUID actorId, String beforeState,
            String afterState) {}

    private final EvidenceRepository evidence;
    private final VariantEvidenceLinkRepository links;
    private final VariantRepository variants;
    private final GeneRepository genes;
    private final GeneService geneService;
    private final PublicationService publicationService;
    private final KnowledgeAssembler assembler;
    private final CurrentUser currentUser;
    private final AuditService audit;
    private final AuditEventRepository auditEvents;

    public EvidenceService(EvidenceRepository evidence, VariantEvidenceLinkRepository links,
            VariantRepository variants, GeneRepository genes, GeneService geneService,
            PublicationService publicationService, KnowledgeAssembler assembler, CurrentUser currentUser,
            AuditService audit, AuditEventRepository auditEvents) {
        this.evidence = evidence;
        this.links = links;
        this.variants = variants;
        this.genes = genes;
        this.geneService = geneService;
        this.publicationService = publicationService;
        this.assembler = assembler;
        this.currentUser = currentUser;
        this.audit = audit;
        this.auditEvents = auditEvents;
    }

    @Transactional(readOnly = true)
    public PageResponse<EvidenceDto> search(EvidenceFilter filter, Integer page, Integer size) {
        Optional<UUID> geneId = Optional.empty();
        String geneSymbol = Text.upper(filter.geneSymbol());
        if (geneSymbol != null) {
            geneId = genes.findBySymbol(geneSymbol).map(Gene::getId);
            if (geneId.isEmpty()) {
                return new PageResponse<>(List.of(), 0, size == null ? 20 : size, 0, 0);
            }
        }
        Specification<Evidence> spec = specification(filter, geneId.orElse(null));
        Page<Evidence> result = evidence.findAll(spec,
                PageResponse.pageable(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<EvidenceDto> dtos = assembler.evidence(result.getContent());
        return new PageResponse<>(dtos, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public EvidenceDto get(UUID id) {
        return assembler.evidence(require(id));
    }

    public EvidenceDto createManual(ManualEvidenceRequest request) {
        if (request.pmid() == null && request.doi() == null && request.url() == null) {
            throw new BusinessRuleException("Toda evidencia debe citar su fuente: indique PMID, DOI o URL.");
        }
        UUID geneId = request.geneSymbol() == null ? null : geneService.findOrCreate(request.geneSymbol()).getId();
        UUID publicationId = request.pmid() == null ? null
                : publicationService.importByPmid(request.pmid(), false).getId();
        Certainty certainty = request.certainty() == null ? Certainty.UNKNOWN : request.certainty();
        Evidence.Draft draft = new Evidence.Draft(geneId, normalizeDescriptor(request.variantDescriptor()),
                request.evidenceType(), request.description(), request.diseaseContext(), certainty,
                certainty == Certainty.UNKNOWN ? CertaintyBasis.NONE : CertaintyBasis.USER_ASSIGNED, null, null, null,
                null, null, request.interpretationScope(), SourceCodes.MANUAL, null, request.url(), publicationId,
                request.doi(), request.publishedDate(), null, Instant.now());
        Evidence saved = evidence.saveAndFlush(new Evidence(null, draft, currentUser.id().orElse(null)));
        EvidenceDto dto = assembler.evidence(saved);
        audit.record(AuditService.CREATE, "EVIDENCE", saved.getId(), null, null, dto);
        if (request.linkToVariantId() != null) {
            link(request.linkToVariantId(), new EvidenceLinkRequest(saved.getId(), request.linkNote()));
        }
        return dto;
    }

    /** Crea evidencia a partir de un borrador ya verificado contra su fuente (importaciones). */
    public Evidence createFromSource(Evidence.Draft draft) {
        Evidence saved = evidence.saveAndFlush(new Evidence(null, draft, currentUser.id().orElse(null)));
        audit.record(AuditService.IMPORT, "EVIDENCE", saved.getId(), null, null, assembler.evidence(saved));
        return saved;
    }

    public EvidenceDto classify(UUID id, ClassificationRequest request) {
        Evidence item = require(id);
        if (request.version() != null && !Objects.equals(request.version(), item.getVersion())) {
            throw new ConflictException("La evidencia fue modificada por otra persona. Recargue antes de guardar.");
        }
        EvidenceDto before = assembler.evidence(item);
        if (request.certainty() != item.getCertainty()) {
            item.classify(request.certainty(), CertaintyBasis.USER_ASSIGNED);
        }
        if (request.status() != item.getStatus() || !Objects.equals(request.reason(), item.getStatusReason())) {
            item.changeStatus(request.status(), request.reason());
        }
        EvidenceDto after = assembler.evidence(evidence.saveAndFlush(item));
        audit.record(AuditService.UPDATE, "EVIDENCE", id, null, before, after);
        return after;
    }

    public EvidenceLinkDto link(UUID variantId, EvidenceLinkRequest request) {
        Variant variant = variants.findById(variantId).orElseThrow(() -> new NotFoundException("Variante", variantId));
        require(request.evidenceId());
        VariantEvidenceLink.Key key = new VariantEvidenceLink.Key(variantId, request.evidenceId());
        if (links.existsById(key)) {
            throw new ConflictException("La evidencia ya está enlazada a esta variante.");
        }
        VariantEvidenceLink saved = links.save(new VariantEvidenceLink(variantId, request.evidenceId(),
                currentUser.id().orElse(null), request.note(), Instant.now()));
        EvidenceLinkDto dto = EvidenceLinkDto.from(saved);
        audit.record(AuditService.LINK, "VARIANT_EVIDENCE", variantId + ":" + request.evidenceId(),
                caseIdOf(variant.getId()), null, dto);
        return dto;
    }

    public void unlink(UUID variantId, UUID evidenceId) {
        VariantEvidenceLink link = links.findById(new VariantEvidenceLink.Key(variantId, evidenceId))
                .orElseThrow(() -> new NotFoundException("Enlace variante-evidencia", variantId + ":" + evidenceId));
        audit.record(AuditService.UNLINK, "VARIANT_EVIDENCE", variantId + ":" + evidenceId, caseIdOf(variantId),
                EvidenceLinkDto.from(link), null);
        links.delete(link);
    }

    @Transactional(readOnly = true)
    public CaseEvidence forCase(UUID caseId) {
        List<UUID> variantIds = variants.findAllByCaseId(caseId).stream().map(Variant::getId).toList();
        if (variantIds.isEmpty()) {
            return new CaseEvidence(List.of(), List.of());
        }
        List<VariantEvidenceLink> caseLinks = links.findAllByVariantIds(variantIds);
        List<Evidence> items = evidence.findAllByIdIn(caseLinks.stream().map(VariantEvidenceLink::evidenceId)
                .distinct().toList());
        return new CaseEvidence(assembler.evidence(items), caseLinks.stream().map(EvidenceLinkDto::from).toList());
    }

    @Transactional(readOnly = true)
    public List<EvidenceHistoryEntry> history(UUID id) {
        require(id);
        return auditEvents.findAllByEntityTypeAndEntityIdOrderByOccurredAtAsc("EVIDENCE", id.toString()).stream()
                .map(a -> new EvidenceHistoryEntry(a.getOccurredAt(), a.getAction(), a.getActorId(),
                        a.getBeforeState(), a.getAfterState()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Evidence require(UUID id) {
        return evidence.findById(id).orElseThrow(() -> new NotFoundException("Evidencia", id));
    }

    private UUID caseIdOf(UUID variantId) {
        return variants.findContexts(List.of(variantId)).stream().map(VariantContext::caseId).findFirst()
                .orElse(null);
    }

    static String normalizeDescriptor(String descriptor) {
        return descriptor == null ? null : ProteinChange.normalize(descriptor);
    }

    private static Specification<Evidence> specification(EvidenceFilter f, UUID geneId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (geneId != null) {
                predicates.add(cb.equal(root.get("geneId"), geneId));
            }
            String descriptor = normalizeDescriptor(Text.clean(f.variant()));
            if (descriptor != null) {
                predicates.add(cb.equal(cb.lower(root.get("variantDescriptor")), descriptor.toLowerCase(Locale.ROOT)));
            }
            if (f.type() != null) {
                predicates.add(cb.equal(root.get("evidenceType"), f.type()));
            }
            if (f.certainty() != null) {
                predicates.add(cb.equal(root.get("certainty"), f.certainty()));
            }
            String source = Text.upper(f.sourceCode());
            if (source != null) {
                predicates.add(cb.equal(root.get("sourceCode"), source));
            }
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            String q = Text.clean(f.q());
            if (q != null) {
                String pattern = "%" + q.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("description")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("diseaseContext"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("externalId"), "")), pattern)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
