package com.molpath.board.molecular;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.molecular.MolecularEnums.BiomarkerType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Biomarcador genómico (TMB, MSI, HRD, firmas, expresión) medido en un estudio. */
@Entity
@Table(name = "biomarker_result")
public class BiomarkerResult extends BaseEntity {

    @Column(name = "molecular_test_id", nullable = false, updatable = false)
    private UUID molecularTestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "biomarker_type", nullable = false, length = 30)
    private BiomarkerType biomarkerType;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "value_numeric", precision = 12, scale = 4)
    private BigDecimal valueNumeric;

    @Column(name = "value_text", length = 200)
    private String valueText;

    @Column(length = 40)
    private String unit;

    @Column
    private String observations;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BiomarkerResult() {
    }

    public BiomarkerResult(UUID id, UUID molecularTestId) {
        super(id);
        this.molecularTestId = molecularTestId;
    }

    public void apply(MolecularDtos.BiomarkerRequest r) {
        this.biomarkerType = r.biomarkerType();
        this.name = r.name();
        this.valueNumeric = r.valueNumeric();
        this.valueText = r.valueText();
        this.unit = r.unit();
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

    public UUID getMolecularTestId() {
        return molecularTestId;
    }

    public BiomarkerType getBiomarkerType() {
        return biomarkerType;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getValueNumeric() {
        return valueNumeric;
    }

    public String getValueText() {
        return valueText;
    }

    public String getUnit() {
        return unit;
    }

    public String getObservations() {
        return observations;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
