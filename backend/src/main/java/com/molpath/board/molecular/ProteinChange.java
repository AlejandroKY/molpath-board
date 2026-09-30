package com.molpath.board.molecular;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Normaliza cambios proteicos HGVS a notación compacta de una letra sin prefijo,
 * para comparar variantes independientemente de cómo se escribieron:
 * {@code p.Leu858Arg}, {@code p.(Leu858Arg)}, {@code p.L858R} y {@code L858R} → {@code L858R}.
 * Mantiene sufijos como {@code del}, {@code ins}, {@code dup}, {@code fs}.
 */
public final class ProteinChange {

    private static final Map<String, String> THREE_TO_ONE = Map.ofEntries(
            Map.entry("Ala", "A"), Map.entry("Arg", "R"), Map.entry("Asn", "N"), Map.entry("Asp", "D"),
            Map.entry("Cys", "C"), Map.entry("Gln", "Q"), Map.entry("Glu", "E"), Map.entry("Gly", "G"),
            Map.entry("His", "H"), Map.entry("Ile", "I"), Map.entry("Leu", "L"), Map.entry("Lys", "K"),
            Map.entry("Met", "M"), Map.entry("Phe", "F"), Map.entry("Pro", "P"), Map.entry("Ser", "S"),
            Map.entry("Thr", "T"), Map.entry("Trp", "W"), Map.entry("Tyr", "Y"), Map.entry("Val", "V"),
            Map.entry("Ter", "*"), Map.entry("Sec", "U"), Map.entry("Pyl", "O"));

    private static final Pattern THREE_LETTER = Pattern.compile("[A-Z][a-z]{2}");

    private ProteinChange() {
    }

    public static String normalize(String hgvsP) {
        if (hgvsP == null) {
            return null;
        }
        String value = hgvsP.strip();
        if (value.regionMatches(true, 0, "p.", 0, 2)) {
            value = value.substring(2);
        }
        if (value.startsWith("(") && value.endsWith(")")) {
            value = value.substring(1, value.length() - 1);
        }
        Matcher matcher = THREE_LETTER.matcher(value);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String replacement = THREE_TO_ONE.getOrDefault(matcher.group(), matcher.group());
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        String normalized = out.toString().strip();
        return normalized.isEmpty() ? null : normalized;
    }

    /** Forma de tres letras para buscar en fuentes que la usan (p. ej. títulos de ClinVar). Sólo cambios simples. */
    public static String toThreeLetter(String normalized) {
        if (normalized == null) {
            return null;
        }
        Matcher simple = Pattern.compile("^([A-Z*])(\\d+)([A-Z*])$").matcher(normalized);
        if (!simple.matches()) {
            return null;
        }
        return threeOf(simple.group(1)) + simple.group(2) + threeOf(simple.group(3));
    }

    private static String threeOf(String one) {
        return THREE_TO_ONE.entrySet().stream().filter(e -> e.getValue().equals(one)).map(Map.Entry::getKey)
                .findFirst().orElse(one);
    }
}
