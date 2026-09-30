package com.molpath.board.molecular;

public final class MolecularEnums {

    private MolecularEnums() {
    }

    public enum MolecularTestType { NGS_DNA, NGS_RNA, PCR, FISH, SANGER, RNA_SEQ, OTHER }

    public enum VariantType { SNV, INDEL, CNV, FUSION, STRUCTURAL }

    public enum VariantOrigin { SOMATIC, GERMLINE, UNKNOWN }

    /** Tipos preparados para la evolución del modelo (TMB, MSI, HRD, firmas, expresión). */
    public enum BiomarkerType { TMB, MSI, HRD, MUTATIONAL_SIGNATURE, RNA_EXPRESSION, OTHER }
}
