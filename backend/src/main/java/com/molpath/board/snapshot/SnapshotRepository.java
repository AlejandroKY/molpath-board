package com.molpath.board.snapshot;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SnapshotRepository extends JpaRepository<CaseSnapshot, UUID> {

    /** Proyección ligera sin el contenido JSON. */
    interface SnapshotHeader {
        UUID getId();

        UUID getCaseId();

        String getLabel();

        String getNote();

        int getSchemaVersion();

        String getContentSha256();

        java.time.Instant getCreatedAt();

        UUID getCreatedBy();
    }

    List<CaseSnapshot> findAllByCaseIdOrderByCreatedAtDesc(UUID caseId);

    @Query("select s.id as id, s.caseId as caseId, s.label as label, s.note as note, s.schemaVersion as schemaVersion, "
            + "s.contentSha256 as contentSha256, s.createdAt as createdAt, s.createdBy as createdBy "
            + "from CaseSnapshot s where s.caseId = :caseId order by s.createdAt desc")
    List<SnapshotHeader> findHeadersByCaseId(@org.springframework.data.repository.query.Param("caseId") UUID caseId);

    @Query(value = "select s.id as id, s.caseId as caseId, s.label as label, s.note as note, s.schemaVersion as schemaVersion, "
            + "s.contentSha256 as contentSha256, s.createdAt as createdAt, s.createdBy as createdBy from CaseSnapshot s",
            countQuery = "select count(s) from CaseSnapshot s")
    Page<SnapshotHeader> findAllHeaders(Pageable pageable);
}
