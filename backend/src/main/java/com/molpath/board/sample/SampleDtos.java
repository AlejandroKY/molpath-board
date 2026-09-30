package com.molpath.board.sample;

import com.molpath.board.common.Text;
import com.molpath.board.sample.SampleEnums.IhcIntensity;
import com.molpath.board.sample.SampleEnums.IhcResultValue;
import com.molpath.board.sample.SampleEnums.NucleicAcidQuality;
import com.molpath.board.sample.SampleEnums.SampleType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** DTOs de muestras. Los constructores compactos sanitizan el texto libre antes de validar. */
public final class SampleDtos {

    private SampleDtos() {
    }

    public record SampleRequest(
            @NotBlank @Size(max = 120) String label,
            @NotNull SampleType sampleType,
            @Size(max = 200) String anatomicSite,
            LocalDate collectionDate,
            @DecimalMin("0") @DecimalMax("100") BigDecimal tumorCellularityPct,
            @DecimalMin("0") @DecimalMax("100") BigDecimal necrosisPct,
            Boolean dnaAvailable,
            Boolean rnaAvailable,
            NucleicAcidQuality dnaQuality,
            NucleicAcidQuality rnaQuality,
            @Size(max = 10000) String observations,
            Long version) {

        public SampleRequest {
            label = Text.clean(label);
            anatomicSite = Text.clean(anatomicSite);
            observations = Text.clean(observations);
        }
    }

    public record SampleDto(
            UUID id, UUID caseId, String label, SampleType sampleType, String anatomicSite, LocalDate collectionDate,
            BigDecimal tumorCellularityPct, BigDecimal necrosisPct, Boolean dnaAvailable, Boolean rnaAvailable,
            NucleicAcidQuality dnaQuality, NucleicAcidQuality rnaQuality, String observations, Instant createdAt,
            Long version) {

        public static SampleDto from(Sample s) {
            return new SampleDto(s.getId(), s.getCaseId(), s.getLabel(), s.getSampleType(), s.getAnatomicSite(),
                    s.getCollectionDate(), s.getTumorCellularityPct(), s.getNecrosisPct(), s.getDnaAvailable(),
                    s.getRnaAvailable(), s.getDnaQuality(), s.getRnaQuality(), s.getObservations(), s.getCreatedAt(),
                    s.getVersion());
        }
    }

    public record HistologyRequest(
            @NotBlank @Size(max = 500) String diagnosis,
            @Size(max = 200) String histologicSubtype,
            @Size(max = 60) String grade,
            @Size(max = 200) String growthPattern,
            @Size(max = 10000) String description) {

        public HistologyRequest {
            diagnosis = Text.clean(diagnosis);
            histologicSubtype = Text.clean(histologicSubtype);
            grade = Text.clean(grade);
            growthPattern = Text.clean(growthPattern);
            description = Text.clean(description);
        }
    }

    public record HistologyDto(UUID id, UUID sampleId, String diagnosis, String histologicSubtype, String grade,
            String growthPattern, String description) {

        public static HistologyDto from(HistologyFinding h) {
            return new HistologyDto(h.getId(), h.getSampleId(), h.getDiagnosis(), h.getHistologicSubtype(),
                    h.getGrade(), h.getGrowthPattern(), h.getDescription());
        }
    }

    public record IhcRequest(
            @NotBlank @Size(max = 80) String marker,
            @NotNull IhcResultValue result,
            @DecimalMin("0") @DecimalMax("100") BigDecimal percentage,
            IhcIntensity intensity,
            @Size(max = 80) String score,
            @Size(max = 200) String method,
            @Size(max = 10000) String observations) {

        public IhcRequest {
            marker = Text.clean(marker);
            score = Text.clean(score);
            method = Text.clean(method);
            observations = Text.clean(observations);
        }
    }

    public record IhcDto(UUID id, UUID sampleId, String marker, IhcResultValue result, BigDecimal percentage,
            IhcIntensity intensity, String score, String method, String observations) {

        public static IhcDto from(IhcResult r) {
            return new IhcDto(r.getId(), r.getSampleId(), r.getMarker(), r.getResult(), r.getPercentage(),
                    r.getIntensity(), r.getScore(), r.getMethod(), r.getObservations());
        }
    }
}
