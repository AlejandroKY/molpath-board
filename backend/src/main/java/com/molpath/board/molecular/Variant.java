package com.molpath.board.molecular;

import com.molpath.board.common.BaseEntity;
import com.molpath.board.molecular.MolecularEnums.VariantOrigin;
import com.molpath.board.molecular.MolecularEnums.VariantType;
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

/**
 * Variante detectada en un estudio. La muestra, el caso y la fecha se derivan del estudio
 * (variant → molecular_test → sample → case), no se duplican.
 */
@Entity
@Table(name = "variant")
public class Variant extends BaseEntity {

    @Column(name = "molecular_test_id", nullable = false, updatable = false)
    private UUID molecularTestId;

    @Column(name = "gene_id", nullable = false)
    private UUID geneId;

    @Enumerated(EnumType.STRING)
    @Column(name = "variant_type", nullable = false, length = 20)
    private VariantType variantType;

    @Column(length = 60)
    private String transcript;

    @Column(name = "hgvs_c", length = 200)
    private String hgvsC;

    @Column(name = "hgvs_p", length = 200)
    private String hgvsP;

    @Column(name = "protein_change_norm", length = 100)
    private String proteinChangeNorm;

    @Column(precision = 6, scale = 3)
    private BigDecimal vaf;

    @Column
    private Integer coverage;

    @Column(name = "copy_number", precision = 8, scale = 2)
    private BigDecimal copyNumber;

    @Column(name = "fusion_partner_symbol", length = 40)
    private String fusionPartnerSymbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VariantOrigin origin = VariantOrigin.UNKNOWN;

    @Column(length = 120)
    private String classification;

    @Column(name = "classification_system", length = 120)
    private String classificationSystem;

    @Column
    private String observations;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Variant() {
    }

    public Variant(UUID id, UUID molecularTestId) {
        super(id);
        this.molecularTestId = molecularTestId;
    }

    public void apply(MolecularDtos.VariantRequest r, UUID geneId) {
        this.geneId = geneId;
        this.variantType = r.variantType();
        this.transcript = r.transcript();
        this.hgvsC = r.hgvsC();
        this.hgvsP = r.hgvsP();
        this.proteinChangeNorm = ProteinChange.normalize(r.hgvsP());
        this.vaf = r.vaf();
        this.coverage = r.coverage();
        this.copyNumber = r.copyNumber();
        this.fusionPartnerSymbol = r.fusionPartnerSymbol();
        this.origin = r.origin() == null ? VariantOrigin.UNKNOWN : r.origin();
        this.classification = r.classification();
        this.classificationSystem = r.classificationSystem();
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

    public UUID getGeneId() {
        return geneId;
    }

    public VariantType getVariantType() {
        return variantType;
    }

    public String getTranscript() {
        return transcript;
    }

    public String getHgvsC() {
        return hgvsC;
    }

    public String getHgvsP() {
        return hgvsP;
    }

    public String getProteinChangeNorm() {
        return proteinChangeNorm;
    }

    public BigDecimal getVaf() {
        return vaf;
    }

    public Integer getCoverage() {
        return coverage;
    }

    public BigDecimal getCopyNumber() {
        return copyNumber;
    }

    public String getFusionPartnerSymbol() {
        return fusionPartnerSymbol;
    }

    public VariantOrigin getOrigin() {
        return origin;
    }

    public String getClassification() {
        return classification;
    }

    public String getClassificationSystem() {
        return classificationSystem;
    }

    public String getObservations() {
        return observations;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
