package com.molpath.board.knowledge;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.molpath.board.common.Exceptions.BusinessRuleException;
import com.molpath.board.common.Text;
import com.molpath.board.knowledge.KnowledgeEnums.Certainty;
import com.molpath.board.knowledge.KnowledgeEnums.CertaintyBasis;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceStatus;
import com.molpath.board.knowledge.KnowledgeEnums.EvidenceType;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Reglas de incertidumbre y trazabilidad (ADR-005, ADR-007). */
class EvidenceRulesTest {

    private static Evidence.Draft draft(Certainty certainty, CertaintyBasis basis) {
        return new Evidence.Draft(null, "L858R", EvidenceType.FUNCTIONAL, "descripción", null, certainty, basis, null,
                null, null, null, null, null, "MANUAL", null, "https://example.org/fuente", null, null, null, null,
                Instant.now());
    }

    @Test
    void certaintyOtherThanUnknownRequiresADeclaredBasis() {
        assertThatThrownBy(() -> new Evidence(null, draft(Certainty.STRONG, CertaintyBasis.NONE), null))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void unknownCertaintyNeverKeepsABasis() {
        Evidence e = new Evidence(null, draft(Certainty.UNKNOWN, CertaintyBasis.USER_ASSIGNED), null);
        assertThat(e.getCertaintyBasis()).isEqualTo(CertaintyBasis.NONE);
    }

    @Test
    void evidenceWithoutSourceIsRejected() {
        Evidence.Draft noSource = new Evidence.Draft(null, null, EvidenceType.FUNCTIONAL, "x", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThatThrownBy(() -> new Evidence(null, noSource, null)).isInstanceOf(NullPointerException.class);
    }

    @Test
    void withdrawingRequiresReason() {
        Evidence e = new Evidence(null, draft(Certainty.LIMITED, CertaintyBasis.USER_ASSIGNED), null);
        assertThatThrownBy(() -> e.changeStatus(EvidenceStatus.WITHDRAWN, " "))
                .isInstanceOf(BusinessRuleException.class);
        e.changeStatus(EvidenceStatus.WITHDRAWN, "Retractada en la fuente");
        assertThat(e.getStatus()).isEqualTo(EvidenceStatus.WITHDRAWN);
    }

    @Test
    void pubmedUrlIsDerivedFromPmid() {
        assertThat(Publication.pubmedUrl("24662454")).isEqualTo("https://pubmed.ncbi.nlm.nih.gov/24662454/");
    }

    @Test
    void textSanitizationRemovesControlCharsAndHtmlFromExternalContent() {
        assertThat(Text.clean("  hola\u0000 mundo \u0007 ")).isEqualTo("hola mundo");
        assertThat(Text.clean("   ")).isNull();
        assertThat(Text.stripHtml("<span class=\"highlighting\">EGFR</span> &amp; ERBB2")).isEqualTo("EGFR & ERBB2");
    }
}
