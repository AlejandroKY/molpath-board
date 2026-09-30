package com.molpath.board.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.molpath.board.search.QueryClassifier.ClassifiedQuery;
import com.molpath.board.search.QueryClassifier.EntityKind;
import org.junit.jupiter.api.Test;

class QueryClassifierTest {

    @Test
    void detectsPmid() {
        ClassifiedQuery q = QueryClassifier.classify("PMID: 24662454");
        assertThat(q.kinds()).containsExactly(EntityKind.PMID);
        assertThat(q.pmid()).isEqualTo("24662454");
        assertThat(QueryClassifier.classify("24662454").pmid()).isEqualTo("24662454");
    }

    @Test
    void detectsGenePlusProteinChange() {
        ClassifiedQuery q = QueryClassifier.classify("EGFR L858R");
        assertThat(q.kinds()).startsWith(EntityKind.VARIANT);
        assertThat(q.geneSymbol()).isEqualTo("EGFR");
        assertThat(q.proteinChange()).isEqualTo("L858R");

        ClassifiedQuery threeLetter = QueryClassifier.classify("braf p.Val600Glu");
        assertThat(threeLetter.geneSymbol()).isEqualTo("BRAF");
        assertThat(threeLetter.proteinChange()).isEqualTo("V600E");
    }

    @Test
    void detectsGenePlusCdna() {
        ClassifiedQuery q = QueryClassifier.classify("EGFR c.2573T>G");
        assertThat(q.kinds()).startsWith(EntityKind.VARIANT);
        assertThat(q.hgvsC()).isEqualTo("c.2573T>G");
    }

    @Test
    void singleSymbolIsAmbiguousBetweenGeneAndMarker() {
        assertThat(QueryClassifier.classify("TP53").kinds()).contains(EntityKind.GENE, EntityKind.IHC_MARKER);
        assertThat(QueryClassifier.classify("PD-L1").kinds()).contains(EntityKind.IHC_MARKER, EntityKind.GENE);
        assertThat(QueryClassifier.classify("TTF-1").kinds()).contains(EntityKind.IHC_MARKER);
    }

    @Test
    void freeTextSearchesTumorsAndCases() {
        ClassifiedQuery q = QueryClassifier.classify("  adenocarcinoma   pulmonar ");
        assertThat(q.normalized()).isEqualTo("adenocarcinoma pulmonar");
        assertThat(q.kinds()).contains(EntityKind.TUMOR, EntityKind.CASE).doesNotContain(EntityKind.VARIANT);
    }

    @Test
    void emptyQueryHasNoKinds() {
        assertThat(QueryClassifier.classify("   ").kinds()).isEmpty();
    }
}
