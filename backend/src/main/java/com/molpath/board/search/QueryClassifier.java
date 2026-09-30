package com.molpath.board.search;

import com.molpath.board.molecular.ProteinChange;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Determina qué tipo(s) de entidad busca el usuario:
 * <ul>
 *   <li>{@code PMID: 12345678} o sólo dígitos → PMID</li>
 *   <li>{@code EGFR L858R}, {@code BRAF p.Val600Glu}, {@code KRAS c.35G>A} → variante (+ gen)</li>
 *   <li>un símbolo ({@code TP53}, {@code TTF-1}, {@code PD-L1}, {@code DEMO-001}) → gen, marcador IHQ, biomarcador, caso</li>
 *   <li>texto libre ({@code adenocarcinoma pulmonar}) → tumor, órgano, caso, pathway, evidencia</li>
 * </ul>
 */
public final class QueryClassifier {

    public enum EntityKind { PMID, VARIANT, GENE, IHC_MARKER, BIOMARKER, CASE, TUMOR, PATHWAY, EVIDENCE }

    public record ClassifiedQuery(String normalized, List<EntityKind> kinds, String geneSymbol, String proteinChange,
            String hgvsC, String pmid) {}

    private static final Pattern PMID = Pattern.compile("^(?:PMID\\s*:?\\s*)?(\\d{1,9})$", Pattern.CASE_INSENSITIVE);
    private static final Pattern SYMBOL = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9.-]{0,19}$");
    private static final Pattern PROTEIN = Pattern.compile("^(?:p\\.)?\\(?[A-Z](?:[a-z]{2})?\\d+[A-Za-z*_]*\\d*[A-Za-z*]*\\)?$");
    private static final Pattern CDNA = Pattern.compile("^c\\.\\S+$");

    private QueryClassifier() {
    }

    public static ClassifiedQuery classify(String raw) {
        String q = raw == null ? "" : raw.strip().replaceAll("\\s+", " ");
        if (q.isEmpty()) {
            return new ClassifiedQuery(q, List.of(), null, null, null, null);
        }
        Matcher pmid = PMID.matcher(q);
        if (pmid.matches()) {
            return new ClassifiedQuery(q, List.of(EntityKind.PMID), null, null, null, pmid.group(1));
        }
        String[] tokens = q.split(" ");
        if (tokens.length == 2 && SYMBOL.matcher(tokens[0]).matches() && hasLetter(tokens[0])) {
            String gene = tokens[0].toUpperCase(Locale.ROOT);
            if (PROTEIN.matcher(tokens[1]).matches()) {
                return new ClassifiedQuery(q, List.of(EntityKind.VARIANT, EntityKind.GENE), gene,
                        ProteinChange.normalize(tokens[1]), null, null);
            }
            if (CDNA.matcher(tokens[1]).matches()) {
                return new ClassifiedQuery(q, List.of(EntityKind.VARIANT, EntityKind.GENE), gene, null, tokens[1],
                        null);
            }
        }
        if (tokens.length == 1 && SYMBOL.matcher(q).matches() && hasLetter(q)) {
            return new ClassifiedQuery(q, List.of(EntityKind.GENE, EntityKind.IHC_MARKER, EntityKind.BIOMARKER,
                    EntityKind.CASE, EntityKind.PATHWAY), q.toUpperCase(Locale.ROOT), null, null, null);
        }
        return new ClassifiedQuery(q, List.of(EntityKind.TUMOR, EntityKind.CASE, EntityKind.IHC_MARKER,
                EntityKind.BIOMARKER, EntityKind.PATHWAY, EntityKind.EVIDENCE), null, null, null, null);
    }

    private static boolean hasLetter(String s) {
        return s.chars().anyMatch(Character::isLetter);
    }
}
