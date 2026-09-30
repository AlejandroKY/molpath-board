package com.molpath.board.sample;

public final class SampleEnums {

    private SampleEnums() {
    }

    public enum SampleType { BIOPSY, RESECTION, CYTOLOGY, CELL_BLOCK, LIQUID_BIOPSY, BONE_MARROW, OTHER }

    public enum NucleicAcidQuality { GOOD, ACCEPTABLE, POOR, FAILED, NOT_ASSESSED }

    /** Resultado registrado por el usuario. MolPath no lo interpreta como diagnóstico. */
    public enum IhcResultValue { POSITIVE, NEGATIVE, EQUIVOCAL, NOT_EVALUABLE }

    public enum IhcIntensity { NONE, WEAK, MODERATE, STRONG, HETEROGENEOUS }
}
