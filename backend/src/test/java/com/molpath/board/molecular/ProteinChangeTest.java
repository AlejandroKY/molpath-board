package com.molpath.board.molecular;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

class ProteinChangeTest {

    @ParameterizedTest
    @CsvSource({
            "p.L858R, L858R",
            "p.Leu858Arg, L858R",
            "p.(Leu858Arg), L858R",
            "L858R, L858R",
            "p.Val600Glu, V600E",
            "p.Thr790Met, T790M",
            "p.Arg273His, R273H",
            "p.Glu746_Ala750del, E746_A750del",
            "p.Gln61Ter, Q61*"
    })
    void normalizesToOneLetterNotation(String input, String expected) {
        assertThat(ProteinChange.normalize(input)).isEqualTo(expected);
    }

    @Test
    void nullAndBlankAreNull() {
        assertThat(ProteinChange.normalize(null)).isNull();
        assertThat(ProteinChange.normalize("p.")).isNull();
    }

    @Test
    void threeLetterFormOnlyForSimpleSubstitutions() {
        assertThat(ProteinChange.toThreeLetter("L858R")).isEqualTo("Leu858Arg");
        assertThat(ProteinChange.toThreeLetter("V600E")).isEqualTo("Val600Glu");
        assertThat(ProteinChange.toThreeLetter("E746_A750del")).isNull();
    }
}
