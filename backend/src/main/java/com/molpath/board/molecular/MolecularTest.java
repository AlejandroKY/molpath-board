package com.molpath.board.molecular;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.molecular.MolecularEnums.MolecularTestType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "molecular_test")
public class MolecularTest extends BaseEntity {

    @Column(name = "sample_id", nullable = false, updatable = false)
    private UUID sampleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "test_type", nullable = false, length = 20)
    private MolecularTestType testType;

    @Column(length = 200)
    private String laboratory;

    @Column(length = 200)
    private String platform;

    @Column(name = "panel_name", length = 200)
    private String panelName;

    @ElementCollection
    @CollectionTable(name = "molecular_test_gene", joinColumns = @JoinColumn(name = "molecular_test_id"))
    @Column(name = "gene_symbol", length = 40)
    @BatchSize(size = 50)
    private Set<String> genesAnalyzed = new HashSet<>();

    @Column(name = "mean_depth")
    private Integer meanDepth;

    @Column(name = "limit_of_detection_pct", precision = 5, scale = 2)
    private BigDecimal limitOfDetectionPct;

    @Column(name = "test_date")
    private LocalDate testDate;

    @Column
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MolecularTest() {
    }

    public MolecularTest(UUID id, UUID sampleId) {
        super(id);
        this.sampleId = sampleId;
    }

    public void apply(MolecularDtos.MolecularTestRequest r, Collection<String> normalizedGenes) {
        this.testType = r.testType();
        this.laboratory = r.laboratory();
        this.platform = r.platform();
        this.panelName = r.panelName();
        this.meanDepth = r.meanDepth();
        this.limitOfDetectionPct = r.limitOfDetectionPct();
        this.testDate = r.testDate();
        this.notes = r.notes();
        this.genesAnalyzed.clear();
        this.genesAnalyzed.addAll(normalizedGenes);
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

    public MolecularTestType getTestType() {
        return testType;
    }

    public String getLaboratory() {
        return laboratory;
    }

    public String getPlatform() {
        return platform;
    }

    public String getPanelName() {
        return panelName;
    }

    public List<String> getGenesAnalyzedSorted() {
        return genesAnalyzed.stream().sorted().toList();
    }

    public Integer getMeanDepth() {
        return meanDepth;
    }

    public BigDecimal getLimitOfDetectionPct() {
        return limitOfDetectionPct;
    }

    public LocalDate getTestDate() {
        return testDate;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
