package com.molpath.board.knowledge;

import com.molpath.board.knowledge.Evidence.VariantEvidenceLink;
import com.molpath.board.knowledge.Pathway.GenePathway;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public final class KnowledgeRepositories {

    private KnowledgeRepositories() {
    }

    public interface GeneRepository extends JpaRepository<Gene, UUID> {

        Optional<Gene> findBySymbol(String symbol);

        List<Gene> findAllByIdIn(Collection<UUID> ids);

        List<Gene> findAllBySymbolIn(Collection<String> symbols);

        @Query("select g from Gene g where lower(g.symbol) like :pattern or lower(coalesce(g.name, '')) like :pattern order by g.symbol")
        List<Gene> search(@Param("pattern") String pattern, Pageable pageable);
    }

    public interface KnowledgeSourceRepository extends JpaRepository<KnowledgeSource, String> {
    }

    public interface SourceVersionRepository extends JpaRepository<SourceVersion, UUID> {

        Optional<SourceVersion> findBySourceCodeAndVersionLabel(String sourceCode, String versionLabel);

        List<SourceVersion> findAllByIdIn(Collection<UUID> ids);
    }

    public interface PathwayRepository extends JpaRepository<Pathway, UUID> {

        Optional<Pathway> findBySourceCodeAndExternalId(String sourceCode, String externalId);

        List<Pathway> findAllByIdIn(Collection<UUID> ids);

        @Query("select p from Pathway p where lower(p.name) like :pattern or lower(p.externalId) like :pattern order by p.name")
        List<Pathway> search(@Param("pattern") String pattern, Pageable pageable);
    }

    public interface GenePathwayRepository extends JpaRepository<GenePathway, GenePathway.Key> {

        @Query("select gp from GenePathway gp where gp.id.geneId in :geneIds")
        List<GenePathway> findAllByGeneIds(@Param("geneIds") Collection<UUID> geneIds);

        @Query("select gp from GenePathway gp where gp.id.pathwayId = :pathwayId")
        List<GenePathway> findAllByPathwayId(@Param("pathwayId") UUID pathwayId);
    }

    public interface PublicationRepository extends JpaRepository<Publication, UUID> {

        Optional<Publication> findByPmid(String pmid);

        List<Publication> findAllByIdIn(Collection<UUID> ids);

        @Query("""
                select p from Publication p
                where p.pmid like :pattern or lower(p.title) like :pattern
                   or lower(coalesce(p.authors, '')) like :pattern or lower(coalesce(p.journal, '')) like :pattern
                """)
        Page<Publication> search(@Param("pattern") String pattern, Pageable pageable);
    }

    public interface EvidenceRepository extends JpaRepository<Evidence, UUID>, JpaSpecificationExecutor<Evidence> {

        Optional<Evidence> findBySourceCodeAndExternalId(String sourceCode, String externalId);

        List<Evidence> findAllByIdIn(Collection<UUID> ids);

        List<Evidence> findTop8ByOrderByCreatedAtDesc();

        @Query("""
                select e from Evidence e
                where lower(e.description) like :pattern or lower(coalesce(e.diseaseContext, '')) like :pattern
                   or lower(coalesce(e.variantDescriptor, '')) like :pattern or lower(coalesce(e.externalId, '')) like :pattern
                order by e.createdAt desc
                """)
        List<Evidence> searchText(@Param("pattern") String pattern, Pageable pageable);

        @Query("""
                select e from Evidence e
                where e.geneId in :geneIds and lower(coalesce(e.variantDescriptor, '')) = lower(:descriptor)
                order by e.createdAt desc
                """)
        List<Evidence> findByGenesAndDescriptor(@Param("geneIds") Collection<UUID> geneIds,
                @Param("descriptor") String descriptor, Pageable pageable);
    }

    public interface VariantEvidenceLinkRepository extends JpaRepository<VariantEvidenceLink, VariantEvidenceLink.Key> {

        @Query("select l from VariantEvidenceLink l where l.id.variantId in :variantIds order by l.linkedAt asc")
        List<VariantEvidenceLink> findAllByVariantIds(@Param("variantIds") Collection<UUID> variantIds);

        @Query("select count(l) from VariantEvidenceLink l where l.id.evidenceId = :evidenceId")
        long countByEvidenceId(@Param("evidenceId") UUID evidenceId);
    }
}
