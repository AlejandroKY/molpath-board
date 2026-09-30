package com.molpath.board.knowledge;

import com.molpath.board.common.Exceptions.NotFoundException;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeDtos.GeneDto;
import com.molpath.board.knowledge.KnowledgeDtos.GenePathwayDto;
import com.molpath.board.knowledge.KnowledgeDtos.PathwayDto;
import com.molpath.board.knowledge.KnowledgeDtos.SourceVersionDto;
import com.molpath.board.knowledge.KnowledgeRepositories.GenePathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.GeneRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.PathwayRepository;
import com.molpath.board.knowledge.KnowledgeRepositories.SourceVersionRepository;
import com.molpath.board.molecular.MolecularRepositories.VariantRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class GeneService {

    public record GeneDetail(GeneDto gene, List<PathwayDto> pathways, List<GenePathwayDto> genePathways,
            List<SourceVersionDto> sourceVersions, long variantCount) {}

    private final GeneRepository genes;
    private final PathwayRepository pathways;
    private final GenePathwayRepository genePathways;
    private final SourceVersionRepository sourceVersions;
    private final VariantRepository variants;

    public GeneService(GeneRepository genes, PathwayRepository pathways, GenePathwayRepository genePathways,
            SourceVersionRepository sourceVersions, VariantRepository variants) {
        this.genes = genes;
        this.pathways = pathways;
        this.genePathways = genePathways;
        this.sourceVersions = sourceVersions;
        this.variants = variants;
    }

    /** Obtiene el gen por símbolo o lo registra sólo con el símbolo (sin inventar metadatos). */
    public Gene findOrCreate(String symbol) {
        String normalized = Text.upper(symbol);
        if (normalized == null) {
            throw new IllegalArgumentException("Símbolo génico vacío");
        }
        return genes.findBySymbol(normalized).orElseGet(() -> genes.saveAndFlush(new Gene(null, normalized)));
    }

    @Transactional(readOnly = true)
    public GeneDetail detail(String symbol) {
        Gene gene = genes.findBySymbol(Text.upper(symbol)).orElseThrow(() -> new NotFoundException("Gen", symbol));
        List<Pathway.GenePathway> links = genePathways.findAllByGeneIds(List.of(gene.getId()));
        List<Pathway> linked = pathways.findAllByIdIn(links.stream().map(l -> l.getId().pathwayId()).toList());
        Set<UUID> versionIds = new HashSet<>();
        versionIds.add(gene.getSourceVersionId());
        links.forEach(l -> versionIds.add(l.getSourceVersionId()));
        linked.forEach(p -> versionIds.add(p.getSourceVersionId()));
        versionIds.removeIf(Objects::isNull);
        return new GeneDetail(GeneDto.from(gene),
                linked.stream().map(PathwayDto::from).toList(),
                links.stream().map(GenePathwayDto::from).toList(),
                sourceVersions.findAllByIdIn(versionIds).stream().map(SourceVersionDto::from).toList(),
                variants.countByGeneId(gene.getId()));
    }
}
