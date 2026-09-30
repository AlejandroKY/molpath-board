import type {
  BiomarkerType,
  Certainty,
  CertaintyBasis,
  EvidenceStatus,
  EvidenceType,
  IhcIntensity,
  IhcResultValue,
  InterpretationScope,
  MolecularTestType,
  NucleicAcidQuality,
  SampleType,
  TargetType,
  TimelineEventType,
  UserRole,
  VariantOrigin,
  VariantType,
} from './types';

export const ROLE_LABEL: Record<UserRole, string> = {
  PATHOLOGY: 'Patología',
  MOLECULAR_BIOLOGY: 'Biología Molecular',
  ONCOLOGY: 'Oncología',
  GENETICS: 'Genética',
  BIOINFORMATICS: 'Bioinformática',
  RESEARCHER: 'Investigador',
  ADMIN: 'Administrador',
};

/** Roles que pueden editar datos clínicos del caso (mismo criterio que el backend). */
export const CLINICAL_EDITOR_ROLES: UserRole[] = ['PATHOLOGY', 'MOLECULAR_BIOLOGY', 'GENETICS', 'BIOINFORMATICS', 'ADMIN'];

export const SAMPLE_TYPE_LABEL: Record<SampleType, string> = {
  BIOPSY: 'Biopsia',
  RESECTION: 'Pieza quirúrgica',
  CYTOLOGY: 'Citología',
  CELL_BLOCK: 'Bloque celular',
  LIQUID_BIOPSY: 'Biopsia líquida',
  BONE_MARROW: 'Médula ósea',
  OTHER: 'Otra',
};

export const QUALITY_LABEL: Record<NucleicAcidQuality, string> = {
  GOOD: 'Buena',
  ACCEPTABLE: 'Aceptable',
  POOR: 'Baja',
  FAILED: 'Fallida',
  NOT_ASSESSED: 'No evaluada',
};

export const IHC_RESULT_LABEL: Record<IhcResultValue, string> = {
  POSITIVE: 'Positivo',
  NEGATIVE: 'Negativo',
  EQUIVOCAL: 'Equívoco',
  NOT_EVALUABLE: 'No evaluable',
};

export const IHC_INTENSITY_LABEL: Record<IhcIntensity, string> = {
  NONE: 'Ausente',
  WEAK: 'Débil',
  MODERATE: 'Moderada',
  STRONG: 'Intensa',
  HETEROGENEOUS: 'Heterogénea',
};

export const TEST_TYPE_LABEL: Record<MolecularTestType, string> = {
  NGS_DNA: 'NGS ADN',
  NGS_RNA: 'NGS ARN',
  PCR: 'PCR',
  FISH: 'FISH',
  SANGER: 'Sanger',
  RNA_SEQ: 'RNA-seq',
  OTHER: 'Otro',
};

export const VARIANT_TYPE_LABEL: Record<VariantType, string> = {
  SNV: 'SNV',
  INDEL: 'Indel',
  CNV: 'CNV',
  FUSION: 'Fusión',
  STRUCTURAL: 'Estructural',
};

export const ORIGIN_LABEL: Record<VariantOrigin, string> = {
  SOMATIC: 'Somática',
  GERMLINE: 'Germinal',
  UNKNOWN: 'Origen no determinado',
};

export const BIOMARKER_TYPE_LABEL: Record<BiomarkerType, string> = {
  TMB: 'TMB',
  MSI: 'MSI',
  HRD: 'HRD',
  MUTATIONAL_SIGNATURE: 'Firma mutacional',
  RNA_EXPRESSION: 'Expresión ARN',
  OTHER: 'Otro',
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  ONCOGENIC: 'Oncogénica',
  FUNCTIONAL: 'Funcional',
  DIAGNOSTIC: 'Diagnóstica',
  PROGNOSTIC: 'Pronóstica',
  PREDICTIVE: 'Predictiva',
  THERAPEUTIC: 'Terapéutica',
  PREDISPOSITION: 'Predisposición',
};

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  STRONG: 'Evidencia fuerte',
  MODERATE: 'Evidencia moderada',
  LIMITED: 'Evidencia limitada',
  CONTRADICTORY: 'Evidencia contradictoria',
  INSUFFICIENT: 'Evidencia insuficiente',
  UNKNOWN: 'Desconocido',
};

export const CERTAINTY_SHORT: Record<Certainty, string> = {
  STRONG: 'Fuerte',
  MODERATE: 'Moderada',
  LIMITED: 'Limitada',
  CONTRADICTORY: 'Contradictoria',
  INSUFFICIENT: 'Insuficiente',
  UNKNOWN: 'Desconocida',
};

/** Símbolo por nivel de certeza: la incertidumbre nunca se comunica sólo con color. */
export const CERTAINTY_SYMBOL: Record<Certainty, string> = {
  STRONG: '●',
  MODERATE: '◐',
  LIMITED: '△',
  CONTRADICTORY: '⇄',
  INSUFFICIENT: '○',
  UNKNOWN: '?',
};

export const CERTAINTY_ORDER: Certainty[] = ['STRONG', 'MODERATE', 'LIMITED', 'CONTRADICTORY', 'INSUFFICIENT', 'UNKNOWN'];

export const BASIS_LABEL: Record<CertaintyBasis, string> = {
  SOURCE_MAPPING: 'Mapeada desde la fuente (regla documentada)',
  USER_ASSIGNED: 'Asignada explícitamente por un usuario',
  NONE: 'Sin clasificar',
};

export const SCOPE_LABEL: Record<InterpretationScope, string> = {
  SOMATIC: 'Somática / oncológica',
  GERMLINE: 'Germinal',
  NOT_APPLICABLE: 'No aplica',
};

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  ACTIVE: 'Vigente',
  WITHDRAWN: 'Retirada',
  SUPERSEDED: 'Sustituida',
};

export const TARGET_LABEL: Record<TargetType, string> = {
  CASE: 'Caso',
  SAMPLE: 'Muestra',
  HISTOLOGY: 'Histología',
  IHC: 'IHQ',
  MOLECULAR_TEST: 'Estudio molecular',
  VARIANT: 'Variante',
  BIOMARKER: 'Biomarcador',
  EVIDENCE: 'Evidencia',
  GENE: 'Gen',
  PATHWAY: 'Pathway',
  PUBLICATION: 'Publicación',
  INTERPRETATION: 'Interpretación',
  GRAPH_NODE: 'Nodo del grafo',
};

export const EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  DIAGNOSIS: 'Diagnóstico',
  INITIAL_BIOPSY: 'Biopsia inicial',
  SURGERY: 'Cirugía',
  REBIOPSY: 'Nueva biopsia',
  PROGRESSION: 'Progresión',
  RECURRENCE: 'Recurrencia',
  METASTASIS: 'Metástasis',
  MOLECULAR_STUDY: 'Nuevo estudio molecular',
  NEW_BIOMARKER: 'Nuevo biomarcador',
  OTHER: 'Otro',
};

export const SOURCE_LABEL: Record<string, string> = {
  CIVIC: 'CIViC',
  CLINVAR: 'ClinVar',
  PUBMED: 'PubMed',
  REACTOME: 'Reactome',
  ONCOKB: 'OncoKB',
  NCBI_GENE: 'NCBI Gene',
  MANUAL: 'Registro manual',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Number(value).toLocaleString('es', { maximumFractionDigits: 2 })}%`;
}

export function variantLabel(v: { geneSymbol: string; hgvsP: string | null; hgvsC: string | null; variantType: VariantType; fusionPartnerSymbol?: string | null; copyNumber?: number | null }): string {
  if (v.variantType === 'FUSION' && v.fusionPartnerSymbol) return `${v.geneSymbol}::${v.fusionPartnerSymbol}`;
  if (v.hgvsP) return `${v.geneSymbol} ${v.hgvsP}`;
  if (v.hgvsC) return `${v.geneSymbol} ${v.hgvsC}`;
  if (v.variantType === 'CNV') return `${v.geneSymbol} CNV${v.copyNumber != null ? ` (${v.copyNumber} copias)` : ''}`;
  return `${v.geneSymbol} ${VARIANT_TYPE_LABEL[v.variantType]}`;
}
