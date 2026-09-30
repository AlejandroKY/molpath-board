package com.molpath.board.casefile;

import com.molpath.board.user.UserSummary;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class CaseDtos {

    private CaseDtos() {
    }

    public record CaseRequest(
            @NotBlank @Size(max = 32)
            @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$",
                    message = "Use sólo letras, números, guion o guion bajo (sin datos identificables del paciente)")
            String caseCode,
            @NotBlank @Size(max = 120) String organ,
            @NotBlank @Size(max = 200) String tumorType,
            @Size(max = 500) String diagnosis,
            @Size(max = 200) String histologicSubtype,
            @Size(max = 60) String grade,
            @Size(max = 10000) String notes,
            Long version) {}

    public record CaseDto(
            UUID id, String caseCode, String organ, String tumorType, String diagnosis, String histologicSubtype,
            String grade, String notes, boolean demo, Instant createdAt, Instant updatedAt, UserSummary createdBy,
            Long version) {

        public static CaseDto from(TumorCase c, UserSummary createdBy) {
            return new CaseDto(c.getId(), c.getCaseCode(), c.getOrgan(), c.getTumorType(), c.getDiagnosis(),
                    c.getHistologicSubtype(), c.getGrade(), c.getNotes(), c.isDemo(), c.getCreatedAt(),
                    c.getUpdatedAt(), createdBy, c.getVersion());
        }
    }

    public record CaseSummary(
            UUID id, String caseCode, String organ, String tumorType, String diagnosis, boolean demo,
            Instant createdAt, Instant updatedAt, long sampleCount, long variantCount) {}
}
