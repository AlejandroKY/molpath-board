package com.molpath.board.molecular;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.molecular.MolecularDtos.VariantRequest;
import com.molpath.board.molecular.MolecularEnums.VariantOrigin;
import com.molpath.board.molecular.MolecularEnums.VariantType;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VariantValidationTest {

    private static VariantRequest request(VariantType type, String hgvsC, String hgvsP, BigDecimal copyNumber,
            String partner, String observations) {
        return new VariantRequest("egfr", type, null, hgvsC, hgvsP, null, null, copyNumber, partner,
                VariantOrigin.SOMATIC, null, null, observations);
    }

    @Test
    void snvRequiresHgvs() {
        assertThatThrownBy(() -> MolecularService.validateVariant(request(VariantType.SNV, null, null, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
        assertThatCode(() -> MolecularService.validateVariant(
                request(VariantType.SNV, "c.2573T>G", "p.L858R", null, null, null))).doesNotThrowAnyException();
    }

    @Test
    void fusionRequiresPartner() {
        assertThatThrownBy(() -> MolecularService.validateVariant(
                request(VariantType.FUSION, null, null, null, null, "EML4::ALK")))
                .isInstanceOf(BusinessRuleException.class);
        assertThatCode(() -> MolecularService.validateVariant(
                request(VariantType.FUSION, null, null, null, "EML4", null))).doesNotThrowAnyException();
    }

    @Test
    void cnvRequiresCopyNumberOrDescription() {
        assertThatThrownBy(() -> MolecularService.validateVariant(request(VariantType.CNV, null, null, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
        assertThatCode(() -> MolecularService.validateVariant(
                request(VariantType.CNV, null, null, new BigDecimal("8"), null, null))).doesNotThrowAnyException();
    }

    @Test
    void rejectsMalformedHgvsPrefixes() {
        assertThatThrownBy(() -> MolecularService.validateVariant(request(VariantType.SNV, "2573T>G", null, null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> MolecularService.validateVariant(request(VariantType.SNV, null, "L858R", null, null, null)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void requestNormalizesGeneSymbol() {
        VariantRequest r = request(VariantType.SNV, "c.1A>G", null, null, null, null);
        org.assertj.core.api.Assertions.assertThat(r.geneSymbol()).isEqualTo("EGFR");
    }
}
