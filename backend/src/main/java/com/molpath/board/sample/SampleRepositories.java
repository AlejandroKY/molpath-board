package com.molpath.board.sample;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public final class SampleRepositories {

    private SampleRepositories() {
    }

    public interface SampleRepository extends JpaRepository<Sample, UUID> {

        List<Sample> findAllByCaseIdOrderByCollectionDateAscCreatedAtAsc(UUID caseId);

        List<Sample> findAllByCaseIdIn(Collection<UUID> caseIds);

        @Query("select s.caseId, count(s) from Sample s where s.caseId in :caseIds group by s.caseId")
        List<Object[]> countByCaseIds(@Param("caseIds") Collection<UUID> caseIds);
    }

    public interface HistologyFindingRepository extends JpaRepository<HistologyFinding, UUID> {

        List<HistologyFinding> findAllBySampleIdInOrderByCreatedAtAsc(Collection<UUID> sampleIds);
    }

    public interface IhcResultRepository extends JpaRepository<IhcResult, UUID> {

        List<IhcResult> findAllBySampleIdInOrderByCreatedAtAsc(Collection<UUID> sampleIds);

        @Query("select r from IhcResult r where lower(r.marker) like :pattern order by r.createdAt desc")
        List<IhcResult> searchByMarker(@Param("pattern") String pattern, Pageable pageable);
    }
}
