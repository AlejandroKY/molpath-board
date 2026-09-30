package com.molpath.board.sample;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.sample.SampleEnums.IhcIntensity;
import com.molpath.board.sample.SampleEnums.IhcResultValue;
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

@Entity
@Table(name = "ihc_result")
public class IhcResult extends BaseEntity {

    @Column(name = "sample_id", nullable = false, updatable = false)
    private UUID sampleId;

    @Column(nullable = false, length = 80)
    private String marker;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IhcResultValue result;

    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private IhcIntensity intensity;

    @Column(length = 80)
    private String score;

    @Column(length = 200)
    private String method;

    @Column
    private String observations;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected IhcResult() {
    }

    public IhcResult(UUID id, UUID sampleId) {
        super(id);
        this.sampleId = sampleId;
    }

    public void apply(SampleDtos.IhcRequest r) {
        this.marker = r.marker();
        this.result = r.result();
        this.percentage = r.percentage();
        this.intensity = r.intensity();
        this.score = r.score();
        this.method = r.method();
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

    public UUID getSampleId() {
        return sampleId;
    }

    public String getMarker() {
        return marker;
    }

    public IhcResultValue getResult() {
        return result;
    }

    public BigDecimal getPercentage() {
        return percentage;
    }

    public IhcIntensity getIntensity() {
        return intensity;
    }

    public String getScore() {
        return score;
    }

    public String getMethod() {
        return method;
    }

    public String getObservations() {
        return observations;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
