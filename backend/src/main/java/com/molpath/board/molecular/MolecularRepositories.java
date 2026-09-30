package com.molpath.board.molecular;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public final class MolecularRepositories {

    private MolecularRepositories() {
    }

    public interface MolecularTestRepository extends JpaRepository<MolecularTest, UUID> {

        List<MolecularTest> findAllBySampleIdInOrderByTestDateAscCreatedAtAsc(Collection<UUID> sampleIds);
    }

    public interface VariantRepository extends JpaRepository<Variant, UUID> {

        List<Variant> findAllByMolecularTestIdInOrderByCreatedAtAsc(Collection<UUID> testIds);

        @Query("""
                select v from Variant v
                where v.molecularTestId in (
                    select t.id from MolecularTest t where t.sampleId in (
                        select s.id from Sample s where s.caseId = :caseId))
                order by v.createdAt asc
                """)
        List<Variant> findAllByCaseId(@Param("caseId") UUID caseId);

        @Query("""
                select s.caseId, count(v) from Variant v, MolecularTest t, Sample s
                where v.molecularTestId = t.id and t.sampleId = s.id and s.caseId in :caseIds
                group by s.caseId
                """)
        List<Object[]> countByCaseIds(@Param("caseIds") Collection<UUID> caseIds);

        @Query("""
                select new com.molpath.board.molecular.VariantContext(v.id, c.id, c.caseCode, s.id, s.label, t.id, t.testDate)
                from Variant v, MolecularTest t, Sample s, TumorCase c
                where v.molecularTestId = t.id and t.sampleId = s.id and s.caseId = c.id and v.id in :variantIds
                """)
        List<VariantContext> findContexts(@Param("variantIds") Collection<UUID> variantIds);

        List<Variant> findAllByGeneIdIn(Collection<UUID> geneIds, Pageable pageable);

        @Query("""
                select v from Variant v
                where v.geneId in :geneIds and lower(v.proteinChangeNorm) = lower(:proteinChange)
                order by v.createdAt desc
                """)
        List<Variant> findByGenesAndProteinChange(@Param("geneIds") Collection<UUID> geneIds,
                @Param("proteinChange") String proteinChange, Pageable pageable);

        @Query("select v from Variant v where lower(v.hgvsC) like :pattern order by v.createdAt desc")
        List<Variant> searchByHgvsC(@Param("pattern") String pattern, Pageable pageable);

        List<Variant> findTop8ByOrderByCreatedAtDesc();

        long countByGeneId(UUID geneId);
    }

    public interface BiomarkerResultRepository extends JpaRepository<BiomarkerResult, UUID> {

        List<BiomarkerResult> findAllByMolecularTestIdInOrderByCreatedAtAsc(Collection<UUID> testIds);

        @Query("""
                select b from BiomarkerResult b
                where lower(b.name) like :pattern or lower(cast(b.biomarkerType as string)) like :pattern
                   or lower(coalesce(b.valueText, '')) like :pattern
                order by b.createdAt desc
                """)
        List<BiomarkerResult> search(@Param("pattern") String pattern, Pageable pageable);
    }
}
