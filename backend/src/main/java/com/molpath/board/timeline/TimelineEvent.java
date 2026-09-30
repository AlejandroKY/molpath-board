package com.molpath.board.timeline;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "timeline_event")
public class TimelineEvent extends BaseEntity {

    public enum EventType {
        DIAGNOSIS, INITIAL_BIOPSY, SURGERY, REBIOPSY, PROGRESSION, RECURRENCE, METASTASIS, MOLECULAR_STUDY,
        NEW_BIOMARKER, OTHER
    }

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private EventType eventType;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(nullable = false, length = 200)
    private String title;

    @Column
    private String description;

    @Column(name = "sample_id")
    private UUID sampleId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    protected TimelineEvent() {
    }

    public TimelineEvent(UUID id, UUID caseId, EventType eventType, LocalDate eventDate, String title,
            String description, UUID sampleId, UUID createdBy) {
        super(id);
        this.caseId = caseId;
        this.eventType = eventType;
        this.eventDate = eventDate;
        this.title = title;
        this.description = description;
        this.sampleId = sampleId;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    public UUID getCaseId() {
        return caseId;
    }

    public EventType getEventType() {
        return eventType;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public UUID getSampleId() {
        return sampleId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
