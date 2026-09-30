package com.molpath.board.casefile;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TumorCaseRepository extends JpaRepository<TumorCase, UUID> {

    boolean existsByCaseCodeIgnoreCase(String caseCode);

    @Query("""
            select c from TumorCase c
            where lower(c.caseCode) like :pattern
               or lower(c.organ) like :pattern
               or lower(c.tumorType) like :pattern
               or lower(coalesce(c.diagnosis, '')) like :pattern
               or lower(coalesce(c.histologicSubtype, '')) like :pattern
            """)
    Page<TumorCase> search(@Param("pattern") String pattern, Pageable pageable);

    List<TumorCase> findTop5ByOrderByUpdatedAtDesc();

    List<TumorCase> findAllByIdIn(java.util.Collection<UUID> ids);
}
