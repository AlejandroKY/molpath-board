package com.molpath.board.molecular;

import java.time.LocalDate;
import java.util.UUID;

/** Proyección JPQL: dónde se encontró una variante. */
public record VariantContext(UUID variantId, UUID caseId, String caseCode, UUID sampleId, String sampleLabel,
        UUID molecularTestId, LocalDate testDate) {}
