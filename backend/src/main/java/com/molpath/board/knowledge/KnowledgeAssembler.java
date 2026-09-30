package com.molpath.board.knowledge;

import com.molpath.board.knowledge.KnowledgeDtos.EvidenceDto;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PublicationRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.SourceVersionRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Construye DTOs de evidencia con su trazabilidad completa cargando genes, publicaciones y versiones por lotes. */
@Component
public class KnowledgeAssembler {

    private final GeneRepository genes;
    private final PublicationRepository publications;
    private final SourceVersionRepository sourceVersions;

    public KnowledgeAssembler(GeneRepository genes, PublicationRepository publications,
            SourceVersionRepository sourceVersions) {
        this.genes = genes;
        this.publications = publications;
        this.sourceVersions = sourceVersions;
    }

    public List<EvidenceDto> evidence(Collection<Evidence> items) {
        if (items.isEmpty()) {
            return List.of();
        }
        Map<UUID, Gene> geneById = index(genes.findAllByIdIn(ids(items, Evidence::getGeneId)), Gene::getId);
        Map<UUID, Publication> pubById = index(publications.findAllByIdIn(ids(items, Evidence::getPublicationId)),
                Publication::getId);
        Map<UUID, SourceVersion> versionById = index(
                sourceVersions.findAllByIdIn(ids(items, Evidence::getSourceVersionId)), SourceVersion::getId);
        return items.stream().map(e -> toDto(e, geneById.get(e.getGeneId()), pubById.get(e.getPublicationId()),
                versionById.get(e.getSourceVersionId()))).toList();
    }

    public EvidenceDto evidence(Evidence item) {
        return evidence(List.of(item)).getFirst();
    }

    private static EvidenceDto toDto(Evidence e, Gene gene, Publication pub, SourceVersion version) {
        String pmid = pub == null ? null : pub.getPmid();
        String doi = e.getDoi() != null ? e.getDoi() : pub == null ? null : pub.getDoi();
        String publishedDate = e.getPublishedDate() != null ? e.getPublishedDate()
                : pub == null ? null : pub.getPubDate();
        return new EvidenceDto(e.getId(), e.getGeneId(), gene == null ? null : gene.getSymbol(),
                e.getVariantDescriptor(), e.getEvidenceType(), e.getDescription(), e.getDiseaseContext(),
                e.getCertainty(), e.getCertaintyBasis(), e.getSourceLevel(), e.getSourceDirection(),
                e.getSourceSignificance(), e.getSourceRating(), e.getSourceTherapies(), e.getInterpretationScope(),
                e.getSourceCode(), e.getExternalId(), e.getUrl(), e.getPublicationId(), pmid,
                Publication.pubmedUrl(pmid), doi, publishedDate, e.getSourceVersionId(),
                version == null ? null : version.getVersionLabel(), e.getRetrievedAt(), e.getStatus(),
                e.getStatusReason(), e.getCreatedAt(), e.getVersion());
    }

    private static <T> List<UUID> ids(Collection<T> items, Function<T, UUID> getter) {
        return items.stream().map(getter).filter(Objects::nonNull).distinct().toList();
    }

    private static <T> Map<UUID, T> index(List<T> items, Function<T, UUID> key) {
        return items.stream().collect(Collectors.toMap(key, Function.identity(), (a, b) -> a));
    }
}
