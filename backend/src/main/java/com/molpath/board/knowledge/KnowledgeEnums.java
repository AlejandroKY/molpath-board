package com.molpath.board.knowledge;

public final class KnowledgeEnums {

    private KnowledgeEnums() {
    }

    public enum EvidenceType { ONCOGENIC, FUNCTIONAL, DIAGNOSTIC, PROGNOSTIC, PREDICTIVE, THERAPEUTIC, PREDISPOSITION }

    /** Escala de incertidumbre de MolPath. Nunca se infiere: ver {@link CertaintyBasis}. */
    public enum Certainty { STRONG, MODERATE, LIMITED, CONTRADICTORY, INSUFFICIENT, UNKNOWN }

    /** De dónde procede la certeza: regla de mapeo documentada, asignación explícita del usuario o ninguna. */
    public enum CertaintyBasis { SOURCE_MAPPING, USER_ASSIGNED, NONE }

    /** Separa interpretación germinal de somática/oncológica. */
    public enum InterpretationScope { SOMATIC, GERMLINE, NOT_APPLICABLE }

    /** Una evidencia retirada o sustituida no se borra: se marca y se conserva. */
    public enum EvidenceStatus { ACTIVE, WITHDRAWN, SUPERSEDED }

    public static final class SourceCodes {
        public static final String PUBMED = "PUBMED";
        public static final String CIVIC = "CIVIC";
        public static final String CLINVAR = "CLINVAR";
        public static final String ONCOKB = "ONCOKB";
        public static final String REACTOME = "REACTOME";
        public static final String NCBI_GENE = "NCBI_GENE";
        public static final String MANUAL = "MANUAL";

        private SourceCodes() {
        }
    }
}
