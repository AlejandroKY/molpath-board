package com.molpath.board.casefile;

import com.molpath.board.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/** Caso tumoral. En esta fase siempre es ficticio ({@code demo = true}). */
@Entity
@Table(name = "tumor_case")
public class TumorCase extends BaseEntity {

    @Column(name = "case_code", nullable = false, unique = true, length = 32)
    private String caseCode;

    @Column(nullable = false, length = 120)
    private String organ;

    @Column(name = "tumor_type", nullable = false, length = 200)
    private String tumorType;

    @Column(length = 500)
    private String diagnosis;

    @Column(name = "histologic_subtype", length = 200)
    private String histologicSubtype;

    @Column(length = 60)
    private String grade;

    @Column
    private String notes;

    @Column(nullable = false)
    private boolean demo = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Version
    private Long version;

    protected TumorCase() {
    }

    public TumorCase(UUID id, String caseCode, UUID createdBy) {
        super(id);
        this.caseCode = caseCode;
        this.createdBy = createdBy;
    }

    public void describe(String organ, String tumorType, String diagnosis, String histologicSubtype, String grade,
            String notes) {
        this.organ = organ;
        this.tumorType = tumorType;
        this.diagnosis = diagnosis;
        this.histologicSubtype = histologicSubtype;
        this.grade = grade;
        this.notes = notes;
    }

    public void changeCaseCode(String caseCode) {
        this.caseCode = caseCode;
    }

    /** Sólo para la siembra del dataset demo: conserva la fecha original del caso ficticio. */
    public void overrideCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public String getCaseCode() {
        return caseCode;
    }

    public String getOrgan() {
        return organ;
    }

    public String getTumorType() {
        return tumorType;
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

    public String getNotes() {
        return notes;
    }

    public boolean isDemo() {
        return demo;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Long getVersion() {
        return version;
    }
}
