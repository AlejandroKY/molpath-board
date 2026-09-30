package com.molpath.board.sample;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Hallazgo histológico de una muestra concreta (puede cambiar entre biopsias). */
@Entity
@Table(name = "histology_finding")
public class HistologyFinding extends BaseEntity {

    @Column(name = "sample_id", nullable = false, updatable = false)
    private UUID sampleId;

    @Column(nullable = false, length = 500)
    private String diagnosis;

    @Column(name = "histologic_subtype", length = 200)
    private String histologicSubtype;

    @Column(length = 60)
    private String grade;

    @Column(name = "growth_pattern", length = 200)
    private String growthPattern;

    @Column
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HistologyFinding() {
    }

    public HistologyFinding(UUID id, UUID sampleId) {
        super(id);
        this.sampleId = sampleId;
    }

    public void apply(SampleDtos.HistologyRequest r) {
        this.diagnosis = r.diagnosis();
        this.histologicSubtype = r.histologicSubtype();
        this.grade = r.grade();
        this.growthPattern = r.growthPattern();
        this.description = r.description();
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getSampleId() {
        return sampleId;
    }

    public String getDiagnosis() {
        return diagnosis;
    }

    public String getHistologicSubtype() {
        return histologicSubtype;
    }

    public String getGrade() {
        return grade;
    }

    public String getGrowthPattern() {
        return growthPattern;
    }

    public String getDescription() {
        return description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
