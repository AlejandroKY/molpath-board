package com.molpath.board.sample;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.sample.SampleEnums.NucleicAcidQuality;
import com.molpath.board.sample.SampleEnums.SampleType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "sample")
public class Sample extends BaseEntity {

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(nullable = false, length = 120)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "sample_type", nullable = false, length = 32)
    private SampleType sampleType;

    @Column(name = "anatomic_site", length = 200)
    private String anatomicSite;

    @Column(name = "collection_date")
    private LocalDate collectionDate;

    @Column(name = "tumor_cellularity_pct", precision = 5, scale = 2)
    private BigDecimal tumorCellularityPct;

    @Column(name = "necrosis_pct", precision = 5, scale = 2)
    private BigDecimal necrosisPct;

    @Column(name = "dna_available")
    private Boolean dnaAvailable;

    @Column(name = "rna_available")
    private Boolean rnaAvailable;

    @Enumerated(EnumType.STRING)
    @Column(name = "dna_quality", length = 20)
    private NucleicAcidQuality dnaQuality;

    @Enumerated(EnumType.STRING)
    @Column(name = "rna_quality", length = 20)
    private NucleicAcidQuality rnaQuality;

    @Column
    private String observations;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;

    protected Sample() {
    }

    public Sample(UUID id, UUID caseId) {
        super(id);
        this.caseId = caseId;
    }

    public void apply(SampleDtos.SampleRequest r) {
        this.label = r.label();
        this.sampleType = r.sampleType();
        this.anatomicSite = r.anatomicSite();
        this.collectionDate = r.collectionDate();
        this.tumorCellularityPct = r.tumorCellularityPct();
        this.necrosisPct = r.necrosisPct();
        this.dnaAvailable = r.dnaAvailable();
        this.rnaAvailable = r.rnaAvailable();
        this.dnaQuality = r.dnaQuality();
        this.rnaQuality = r.rnaQuality();
        this.observations = r.observations();
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getCaseId() {
        return caseId;
    }

    public String getLabel() {
        return label;
    }

    public SampleType getSampleType() {
        return sampleType;
    }

    public String getAnatomicSite() {
        return anatomicSite;
    }

    public LocalDate getCollectionDate() {
        return collectionDate;
    }

    public BigDecimal getTumorCellularityPct() {
        return tumorCellularityPct;
    }

    public BigDecimal getNecrosisPct() {
        return necrosisPct;
    }

    public Boolean getDnaAvailable() {
        return dnaAvailable;
    }

    public Boolean getRnaAvailable() {
        return rnaAvailable;
    }

    public NucleicAcidQuality getDnaQuality() {
        return dnaQuality;
    }

    public NucleicAcidQuality getRnaQuality() {
        return rnaQuality;
    }

    public String getObservations() {
        return observations;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getVersion() {
        return version;
    }
}
