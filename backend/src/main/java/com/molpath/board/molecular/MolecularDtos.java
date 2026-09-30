package com.molpath.board.molecular;

import com.molpath.board.common.Text;
import com.molpath.board.molecular.MolecularEnums.BiomarkerType;
import com.molpath.board.molecular.MolecularEnums.MolecularTestType;
import com.molpath.board.molecular.MolecularEnums.VariantOrigin;
import com.molpath.board.molecular.MolecularEnums.VariantType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class MolecularDtos {

    /** Símbolo génico HGNC: letras, números, guion y punto. */
    public static final String GENE_SYMBOL_REGEX = "^[A-Za-z0-9][A-Za-z0-9.-]{0,39}$";

    private MolecularDtos() {
    }

    public record MolecularTestRequest(
            @NotNull MolecularTestType testType,
            @Size(max = 200) String laboratory,
            @Size(max = 200) String platform,
            @Size(max = 200) String panelName,
            @Size(max = 2000) List<@Pattern(regexp = GENE_SYMBOL_REGEX, message = "símbolo génico no válido") String> genesAnalyzed,
            @Min(0) Integer meanDepth,
            @DecimalMin("0") @DecimalMax("100") BigDecimal limitOfDetectionPct,
            LocalDate testDate,
            @Size(max = 10000) String notes) {

        public MolecularTestRequest {
            laboratory = Text.clean(laboratory);
            platform = Text.clean(platform);
            panelName = Text.clean(panelName);
            notes = Text.clean(notes);
            genesAnalyzed = genesAnalyzed == null ? List.of() : genesAnalyzed;
        }
    }

    public record MolecularTestDto(UUID id, UUID sampleId, MolecularTestType testType, String laboratory,
            String platform, String panelName, List<String> genesAnalyzed, Integer meanDepth,
            BigDecimal limitOfDetectionPct, LocalDate testDate, String notes) {

        public static MolecularTestDto from(MolecularTest t) {
            return new MolecularTestDto(t.getId(), t.getSampleId(), t.getTestType(), t.getLaboratory(),
                    t.getPlatform(), t.getPanelName(), t.getGenesAnalyzedSorted(), t.getMeanDepth(),
                    t.getLimitOfDetectionPct(), t.getTestDate(), t.getNotes());
        }
    }

    public record VariantRequest(
            @NotBlank @Pattern(regexp = GENE_SYMBOL_REGEX, message = "símbolo génico no válido") String geneSymbol,
            @NotNull VariantType variantType,
            @Size(max = 60) String transcript,
            @Size(max = 200) String hgvsC,
            @Size(max = 200) String hgvsP,
            @DecimalMin("0") @DecimalMax("100") BigDecimal vaf,
            @Min(0) Integer coverage,
            @DecimalMin("0") BigDecimal copyNumber,
            @Pattern(regexp = GENE_SYMBOL_REGEX, message = "símbolo génico no válido") String fusionPartnerSymbol,
            VariantOrigin origin,
            @Size(max = 120) String classification,
            @Size(max = 120) String classificationSystem,
            @Size(max = 10000) String observations) {

        public VariantRequest {
            geneSymbol = Text.upper(geneSymbol);
            transcript = Text.clean(transcript);
            hgvsC = Text.clean(hgvsC);
            hgvsP = Text.clean(hgvsP);
            fusionPartnerSymbol = Text.upper(fusionPartnerSymbol);
            classification = Text.clean(classification);
            classificationSystem = Text.clean(classificationSystem);
            observations = Text.clean(observations);
        }
    }

    public record VariantDto(UUID id, UUID molecularTestId, UUID geneId, String geneSymbol, VariantType variantType,
            String transcript, String hgvsC, String hgvsP, String proteinChange, BigDecimal vaf, Integer coverage,
            BigDecimal copyNumber, String fusionPartnerSymbol, VariantOrigin origin, String classification,
            String classificationSystem, String observations, Instant createdAt) {

        public static VariantDto from(Variant v, String geneSymbol) {
            return new VariantDto(v.getId(), v.getMolecularTestId(), v.getGeneId(), geneSymbol, v.getVariantType(),
                    v.getTranscript(), v.getHgvsC(), v.getHgvsP(), v.getProteinChangeNorm(), v.getVaf(),
                    v.getCoverage(), v.getCopyNumber(), v.getFusionPartnerSymbol(), v.getOrigin(),
                    v.getClassification(), v.getClassificationSystem(), v.getObservations(), v.getCreatedAt());
        }
    }

    public record BiomarkerRequest(
            @NotNull BiomarkerType biomarkerType,
            @NotBlank @Size(max = 200) String name,
            BigDecimal valueNumeric,
            @Size(max = 200) String valueText,
            @Size(max = 40) String unit,
            @Size(max = 10000) String observations) {

        public BiomarkerRequest {
            name = Text.clean(name);
            valueText = Text.clean(valueText);
            unit = Text.clean(unit);
            observations = Text.clean(observations);
        }
    }

    public record BiomarkerDto(UUID id, UUID molecularTestId, BiomarkerType biomarkerType, String name,
            BigDecimal valueNumeric, String valueText, String unit, String observations) {

        public static BiomarkerDto from(BiomarkerResult b) {
            return new BiomarkerDto(b.getId(), b.getMolecularTestId(), b.getBiomarkerType(), b.getName(),
                    b.getValueNumeric(), b.getValueText(), b.getUnit(), b.getObservations());
        }
    }

    /** Variante con su contexto derivado (caso, muestra, fecha del estudio). */
    public record CaseVariantView(VariantDto variant, UUID caseId, String caseCode, UUID sampleId, String sampleLabel,
            LocalDate testDate) {}
}
